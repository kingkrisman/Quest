import { Link } from "react-router-dom";
import { DECK_ICONS, colorVar } from "./icons";
import { Menu, type MenuItem } from "./ui";
import type { Deck } from "../lib/store";
import { cn } from "../lib/utils";

/**
 * A deck as an index card: the deck's ink color runs along the top edge, the
 * title sits above the margin line, and the details are written on the rules.
 */
export function DeckCard({ deck, mastery, meta, menu, className }: { deck: Deck; mastery: number; meta: string; menu?: MenuItem[]; className?: string }) {
  const Glyph = DECK_ICONS[deck.icon] ?? DECK_ICONS.book;
  const c = colorVar(deck.color);
  return (
    <Link
      to={`/deck/${deck.id}`}
      className={cn(
        "group relative flex flex-col h-[196px] rounded-[3px] ruled border border-line shadow-(--shadow-card) overflow-hidden",
        "transition-[transform,box-shadow] duration-300 ease-out-strong hover:-translate-y-1 hover:rotate-[-0.4deg] hover:shadow-(--shadow-float)",
        className
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: c }} aria-hidden />
      <div className="flex items-start gap-2 px-4 pt-4 h-[3.25rem]">
        <Glyph className="w-5 h-5 mt-0.5 shrink-0" style={{ color: c }} aria-hidden />
        <p title={deck.title} className="flex-1 min-w-0 font-serif text-[1.3rem] leading-[1.25] text-ink truncate">{deck.title}</p>
        {menu && (
          <span className="-mr-2 -mt-1.5">
            <Menu items={menu} label={`Options for ${deck.title}`} />
          </span>
        )}
      </div>
      {/* Written on the rules: each line sits on a 2rem ruling. */}
      <div className="px-4 pt-[0.55rem] flex-1 flex flex-col t-footnote text-ink-2">
        <span className="h-8 leading-8 truncate">{meta}</span>
        <span className="h-8 leading-8 flex items-center gap-2">
          <span className="t-num text-ink">{mastery}%</span> mastered
          <span className="flex-1 h-[3px] bg-line ml-1">
            <span className="block h-full origin-left transition-transform duration-700 ease-out-strong" style={{ background: c, transform: `scaleX(${mastery / 100})` }} />
          </span>
        </span>
        {deck.starred && <span className="h-8 leading-8 text-ink">Favorite</span>}
      </div>
    </Link>
  );
}
