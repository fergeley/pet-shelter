# Dual-layer persistence requires Chesterton's Fence analysis before refactoring fallbacks

**Learned:** 2026-08-28

Dual-layer stores (`Prisma` with in-memory JSON fallback) seem like redundant code duplication and maintenance burden at first glance. However, ripping them out completely would either break sub-second, zero-dependency unit tests or silently break test doubles (`prismaDouble.ts`) that rely on query fallback behaviors.

**Rule:** before simplifying fallback stores, discover their load-bearing invariants through test runs. Ensure that:
1. Pure unit tests run without local DB timeouts via clean in-memory state.
2. Tier 3 strict persistence integration tests (`STRICT_PERSISTENCE=true`) rethrow real database failures rather than masking them.
3. Repositories maintain single-source-of-truth invariants without creating race conditions or phantom data resurrection.
