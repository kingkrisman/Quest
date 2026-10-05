/**
 * On-device study-set generator. No network, no model: it reads the structure
 * of the text instead.
 *
 *   1. Clean the text and split it into sections and sentences.
 *   2. Extract what a teacher would test: definitions, abbreviations, lists
 *      ("the four chambers of the heart are ..."), and facts carrying a person,
 *      a date or a number.
 *   3. Turn those into questions phrased the way an exam phrases them
 *      ("Who described ...?", "In what year ...?", "Which term describes ...?"),
 *      with wrong answers drawn from the same topic so they are plausible.
 *   4. Rank everything, keep the best, and mix types and topics.
 */
import { uid, type Item } from "./store";
import { shuffle } from "./utils";

/* ------------------------------------------------------------------ */
/* Text cleanup                                                        */
/* ------------------------------------------------------------------ */

const MAX_WORDS = 80_000;
const BULLET = /^([-*•▪◦·‣–]|\d+[.)]|[a-z][.)])\s+/;

export function cleanText(raw: string): string {
  let text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n\n")
    .replace(/[­​]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\t/g, " ")
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2");

  const lines = text.split("\n").map((l) => l.replace(/ {2,}/g, " ").trim());
  const counts = new Map<string, number>();
  for (const l of lines) if (l && l.length < 60) counts.set(l, (counts.get(l) ?? 0) + 1);
  const kept = lines.filter((l) => {
    if (/^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l)) return false;
    if (l && l.length < 60 && (counts.get(l) ?? 0) >= 4) return false;
    return true;
  });

  const out: string[] = [];
  for (const line of kept) {
    const prev = out[out.length - 1];
    if (!line) {
      if (prev !== "") out.push("");
    } else if (prev && prev !== "" && !BULLET.test(line) && !BULLET.test(prev) && !/[.!?:;]$/.test(prev) && !isHeading(prev) && /^[\p{Ll}\d(]/u.test(line)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }
  text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const words = text.split(/\s+/);
  if (words.length > MAX_WORDS) text = words.slice(0, MAX_WORDS).join(" ");
  return text;
}

function isHeading(line: string) {
  const words = line.split(/\s+/);
  if (words.length > 9 || line.length < 3 || /[.!?,;]$/.test(line) || BULLET.test(line)) return false;
  if (line.replace(/[^\p{L}]/gu, "").length < 3) return false;
  const caps = words.filter((w) => /^[\p{Lu}\d]/u.test(w)).length;
  return line === line.toUpperCase() || caps / words.length >= 0.6 || /^(\d+(\.\d+)*|chapter|section|unit|lesson)\b/i.test(line) || (/:$/.test(line) && words.length <= 6);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  "a an the and or but if then else when while of in on at to for from by with without within into onto over under about above below between among through during before after since until upon as is are was were be been being am do does did doing have has had having can could shall should will would may might must this that these those it its it's they them their theirs we us our ours you your yours he him his she her hers i me my mine who whom whose which what where why how not no nor so than too very also just only such each every either neither both few more most other some any all many much one two three four five six first second new used use using uses called known include includes including example e.g i.e etc however therefore thus hence because although though whereas yet still even often usually generally typically well way ways make makes made like another same different various several certain part parts form forms type types kind kinds number numbers term terms thing things refer refers mean means defined define definition important main major minor large small high low good great carry carries help helps take takes give gives get gets body per about around january february march april june july august september october november december monday tuesday wednesday thursday friday saturday sunday".split(
    " "
  )
);
const PRONOUN_START = /^(this|that|these|those|it|its|they|them|their|he|she|his|her|we|our|you|your|such|here|there|which|however|also|thus|therefore|hence|so|and|but|or|in addition|for example|as a result)\b/i;

function splitSentences(paragraph: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg("en", { granularity: "sentence" }).segment(paragraph), (s) => s.segment.trim()).filter(Boolean);
  return paragraph.split(/(?<=[.!?])\s+(?=["'(\p{Lu}\d])/u).map((s) => s.trim());
}

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(?<!s)s$/, "");
const keyOf = (s: string) => norm(s).split(" ").map(stem).join(" ");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lowerFirst = (s: string) => (/^(A|An|The)\s/.test(s) || /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const stripEnd = (s: string) => s.trim().replace(/[.;:,]+$/, "");
const isYear = (s: string) => /^(1[0-9]{3}|20[0-9]{2})$/.test(s);
const lastWord = (s: string) => stem(norm(s).split(" ").pop() ?? "");

/* ------------------------------------------------------------------ */
/* Analysis                                                             */
/* ------------------------------------------------------------------ */

type TermKind = "number" | "proper" | "common";

export interface Term {
  text: string;
  key: string;
  score: number;
  kind: TermKind;
  words: number;
  defined?: boolean;
  count: number;
  sections: number[];
}

export interface Definition {
  term: string;
  definition: string;
  source: string;
  section: number;
}

export interface ListFact {
  /** e.g. "chambers of the heart" */
  label: string;
  items: string[];
  source: string;
  section: number;
}

export interface Fact {
  sentence: string;
  answer: string;
  kind: "person" | "year" | "number" | "term";
  question?: string;
  section: number;
  score: number;
}

export interface Analysis {
  title: string;
  words: number;
  sentences: string[];
  headings: string[];
  terms: Term[];
  definitions: Definition[];
  lists: ListFact[];
  facts: Fact[];
  sections: { heading: string; text: string }[];
}

/**
 * Terms worth testing: defined, named, figures, or multi-word concepts the text keeps
 * returning to. Lone common words ("area") and one-off verb phrases ("pumps blood") are too generic.
 */
export const testable = (t: Term) => t.defined || t.kind !== "common" || (t.words > 1 && t.count >= 3);

const DEF_PATTERNS: RegExp[] = [
  /^(?:the |an? )?(?<term>[\p{L}][\p{L}\p{N}' \-/()]{1,60}?)\s+(?:is|are|was|were)\s+(?:defined as |known as |called )?(?<def>(?:a|an|the|one|any|how|when|where|process|method|study|set|type|form|measure|ability|amount|period|group|system|substance|state)\b.{12,})$/iu,
  /^(?:the |an? )?(?<term>[\p{L}][\p{L}\p{N}' \-/()]{1,60}?)\s+(?:refers? to|means|is defined as|are defined as|describes?|denotes|represents|is the term for)\s+(?<def>.{12,})$/iu,
  // Appositive: "Photosynthesis, the process by which plants ..., occurs in ..."
  /^(?<term>[\p{Lu}][\p{L}\p{N}' \-]{1,40}?),\s+(?<def>(?:a|an|the)\s[^,]{12,}),/u,
];
const TERM_LAST = /^(?<def>.{15,}?),?\s+(?:is|are)\s+(?:called|known as|termed|referred to as)\s+(?:an? |the )?(?<term>[\p{L}][\p{L}\p{N}' \-]{1,50})$/iu;
const LINE_DEF = /^(?:[-*•▪◦·‣]\s*)?(?<term>[\p{L}][\p{L}\p{N}' \-/()]{1,50}?)\s*(?::|\s[-–—]\s)\s*(?<def>.{8,})$/u;
const ABBREV = /(?<long>(?:\p{Lu}[\p{L}\-]+\s+(?:(?:of|and|for|the)\s+)?){1,6}\p{Lu}?[\p{L}\-]+)\s+\((?<short>\p{Lu}[\p{Lu}\d]{1,7}s?(?:\s\p{L}+)?)\)/gu;
const LIST_NOUNS = "types|kinds|forms|stages|phases|parts|components|functions|layers|classes|categories|steps|features|properties|causes|effects|examples|characteristics|principles|elements|branches|levels|organs|chambers|estates|factors|risk factors|sources|symptoms|methods|groups|states|products|reactants|roles|uses|advantages|disadvantages|benefits";
const LIST_SENTENCE = new RegExp(
  `^(?:the\\s+)?(?:(?:main|major|key|basic|primary|principal|different|several|two|three|four|five|six|seven|eight|nine|ten|\\d+)\\s+)*(?<noun>${LIST_NOUNS})\\s+(?:of|for|in)\\s+(?<subject>[^,:]{2,60}?)\\s+(?:are|were|include|includes|included|consist of|comprise)\\s*:?\\s+(?<items>.+)$`,
  "iu"
);
const COUNT_LIST_SENTENCE = new RegExp(
  `^(?:the\\s+)?(?<count>two|three|four|five|six|seven|eight|nine|ten|\\d+)\\s+(?<label>[\\p{L} \\-']{3,50}?)\\s+(?:are|were|include|includes)\\s+(?<items>.+)$`,
  "iu"
);
const INCLUDE_SENTENCE = /^(?<subject>[\p{L}][\p{L} \-']{2,50}?)\s+(?:include|includes|such as|consist of|consists of|are made up of)\s+(?<items>(?:[^,]+,\s*)+(?:and|or)\s+[^,.]+)$/iu;

function splitItems(s: string): string[] {
  return stripEnd(s)
    .split(/\s*,\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+|\s*;\s*/)
    .map((x) => x.replace(/^(the|an?)\s+/i, "").trim())
    .filter((x) => x && wordCount(x) <= 12 && /\p{L}{2,}/u.test(x));
}

function tidyDef(d: string) {
  return upperFirst(stripEnd(d.replace(/\s+/g, " "))) + ".";
}

function validTerm(term: string) {
  const w = wordCount(term);
  if (w < 1 || w > 6 || term.length < 2) return false;
  if (PRONOUN_START.test(term) || STOP.has(term.toLowerCase())) return false;
  return /\p{L}{2,}/u.test(term);
}

const tokenRe = /[\p{L}][\p{L}\p{N}'\-]*|\d+(?:[.,]\d+)?%?/gu;

function candidatePhrases(sentence: string): { text: string; kind: TermKind }[] {
  const tokens = Array.from(sentence.matchAll(tokenRe), (m) => ({ t: m[0], i: m.index ?? 0 }));
  const out: { text: string; kind: TermKind }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].t;
    if (/^\d/.test(t)) {
      if (t.length >= 2) out.push({ text: t, kind: "number" });
      continue;
    }
    if (STOP.has(t.toLowerCase()) || t.length < 3) continue;
    let phrase = t;
    out.push({ text: phrase, kind: /^\p{Lu}/u.test(t) && i > 0 ? "proper" : "common" });
    for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
      const n = tokens[j].t;
      if (STOP.has(n.toLowerCase()) || /^\d/.test(n)) break;
      const gap = sentence.slice(tokens[j - 1].i + tokens[j - 1].t.length, tokens[j].i);
      if (gap.trim()) break;
      phrase = `${phrase} ${n}`;
      const allCaps = phrase.split(" ").every((w) => /^\p{Lu}/u.test(w));
      out.push({ text: phrase, kind: allCaps && i > 0 ? "proper" : "common" });
    }
  }
  return out;
}

export function analyze(rawText: string, fallbackTitle = "Study set"): Analysis {
  const text = cleanText(rawText);
  const blocks = text.split(/\n+/);
  const headings: string[] = [];
  const sections: { heading: string; text: string }[] = [];
  const sentences: string[] = [];
  const sentenceSection: number[] = [];
  const definitions: Definition[] = [];
  const lists: ListFact[] = [];
  const seenDef = new Set<string>();

  let current = { heading: "", text: "" };
  let pendingList: { label: string; items: string[]; source: string } | null = null;

  const sectionIndex = () => sections.length;
  const addDef = (term: string, def: string, source: string, minWords = 3) => {
    term = term.replace(/^(the|an?)\s+/i, "").replace(/\s+/g, " ").trim();
    const key = keyOf(term);
    if (!validTerm(term) || seenDef.has(key) || wordCount(def) < minWords || wordCount(def) > 60) return;
    if (norm(def).startsWith(norm(term))) return;
    seenDef.add(key);
    definitions.push({ term: upperFirst(term), definition: tidyDef(def), source, section: sectionIndex() });
  };
  const addList = (label: string, items: string[], source: string) => {
    const uniq = Array.from(new Map(items.map((i) => [norm(i), i])).values());
    if (uniq.length < 2 || uniq.length > 10) return;
    lists.push({ label: stripEnd(label).replace(/^(the|an?)\s+/i, ""), items: uniq, source, section: sectionIndex() });
  };
  const flushPending = () => {
    if (pendingList && pendingList.items.length >= 2) addList(pendingList.label, pendingList.items, pendingList.source);
    pendingList = null;
  };

  for (const block of blocks) {
    // "Causes:" followed by bullet lines becomes a list.
    if (BULLET.test(block) && pendingList) {
      const item = block.replace(BULLET, "").split(/\s*(?::|\s[-–—]\s)\s*/)[0];
      if (wordCount(item) <= 12) pendingList.items.push(stripEnd(item));
      pendingList.source += `\n${block}`;
      const line = LINE_DEF.exec(block);
      if (line?.groups && wordCount(line.groups.term) <= 5) addDef(line.groups.term, line.groups.def, block);
      continue;
    }
    flushPending();

    if (/:$/.test(block) && wordCount(block) <= 8) {
      const label = block.replace(/:$/, "");
      pendingList = { label: /\bof\b/i.test(label) || !current.heading ? label : `${label} of ${current.heading.replace(/^The\s/, "the ")}`, items: [], source: block };
      continue;
    }
    if (isHeading(block)) {
      if (current.text) sections.push(current);
      headings.push(block);
      current = { heading: block, text: "" };
      continue;
    }
    const line = LINE_DEF.exec(block);
    if (line?.groups && wordCount(line.groups.term) <= 5 && !/[.!?]/.test(line.groups.term)) addDef(line.groups.term, line.groups.def, block);

    for (const s of splitSentences(block)) {
      const wc = wordCount(s);
      if (wc < 5 || wc > 60) continue;
      if ((s.match(/\p{L}/gu)?.length ?? 0) < s.length * 0.55) continue;
      sentences.push(s);
      sentenceSection.push(sectionIndex());
      current.text += (current.text ? " " : "") + s;
      const body = stripEnd(s);

      let isList = false;
      const ls = LIST_SENTENCE.exec(body);
      const cl = COUNT_LIST_SENTENCE.exec(body);
      if (ls?.groups) {
        addList(`${ls.groups.noun} of ${ls.groups.subject}`, splitItems(ls.groups.items), s);
        isList = true;
      } else if (cl?.groups) {
        const items = splitItems(cl.groups.items);
        const n = Number(cl.groups.count) || ({ two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 } as Record<string, number>)[cl.groups.count.toLowerCase()];
        if (items.length === n) {
          addList(cl.groups.label, items, s);
          isList = true;
        }
      } else {
        const inc = INCLUDE_SENTENCE.exec(body);
        if (inc?.groups && !PRONOUN_START.test(inc.groups.subject)) {
          const items = splitItems(inc.groups.items);
          if (items.length >= 3) {
            addList(inc.groups.subject, items, s);
            isList = true;
          }
        }
      }

      if (!isList) for (const re of DEF_PATTERNS) {
        const m = re.exec(body);
        if (m?.groups) {
          addDef(m.groups.term, m.groups.def, s);
          break;
        }
      }
      const tl = TERM_LAST.exec(body);
      if (tl?.groups) addDef(tl.groups.term, tl.groups.def, s);
      for (const ab of s.matchAll(ABBREV)) if (ab.groups) addDef(ab.groups.short, ab.groups.long, s, 2);
    }
  }
  flushPending();
  if (current.text) sections.push(current);

  // Key terms: frequency x rarity, with the sections each appears in (a topic signal for distractors).
  const tf = new Map<string, { text: string; kind: TermKind; count: number; df: Set<number>; sections: Set<number> }>();
  sentences.forEach((s, idx) => {
    for (const { text: t, kind } of candidatePhrases(s)) {
      const key = keyOf(t);
      const e = tf.get(key) ?? { text: t, kind, count: 0, df: new Set<number>(), sections: new Set<number>() };
      e.count++;
      e.df.add(idx);
      e.sections.add(sentenceSection[idx]);
      if (kind === "proper") e.kind = "proper";
      tf.set(key, e);
    }
  });
  const N = Math.max(1, sentences.length);
  const defKeys = new Set(definitions.map((d) => keyOf(d.term)));
  const listItemKeys = new Set(lists.flatMap((l) => l.items.map(keyOf)));
  const terms: Term[] = [];
  for (const [key, e] of tf) {
    const words = wordCount(e.text);
    const defined = defKeys.has(key);
    if (e.count < 2 && !defined && e.kind === "common" && !listItemKeys.has(key)) continue;
    let score = e.count * Math.log(1 + N / e.df.size) * (words > 1 ? 1.6 : 1);
    if (defined) score *= 3;
    if (listItemKeys.has(key)) score *= 1.5;
    if (e.kind === "proper") score *= 1.3;
    if (e.kind === "number") score *= 0.6;
    if (e.text.length < 4) score *= 0.5;
    terms.push({ text: e.text, key, score, kind: e.kind, words, defined, count: e.count, sections: [...e.sections] });
  }
  terms.sort((a, b) => b.score - a.score);
  const top: Term[] = [];
  for (const t of terms) {
    if (top.length >= 150) break;
    if (top.some((o) => o.key.includes(t.key) && o.score >= t.score * 0.6 && !t.defined)) continue;
    top.push(t);
  }

  const listSources = new Set(lists.map((l) => l.source));
  const facts = extractFacts(sentences, sentenceSection, top, definitions, listSources);
  const title = headings.find((h) => wordCount(h) >= 2 && wordCount(h) <= 8 && !/:$/.test(h)) ?? fallbackTitle;
  return { title: toTitle(title), words: wordCount(text), sentences, headings, terms: top, definitions, lists, facts, sections };
}

function toTitle(s: string) {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s;
}

/* ------------------------------------------------------------------ */
/* Facts: sentences rewritten as real questions                          */
/* ------------------------------------------------------------------ */

const PERSON = /^(?!(?:The|A|An|In|On|At|By|For)\s)(?<name>(?:\p{Lu}[\p{Ll}'\-]+\s){1,3}\p{Lu}[\p{Ll}'\-]+)\s+(?<rest>(?:\p{Ll}+ed|led|won|wrote|built|made|found|took|gave|became|began|seized|developed|discovered|invented|proposed|described|founded|published)\b.+)$/u;

function toQuestion(sentence: string, answer: string, kind: Fact["kind"]): string | undefined {
  const body = stripEnd(sentence);
  if (kind === "person") {
    const m = PERSON.exec(body);
    if (m?.groups && m.groups.name === answer) return `Who ${m.groups.rest}?`;
  }
  if (kind === "year") {
    const m = new RegExp(`\\b(in|by|during|around|from)\\s+${escapeRe(answer)}\\b`, "i").exec(body);
    if (m) {
      const before = body.slice(0, m.index).trim();
      const after = body.slice(m.index + m[0].length).trim();
      // "... described the circulation of blood in 1628" -> "... in what year?"
      if (!after && before) return `${upperFirst(before)} in what year?`;
      // "In 1953, Watson and Crick described ..." -> "In what year did ..." needs verb surgery; ask plainly instead.
      if (m.index === 0 && /^in$/i.test(m[1])) return `${upperFirst(after.replace(/^,\s*/, ""))}. In what year?`;
    }
  }
  if (kind === "number") {
    const m = new RegExp(`\\b(?:about |around |approximately |roughly |over |nearly )?${escapeRe(answer)}\\s+(?<unit>\\p{L}+)`, "iu").exec(body);
    if (m?.groups && /s$/.test(m.groups.unit)) {
      return upperFirst(`${body.slice(0, m.index).trim()} how many ${m.groups.unit}${body.slice(m.index + m[0].length)}`.replace(/\s+/g, " ").trim()) + "?";
    }
  }
  if (kind === "term") {
    // "Mitochondria are the organelles that ..." -> "What are the organelles that ...?"
    const m = new RegExp(`^(?:the\\s+)?${escapeRe(answer)}\\s+(is|are|was|were)\\s+(?<rest>.+)$`, "iu").exec(body);
    if (m?.groups) return `What ${m[1].toLowerCase()} ${m.groups.rest}?`;
    // "The French Revolution began in 1789 ..." -> "What began in 1789 ...?"
    const e = new RegExp(`^(?:the\\s+)?${escapeRe(answer)}\\s+(?<rest>(?:\\p{Ll}+ed|began|led|took|became|won|lost|ended|started)\\b.+)$`, "iu").exec(body);
    if (e?.groups) return `What ${e.groups.rest}?`;
  }
  return undefined;
}

function extractFacts(sentences: string[], sectionOf: number[], terms: Term[], defs: Definition[], listSources: Set<string>): Fact[] {
  const facts: Fact[] = [];
  const testableTerms = terms.filter(testable).slice(0, 100);
  const defKeys = new Set(defs.map((d) => keyOf(d.term)));
  sentences.forEach((s, i) => {
    const wc = wordCount(s);
    if (wc < 6 || wc > 40) return;
    const penalty = PRONOUN_START.test(s) ? 0.5 : 1;
    const body = stripEnd(s);

    const person = PERSON.exec(body);
    if (person?.groups) {
      facts.push({ sentence: s, answer: person.groups.name, kind: "person", question: toQuestion(s, person.groups.name, "person"), section: sectionOf[i], score: 9 * penalty });
    }
    for (const m of body.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)) {
      const q = toQuestion(s, m[1], "year");
      facts.push({ sentence: s, answer: m[1], kind: "year", question: q, section: sectionOf[i], score: (q ? 8 : 6) * penalty });
    }
    for (const m of body.matchAll(/\b(\d{2,}(?:[.,]\d+)?%?)\b/g)) {
      if (isYear(m[1])) continue;
      const q = toQuestion(s, m[1], "number");
      if (q) facts.push({ sentence: s, answer: m[1], kind: "number", question: q, section: sectionOf[i], score: 6 * penalty });
    }
    let best: { t: Term; match: string } | null = null;
    const personSpan = person?.groups?.name ?? "";
    for (const t of PRONOUN_START.test(s) || listSources.has(s) ? [] : testableTerms) {
      if (t.kind === "number") continue;
      const m = new RegExp(`\\b${escapeRe(t.text)}\\b`, "i").exec(s);
      if (!m || t.words / wc > 0.4) continue;
      // "William _____" or "The _____ of Terror" gives nothing to reason about: the answer must be a whole unit.
      if (personSpan && personSpan.includes(m[0]) && personSpan !== m[0]) continue;
      const before = s.slice(0, m.index).trimEnd().split(/\s+/).pop() ?? "";
      const after = s.slice(m.index + m[0].length).trimStart().split(/\s+/)[0] ?? "";
      const glued = (w: string) => /^\p{Lu}/u.test(w) && !/[.,;:!?]$/.test(w);
      if (m.index > 0 && (glued(before) || (/^(of|de|von)$/i.test(after) && /^\p{Lu}/u.test(m[0])))) continue;
      if (glued(after) && /^\p{Lu}/u.test(m[0])) continue;
      if (testableTerms.some((o) => o !== t && o.words > t.words && o.key.includes(t.key) && new RegExp(`\\b${escapeRe(o.text)}\\b`, "i").test(s))) continue;
      if (defs.some((d) => wordCount(d.term) > t.words && keyOf(d.term).includes(t.key) && new RegExp(`\\b${escapeRe(d.term)}\\b`, "i").test(s))) continue;
      // Part of a longer name joined by "of/the/and": "Reign of _____", "Committee of _____".
      const lookback = s.slice(0, m.index).trimEnd().split(/\s+/).slice(-5);
      if (/^\p{Lu}/u.test(m[0]) && lookback.length && /^(of|the|and|de)$/i.test(lookback[lookback.length - 1]) && lookback.some((w) => /^\p{Lu}/u.test(w))) continue;
      // Mentioned twice: blanking one occurrence would leave the answer in plain sight.
      if ((s.match(new RegExp(`\\b${escapeRe(t.text)}\\b`, "gi"))?.length ?? 0) > 1) continue;
      if (!best || t.score > best.t.score) best = { t, match: m[0] };
    }
    if (best) {
      const q = toQuestion(s, best.match, "term");
      const bonus = (defKeys.has(best.t.key) ? 1.4 : 1) * (q ? 1.2 : 1) * (wc >= 9 && wc <= 28 ? 1.15 : 1);
      facts.push({ sentence: s, answer: best.match, kind: "term", question: q, section: sectionOf[i], score: Math.min(10, 3 + best.t.score / 4) * bonus * penalty });
    }
  });
  return facts.sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Distractors: same kind, same topic                                    */
/* ------------------------------------------------------------------ */

function numberDistractors(answer: string): string[] {
  const n = parseFloat(answer.replace(/,/g, ""));
  if (Number.isNaN(n)) return [];
  const pct = answer.endsWith("%") ? "%" : "";
  const year = isYear(answer);
  const vals = new Set<string>();
  const fmt = (v: number) => (Number.isInteger(v) ? (v >= 10000 && !year ? v.toLocaleString("en-US") : String(v)) : v.toFixed(1)) + pct;
  const tries = year ? shuffle([-11, -7, -4, 3, 6, 10, 15]) : n < 20 ? shuffle([-3, -2, -1, 1, 2, 4]) : shuffle([0.5, 0.75, 1.5, 2, 0.25, 3]);
  for (const d of tries) {
    let v = year || n < 20 ? n + d : n * d;
    if (!year && n >= 20) {
      const mag = Math.pow(10, Math.max(0, String(Math.round(v)).length - 2));
      v = Math.round(v / mag) * mag;
    }
    if (pct && v > 100) continue;
    if (v > 0 && fmt(v) !== fmt(n)) vals.add(fmt(v));
    if (vals.size >= 3) break;
  }
  return [...vals];
}

function isPersonName(s: string) {
  return /^(?:\p{Lu}[\p{Ll}'\-]+\s){1,3}\p{Lu}[\p{Ll}'\-]+$/u.test(s);
}

function peopleIn(a: Analysis) {
  return Array.from(new Set(a.facts.filter((f) => f.kind === "person").map((f) => f.answer)));
}

function distractorsFor(answer: string, a: Analysis, context: string, section?: number, extra: string[] = []): string[] {
  if (/^\d/.test(answer)) {
    const nums = numberDistractors(answer);
    if (nums.length >= 3) return nums.slice(0, 3);
  }
  const akey = keyOf(answer);
  const ctx = norm(context);
  const ctxWords = new Set(ctx.split(" ").map(stem));
  const aWords = wordCount(answer);
  const person = isPersonName(answer) && peopleIn(a).includes(answer);
  const head = lastWord(answer);
  const people = new Set(peopleIn(a));
  const longer = a.terms.filter((t) => t.words > 1 && testable(t)).map((t) => t.key);
  const pool: { text: string; fit: number }[] = [];
  const consider = (text: string, base: number, sections: number[] = []) => {
    const k = keyOf(text);
    if (!k || k === akey || k.includes(akey) || akey.includes(k) || ctx.includes(norm(text))) return;
    if (k.split(" ").some((w) => w.length >= 4 && ctxWords.has(w))) return;
    if (Math.abs(wordCount(text) - aWords) > 3) return; // a long phrase among short terms gives the answer away
    if (/^\d/.test(text) !== /^\d/.test(answer)) return;
    if (person !== people.has(text)) return;
    if (!text.includes(" ") && longer.some((l) => l !== k && l.split(" ").includes(k))) return;
    let fit = base;
    if (section !== undefined && sections.includes(section)) fit += 3;
    if (lastWord(text) === head) fit += 2;
    fit += 2 - Math.min(2, Math.abs(wordCount(text) - aWords));
    if (/^\p{Lu}/u.test(text) === /^\p{Lu}/u.test(answer)) fit += 1;
    pool.push({ text, fit: fit + Math.random() * 0.8 });
  };
  extra.forEach((e) => consider(e, 6));
  a.definitions.forEach((d) => consider(d.term, 4, [d.section]));
  a.lists.forEach((l) => l.items.forEach((it) => consider(it, 3, [l.section])));
  a.terms.filter((t) => testable(t) && t.kind !== "number").forEach((t) => consider(t.text, 1 + Math.min(2, t.score / 10), t.sections));
  pool.sort((x, y) => y.fit - x.fit);
  const out: string[] = [];
  for (const { text } of pool) {
    const keepCase = isPersonName(text) || /\p{Lu}.*\p{Lu}/u.test(text);
    const cased = keepCase ? text : /^\p{Lu}/u.test(answer) ? upperFirst(text) : /^\p{Ll}/u.test(answer) ? lowerFirst(text) : text;
    if (!out.some((o) => keyOf(o) === keyOf(cased))) out.push(cased);
    if (out.length >= 3) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Generators                                                           */
/* ------------------------------------------------------------------ */

export type QuestionType = "mcq" | "tf" | "fill";

export interface GenerateOptions {
  flashcards: number;
  questions: number;
  types: QuestionType[];
}

const joinList = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const blank = (sentence: string, answer: string) => sentence.replace(new RegExp(`\\b${escapeRe(answer)}\\b`), "_____");

export function generateFlashcards(a: Analysis, max: number): Item[] {
  const cards: Item[] = [];
  const used = new Set<string>();
  const push = (prompt: string, answer: string, explanation?: string) => {
    const k = norm(prompt);
    if (!prompt || !answer || used.has(k) || norm(answer) === k) return;
    used.add(k);
    cards.push({ id: uid(), prompt, answer, explanation });
  };
  for (const d of a.definitions) push(d.term, d.definition);
  for (const l of a.lists) push(`Name the ${l.items.length} ${lowerFirst(l.label)}`, `${upperFirst(joinList(l.items))}.`);
  // Fact cards are phrased as questions so recall is active, not recognition.
  const definedKeys = new Set(a.definitions.map((d) => keyOf(d.term)));
  for (const f of a.facts) {
    if (cards.length >= max) break;
    if (f.kind === "term" && (definedKeys.has(keyOf(f.answer)) || !f.question)) continue;
    push(f.question ?? blank(f.sentence, f.answer), f.answer, f.sentence);
  }
  return cards.slice(0, max);
}

interface Candidate {
  item: Item;
  score: number;
  topic: string;
}

export function generateQuestions(a: Analysis, max: number, types: QuestionType[]): Item[] {
  if (!types.length || max <= 0) return [];
  const allow = new Set(types);
  const out: Candidate[] = [];
  const mcq = (prompt: string, answer: string, wrong: string[], explanation: string | undefined, score: number, topic: string) => {
    if (wrong.length < 2) return;
    const options = shuffle([answer, ...wrong.slice(0, 3)]);
    out.push({ item: { id: uid(), prompt, answer, options, correctIndex: options.indexOf(answer), explanation }, score, topic });
  };
  const tf = (statement: string, truth: boolean, explanation: string | undefined, score: number, topic: string) => {
    out.push({ item: { id: uid(), prompt: `True or false: ${statement}`, answer: truth ? "True" : "False", options: ["True", "False"], correctIndex: truth ? 0 : 1, explanation }, score, topic });
  };
  const fill = (prompt: string, answer: string, explanation: string | undefined, score: number, topic: string) => {
    out.push({ item: { id: uid(), prompt, answer, explanation }, score, topic });
  };

  // 1. Definitions: the most reliable material in any set of notes.
  const defTerms = a.definitions.map((d) => d.term);
  for (const d of a.definitions) {
    const topic = keyOf(d.term);
    const desc = lowerFirst(stripEnd(d.definition));
    if (allow.has("mcq")) mcq(`Which term describes ${desc}?`, d.term, distractorsFor(d.term, a, d.definition, d.section, defTerms), d.source, 10, topic);
    if (allow.has("mcq") && a.definitions.length >= 4 && wordCount(d.definition) <= 22) {
      const wrongDefs = shuffle(a.definitions.filter((o) => o !== d))
        .sort((x, y) => Number(y.section === d.section) - Number(x.section === d.section))
        .slice(0, 3)
        .map((o) => o.definition);
      mcq(`What is ${/^\p{Lu}{2,}/u.test(d.term) ? d.term : lowerFirst(d.term)}?`, d.definition, wrongDefs, d.source, 8, topic + "#what");
    }
    if (allow.has("tf")) {
      const other = shuffle(a.definitions.filter((o) => o !== d)).sort((x, y) => Number(y.section === d.section) - Number(x.section === d.section))[0];
      const truth = !other || Math.random() < 0.5;
      const shown = truth ? desc : lowerFirst(stripEnd(other!.definition));
      tf(`"${d.term}" refers to ${shown}.`, truth, truth ? d.source : `${d.term}: ${d.definition}`, 7, topic + "#tf");
    }
    if (allow.has("fill") && wordCount(d.term) <= 3) fill(`What is the term for ${desc}?`, d.term, d.source, 9, topic + "#fill");
  }

  // 2. Lists: "which of these is (not) one of ...".
  for (const l of a.lists) {
    const topic = keyOf(l.label);
    const phrase = lowerFirst(l.label);
    const why = `The ${phrase}: ${joinList(l.items)}.`;
    const outsiders = distractorsFor(l.items[0], a, `${l.items.join(" ")} ${l.label}`, undefined, a.lists.filter((o) => o !== l).flatMap((o) => o.items));
    if (allow.has("mcq") && l.items.length >= 3 && outsiders.length >= 1) {
      mcq(`Which of these is not one of the ${phrase}?`, outsiders[0], shuffle(l.items).slice(0, 3), why, 9.5, topic + "#not");
    }
    if (allow.has("mcq") && outsiders.length >= 2) {
      mcq(`Which of these is one of the ${phrase}?`, l.items[Math.floor(Math.random() * l.items.length)], outsiders, why, 8.5, topic + "#is");
    }
    if (allow.has("tf") && outsiders.length) {
      const truth = Math.random() < 0.5;
      const item = truth ? l.items[Math.floor(Math.random() * l.items.length)] : outsiders[0];
      tf(`${upperFirst(item)} is one of the ${phrase}.`, truth, why, 7, topic + "#tf");
    }
    if (allow.has("fill") && l.items.length <= 8) fill(`How many ${phrase} are there?`, String(l.items.length), why, 6, topic + "#n");
  }

  // 3. Facts, rewritten as questions where the grammar allows.
  const termByKey = new Map(a.terms.map((t) => [t.key, t]));
  for (const f of a.facts) {
    const topic = `${keyOf(f.answer)}@${norm(f.sentence).slice(0, 40)}`;
    const prompt = f.question ?? blank(f.sentence, f.answer);
    const wrong = distractorsFor(f.answer, a, f.question ?? f.sentence, f.section);
    if (allow.has("mcq")) mcq(prompt, f.answer, wrong, f.sentence, f.score + (f.question ? 1 : 0), topic);
    const term = termByKey.get(keyOf(f.answer));
    if (allow.has("fill") && (f.kind !== "term" || (term && testable(term)))) fill(f.question ?? `Fill in the blank: ${prompt}`, f.answer, f.sentence, f.score * 0.9, topic + "#fill");
    const swapOk = f.kind === "year" || f.kind === "number" || (f.kind === "term" && a.definitions.some((d) => keyOf(d.term) === keyOf(wrong[0] ?? "") && d.section === f.section));
    if (allow.has("tf") && wrong[0] && f.kind !== "person" && (swapOk || Math.random() < 0.35)) {
      const truth = !swapOk || Math.random() < 0.5;
      const statement = truth ? f.sentence : f.sentence.replace(new RegExp(`\\b${escapeRe(f.answer)}\\b`), wrong[0]);
      tf(`${stripEnd(statement)}.`, truth, truth ? undefined : `The notes say: ${f.sentence}`, f.score * 0.75, topic + "#tf");
    }
  }

  // Keep the best, rotating through question types and never testing the same thing twice in a row.
  const kindOf = (c: Candidate): QuestionType => (!c.item.options ? "fill" : c.item.options.length === 2 && c.item.options[0] === "True" ? "tf" : "mcq");
  const byType = new Map<QuestionType, Candidate[]>();
  for (const c of out) {
    const t = kindOf(c);
    if (allow.has(t)) byType.set(t, [...(byType.get(t) ?? []), c]);
  }
  for (const list of byType.values()) list.sort((x, y) => y.score - x.score);
  const chosen: Candidate[] = [];
  const conceptUsed = new Map<string, number>();
  const concept = (topic: string) => topic.split(/[#@]/)[0];
  const answersUsed = new Set<string>();
  const promptsUsed = new Set<string>();
  const fresh = (c: Candidate) => !promptsUsed.has(norm(c.item.prompt.replace(/^(true or false|fill in the blank):\s*/i, ""))) && (c.item.options?.length === 2 || !answersUsed.has(keyOf(c.item.answer)));
  const order = types.filter((t) => byType.has(t));
  for (const allowRepeat of [false, true]) {
  while (chosen.length < max) {
    let progressed = false;
    for (const t of order) {
      const list = byType.get(t)!;
      const idx = allowRepeat
        ? list.findIndex((c) => (conceptUsed.get(concept(c.topic)) ?? 0) < 2 && c.score >= 7 && !promptsUsed.has(norm(c.item.prompt.replace(/^(true or false|fill in the blank):\s*/i, ""))))
        : list.findIndex((c) => !conceptUsed.has(concept(c.topic)) && fresh(c));
      if (idx < 0) continue;
      const [c] = list.splice(idx, 1);
      chosen.push(c);
      conceptUsed.set(concept(c.topic), (conceptUsed.get(concept(c.topic)) ?? 0) + 1);
      answersUsed.add(keyOf(c.item.answer));
      promptsUsed.add(norm(c.item.prompt.replace(/^(true or false|fill in the blank):\s*/i, "")));
      progressed = true;
      if (chosen.length >= max) break;
    }
    if (!progressed) break;
  }
  }
  return shuffle(chosen).map((c) => c.item);
}

/** How many good items this document actually supports, per output. */
export function capacity(a: Analysis, types: QuestionType[] = ["mcq", "tf", "fill"]) {
  const quizTypes = types.filter((t) => t !== "fill");
  return {
    flashcards: generateFlashcards(a, 200).length,
    questions: generateQuestions(a, 200, types.length ? types : ["mcq"]).length,
    quiz: generateQuestions(a, 200, quizTypes.length ? quizTypes : ["mcq"]).length,
  };
}
