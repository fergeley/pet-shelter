# The server-action auth guard can pass a function on its neighbour's authorization

**Status:** MEASURED · opened 2026-09-08 · found while making `getPetById` archive-aware

`collectServerActions` in `tests/unit/serverActionAuth.test.ts` slices each action's body from
its own `export async function` to the **next one**:

    const pattern = /^export\s+async\s+function\s+([A-Za-z0-9_]+)/gm;
    ...
    const end = i + 1 < starts.length ? starts[i + 1].index : source.length;
    found.push({ file, name: start.name, body: source.slice(start.index, end) });

Anything between two exported actions is therefore attributed to the **earlier** one. In
`src/actions/pets.ts` the private helper

    async function getAdminActorOrThrow(): Promise<AdminPrincipal> {
      const principal = await verifyAdminSession(PERMISSIONS.MANAGE_PETS);

sits immediately after `getPetById`, so `getPetById`'s "body" contained `verifyAdminSession`
and `getAdminActorOrThrow` — two AUTH_TOKENS — and the guard read it as authorized. It never
called either. It is a public catalogue read; it was correct for it to be unguarded, but the
guard was not the thing establishing that.

This matters because the failure is **positional**. Any unguarded action that happens to be
followed by a private helper containing an auth token passes. Move the helper, or add an action
between them, and the same code starts failing — which is the opposite of what a security guard
should do, and it means the test's green is not evidence for the actions near a helper.

`getPetById` is now listed in `INTENTIONALLY_PUBLIC` with its reason, so this particular
function is classified explicitly rather than by adjacency. The extractor is unchanged.

**Settles when:** the extractor stops at the end of the function it is reading — brace matching,
or at minimum cutting at the first subsequent top-level `function`/`const`/`export`, not only at
the next *exported async* one — and the fix is demonstrated by an unguarded action placed before
a token-bearing private helper still failing the suite.

Adjacent to `tasks/open/server-action-auth-guard-has-not-seen-the-faq-reads.md`, which asks a
different question about the same suite: that one is about reach, this one about attribution.
