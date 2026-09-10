# Master's Playwright job has been red since PR #39 merged, so every PR inherits two failures

**Status:** open · opened 2026-09-11 · found while merging PR #36

`master` was green at `1b3b6e4` (#37). It went red at `c7fb58f`, the merge of #39
(`feat(adoption): Add multi-step application form and tracking`):

    c7fb58f completed failure — Merge pull request #39 from fergeley/adoption-form-and-tracking
    1b3b6e4 completed success — chore(tasks): Reconcile the ledger (#37)

#39 was merged with two of its own checks failing — `Playwright golden paths` and
`Commit messages`. Because GitHub runs a PR's workflows against the **computed merge with master**,
every open PR now shows the same Playwright failure whether or not it touches adoption. PR #36
changed nothing near adoption and was 23/23 green against `1b3b6e4`; against `c7fb58f` it failed
exactly these two, on the first attempt and on the retry:

    01_public_adoption_flow.spec.ts:31 › submits an application and confirms it was received
    01_public_adoption_flow.spec.ts:50 › refuses an incomplete application
      TimeoutError: locator.click: Timeout 15000ms exceeded.
        - waiting for getByRole('dialog').getByRole('button', { name: /submit/i })

## Likely cause — reasoned, not verified

The page object clicks a Submit button inside the adoption dialog. #39 made that form multi-step,
so Submit presumably no longer exists until the earlier steps are completed. That fits the
locator, the timing and the PR's title, but **nobody has opened the page object against the new
form yet** — the fix may be in the page object, in the form, or both.

It is the same shape as the defect PR #36's review found in `e2e/pages/DonatePage.ts`: a form
changed and the page object that drives it did not. See
`tasks/lessons/2026-09-09-checking-the-spec-is-not-checking-the-page-object.md`.

## Why it goes first

It blocks nothing on its own, but it makes every other PR's CI unreadable. A red Playwright job
that is "always red" teaches people to merge past it — which is how #39 landed — and then a real
regression in someone else's PR reads as the known failure.

**Agent-checkable trigger:**

```bash
gh run list --branch master --limit 1 --json conclusion --jq '.[0].conclusion'
```

Expected today: `failure`. When it prints `success`, delete this file.

## Settles when

Master's latest run is green again, and the adoption page object drives the multi-step form rather
than assuming a single-step dialog.
