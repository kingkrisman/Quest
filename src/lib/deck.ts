import { uid, type Deck, type Item } from "./store";
import { shuffle } from "./utils";

/** Multiple-choice options for an item. Uses its own options, or borrows answers from the rest of the deck. */
export function choicesFor(item: Item, deck: Deck): { options: string[]; correctIndex: number } {
  if (item.options && item.options.length >= 2 && item.correctIndex !== undefined) {
    const order = shuffle(item.options.map((_, i) => i));
    return { options: order.map((i) => item.options![i]), correctIndex: order.indexOf(item.correctIndex) };
  }
  const pool = Array.from(new Set(deck.items.filter((i) => i.id !== item.id && i.answer !== item.answer).map((i) => i.answer)));
  const distractors = shuffle(pool).slice(0, 3);
  const options = shuffle([item.answer, ...distractors]);
  return { options, correctIndex: options.indexOf(item.answer) };
}

/** Convert a deck into the question format the live multiplayer tables expect. */
export function toLiveQuestions(deck: Deck) {
  return deck.items.map((item, i) => {
    const { options, correctIndex } = choicesFor(item, deck);
    return {
      id: String(i + 1),
      text: item.prompt,
      options,
      correctOptionIndex: correctIndex,
      points: item.points ?? 1000,
      timeLimit: item.timeLimit ?? 20,
    };
  });
}

export const blankItem = (): Item => ({ id: uid(), prompt: "", answer: "" });
export const blankQuestion = (): Item => ({ id: uid(), prompt: "", answer: "", options: ["", "", "", ""], correctIndex: 0 });

/**
 * Parse pasted text into items. Supports:
 *  - Numbered multiple choice ("1. Question" / "A. option" ...) with an optional "Answers" key ("1. C" or "1-C")
 *  - Term/definition pairs separated by a tab, " - ", " – ", " : " or " = " (Quizlet / Anki exports)
 */
export function parseImport(text: string): { items: Item[]; kind: "quiz" | "cards" } {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const isQuiz = lines.some((l) => /^\d+[.)]\s+/.test(l)) && lines.some((l) => /^[A-Da-d][.)]\s+/.test(l));

  if (isQuiz) {
    const keyStart = lines.findIndex((l) => /^(answers?|answer key)\s*:?$/i.test(l));
    const qLines = keyStart >= 0 ? lines.slice(0, keyStart) : lines;
    const keyLines = keyStart >= 0 ? lines.slice(keyStart + 1) : [];
    const items: Item[] = [];
    let cur: Item | null = null;
    const flush = () => {
      if (cur && cur.options!.filter(Boolean).length >= 2) {
        cur.options = cur.options!.filter(Boolean);
        cur.correctIndex = Math.min(cur.correctIndex ?? 0, cur.options.length - 1);
        cur.answer = cur.options[cur.correctIndex];
        items.push(cur);
      }
    };
    for (const line of qLines) {
      const q = line.match(/^(\d+)[.)]\s+(.+)/);
      if (q) {
        flush();
        cur = { id: uid(), prompt: q[2], answer: "", options: ["", "", "", ""], correctIndex: 0 };
        continue;
      }
      const o = line.match(/^([A-Da-d])[.)]\s+(.+)/);
      if (o && cur) {
        let textOpt = o[2];
        // Inline marker: "C. Canberra *" or "C. Canberra (correct)"
        if (/\s*(\*|\(correct\))$/i.test(textOpt)) {
          textOpt = textOpt.replace(/\s*(\*|\(correct\))$/i, "");
          cur.correctIndex = o[1].toUpperCase().charCodeAt(0) - 65;
        }
        cur.options![o[1].toUpperCase().charCodeAt(0) - 65] = textOpt;
      }
    }
    flush();
    for (const line of keyLines) {
      const m = line.match(/^(\d+)\s*[.):-]?\s*([A-Da-d])\b/);
      if (m) {
        const it = items[Number(m[1]) - 1];
        const idx = m[2].toUpperCase().charCodeAt(0) - 65;
        if (it && it.options && idx < it.options.length) {
          it.correctIndex = idx;
          it.answer = it.options[idx];
        }
      }
    }
    return { items, kind: "quiz" };
  }

  const items: Item[] = [];
  for (const line of lines) {
    if (!line) continue;
    const m = line.split(/\t| [-–—=:] /);
    if (m.length >= 2) {
      const [prompt, ...rest] = m;
      const answer = rest.join(" - ").trim();
      if (prompt.trim() && answer) items.push({ id: uid(), prompt: prompt.trim(), answer });
    }
  }
  return { items, kind: "cards" };
}

export const isQuizDeck = (deck: Deck) => deck.items.some((i) => i.options && i.options.length >= 2);
