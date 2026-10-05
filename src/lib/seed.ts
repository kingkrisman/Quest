import type { Deck } from "./store";

type SeedDeck = Omit<Deck, "createdAt" | "updatedAt">;

const mc = (id: string, prompt: string, options: string[], correctIndex: number, explanation?: string) => ({
  id,
  prompt,
  answer: options[correctIndex],
  options,
  correctIndex,
  explanation,
});

const card = (id: string, prompt: string, answer: string) => ({ id, prompt, answer });

export const SEED_DECKS: SeedDeck[] = [
  {
    id: "seed-capitals",
    title: "World Capitals",
    description: "Tour the globe one capital city at a time.",
    icon: "globe",
    color: "blue",
    items: [
      mc("seed-cap-1", "What is the capital of Australia?", ["Sydney", "Melbourne", "Canberra", "Perth"], 2, "Canberra was purpose-built as a compromise between Sydney and Melbourne."),
      mc("seed-cap-2", "What is the capital of Canada?", ["Toronto", "Ottawa", "Vancouver", "Montreal"], 1),
      mc("seed-cap-3", "What is the capital of Nigeria?", ["Lagos", "Kano", "Ibadan", "Abuja"], 3, "Abuja replaced Lagos as the capital in 1991."),
      mc("seed-cap-4", "What is the capital of Brazil?", ["Brasília", "Rio de Janeiro", "São Paulo", "Salvador"], 0),
      mc("seed-cap-5", "What is the capital of Japan?", ["Osaka", "Kyoto", "Tokyo", "Yokohama"], 2),
      mc("seed-cap-6", "What is the capital of Turkey?", ["Istanbul", "Ankara", "Izmir", "Antalya"], 1, "Ankara has been the capital since 1923."),
      mc("seed-cap-7", "What is the capital of Kenya?", ["Mombasa", "Kisumu", "Nairobi", "Nakuru"], 2),
      mc("seed-cap-8", "What is the capital of Egypt?", ["Alexandria", "Cairo", "Giza", "Luxor"], 1),
      mc("seed-cap-9", "What is the capital of Germany?", ["Munich", "Hamburg", "Frankfurt", "Berlin"], 3),
      mc("seed-cap-10", "What is the capital of South Korea?", ["Seoul", "Busan", "Incheon", "Daegu"], 0),
    ],
  },
  {
    id: "seed-bio",
    title: "Biology Essentials",
    description: "Core cell biology terms every student should know.",
    icon: "biology",
    color: "green",
    items: [
      card("seed-bio-1", "Mitochondria", "The organelle that produces most of the cell's ATP through cellular respiration."),
      card("seed-bio-2", "Ribosome", "The molecular machine that builds proteins by translating mRNA."),
      card("seed-bio-3", "Photosynthesis", "The process plants use to turn light, water and CO₂ into glucose and oxygen."),
      card("seed-bio-4", "Osmosis", "The movement of water across a semi-permeable membrane from low to high solute concentration."),
      card("seed-bio-5", "DNA", "Deoxyribonucleic acid: the double-helix molecule that stores genetic information."),
      card("seed-bio-6", "Mitosis", "Cell division that produces two genetically identical daughter cells."),
      card("seed-bio-7", "Enzyme", "A protein that speeds up a chemical reaction without being used up."),
      card("seed-bio-8", "Nucleus", "The membrane-bound organelle that holds a eukaryotic cell's DNA."),
    ],
  },
  {
    id: "seed-js",
    title: "JavaScript Fundamentals",
    description: "Sharpen the core ideas behind modern JavaScript.",
    icon: "code",
    color: "orange",
    items: [
      mc("seed-js-1", "Which keyword declares a block-scoped variable that can't be reassigned?", ["var", "let", "const", "static"], 2),
      mc("seed-js-2", "What does `typeof null` return?", ['"null"', '"object"', '"undefined"', '"number"'], 1, "A long-standing quirk kept for backwards compatibility."),
      mc("seed-js-3", "Which method creates a new array with the results of calling a function on every element?", ["forEach", "filter", "reduce", "map"], 3),
      mc("seed-js-4", "What is the result of `0.1 + 0.2 === 0.3`?", ["true", "false", "TypeError", "NaN"], 1, "Floating-point rounding makes the sum 0.30000000000000004."),
      mc("seed-js-5", "Which operator checks equality without type coercion?", ["==", "===", "=", "!="], 1),
      mc("seed-js-6", "What does `await` do inside an async function?", ["Blocks the whole thread", "Pauses until a Promise settles", "Creates a new thread", "Cancels a Promise"], 1),
      mc("seed-js-7", "Which of these is NOT a primitive type?", ["string", "boolean", "object", "symbol"], 2),
      mc("seed-js-8", 'What does `[..."hi"]` evaluate to?', ['["hi"]', '["h", "i"]', '"hi"', "SyntaxError"], 1),
    ],
  },
];
