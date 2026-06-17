/**
 * Text-difference helpers used to quantify how much a participant changed the
 * AI output before submitting.
 */

/**
 * Levenshtein edit distance between two strings — the minimum number of
 * single-character insertions, deletions, or substitutions to turn `a` into `b`.
 * Uses a two-row rolling buffer so memory stays O(min(a, b)).
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Keep the shorter string as the inner loop to minimise the row width.
  if (a.length > b.length) [a, b] = [b, a];

  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  let curr = new Array<number>(a.length + 1);

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1, // deletion
        curr[i - 1] + 1, // insertion
        prev[i - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[a.length];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Signed difference in word count between the final and original text.
 * Positive = participant added words, negative = removed words.
 */
export function wordDelta(original: string, final: string): number {
  return wordCount(final) - wordCount(original);
}
