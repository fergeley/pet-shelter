# De-duplicating shared data must not cost server rendering

**Learned:** 2026-09-03

Two pages held their own hard-coded copies of the same expense split. Collapsing
them onto one derived source was right, but the shared component fetched on mount
from a client component, so the donate page lost its server-rendered content, its
first paint and its crawlability. A correctness fix had been traded for a
performance and SEO regression, and the whole test suite stayed green through it.

**Rule:** when a client component needs server data, move the fetch up to a Server
Component and pass props down; never let a shared presentational component fetch
for itself. After any such refactor, `curl` the affected routes and grep the
server HTML for the content that should be in it. "The tests pass" does not prove
the content is still server-rendered.
