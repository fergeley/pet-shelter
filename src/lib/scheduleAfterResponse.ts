import { after } from "next/server";

/**
 * Runs work after the HTTP response has been sent.
 *
 * The pattern already used elsewhere in this codebase — `sendEmail(...).catch(...)`
 * as a floating promise — is not actually safe on a serverless platform: the
 * function instance can be frozen the moment the response is returned, dropping
 * anything still in flight. Next's `after()` (stable since 15.1) hands the
 * promise to the platform's `waitUntil`, which keeps the invocation alive until
 * it settles.
 *
 * Falls back to a floating promise when called outside a request scope, so that
 * unit tests and scripts can exercise the same code paths.
 */
export function scheduleAfterResponse(work: () => Promise<unknown>): void {
  const guarded = () =>
    Promise.resolve()
      .then(work)
      .catch((err) => {
        console.error("[Deferred Work] Failed after response:", err);
      });

  try {
    after(guarded);
  } catch {
    // No request context (tests, scripts, build-time). Run it inline instead.
    void guarded();
  }
}
