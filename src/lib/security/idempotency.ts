interface IdempotencyRecord<T> {
  response: T;
  expiresAt: number;
}

const idempotencyStore = new Map<string, IdempotencyRecord<unknown>>();

/**
 * Wraps an async operation with idempotency protection.
 * If the key has already been processed within the TTL window, returns the cached result.
 */
export async function withIdempotency<T>(
  key: string | undefined | null,
  operation: () => Promise<T>,
  ttlMs = 1000 * 60 * 10 // 10 minutes
): Promise<T> {
  if (!key || key.trim() === "") {
    return operation();
  }

  const cleanKey = `idemp:${key.trim()}`;
  const now = Date.now();
  const cached = idempotencyStore.get(cleanKey);

  if (cached && now < cached.expiresAt) {
    return cached.response as T;
  }

  // Execute operation
  const result = await operation();

  // Cache response
  idempotencyStore.set(cleanKey, {
    response: result,
    expiresAt: now + ttlMs,
  });

  return result;
}
