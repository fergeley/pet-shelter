# A green deploy proves one variable was set, and nothing else

**Learned:** 2026-09-03

A Vercel production build failed with `SecretConfigurationError` collecting page data for
`/api/upload`. The cause was correct and deliberate: `crypto.ts` resolves `getSessionSecret()` at
module load, `next build` imports every route module, and `TARGET_SECRET_HARDENING.md` §5 names
that exact failure as a gate. Setting the secret cleared it.

What the green build then hid was worse than what the red one showed. `DATABASE_URL`,
`RESEND_API_KEY`, `EMAIL_FROM`, `SHELTER_NOTIFICATION_EMAIL` and `NEXT_PUBLIC_APP_URL` all degrade
into something shaped like success: the pet repository serves `src/data/pets.json` fixtures, and
the mailer returns `{success: true, simulated: true}` and writes an audit row saying the mail was
sent. Exactly one of eight variables fails loudly, and it is the one that had just been fixed.

**Rule:** when a deploy's only failure mode is loud, enumerate the silent ones before calling it
done. Grep `process.env.` across `src/`, and for each name ask what the code does when it is
absent. Every `|| "default"` is a silent failure waiting for production.

**Corollary — identity does not distinguish a fallback; count does.** The build prerendered
`/pets/pet-001`…, which looked like fixture data, but `prisma/seed.ts` seeds *from that same JSON*,
so a correctly-seeded database holds identical ids. The ids were unusable as evidence and an early
call based on them was overstated. What settled it was arithmetic: 10 prerendered paths against 8
rows in `pets`, and 10 entries in the fixture file. `getServerPetsAsync` returns fixtures both when
the query throws *and* when it returns zero rows, so the two causes are also indistinguishable —
only the count separates fixture from database at all.
