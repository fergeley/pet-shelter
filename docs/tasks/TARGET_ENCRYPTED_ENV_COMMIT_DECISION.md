# Target — Commit (or don't) the SOPS-encrypted production env

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Status**: ⏸ Blocked on a human decision. Nothing else is outstanding.
**Related**: [Runbook: SOPS Secrets Management](../runbooks/RUNBOOK_SOPS_SECRETS_MANAGEMENT.md)

---

## 1. What is pending

`4251a4c` committed the SOPS tooling — `.sops.yaml`, `scripts/secrets.mjs`, the runbook,
and `tests/unit/sopsConfig.test.ts`. **The encrypted payload it exists to manage,
`.env.production.enc`, was deliberately left untracked.**

That is the only uncommitted file in the tree.

```
$ git status --short
?? .env.production.enc
```

---

## 2. Why it was paused rather than committed

Adding a secrets blob to git history is the one action in this workstream a later commit
cannot undo. A `git rm` removes it from the *tip*, not from history — every clone, every
fork, and every CI cache keeps the blob. So the real question is not "is this file safe
today" but:

> If the age private key ever leaks — laptop, CI variable, backup, a future team member
> leaving — is every value in this file acceptable to have been exposed for the entire
> lifetime of the repository?

The values are production credentials for a live NGO handling applicant PII under PDPA
2010. That question is the shelter's to answer, not an agent's.

---

## 3. What was verified before pausing

All of this checked out. The file is safe *by construction*; the pause is about history,
not about a defect.

| Check | Result |
|---|---|
| Every value encrypted | ✅ 13 × `ENC[AES256_GCM,...]`, 0 plaintext assignments |
| Which values | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SECRET_KEY`, `STAFF_INVITE_SECRET`, `RESEND_API_KEY`, `NEON_BRANCH`, `ADMIN_EMAIL`, `SENDER_EMAIL`, `ROS_REGISTRATION_NO`, `NODE_ENV` |
| Plaintext remaining | Key *names*, the age **public** recipient, SOPS metadata (`version`, `lastmodified`, `mac`) — all safe to publish |
| Runbook key material | None. `AGE-SECRET-KEY-1...` and the `Y`-filled string are placeholders |
| `.gitignore` blast radius | Narrow — `.env.local`, `.env`, `.env.production` all still resolve to **ignored** |

That last row matters most. `scripts/secrets.mjs decrypt-to-local` writes *plaintext* to
`.env.local`. The `!.env*.enc` negation added alongside it does not un-ignore that file, so
a future `git add -A` cannot commit the decrypted secrets by accident. Re-verify with:

```bash
git check-ignore -v .env.local .env .env.production   # all three must print a rule
git check-ignore -v .env.production.enc               # must print nothing
```

---

## 4. Options

**A — Commit it (the SOPS design as intended).** Encrypted-secrets-in-git is precisely what
SOPS is for; it gives CI a single source of truth and makes secret changes reviewable in a
diff. Choose this if the age private key is held only in a password manager and CI secret
store, and rotation on staff departure is a process you will actually run.

```bash
git add -f .env.production.enc
git commit -m "chore(secrets): add SOPS-encrypted production env"
```

`-f` is required: the file is only committable because of the `!.env*.enc` negation, and
git still wants the override to be explicit.

**B — Keep it out of git.** Distribute the `.enc` file out of band (password manager, CI
file-type secret) and keep the tooling for local decryption only. Costs reviewability;
removes the history question entirely. Choose this if key custody is uncertain.

**Recommendation: A, but only after rotating.** The values in that blob have been sitting
in plaintext `.env.local` on a developer machine that two agent sessions have been reading
all day. Rotate `SESSION_SECRET`, `ADMIN_SECRET_KEY`, `STAFF_INVITE_SECRET`, `ADMIN_PASSWORD`
and `RESEND_API_KEY`, re-encrypt, *then* commit — so the first thing entering permanent
history is a set of credentials that has never been loose.

If you choose B, delete the `!.env*.enc` negation from `.gitignore` so the exception cannot
be inherited by a later file nobody audits.

---

## 5. Separate open item — work destroyed 2026-08-28

Unrelated to the decision above, and needs action before the parallel session exits.

An agent error (an unquoted bash heredoc executed backticked prose containing
`git reset --hard`) discarded the **unstaged** edits of the parallel session to:

- `README.md`
- `docs/README.md`
- `docs/setup.md`
- `tasks/lessons.md`

Unstaged content never reaches git's object database, so `git fsck --lost-found` recovers
nothing — confirmed, only unrelated dangling trees were present. Its 15 staged
`docs/tasks/` → `docs/archives/tasks/` renames were also unstaged, but those are trivially
redoable since the blob content is unchanged. Its untracked SOPS work was unaffected and
is now committed in `4251a4c`.

**Action:** ask the parallel session to re-apply those four files from its own context
before it ends. Nothing else can recover them.

---

## 6. Definition of done

- [ ] Decision recorded (A or B) by a human.
- [ ] If A: secrets rotated, file re-encrypted, committed with `git add -f`.
- [ ] If B: `!.env*.enc` negation removed from `.gitignore`; `.env.production.enc`
      distributed out of band.
- [ ] Parallel session's four lost files re-applied.
- [ ] `git status --short` clean.
