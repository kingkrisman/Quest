import { describe, expect, it } from "vitest";
import { isClose } from "./answer";
import { parseImport, choicesFor } from "./deck";
import { levelInfo, xpForLevel } from "./store";

describe("isClose", () => {
  it("accepts case, accent, punctuation and small typo differences", () => {
    expect(isClose("canberra", "Canberra")).toBe(true);
    expect(isClose("Brasilia", "Brasília")).toBe(true);
    expect(isClose("mitocondria", "Mitochondria")).toBe(true);
    expect(isClose("photosynthesis.", "Photosynthesis")).toBe(true);
  });
  it("rejects wrong or empty answers", () => {
    expect(isClose("Sydney", "Canberra")).toBe(false);
    expect(isClose("", "Canberra")).toBe(false);
    expect(isClose("   ", "Canberra")).toBe(false);
  });
  it("works outside the Latin alphabet", () => {
    expect(isClose("東京", "東京")).toBe(true);
    expect(isClose("Москва", "москва")).toBe(true);
  });
});

describe("parseImport", () => {
  it("parses term - definition pairs", () => {
    const { items, kind } = parseImport("Osmosis - movement of water\nDiffusion\t spread of particles");
    expect(kind).toBe("cards");
    expect(items.map((i) => i.prompt)).toEqual(["Osmosis", "Diffusion"]);
  });
  it("parses numbered multiple choice with an answer key", () => {
    const { items, kind } = parseImport("1. Capital of Kenya?\nA. Mombasa\nB. Nairobi\nC. Kisumu\n\nAnswers\n1. B");
    expect(kind).toBe("quiz");
    expect(items[0].answer).toBe("Nairobi");
    expect(items[0].options![items[0].correctIndex!]).toBe("Nairobi");
  });
});

describe("choicesFor", () => {
  it("always includes the correct answer at correctIndex", () => {
    const deck = { id: "d", title: "t", description: "", icon: "book" as const, color: "blue" as const, createdAt: 0, updatedAt: 0, items: ["a", "b", "c", "d", "e"].map((x) => ({ id: x, prompt: x, answer: x.toUpperCase() })) };
    for (let i = 0; i < 20; i++) {
      const { options, correctIndex } = choicesFor(deck.items[0], deck);
      expect(options[correctIndex]).toBe("A");
      expect(new Set(options).size).toBe(options.length);
    }
  });
});

describe("levels", () => {
  it("levels up at the documented thresholds", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(xpForLevel(2)).level).toBe(2);
    expect(levelInfo(xpForLevel(5) - 1).level).toBe(4);
  });
});
