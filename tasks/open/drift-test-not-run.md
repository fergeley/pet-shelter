# The drift test has not been run

**Status:** open · opened 2026-08-30

Four of five litmus tests ran and passed (see
`tasks/decisions/2026-08-30-litmus-tests-all-passed.md`). The fifth did not:
**20 turns in one session, checking that triage still fires first and that the ledger still goes
to files rather than to chat.** Every short run passed; nothing is known about turn 20.

This is the test most likely to fail, because it is the only one measuring *decay* rather than
behaviour — and decay is what artifacts were supposed to prevent.

**Settles when:** a sustained session is run and triage is observed at the last turn.
