export type FuzzyMatch = { score: number; indices: number[] };

/**
 * Case-insensitive subsequence match. Contiguous runs and word-start hits
 * score higher; ties are left to the caller's stable sort.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, indices: [] };
  const t = text.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let from = 0;
  for (const char of q) {
    const index = t.indexOf(char, from);
    if (index === -1) return null;
    const previous = indices[indices.length - 1];
    if (previous !== undefined && index === previous + 1) score += 3;
    if (index === 0 || /[\s/\-_]/.test(t[index - 1] ?? "")) score += 2;
    score += 1;
    indices.push(index);
    from = index + 1;
  }
  if (t.startsWith(q)) score += 5;
  return { score, indices };
}

export type RankedItem<T> = { item: T; score: number; indices: number[] };

/** Ranks items by best match against title (highlighted) or keywords. Stable. */
export function rankByQuery<T>(
  items: T[],
  query: string,
  getTitle: (item: T) => string,
  getKeywords: (item: T) => string[] = () => [],
): RankedItem<T>[] {
  const ranked: (RankedItem<T> & { order: number })[] = [];
  items.forEach((item, order) => {
    const titleMatch = fuzzyMatch(query, getTitle(item));
    let best: FuzzyMatch | null = titleMatch;
    for (const keyword of getKeywords(item)) {
      const match = fuzzyMatch(query, keyword);
      if (match && (!best || match.score > best.score)) best = { score: match.score, indices: [] };
    }
    if (best) ranked.push({ item, score: best.score, indices: titleMatch?.indices ?? [], order });
  });
  ranked.sort((a, b) => b.score - a.score || a.order - b.order);
  return ranked.map(({ item, score, indices }) => ({ item, score, indices }));
}
