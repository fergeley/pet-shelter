/**
 * Maps over items with a bounded number of operations in flight, settling every
 * one and preserving input order in the results.
 *
 * `Promise.all` / `Promise.allSettled` over a mapped array start *everything* at
 * once. For a few items that is fine; for a mailing list it means hundreds of
 * simultaneous requests to one provider, which earns rate-limit rejections that
 * are indistinguishable from real delivery failures.
 */
export async function settleWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function run(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;

      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: effectiveLimit }, () => run()));
  return results;
}
