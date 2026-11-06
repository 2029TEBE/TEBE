/** Bound directory reads without imposing a maximum traversable account count. */
export function accountDirectoryQuery(rawLimit?: string, rawCursor?: string, rawQuery?: string) {
  const limit = rawLimit === undefined ? 25 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
    throw new Error('Use a limit between 1 and 50');
  const cursor = rawCursor ?? null;
  if (cursor !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))
    throw new Error('Invalid account cursor');
  const q = (rawQuery ?? '').trim();
  if (q.length > 100 || /[\u0000-\u001f\u007f]/.test(q))
    throw new Error('Search must contain at most 100 printable characters');
  return { limit, cursor, q };
}
