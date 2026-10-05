# KÀWÉ design: Editorial paper

A study app that feels like a well-made printed textbook, not a dashboard.

## World
- **Paper and ink.** Warm paper `#F3EEE4` with a faint grain, near-black ink `#1B1813`. Dark mode is "night paper" `#15130F` with warm ink.
- **One accent.** Tomato `#C8391F`, used for at most one action per screen (Review, Continue, Start) and for the index-card margin line. Everything else is ink.
- **Printing inks for decks.** Muted slate, sage, clay, ochre and plum (`--sys-*`). Deck color appears as the index card's top edge and glyph, never as a full fill.

## Type
- **Instrument Serif** for headlines, card faces, big figures (timers, grades, stats) and deck titles.
- **Instrument Sans** for everything you read or operate: body, labels, buttons, data.
- Fixed scale (`t-display`, `t-large`, `t-title1/2`, `t-body`, `t-subhead`, `t-footnote`); 16px body floor. Numbers in tables use `t-num` (tabular).

## Structure
- A masthead with a dateline and text navigation (underlined when current) sits over a **double rule**. On mobile, a paper tab bar replaces the navigation.
- Rules instead of boxes: `grouped` lists start with an ink rule and use hairlines between rows. Sections open with a serif heading over a rule.
- **Index cards** are the signature: decks and flashcards are ruled cards (blue ruling, red margin line). The card front holds the prompt; the back is plain card stock.
- Corners are paper corners (3–6px). No pill-shaped app cards, no gradients, no glass.

## Controls
All states live in `index.css`: `btn` + `btn-filled` (ink) / `btn-tinted` (outlined) / `btn-gray` / `btn-plain` (link), `field`, `hoverable`. Pressed buttons move down 1px, like a key. Focus is a 2px tomato outline.

## Motion
Critically damped springs (`lib/motion.ts`). Pages fade in without waiting. Cards lift and tilt slightly on hover. Nothing loops except the loading spinner.

## Don't
Eyebrow labels above headings, big-number stat tiles, progress rings as decoration, emoji, gradient text, rounded "SaaS" cards.
