import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { actions, type Item } from "../lib/store";
import { analyze, capacity, generateFlashcards, generateQuestions, testable, type Analysis, type QuestionType } from "../lib/generate";
import type { ExtractProgress } from "../lib/extract";
import { Button, Group, IconTile, PageHeader, Row, Segmented, Stepper, Switch } from "../components/ui";
import { I, type ColorKey, type DeckIconKey } from "../components/icons";
import { toast } from "../components/Toaster";
import { confetti, feedback } from "../lib/feedback";
import { spring } from "../lib/motion";
import { cn } from "../lib/utils";

const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.tsv,.html,.htm,.png,.jpg,.jpeg,.webp,.bmp";
const MIN_WORDS = 40;

type Phase =
  | { kind: "pick" }
  | { kind: "working"; name: string; progress: ExtractProgress }
  | { kind: "review"; name: string; analysis: Analysis; pages: number; usedOcr: boolean; skippedPages: number }
  | { kind: "error"; name?: string; message: string; hint?: string };

type Output = "cards" | "quiz" | "exam";

const TYPE_LABELS: Record<QuestionType, string> = { mcq: "Multiple choice", tf: "True or false", fill: "Fill in the blank" };

/** Pick a fitting deck icon from the document's title and key terms. */
function guessIcon(a: Analysis): DeckIconKey {
  const hay = `${a.title} ${a.terms.slice(0, 20).map((t) => t.text).join(" ")}`.toLowerCase();
  const map: [RegExp, DeckIconKey][] = [
    [/cell|dna|gene|biolog|organism|protein|enzyme/, "biology"],
    [/atom|physic|force|energy|quantum|electr/, "physics"],
    [/chemi|molecul|reaction|acid|compound/, "science"],
    [/histor|war|empire|century|revolution/, "history"],
    [/math|equation|algebra|calculus|theorem|geometry/, "math"],
    [/code|program|software|algorithm|javascript|python|data structure/, "code"],
    [/law|legal|court|constitution|contract/, "law"],
    [/health|medic|disease|anatomy|patient|nurs/, "health"],
    [/econom|market|finance|business|account/, "data"],
    [/language|grammar|vocabular|translat/, "language"],
    [/art|design|paint|music/, "art"],
    [/planet|space|star|galaxy|orbit/, "space"],
    [/plant|ecolog|environment|climate/, "nature"],
  ];
  return map.find(([re]) => re.test(hay))?.[1] ?? "book";
}

function stageLabel(p: ExtractProgress) {
  if (p.stage === "loading-ocr") return "Preparing text recognition…";
  if (p.stage === "ocr") return p.pages && p.pages > 1 ? `Recognizing text on page ${p.page} of ${p.pages}` : "Recognizing text";
  return p.pages ? `Reading page ${p.page} of ${p.pages}` : "Reading file";
}

function Preview({ items, onRemove }: { items: Item[]; onRemove: (id: string) => void }) {
  if (!items.length) return <p className="t-subhead text-ink-2 px-4 py-6 text-center">Nothing to show with these settings.</p>;
  return (
    <ul className="grouped">
      <AnimatePresence initial={false}>
        {items.map((it, i) => (
          <motion.li key={it.id} layout exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }} className="flex gap-3 px-4 py-3">
            <span className="t-footnote t-num text-ink-3 w-6 shrink-0 pt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="t-subhead text-ink">{it.prompt}</p>
              {it.options ? (
                <p className="t-footnote text-ink-2 mt-1">
                  {it.options.map((o, k) => (
                    <span key={k} className={cn(k === it.correctIndex && "text-green font-semibold")}>
                      {k > 0 && " · "}
                      {o}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="t-footnote text-green font-medium mt-1">{it.answer}</p>
              )}
            </div>
            <button type="button" onClick={() => onRemove(it.id)} aria-label="Remove this item" className="btn w-8 h-8 shrink-0 text-ink-3 hover:text-red hover:bg-red/10">
              <I.x className="w-3.5 h-3.5" aria-hidden />
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function Import() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const signal = useRef({ aborted: false });
  const fileInput = useRef<HTMLInputElement>(null);

  // Review options
  const [title, setTitle] = useState("");
  const [outputs, setOutputs] = useState<Record<Output, boolean>>({ cards: true, quiz: true, exam: true });
  const [counts, setCounts] = useState({ cards: 20, quiz: 15, exam: 20 });
  const [examMinutes, setExamMinutes] = useState(20);
  const [types, setTypes] = useState<QuestionType[]>(["mcq", "tf", "fill"]);
  const [seed, setSeed] = useState(0);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Output>("cards");
  const [creating, setCreating] = useState(false);

  const analysis = phase.kind === "review" ? phase.analysis : null;
  const cap = useMemo(() => (analysis ? capacity(analysis, types) : { flashcards: 0, questions: 0, quiz: 0 }), [analysis, types]);

  // Keep requested counts within what the document supports as question types change.
  useEffect(() => {
    if (!analysis) return;
    setCounts((c) => ({ cards: Math.min(c.cards, Math.max(1, cap.flashcards)), quiz: Math.min(c.quiz, Math.max(1, cap.quiz)), exam: Math.min(c.exam, Math.max(1, cap.questions)) }));
  }, [cap, analysis]);

  const generated = useMemo(() => {
    if (!analysis) return { cards: [], quiz: [], exam: [] };
    void seed; // regenerate on demand
    const quizTypes = types.filter((t) => t !== "fill");
    return {
      cards: generateFlashcards(analysis, counts.cards),
      quiz: generateQuestions(analysis, counts.quiz, quizTypes.length ? quizTypes : ["mcq"]),
      exam: generateQuestions(analysis, counts.exam, types.length ? types : ["mcq"]),
    };
  }, [analysis, counts, types, seed]);

  const visible = (o: Output) => generated[o].filter((it) => !removed.has(it.id));

  const load = async (file: File) => {
    signal.current = { aborted: false };
    setPhase({ kind: "working", name: file.name, progress: { stage: "reading" } });
    try {
      const { extractText, ExtractError } = await import("../lib/extract");
      try {
        const res = await extractText(file, (progress) => setPhase((p) => (p.kind === "working" ? { ...p, progress } : p)), signal.current);
        finish(res.text, file.name, res.pages, res.usedOcr, res.skippedPages);
      } catch (err) {
        if (signal.current.aborted) return setPhase({ kind: "pick" });
        if (err instanceof ExtractError) setPhase({ kind: "error", name: file.name, message: err.message, hint: err.hint });
        else setPhase({ kind: "error", name: file.name, message: "Something went wrong while reading this file.", hint: "Try again, or save it in a different format." });
      }
    } catch {
      setPhase({ kind: "error", name: file.name, message: "The document reader couldn't load.", hint: "Check your connection and reload the page." });
    }
  };

  const finish = (text: string, name: string, pages: number, usedOcr: boolean, skippedPages: number) => {
    // Let the progress UI paint before the (synchronous) analysis runs.
    setTimeout(() => {
      const a = analyze(text, name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
      if (a.words < MIN_WORDS || (a.sentences.length < 3 && a.definitions.length < 2)) {
        setPhase({
          kind: "error",
          name,
          message: usedOcr ? "We couldn't read enough text from this scan." : "There isn't enough text here to study from.",
          hint: usedOcr ? "Try a sharper, well-lit photo taken straight on, or a PDF with selectable text." : "Use a longer document: a few paragraphs or more works best.",
        });
        return;
      }
      const c = capacity(a, types);
      setTitle(a.title);
      setCounts({ cards: Math.max(1, Math.min(30, c.flashcards)), quiz: Math.max(1, Math.min(20, c.quiz)), exam: Math.max(1, Math.min(30, c.questions)) });
      setExamMinutes(Math.max(5, Math.min(90, Math.round(Math.min(25, c.questions) * 1.2))));
      setRemoved(new Set());
      setOutputs({ cards: c.flashcards > 0, quiz: c.quiz > 0, exam: c.questions >= 3 });
      setTab(c.flashcards > 0 ? "cards" : "quiz");
      setPhase({ kind: "review", name, analysis: a, pages, usedOcr, skippedPages });
      feedback("complete");
    }, 30);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void load(file);
  };

  // Paste a file from the clipboard anywhere on the pick screen.
  useEffect(() => {
    if (phase.kind !== "pick") return;
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) {
        e.preventDefault();
        void load(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind]);

  const toggleType = (t: QuestionType) => setTypes((ts) => (ts.includes(t) ? (ts.length > 1 ? ts.filter((x) => x !== t) : ts) : [...ts, t]));

  const create = () => {
    if (phase.kind !== "review") return;
    setCreating(true);
    const base = title.trim() || phase.analysis.title;
    const icon = guessIcon(phase.analysis);
    const color: ColorKey = (["blue", "indigo", "purple", "teal", "orange", "green", "pink"] as ColorKey[])[Math.floor(Math.random() * 7)];
    const source = { name: phase.name, pages: phase.pages, words: phase.analysis.words };
    const made: { id: string; kind: Output }[] = [];
    const plan: [Output, string][] = [
      ["cards", "Flashcards"],
      ["quiz", "Quiz"],
      ["exam", "Exam"],
    ];
    for (const [o, label] of plan) {
      const items = visible(o);
      if (!outputs[o] || !items.length) continue;
      const deck = actions.createDeck({
        title: `${base} · ${label}`,
        description: `Generated from ${phase.name}`,
        icon,
        color,
        items,
        source,
        examMinutes: o === "exam" ? examMinutes : undefined,
      });
      made.push({ id: deck.id, kind: o });
    }
    setCreating(false);
    if (!made.length) {
      toast.error("Nothing selected to create", { description: "Turn on at least one of Flashcards, Quiz or Exam." });
      return;
    }
    confetti({ y: 0.3, count: 90 });
    toast.success(`Created ${made.length} ${made.length === 1 ? "deck" : "decks"}`, { description: `From ${phase.name}` });
    const first = made[0];
    navigate(made.length === 1 && first.kind === "exam" ? `/study/${first.id}/exam` : `/deck/${first.id}`);
  };

  const totalSelected = (["cards", "quiz", "exam"] as Output[]).filter((o) => outputs[o] && visible(o).length).length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-32">
      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === "pick" && (
          <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring}>
            <PageHeader title="Scan a document" subtitle="Turn lecture notes, a textbook chapter or a photo of your notes into flashcards, a quiz and a timed exam." />

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "group relative flex flex-col items-center text-center gap-3 px-6 py-12 rounded-[4px] card cursor-pointer transition-[box-shadow,background-color] duration-200",
                "focus-within:shadow-[0_0_0_2px_var(--c-bg),0_0_0_4px_var(--c-accent)]",
                dragging ? "bg-accent/8 shadow-[0_0_0_2px_var(--c-accent)]" : "hover:bg-fill/40"
              )}
            >
              <motion.span animate={{ y: dragging ? -6 : 0, scale: dragging ? 1.06 : 1 }} transition={spring}>
                <IconTile icon={I.upload} color="blue" size={64} />
              </motion.span>
              <span className="t-title3 text-ink mt-1">{dragging ? "Drop to scan" : "Drop a file, or click to browse"}</span>
              <span className="t-subhead text-ink-2">PDF, Word (.docx), text, or a photo of your notes. Up to 30 MB.</span>
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void load(f);
                }}
              />
            </label>
            <p className="flex items-center justify-center gap-1.5 t-footnote text-ink-2 mt-3">
              <I.lock className="w-3.5 h-3.5" aria-hidden /> Files are read on this device. Nothing is uploaded.
            </p>

            <Group header="Or paste text" className="mt-8" footer={pasted.trim() ? `${pasted.trim().split(/\s+/).length} words${pasted.trim().split(/\s+/).length < MIN_WORDS ? ` · at least ${MIN_WORDS} needed` : ""}` : "Paste notes, an article or a transcript."}>
              <div className="p-3">
                <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder="Paste your notes here" aria-label="Text to scan" className="field px-3.5 py-3 t-body resize-y bg-transparent hover:bg-transparent" />
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="tinted" disabled={pasted.trim().split(/\s+/).length < MIN_WORDS} onClick={() => finish(pasted, "Pasted notes", 1, false, 0)}>
                    Use this text
                  </Button>
                </div>
              </div>
            </Group>
          </motion.div>
        )}

        {phase.kind === "working" && (
          <motion.div key="working" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={spring} className="pt-16 text-center" role="status" aria-live="polite">
            <motion.span className="inline-block" animate={{ y: [0, -4, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
              <IconTile icon={phase.progress.stage === "reading" ? I.document : I.scan} color={phase.progress.stage === "reading" ? "blue" : "purple"} size={64} />
            </motion.span>
            <h1 className="t-title1 text-ink mt-6 truncate">{phase.name}</h1>
            <p className="t-subhead text-ink-2 mt-1.5">{stageLabel(phase.progress)}</p>
            <div className="max-w-xs mx-auto mt-6 h-1.5 rounded-full bg-fill overflow-hidden">
              {phase.progress.progress !== undefined ? (
                <div className="h-full w-full rounded-full bg-accent origin-left transition-transform duration-300 ease-out" style={{ transform: `scaleX(${Math.max(0.03, phase.progress.progress)})` }} />
              ) : (
                <motion.div className="h-full w-1/3 rounded-full bg-accent" animate={{ x: ["-100%", "300%"] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
              )}
            </div>
            {phase.progress.stage === "loading-ocr" && <p className="t-footnote text-ink-2 mt-4 max-w-sm mx-auto">This file looks scanned. The first scan downloads a text reader, about 10 MB.</p>}
            <Button
              variant="gray"
              className="mt-8"
              onClick={() => {
                signal.current.aborted = true;
                setPhase({ kind: "pick" });
              }}
            >
              Cancel
            </Button>
          </motion.div>
        )}

        {phase.kind === "error" && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="pt-16 text-center" role="alert">
            <IconTile icon={I.warning} color="orange" size={64} className="mx-auto" />
            <h1 className="t-title1 text-ink mt-6">{phase.message}</h1>
            {phase.hint && <p className="t-body text-ink-2 mt-2 max-w-md mx-auto">{phase.hint}</p>}
            {phase.name && <p className="t-footnote text-ink-3 mt-3 truncate">{phase.name}</p>}
            <div className="flex justify-center gap-2 mt-8">
              <Button
                icon={I.upload}
                onClick={() => {
                  setPhase({ kind: "pick" });
                  requestAnimationFrame(() => fileInput.current?.click());
                }}
              >
                Choose another file
              </Button>
            </div>
          </motion.div>
        )}

        {phase.kind === "review" && analysis && (
          <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
            <div className="flex items-center justify-between h-11 mb-2">
              <button type="button" onClick={() => setPhase({ kind: "pick" })} className="btn btn-plain -ml-1 gap-0.5 t-body">
                <I.back className="w-6 h-6" aria-hidden /> Start over
              </button>
            </div>
            <label className="block">
              <span className="sr-only">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent outline-none t-large text-ink rounded-lg focus-visible:bg-fill px-1 -mx-1" />
            </label>
            <p className="t-subhead text-ink-2 mt-1">
              {phase.name} · {phase.pages > 1 ? `${phase.pages} pages · ` : ""}
              {analysis.words.toLocaleString()} words
              {phase.usedOcr ? " · read from scanned pages" : ""}
            </p>
            {phase.skippedPages > 0 && (
              <p className="t-footnote text-orange mt-2 flex gap-1.5">
                <I.warning className="w-4 h-4 shrink-0" aria-hidden /> Only the first 25 scanned pages were read ({phase.skippedPages} skipped). Split long scans for full coverage.
              </p>
            )}

            {analysis.terms.some(testable) && (
              <div className="mt-6">
                <p className="t-footnote font-medium text-ink-2 mb-2">Key terms found</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.terms.filter(testable).slice(0, 14).map((t) => (
                    <span key={t.key} className="h-7 px-2.5 inline-flex items-center rounded-full bg-fill t-footnote text-ink">
                      {t.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-7 mt-8">
              <Group header="Create" footer={`This document supports up to ${cap.flashcards} flashcards and ${cap.questions} exam questions. Longer documents give more.`}>
                <Row
                  icon={I.cards}
                  color="orange"
                  title="Flashcards"
                  subtitle={`${visible("cards").length} cards`}
                  trailing={
                    <div className="flex items-center gap-3">
                      <Stepper label="flashcards" value={counts.cards} min={1} max={Math.max(1, cap.flashcards)} onChange={(v) => setCounts((c) => ({ ...c, cards: v }))} disabled={!outputs.cards || cap.flashcards === 0} />
                      <Switch label="Create flashcards" checked={outputs.cards} disabled={cap.flashcards === 0} onChange={(v) => setOutputs((o) => ({ ...o, cards: v }))} />
                    </div>
                  }
                />
                <Row
                  icon={I.review}
                  color="indigo"
                  title="Practice quiz"
                  subtitle={`${visible("quiz").length} questions with instant feedback`}
                  trailing={
                    <div className="flex items-center gap-3">
                      <Stepper label="quiz questions" value={counts.quiz} min={1} max={Math.max(1, cap.quiz)} onChange={(v) => setCounts((c) => ({ ...c, quiz: v }))} disabled={!outputs.quiz || cap.quiz === 0} />
                      <Switch label="Create a practice quiz" checked={outputs.quiz} disabled={cap.quiz === 0} onChange={(v) => setOutputs((o) => ({ ...o, quiz: v }))} />
                    </div>
                  }
                />
                <Row
                  icon={I.cap}
                  color="red"
                  title="Timed exam"
                  subtitle={`${visible("exam").length} questions · ${examMinutes} min`}
                  trailing={
                    <div className="flex items-center gap-3">
                      <Stepper label="exam questions" value={counts.exam} min={1} max={Math.max(1, cap.questions)} onChange={(v) => setCounts((c) => ({ ...c, exam: v }))} disabled={!outputs.exam || cap.questions === 0} />
                      <Switch label="Create a timed exam" checked={outputs.exam} disabled={cap.questions === 0} onChange={(v) => setOutputs((o) => ({ ...o, exam: v }))} />
                    </div>
                  }
                />
                {outputs.exam && <Row icon={I.alarm} color="pink" title="Exam time limit" trailing={<Stepper label="minutes" value={examMinutes} min={5} max={180} step={5} onChange={setExamMinutes} />} />}
              </Group>

              <section>
                <p className="t-footnote font-medium text-ink-2 px-4 mb-2">Question types</p>
                <div className="flex flex-wrap gap-2 px-1">
                  {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => {
                    const on = types.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleType(t)}
                        className={cn("btn h-9 px-3.5 gap-1.5 t-subhead", on ? "btn-tinted" : "btn-gray text-ink-2")}
                      >
                        {on && <I.check className="w-3.5 h-3.5" aria-hidden />}
                        {TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
                <p className="t-footnote text-ink-2 px-4 mt-2">Fill in the blank appears in the exam; the practice quiz uses choices.</p>
              </section>

              <section>
                <div className="flex items-center justify-between gap-3 mb-3 px-1">
                  <Segmented<Output>
                    value={tab}
                    onChange={setTab}
                    label="Preview"
                    options={[
                      { value: "cards", label: `Cards ${visible("cards").length}` },
                      { value: "quiz", label: `Quiz ${visible("quiz").length}` },
                      { value: "exam", label: `Exam ${visible("exam").length}` },
                    ]}
                  />
                  <Button
                    variant="plain"
                    icon={I.shuffle}
                    onClick={() => {
                      setSeed((s) => s + 1);
                      setRemoved(new Set());
                    }}
                  >
                    Shuffle
                  </Button>
                </div>
                <Preview items={visible(tab)} onRemove={(id) => setRemoved((r) => new Set(r).add(id))} />
              </section>
            </div>

            {/* Action bar */}
            <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 z-30 material border-t-[1.5px] border-rule">
              <div className="max-w-2xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
                <p className="t-footnote text-ink-2 min-w-0 truncate">{totalSelected ? `${totalSelected} ${totalSelected === 1 ? "deck" : "decks"} will be added to your library` : "Nothing selected"}</p>
                <Button onClick={create} loading={creating} disabled={!totalSelected} icon={I.check}>
                  Create
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
