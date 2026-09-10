# Read the bundled Next docs before proposing a framework fix

**Learned:** 2026-09-03

Three conclusions from a careful self-review were wrong, and `node_modules/next/dist/docs/`
overturned all three: the post-mutation refetch fix was backwards; branching on the `RSC` header in
`proxy` is impossible because Next strips those headers on purpose; and
`NextResponse.rewrite(url, { status })` silently drops the status. This is a modified Next.js —
general knowledge of Next is not evidence about it.
