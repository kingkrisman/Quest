/** Answer checking shared by Learn and Exam. */

/** Lowercase, strip accents and punctuation, collapse spaces. Works for any script. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Forgiving check: ignores case, accents, punctuation and small typos. */
export function isClose(given: string, answer: string) {
  const g = normalize(given);
  const a = normalize(answer);
  if (!g || !a) return false;
  return g === a || distance(g, a) <= Math.max(1, Math.floor(a.length * 0.15));
}
