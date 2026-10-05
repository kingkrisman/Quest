import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { actions, deckMastery, dueItems, masteryOf, useStore } from "../lib/store";
import { hostDeck, liveErrorMessage } from "../lib/live";
import { useAuth } from "../contexts/AuthContext";
import { Button, Dialog, EmptyState, Menu, Spinner } from "../components/ui";
import { DECK_ICONS, I, colorVar, type Icon } from "../components/icons";
import { toast } from "../components/Toaster";
import { spring } from "../lib/motion";
import { cn, formatMs, timeAgo } from "../lib/utils";

const MASTERY = [
  { label: "New", color: "var(--c-line)" },
  { label: "Learning", color: "var(--sys-orange)" },
  { label: "Familiar", color: "var(--sys-blue)" },
  { label: "Mastered", color: "var(--sys-green)" },
];

function ModeRow({ to, icon: IconC, title, body, disabled, accent }: { to: string; icon: Icon; title: string; body: string; disabled?: boolean; accent?: boolean }) {
  return (
    <Link
      to={to}
      aria-disabled={disabled}
      className={cn("group flex items-center gap-4 py-4 border-b border-line hoverable -mx-2 px-2 rounded-[3px]", disabled && "opacity-40 pointer-events-none")}
    >
      <IconC className={cn("w-6 h-6 shrink-0", accent ? "text-accent" : "text-ink-2")} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block font-serif text-[1.45rem] leading-tight text-ink">{title}</span>
        <span className="block t-footnote text-ink-2 mt-0.5">{body}</span>
      </span>
      <I.arrow className="w-5 h-5 text-ink-2 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

export function DeckDetail() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = useStore();
  const [hosting, setHosting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const deck = state.decks.find((d) => d.id === deckId);

  if (!deck) {
    return <EmptyState icon={I.library} title="Deck not found" body="It may have been deleted." action={<Button onClick={() => navigate("/library")}>Back to Library</Button>} />;
  }

  const m = deckMastery(deck, state.cards);
  const due = dueItems(state, deck.id).length;
  const best = state.bestMatchMs[deck.id];
  const n = deck.items.length;
  const canChoose = n >= 2 || deck.items.some((i) => i.options?.length);
  const Glyph = DECK_ICONS[deck.icon] ?? DECK_ICONS.book;
  const c = colorVar(deck.color);

  const host = async () => {
    setHosting(true);
    try {
      navigate(`/lobby/${await hostDeck(deck, user.id)}`);
    } catch (err) {
      toast.error("Couldn't start a live game", { description: liveErrorMessage(err) });
    } finally {
      setHosting(false);
    }
  };

  const facts = [
    { k: "Items", v: String(n) },
    { k: "Mastered", v: `${m.percent}%` },
    { k: "Due now", v: String(due) },
    { k: "Best Match", v: best ? formatMs(best) : "—" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-16">
      <div className="flex items-center justify-between h-10 mb-6">
        <Link to="/library" className="btn btn-plain gap-1 t-subhead text-ink-2 hover:text-ink">
          <I.arrowLeft className="w-4 h-4" aria-hidden /> Library
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="plain" size="sm" icon={I.edit} onClick={() => navigate(`/edit/${deck.id}`)}>
            Edit
          </Button>
          <Menu
            label="Deck options"
            items={[
              { label: deck.starred ? "Remove from favorites" : "Add to favorites", icon: deck.starred ? I.starOutline : I.star, onSelect: () => actions.toggleStar(deck.id) },
              {
                label: "Duplicate",
                icon: I.copy,
                onSelect: () => {
                  const copy = actions.duplicateDeck(deck.id);
                  toast.success("Deck duplicated");
                  if (copy) navigate(`/deck/${copy.id}`);
                },
              },
              { label: "Reset progress", icon: I.restart, onSelect: () => setConfirmReset(true) },
              {
                label: "Delete deck",
                icon: I.trash,
                destructive: true,
                onSelect: () => {
                  const removed = actions.deleteDeck(deck.id);
                  navigate("/library");
                  toast.info(`Deleted "${deck.title}"`, { action: { label: "Undo", onClick: () => removed && actions.restoreDeck(removed) } });
                },
              },
            ]}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-x-12 gap-y-10">
        {/* Title block */}
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="lg:col-span-7">
          <Glyph className="w-8 h-8" style={{ color: c }} aria-hidden />
          <h1 className="t-display text-ink mt-3">{deck.title}</h1>
          {deck.description && <p className="t-body text-[1.0625rem] text-ink-2 mt-4 max-w-[58ch]">{deck.description}</p>}
          {deck.source && (
            <p className="t-footnote text-ink-2 mt-3 inline-flex items-center gap-1.5">
              <I.document className="w-4 h-4" aria-hidden /> From {deck.source.name}
              {deck.source.pages > 1 ? ` · ${deck.source.pages} pages` : ""} · {deck.source.words.toLocaleString()} words
            </p>
          )}

          {/* Facts table */}
          <dl className="grid grid-cols-4 mt-8 border-y-[1.5px] border-rule">
            {facts.map((f, i) => (
              <div key={f.k} className={cn("py-3 px-1", i > 0 && "border-l border-line pl-4")}>
                <dt className="t-label text-ink-2">{f.k}</dt>
                <dd className="t-figure text-[2rem] text-ink mt-1">{f.v}</dd>
              </div>
            ))}
          </dl>

          {/* Mastery bar */}
          <div className="mt-5">
            <div className="flex h-2 gap-px bg-line">
              {[3, 2, 1, 0].map((lvl) => (m.counts[lvl] ? <motion.span key={lvl} className="h-full" style={{ background: MASTERY[lvl].color }} initial={{ flexGrow: 0 }} animate={{ flexGrow: m.counts[lvl] }} transition={{ ...spring, duration: 0.8 }} /> : null))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5">
              {MASTERY.map((ms, i) => (
                <span key={ms.label} className="inline-flex items-center gap-1.5 t-footnote text-ink-2">
                  <span className="w-2.5 h-2.5" style={{ background: ms.color }} aria-hidden />
                  {m.counts[i]} {ms.label.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </motion.header>

        {/* Contents */}
        <nav aria-label="Study modes" className="lg:col-span-5 lg:border-l lg:border-line lg:pl-12">
          <h2 className="t-title2 text-ink pb-2 border-b-[1.5px] border-rule">Study</h2>
          <ModeRow to={`/study/${deck.id}/cards`} icon={I.cards} title="Flashcards" body={due ? `${due} due for review` : "Flip, rate yourself, and let spacing do the work"} disabled={n === 0} accent={due > 0} />
          <ModeRow to={`/study/${deck.id}/learn`} icon={I.review} title="Learn" body="Adaptive questions with instant corrections" disabled={!canChoose} />
          <ModeRow to={`/study/${deck.id}/exam`} icon={I.cap} title="Exam" body={`Timed and graded at the end${deck.examMinutes ? ` · ${deck.examMinutes} minutes` : ""}`} disabled={n === 0} />
          <ModeRow to={`/study/${deck.id}/test`} icon={I.target} title="Quick test" body="Twenty seconds a question" disabled={!canChoose} />
          <ModeRow to={`/study/${deck.id}/match`} icon={I.puzzle} title="Match" body={best ? `Beat your best of ${formatMs(best)}` : "Race the clock to pair every term"} disabled={n < 3} />
          <button type="button" onClick={host} disabled={n === 0 || hosting} className="group w-full flex items-center gap-4 py-4 border-b border-line hoverable -mx-2 px-2 rounded-[3px] text-left disabled:opacity-40">
            <I.live className="w-6 h-6 text-ink-2 shrink-0" aria-hidden />
            <span className="flex-1 min-w-0">
              <span className="block font-serif text-[1.45rem] leading-tight text-ink">Host a live game</span>
              <span className="block t-footnote text-ink-2 mt-0.5">Friends join from the Today page with a PIN</span>
            </span>
            {hosting ? <Spinner size={18} className="text-ink-2" /> : <I.arrow className="w-5 h-5 text-ink-2 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />}
          </button>
          {deck.lastStudiedAt && <p className="t-footnote text-ink-2 mt-3">Last studied {timeAgo(deck.lastStudiedAt)}.</p>}
        </nav>
      </div>

      {/* Glossary */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between pb-2 border-b-[1.5px] border-rule">
          <h2 className="t-title1 text-ink">
            {n} {n === 1 ? "item" : "items"}
          </h2>
          <Link to={`/edit/${deck.id}`} className="t-subhead text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            Edit items
          </Link>
        </div>
        {n === 0 ? (
          <EmptyState icon={I.write} title="No items yet" body="Add terms and definitions, or questions with answers." action={<Button onClick={() => navigate(`/edit/${deck.id}`)}>Add items</Button>} />
        ) : (
          <dl>
            {deck.items.map((item) => {
              const lvl = masteryOf(state.cards[item.id]);
              return (
                <div key={item.id} className="grid md:grid-cols-12 gap-x-8 gap-y-1 py-4 border-b border-line">
                  <dt className="md:col-span-5 flex gap-3">
                    <span className="w-2 h-2 mt-2.5 shrink-0 rounded-full" style={{ background: MASTERY[lvl].color }} title={MASTERY[lvl].label} aria-label={MASTERY[lvl].label} />
                    <span className="font-serif text-[1.3rem] leading-snug text-ink">{item.prompt}</span>
                  </dt>
                  <dd className="md:col-span-7 t-body text-ink-2 pl-5 md:pl-0">{item.answer}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset progress?">
        <p className="t-body text-ink-2">Mastery and review schedules for these {n} items will be cleared. Your XP and streak stay.</p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="gray" onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
          <Button
            color="accent"
            onClick={() => {
              actions.resetDeckProgress(deck.id);
              setConfirmReset(false);
              toast.success("Progress reset");
            }}
          >
            Reset progress
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
