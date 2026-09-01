# End-to-end verification

## `verify-promotion.sh` — repeatable promotion-cascade proof

Proves, against a **live** PipeCraft repo, that a change pushed to the initial branch
actually promotes all the way through to the final branch.

```bash
tests/e2e/verify-promotion.sh <owner/repo> [domain-file-to-touch]

# e.g.
tests/e2e/verify-promotion.sh the-craftlab/pipecraft-example-basic
tests/e2e/verify-promotion.sh the-craftlab/pipecraft-example-gated services/auth-service.js
```

What it does (idempotent — safe to re-run):

1. Clones the repo into a temp dir.
2. Resets every downstream branch to the initial branch's tip (a clean, even base).
3. Commits a unique `feat:` touching a domain file and pushes it to the initial branch.
4. Polls until that exact commit is reachable from the final branch — i.e. the promotion
   cascade carried it through — then exits `0`. Times out (non-zero) if it never arrives.

Requirements: `gh` authenticated with push access to the target repo, and the repo already
set up (`pipecraft setup` + `pipecraft setup-github`). Use the disposable
`the-craftlab/pipecraft-example-*` repos.

The canonical flavors this is run against:

| Repo                        | Flow                                          | Promotion    |
| --------------------------- | --------------------------------------------- | ------------ |
| `pipecraft-example-minimal` | develop → main                                | auto         |
| `pipecraft-example-basic`   | develop → staging → main                      | auto         |
| `pipecraft-example-gated`   | develop → alpha → beta → release → production | manual gates |
