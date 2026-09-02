/**
 * A Prisma client that always reports the database as unreachable.
 *
 * The sponsor suites exercise the in-memory fallback path, and they used to reach that
 * path by accident: `src/lib/prisma.ts` defaults `DATABASE_URL` to localhost, nothing was
 * listening, so every call threw. That is not a test fixture, it is a coincidence — and a
 * dangerous one, because this repo's `.env.local` points `DATABASE_URL` at a Neon
 * *production* branch. On a machine where that variable is exported, those suites would
 * have run `prisma.sponsor.create` and `prisma.sponsorContribution.updateMany` against it.
 *
 * Mocking it explicitly makes the fallback path deliberate and makes the suites incapable
 * of touching a real database.
 */
export const prisma = new Proxy(
  {},
  {
    get: () =>
      new Proxy(
        {},
        {
          get: () => async () => {
            throw new Error("ECONNREFUSED (test stub: database intentionally unreachable)");
          },
        }
      ),
  }
) as never;

export default prisma;
