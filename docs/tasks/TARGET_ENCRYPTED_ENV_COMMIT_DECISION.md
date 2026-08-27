# Target — SOPS-encrypted production env: committed, now rotate

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Status**: ✅ Decided and committed (`8e61027`). ⏳ One follow-up action outstanding: rotate.
**Related**: [Runbook: SOPS Secrets Management](../runbooks/RUNBOOK_SOPS_SECRETS_MANAGEMENT.md)

---

## 1. What happened

`4251a4c` committed the SOPS tooling — `.sops.yaml`, `scripts/secrets.mjs`, the runbook, and
`tests/unit/sopsConfig.test.ts` — and deliberately left the encrypted payload untracked
pending a human decision.

That decision was made minutes later: **`8e61027` committed `.env.production.enc`**. The
tree is clean and nothing is outstanding in git.

This doc is kept because the decision has a consequence that outlives it.

---

## 2. What was verified before it went in

The file is safe *by construction*. None of the following changed the decision — they are
recorded so nobody has to re-derive them.

| Check | Result |
|---|---|
| Every value encrypted | ✅ 13 × `ENC[AES256_GCM,...]`, 0 plaintext assignments |
| Which values | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SECRET_KEY`, `STAFF_INVITE_SECRET`, `RESEND_API_KEY`, `NEON_BRANCH`, `ADMIN_EMAIL`, `SENDER_EMAIL`, `ROS_REGISTRATION_NO`, `NODE_ENV` |
| Plaintext remaining | Key *names*, the age **public** recipient, SOPS metadata (`version`, `lastmodified`, `mac`) — all safe to publish |
| Runbook key material | None. `AGE-SECRET-KEY-1...` and the `Y`-filled string are placeholders |
| `.gitignore` blast radius | Narrow — `.env.local`, `.env`, `.env.production` all still resolve to **ignored** |

That last row is the one to re-check if `.gitignore` is ever edited.
`scripts/secrets.mjs decrypt-to-local` writes *plaintext* to `.env.local`, and the
`!.env*.enc` negation added alongside it must never widen far enough to catch that file:

```bash
git check-ignore -v .env.local .env .env.production   # all three must print a rule
git check-ignore -v .env.production.enc               # must print nothing
```

---

## 3. The outstanding action: rotate

**Why now, and not "sometime".** Committing a secrets blob is the one action here that a
later commit cannot undo. `git rm` removes it from the *tip*, not from history — every
clone, fork and CI cache keeps the blob. The security question is therefore no longer "is
this safe to commit" but:

> If the age private key ever leaks — laptop, CI variable, backup, a team member leaving —
> every value in `8e61027` is exposed, retroactively, for the lifetime of the repository.

And these particular values are not pristine. They sat in plaintext in `.env.local` on a
developer machine that two agent sessions read from all day on 2026-08-28. The credentials
now in permanent history are credentials that have already been loose.

Rotate these, re-encrypt, and commit the new blob. From then on, history's oldest version
holds only dead values:

- `SESSION_SECRET` — forges any staff session cookie
- `ADMIN_SECRET_KEY` — the legacy `admin_session` bearer token, no expiry, no revocation
  (see `docs/archives/tasks/TARGET_SECRET_HARDENING.md` §3.5)
- `STAFF_INVITE_SECRET` — the only gate on registering an account that can read applicant
  PII under PDPA 2010
- `ADMIN_PASSWORD`
- `RESEND_API_KEY`
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — rotate the Neon role password

```bash
npm run secrets:edit:prod      # rotate values in place
npm run secrets:check          # confirm it still decrypts
git add .env.production.enc && git commit -m "chore(secrets): rotate production credentials"
```

Keep the age **private** key out of the repo entirely — password manager plus a CI
file-type secret. `.sops.yaml` holds only the public recipient, which is correct.

---

## 4. Separate open item — work destroyed 2026-08-28

Unrelated to the above, and only the parallel session can still fix it.

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
landed in `4251a4c` / `8e61027`.

**Action:** ask the parallel session to re-apply those four files from its own context
before it ends.

---

## 5. Definition of done

- [x] Decision made and `.env.production.enc` committed (`8e61027`).
- [x] Payload verified fully encrypted before it entered history.
- [ ] Production credentials rotated and re-encrypted.
- [ ] Age private key confirmed to live only in a password manager and CI secret store.
- [ ] Parallel session's four lost files re-applied.
