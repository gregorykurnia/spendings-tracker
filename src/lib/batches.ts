/** Firestore allows 500 writes per batch; staying under it leaves room for one or two extra writes. */
export const MAX_BATCH_WRITES = 450;

export function inChunks<T>(items: T[], size = MAX_BATCH_WRITES): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
