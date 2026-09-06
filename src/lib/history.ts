export type DatedId = { id: string; createdAt: Date };

export function byNewestStable<T extends DatedId>(a: T, b: T) {
  const t = b.createdAt.getTime() - a.createdAt.getTime();
  if (t !== 0) return t;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Newest `take` rows, then chronological (oldest of that window first). */
export function newestThenChrono<T extends DatedId>(rows: T[], take: number): T[] {
  return [...rows].sort(byNewestStable).slice(0, take).reverse();
}

export const HISTORY_ORDER = [{ createdAt: "desc" as const }, { id: "desc" as const }];
