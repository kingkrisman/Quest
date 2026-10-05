import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, Reorder, useDragControls } from "motion/react";
import { actions, uid, useStore, type Item } from "../lib/store";
import { blankItem, blankQuestion, isQuizDeck, parseImport } from "../lib/deck";
import { Button, DeckTile, Dialog, Kbd, Segmented } from "../components/ui";
import { COLORS, DECK_ICONS, I, colorVar, type ColorKey, type DeckIconKey } from "../components/icons";
import { toast } from "../components/Toaster";
import { confetti } from "../lib/feedback";
import { spring } from "../lib/motion";
import { cn } from "../lib/utils";

type Kind = "cards" | "quiz";
const DRAFT_KEY = "kawe:draft";
const ICON_KEYS = Object.keys(DECK_ICONS) as DeckIconKey[];
const PICKABLE_COLORS = COLORS.filter((c) => c !== "gray");

interface Draft {
  title: string;
  description: string;
  icon: DeckIconKey;
  color: ColorKey;
  kind: Kind;
  items: Item[];
}

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  icon: "book",
  color: PICKABLE_COLORS[Math.floor(Math.random() * PICKABLE_COLORS.length)],
  kind: "cards",
  items: [blankItem(), blankItem(), blankItem()],
});

function convert(items: Item[], to: Kind): Item[] {
  if (to === "quiz") return items.map((it) => (it.options ? it : { ...it, options: [it.answer, "", "", ""], correctIndex: 0 }));
  return items.map(({ options: _o, correctIndex: _c, ...rest }) => rest);
}

const fieldCls = "w-full bg-transparent outline-none resize-none placeholder:text-ink-3";

function ItemRow({
  item,
  index,
  kind,
  showErrors,
  onChange,
  onRemove,
  onDuplicate,
  autoFocus,
}: {
  item: Item;
  index: number;
  kind: Kind;
  showErrors: boolean;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  autoFocus: boolean;
}) {
  const controls = useDragControls();
  const promptMissing = showErrors && !item.prompt.trim();
  const answerMissing = showErrors && (kind === "quiz" ? (item.options ?? []).filter((o) => o.trim()).length < 2 : !item.answer.trim());

  const setOption = (i: number, v: string) => {
    const options = [...(item.options ?? [])];
    options[i] = v;
    onChange({ options, answer: options[item.correctIndex ?? 0] ?? "" });
  };

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
      transition={spring}
      whileDrag={{ scale: 1.02, boxShadow: "var(--shadow-float)" }}
      className="card rounded-[4px] overflow-hidden"
    >
      <div className="flex items-center gap-1 h-10 pl-2 pr-1.5 border-b border-line">
        <button onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder" className="touch-none cursor-grab active:cursor-grabbing p-1.5 rounded-md text-ink-3 hover:text-ink-2">
          <I.grip className="w-4 h-4" />
        </button>
        <span className="t-footnote font-semibold text-ink-2 tabular-nums">{index + 1}</span>
        <div className="ml-auto flex">
          <button onClick={onDuplicate} aria-label="Duplicate" className="press w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:bg-fill">
            <I.copy className="w-4 h-4" />
          </button>
          <button onClick={onRemove} aria-label="Delete" className="press w-8 h-8 grid place-items-center rounded-full text-red hover:bg-red/10">
            <I.trash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {kind === "cards" ? (
        <div className="grid sm:grid-cols-2 sm:divide-x divide-line">
          <label className={cn("block px-4 py-3 border-b sm:border-b-0 border-line", promptMissing && "bg-red/8")}>
            <span className="t-footnote font-medium text-ink-2">Term</span>
            <textarea autoFocus={autoFocus} rows={2} value={item.prompt} onChange={(e) => onChange({ prompt: e.target.value })} placeholder="Photosynthesis" className={cn(fieldCls, "t-headline mt-0.5")} />
          </label>
          <label className={cn("block px-4 py-3", answerMissing && "bg-red/8")}>
            <span className="t-footnote font-medium text-ink-2">Definition</span>
            <textarea rows={2} value={item.answer} onChange={(e) => onChange({ answer: e.target.value })} placeholder="How plants turn light into energy" className={cn(fieldCls, "t-body mt-0.5")} />
          </label>
        </div>
      ) : (
        <div>
          <label className={cn("block px-4 py-3 border-b border-line", promptMissing && "bg-red/8")}>
            <span className="t-footnote font-medium text-ink-2">Question</span>
            <textarea autoFocus={autoFocus} rows={2} value={item.prompt} onChange={(e) => onChange({ prompt: e.target.value })} placeholder="Ask something…" className={cn(fieldCls, "t-headline mt-0.5")} />
          </label>
          {(item.options ?? []).map((opt, oi) => {
            const correct = item.correctIndex === oi;
            return (
              <div key={oi} className={cn("flex items-center gap-3 pl-3 pr-4 border-b border-line", answerMissing && !opt.trim() && "bg-red/8")}>
                <button onClick={() => onChange({ correctIndex: oi, answer: opt })} aria-label={`Mark option ${oi + 1} correct`} className="press w-8 h-8 grid place-items-center shrink-0">
                  {correct ? <I.success className="w-6 h-6 text-green" /> : <span className="w-5.5 h-5.5 rounded-full border-[1.5px] border-ink-3" />}
                </button>
                <input value={opt} onChange={(e) => setOption(oi, e.target.value)} placeholder={`Option ${oi + 1}`} className={cn(fieldCls, "t-body h-11 min-w-0")} />
              </div>
            );
          })}
          <label className="flex items-center gap-3 pl-4 pr-4">
            <I.hint className="w-5 h-5 text-yellow shrink-0" />
            <input value={item.explanation ?? ""} onChange={(e) => onChange({ explanation: e.target.value })} placeholder="Explanation (optional)" className={cn(fieldCls, "t-subhead h-11")} />
          </label>
        </div>
      )}
    </Reorder.Item>
  );
}

export function CreateQuiz() {
  const { deckId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { decks } = useStore();
  const editing = deckId ? decks.find((d) => d.id === deckId) : undefined;

  const [draft, setDraft] = useState<Draft>(() => {
    if (editing) return { title: editing.title, description: editing.description, icon: editing.icon, color: editing.color, kind: isQuizDeck(editing) ? "quiz" : "cards", items: editing.items };
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved) as Draft;
        if (d.icon && d.color) return d;
      }
    } catch {
      /* ignore */
    }
    return emptyDraft();
  });
  const [showErrors, setShowErrors] = useState(false);
  const [importOpen, setImportOpen] = useState(params.get("import") === "1");
  const [importText, setImportText] = useState("");
  const [styleOpen, setStyleOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autosave new-deck drafts so nothing is lost on refresh.
  useEffect(() => {
    if (editing) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [draft, editing]);

  const preview = useMemo(() => (importText.trim() ? parseImport(importText) : null), [importText]);
  const patchItem = (id: string, patch: Partial<Item>) => setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));

  const addItem = () => {
    const it = draft.kind === "quiz" ? blankQuestion() : blankItem();
    setLastAdded(it.id);
    setDraft((d) => ({ ...d, items: [...d.items, it] }));
  };

  const removeItem = (id: string) => {
    const idx = draft.items.findIndex((i) => i.id === id);
    const removed = draft.items[idx];
    setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
    if (removed && (removed.prompt || removed.answer)) {
      toast.info("Item deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            setDraft((d) => {
              const items = [...d.items];
              items.splice(idx, 0, removed);
              return { ...d, items };
            }),
        },
      });
    }
  };

  const duplicateItem = (id: string) =>
    setDraft((d) => {
      const idx = d.items.findIndex((i) => i.id === id);
      const src = d.items[idx];
      const items = [...d.items];
      items.splice(idx + 1, 0, { ...src, id: uid(), options: src.options ? [...src.options] : undefined });
      return { ...d, items };
    });

  const setKind = (kind: Kind) => setDraft((d) => ({ ...d, kind, items: convert(d.items, kind) }));

  const applyImport = (mode: "append" | "replace") => {
    if (!preview || preview.items.length === 0) return;
    setDraft((d) => {
      const kind = preview.kind;
      const base = mode === "replace" ? [] : convert(d.items.filter((i) => i.prompt.trim() || i.answer.trim()), kind);
      return { ...d, kind, items: [...base, ...convert(preview.items, kind)] };
    });
    toast.success(`Imported ${preview.items.length} ${preview.kind === "quiz" ? "questions" : "cards"}`);
    setImportText("");
    setImportOpen(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", { description: "Text imports are limited to 2 MB." });
      return;
    }
    setImportText(await file.text());
    setImportOpen(true);
  };

  const save = () => {
    const items = draft.items
      .map((it) => (draft.kind === "quiz" && it.options ? { ...it, answer: it.options[it.correctIndex ?? 0] ?? "" } : it))
      .filter((it) => it.prompt.trim() || it.answer.trim() || it.options?.some((o) => o.trim()));

    const invalid = items.some((it) =>
      draft.kind === "quiz" ? !it.prompt.trim() || (it.options ?? []).filter((o) => o.trim()).length < 2 || !it.options?.[it.correctIndex ?? 0]?.trim() : !it.prompt.trim() || !it.answer.trim()
    );

    if (!draft.title.trim()) {
      setShowErrors(true);
      toast.error("Add a title");
      document.getElementById("deck-title")?.focus();
      return;
    }
    if (items.length === 0) {
      setShowErrors(true);
      toast.error("Add at least one item");
      return;
    }
    if (invalid) {
      setShowErrors(true);
      toast.error("Some items are incomplete", { description: draft.kind === "quiz" ? "Questions need text, two options, and a filled-in correct answer." : "Each card needs a term and a definition." });
      return;
    }

    const clean = items.map((it) => {
      if (draft.kind !== "quiz" || !it.options) return it;
      const correctText = it.options[it.correctIndex ?? 0];
      const options = it.options.filter((o) => o.trim());
      return { ...it, options, correctIndex: options.indexOf(correctText), answer: correctText };
    });

    const payload = { title: draft.title.trim(), description: draft.description.trim(), icon: draft.icon, color: draft.color, items: clean };
    if (editing) {
      actions.updateDeck(editing.id, payload);
      toast.success("Saved");
      navigate(`/deck/${editing.id}`);
    } else {
      const deck = actions.createDeck(payload);
      localStorage.removeItem(DRAFT_KEY);
      confetti({ y: 0.25, count: 70 });
      toast.success("Deck created", { description: `${clean.length} items ready to study.` });
      navigate(`/deck/${deck.id}`);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Enter") {
        e.preventDefault();
        addItem();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pb-16">
      {/* Nav bar */}
      <div className="sticky top-0 z-30 material border-b border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-8 h-12 grid grid-cols-[1fr_auto_1fr] items-center">
          <button onClick={() => navigate(-1)} className="justify-self-start t-body text-accent press">
            Cancel
          </button>
          <span className="t-headline text-ink">{editing ? "Edit Deck" : "New Deck"}</span>
          <button onClick={save} className="justify-self-end t-body font-semibold text-accent press">
            {editing ? "Done" : "Create"}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 pt-6">
        {/* Identity */}
        <div className="text-center">
          <button onClick={() => setStyleOpen(true)} aria-label="Change icon and color" className="press inline-block">
            <DeckTile icon={draft.icon} color={draft.color} size={80} className="shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)]" />
          </button>
          <input
            id="deck-title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Deck Title"
            className={cn("block w-full mt-4 text-center t-title1 bg-transparent outline-none placeholder:text-ink-3", showErrors && !draft.title.trim() && "placeholder:text-red/60")}
          />
          <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Add a description" className="block w-full mt-1 text-center t-subhead text-ink-2 bg-transparent outline-none placeholder:text-ink-3" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <Segmented<Kind>
            value={draft.kind}
            onChange={setKind}
            options={[
              { value: "cards", label: "Flashcards", icon: I.cards },
              { value: "quiz", label: "Multiple Choice", icon: I.checklist },
            ]}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          <Button variant="tinted" size="sm" icon={I.paste} onClick={() => setImportOpen(true)}>
            Paste Text
          </Button>
          <Button variant="tinted" size="sm" icon={I.import} onClick={() => fileRef.current?.click()}>
            Import File
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.tsv,.md,text/plain"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {/* Items */}
        <Reorder.Group axis="y" values={draft.items} onReorder={(items) => setDraft((d) => ({ ...d, items }))} className="mt-7 space-y-3">
          <AnimatePresence initial={false}>
            {draft.items.map((item, i) => (
              <ItemRow
                key={item.id}
                item={item}
                index={i}
                kind={draft.kind}
                showErrors={showErrors && Boolean(item.prompt || item.answer || item.options?.some(Boolean))}
                onChange={(p) => patchItem(item.id, p)}
                onRemove={() => removeItem(item.id)}
                onDuplicate={() => duplicateItem(item.id)}
                autoFocus={item.id === lastAdded}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        <button onClick={addItem} className="press w-full mt-3 h-12 rounded-[4px] card flex items-center justify-center gap-2 t-body font-medium text-accent">
          <I.plus className="w-4 h-4" /> Add {draft.kind === "quiz" ? "Question" : "Card"}
        </button>
        <p className="text-center t-footnote text-ink-3 mt-4 hidden sm:block">
          <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> add item · <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> save
        </p>
      </div>

      {/* Icon & color */}
      <Dialog open={styleOpen} onClose={() => setStyleOpen(false)} title="Icon & Color">
        <div className="flex justify-center mb-5">
          <DeckTile icon={draft.icon} color={draft.color} size={72} />
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {PICKABLE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setDraft((d) => ({ ...d, color: c }))}
              aria-label={c}
              className="press w-9 h-9 rounded-full grid place-items-center"
              style={{ background: colorVar(c), boxShadow: draft.color === c ? `0 0 0 3px var(--c-elevated), 0 0 0 5px ${colorVar(c)}` : undefined }}
            />
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2.5 mt-6">
          {ICON_KEYS.map((k) => {
            const Glyph = DECK_ICONS[k];
            const active = draft.icon === k;
            return (
              <button
                key={k}
                onClick={() => setDraft((d) => ({ ...d, icon: k }))}
                aria-label={k}
                className={cn("press aspect-square rounded-full grid place-items-center transition-colors", active ? "text-white" : "bg-fill text-ink-2")}
                style={active ? { background: colorVar(draft.color) } : undefined}
              >
                <Glyph className="w-6 h-6" />
              </button>
            );
          })}
        </div>
        <Button className="w-full mt-6" onClick={() => setStyleOpen(false)}>
          Done
        </Button>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} title="Paste Text" className="sm:max-w-xl">
        <p className="t-subhead text-ink-2 mb-3">
          One <b className="text-ink font-semibold">term – definition</b> pair per line (tab or dash separated, like Quizlet exports), or numbered multiple-choice questions with an optional <b className="text-ink font-semibold">Answers</b> key.
        </p>
        <textarea
          autoFocus
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={9}
          placeholder={"Mitochondria - Powerhouse of the cell\nOsmosis - Movement of water across a membrane\n\n1. What is the capital of Kenya?\nA. Mombasa\nB. Nairobi\nC. Kisumu\nD. Nakuru\n\nAnswers\n1. B"}
          className="w-full rounded-xl bg-fill px-4 py-3 font-mono text-[13px] leading-relaxed outline-none focus:ring-2 ring-accent/60 placeholder:text-ink-3 resize-y"
        />
        <p className={cn("t-footnote font-medium mt-3 flex items-center gap-1.5", preview?.items.length ? "text-green" : "text-ink-2")}>
          <I.magic className="w-4 h-4" />
          {preview ? (preview.items.length ? `Found ${preview.items.length} ${preview.kind === "quiz" ? "questions" : "cards"}` : "Nothing recognized yet") : "Waiting for text"}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="gray" disabled={!preview?.items.length} onClick={() => applyImport("append")}>
            Add to Deck
          </Button>
          <Button disabled={!preview?.items.length} onClick={() => applyImport("replace")}>
            Replace Items
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
