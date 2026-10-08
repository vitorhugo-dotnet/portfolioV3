export type ReadingLogBook = {
  id: string;
  title: string;
  author: string;
  url: string;
  coverUrl?: string;
  finishedAt?: string;
};

export type ReadingLogSnapshot = {
  generatedAt: string;
  currentlyReading: ReadingLogBook[];
  recentlyFinished: ReadingLogBook[];
  toRead: ReadingLogBook[];
};

type GoodreadsShelves = {
  currentlyReading: unknown;
  read: unknown;
  toRead: unknown;
};

const limits = { currentlyReading: 3, recentlyFinished: 4, toRead: 4 };

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeGoodreadsUrl(value: unknown): string | undefined {
  const raw = nonEmptyString(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      !["goodreads.com", "www.goodreads.com"].includes(url.hostname) ||
      !url.pathname.startsWith("/book/show/")
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function safeCoverUrl(value: unknown): string | undefined {
  const raw = nonEmptyString(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function validDate(value: unknown): string | undefined {
  const raw = nonEmptyString(value);
  if (!raw) return undefined;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : undefined;
}

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeBook(value: unknown): ReadingLogBook | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  const title = nonEmptyString(row.title);
  const url = safeGoodreadsUrl(row.bookLink);
  if (!title || !url) return;

  const id = nonEmptyString(row.guid) ?? url;
  const author = nonEmptyString(row.author) ?? "";
  const coverUrl = safeCoverUrl(row.imageLink);
  const finishedAt = validDate(row.readAt);
  return {
    id,
    title,
    author,
    url,
    ...(coverUrl ? { coverUrl } : {}),
    ...(finishedAt ? { finishedAt } : {}),
  };
}

function normalizeShelf(value: unknown, limit: number): ReadingLogBook[] {
  return rows(value)
    .map(normalizeBook)
    .filter((book): book is ReadingLogBook => Boolean(book))
    .slice(0, limit);
}

export function normalizeReadingLog(
  shelves: GoodreadsShelves,
  generatedAt: string,
): ReadingLogSnapshot {
  const finished = rows(shelves.read)
    .map((row, index) => ({ book: normalizeBook(row), index }))
    .filter(
      (item): item is { book: ReadingLogBook; index: number } =>
        item.book !== undefined,
    )
    .sort((a, b) => {
      const aDate = a.book.finishedAt ? Date.parse(a.book.finishedAt) : -1;
      const bDate = b.book.finishedAt ? Date.parse(b.book.finishedAt) : -1;
      return bDate - aDate || a.index - b.index;
    })
    .slice(0, limits.recentlyFinished)
    .map(({ book }) => book);

  return {
    generatedAt,
    currentlyReading: normalizeShelf(
      shelves.currentlyReading,
      limits.currentlyReading,
    ),
    recentlyFinished: finished,
    toRead: normalizeShelf(shelves.toRead, limits.toRead),
  };
}
