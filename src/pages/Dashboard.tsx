import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { actions, deckMastery, dueItems, useStore, type Deck } from "../lib/store";
import { isQuizDeck } from "../lib/deck";
import { hostDeck, liveErrorMessage } from "../lib/live";
import { useAuth } from "../contexts/AuthContext";
import { Button, EmptyState, PageHeader, Segmented, Spinner } from "../components/ui";
import { DeckCard } from "../components/DeckCard";
import { I } from "../components/icons";
import { toast } from "../components/Toaster";
import { spring } from "../lib/motion";

type Filter = "all" | "starred" | "quiz" | "cards";
type Sort = "recent" | "name" | "mastery";

export function Dashboard() {
  const state = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [hosting, setHosting] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("host") === "1") toast.info("Choose a deck to host", { description: "Open a deck's menu and pick Host Live Game." });
  }, [params]);

  const decks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.decks.filter((d) => {
      if (filter === "starred" && !d.starred) return false;
      if (filter === "quiz" && !isQuizDeck(d)) return false;
      if (filter === "cards" && isQuizDeck(d)) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.items.some((i) => i.prompt.toLowerCase().includes(q));
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "mastery") return deckMastery(b, state.cards).percent - deckMastery(a, state.cards).percent;
      return (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt);
    });
  }, [state.decks, state.cards, query, filter, sort]);

  const host = async (deck: Deck) => {
    setHosting(deck.id);
    try {
      navigate(`/lobby/${await hostDeck(deck, user.id)}`);
    } catch (err) {
      toast.error("Couldn't start a live game", { description: liveErrorMessage(err) });
    } finally {
      setHosting(null);
    }
  };

  const menuFor = (deck: Deck) => [
    { label: "Host Live Game", icon: I.live, onSelect: () => host(deck) },
    { label: deck.starred ? "Unfavorite" : "Favorite", icon: deck.starred ? I.starOutline : I.star, onSelect: () => actions.toggleStar(deck.id) },
    { label: "Edit", icon: I.edit, onSelect: () => navigate(`/edit/${deck.id}`) },
    {
      label: "Duplicate",
      icon: I.copy,
      onSelect: () => {
        actions.duplicateDeck(deck.id);
        toast.success("Deck duplicated");
      },
    },
    {
      label: "Delete",
      icon: I.trash,
      destructive: true,
      onSelect: () => {
        const removed = actions.deleteDeck(deck.id);
        toast.info(`Deleted "${deck.title}"`, { action: { label: "Undo", onClick: () => removed && actions.restoreDeck(removed) } });
      },
    },
  ];

  const itemCount = state.decks.reduce((n, d) => n + d.items.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-16">
      <PageHeader
        title="Library"
        subtitle={`${state.decks.length} decks · ${itemCount} items`}
        actions={
          <>
            <Button variant="tinted" size="sm" icon={I.scan} onClick={() => navigate("/import")}>
              Scan
            </Button>
            <Button size="sm" icon={I.plus} onClick={() => navigate("/create")}>
              New
            </Button>
          </>
        }
      />

      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-8">
        <label className="relative flex-1">
          <I.search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-2" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            type="search"
            className="field h-10 pl-10 pr-3 t-body"
          />
        </label>
        <div className="flex gap-5 items-center justify-between min-w-0 border-b border-line">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            className="flex-1 min-w-0 sm:flex-none"
            options={[
              { value: "all", label: "All" },
              { value: "starred", label: "Favorites" },
              { value: "quiz", label: "Quizzes" },
              { value: "cards", label: "Cards" },
            ]}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort decks" className="field shrink-0 w-auto h-9 pl-2.5 pr-1 t-subhead">
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="mastery">Mastery</option>
          </select>
        </div>
      </div>

      {state.decks.length === 0 ? (
        <EmptyState icon={I.library} title="No decks yet" body="Create a deck from scratch or paste in your notes." action={<Button onClick={() => navigate("/create")}>Create a deck</Button>} />
      ) : decks.length === 0 ? (
        <EmptyState icon={I.search} title="No results" body="Try a different search or filter." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatePresence initial={false} mode="popLayout">
            {decks.map((deck) => {
              const due = dueItems(state, deck.id).length;
              const m = deckMastery(deck, state.cards).percent;
              return (
                <motion.div key={deck.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }} transition={spring} className="relative">
                  <DeckCard deck={deck} mastery={m} meta={`${deck.items.length} ${isQuizDeck(deck) ? "questions" : "cards"}${due ? ` · ${due} due` : deck.source ? " · scanned" : ""}`} menu={menuFor(deck)} />
                  {hosting === deck.id && (
                    <div className="absolute inset-0 rounded-[3px] bg-bg/70 grid place-items-center text-ink">
                      <Spinner size={24} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
