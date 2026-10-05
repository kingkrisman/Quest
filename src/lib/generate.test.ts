import { describe, expect, it } from "vitest";
import { analyze, cleanText, generateFlashcards, generateQuestions } from "./generate";
import { BIOLOGY_NOTES, HEART_NOTES, HISTORY_NOTES } from "./fixtures";

describe("cleanText", () => {
  it("drops page numbers and joins hyphenated words", () => {
    const t = cleanText("Some infor-\nmation here.\nPage 12\n3\nNext line.");
    expect(t).toContain("information");
    expect(t).not.toMatch(/Page 12/);
  });
});

describe("analyze", () => {
  const bio = analyze(BIOLOGY_NOTES, "notes.pdf");
  const heart = analyze(HEART_NOTES);
  const history = analyze(HISTORY_NOTES);

  it("finds definitions in several phrasings", () => {
    const terms = bio.definitions.map((d) => d.term.toLowerCase());
    expect(terms).toEqual(expect.arrayContaining(["mitochondria", "photosynthesis", "osmosis", "enzyme", "diffusion", "dna"]));
    expect(bio.definitions.find((d) => d.term.toLowerCase() === "osmosis")!.definition).toMatch(/^The movement of water/);
  });

  it("uses a heading as the title", () => {
    expect(bio.title).toBe("Cell Biology");
  });

  it("detects lists written as sentences and as bullets", () => {
    const labels = heart.lists.map((l) => l.label.toLowerCase());
    expect(labels.some((l) => l.includes("chambers of the heart"))).toBe(true);
    const chambers = heart.lists.find((l) => /chambers/i.test(l.label))!;
    expect(chambers.items).toHaveLength(4);
    const causes = history.lists.find((l) => /causes/i.test(l.label));
    expect(causes?.items.length).toBe(4);
  });

  it("rewrites facts as real questions", () => {
    const qs = heart.facts.map((f) => f.question).filter(Boolean) as string[];
    expect(qs).toContain("Who described the circulation of blood in 1628?");
    expect(qs.some((q) => /in what year\?$/i.test(q))).toBe(true);
  });
});

describe("generate", () => {
  const heart = analyze(HEART_NOTES);

  it("builds flashcards with non-empty, distinct sides and no filler terms", () => {
    const cards = generateFlashcards(heart, 30);
    expect(cards.length).toBeGreaterThanOrEqual(12);
    for (const c of cards) {
      expect(c.prompt.trim()).not.toBe("");
      expect(c.answer.trim()).not.toBe("");
      expect(c.prompt.toLowerCase()).not.toBe(c.answer.toLowerCase());
    }
    expect(cards.map((c) => c.prompt.toLowerCase())).not.toContain("pumps blood");
  });

  it("builds valid multiple-choice questions with plausible options", () => {
    const qs = generateQuestions(heart, 20, ["mcq"]);
    expect(qs.length).toBeGreaterThanOrEqual(12);
    for (const q of qs) {
      expect(q.options!.length).toBeGreaterThanOrEqual(3);
      expect(q.options![q.correctIndex!]).toBe(q.answer);
      expect(new Set(q.options!.map((o) => o.toLowerCase())).size).toBe(q.options!.length);
      // The answer must never be given away inside the question.
      if (!/not one of/.test(q.prompt)) expect(q.prompt.toLowerCase()).not.toContain(q.answer.toLowerCase());
    }
  });

  it("uses same-kind distractors for people and years", () => {
    const qs = generateQuestions(heart, 60, ["mcq"]);
    const who = qs.find((q) => q.prompt.startsWith("Who described"));
    if (who) for (const o of who.options!) expect(o).toMatch(/^\p{Lu}/u);
    const year = qs.find((q) => q.answer === "1628");
    if (year) for (const o of year.options!) expect(o).toMatch(/^\d{4}$/);
  });

  it("builds true/false and fill-in questions", () => {
    const qs = generateQuestions(heart, 20, ["tf", "fill"]);
    const tf = qs.filter((q) => q.options?.[0] === "True");
    const fill = qs.filter((q) => !q.options);
    expect(tf.length).toBeGreaterThan(0);
    expect(fill.length).toBeGreaterThan(0);
    for (const q of tf) expect(["True", "False"]).toContain(q.answer);
  });

  it("does not ask about the same concept twice when there is enough material", () => {
    const qs = generateQuestions(heart, 10, ["mcq", "tf", "fill"]);
    const answers = qs.map((q) => q.answer.toLowerCase()).filter((a) => a !== "true" && a !== "false");
    expect(new Set(answers).size).toBe(answers.length);
  });

  it("returns nothing for empty input instead of throwing", () => {
    const empty = analyze("");
    expect(generateFlashcards(empty, 10)).toEqual([]);
    expect(generateQuestions(empty, 10, ["mcq", "tf", "fill"])).toEqual([]);
  });
});
