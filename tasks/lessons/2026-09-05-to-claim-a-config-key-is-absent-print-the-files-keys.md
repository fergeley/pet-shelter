# To claim a config key is absent, print the file's keys

**Learned:** 2026-09-05

I hand-rolled a `PreToolUse` shell parser to fence irreversible commands, hardened it through five
review rounds, then discovered Claude Code ships `permissions.allow/deny/ask`. Reporting that, I
wrote *"the platform's mechanisms were entirely unused"* — having printed `settings.permissions`,
seen only `defaultMode`, and generalised. `~/.claude/settings.json` carries a top-level `autoMode`
profile with 23 environment entries and 3 `soft_deny` rules, two of which already blocked
`prisma db push` and seeds against a production `DATABASE_URL`. It is one line away from the key I
did print. An auto-memory note had recorded it since 2026-08-31.

**Rule:** "feature X is not configured here" is a claim about a file, and the only evidence for it
is that file's key list — `Object.keys(JSON.parse(...))`, printed, whole. Reading one sub-object and
generalising to the file is the same error as reading one test and generalising to the suite. Do
this *before* building the thing, because the search that finds the feature is the same search that
finds the config.
