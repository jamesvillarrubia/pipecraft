# Deployment environments as the manual promotion gate

Rank 5 of the 2026-09-04 list. Decision: **build**, attended, first of the six.

## Problem

`autoPromote: false` on a branch leaves the promotion PR open for a person to merge.
GitHub records the merge, and nothing else. There is no reviewer list, no wait timer, no
required approver, and no audit entry that names who allowed the deploy. Teams that need
one today add a GitHub environment by hand to the deploy job the generator wrote, and
`generate` overwrites nothing inside the managed region but knows nothing about it either.

## Contract

`.pipecraftrc` gains one optional key per branch:

```json
"environments": { "production": "production", "staging": "staging" }
```

Keys are branch names from `branchFlow`; values are GitHub environment names. When a
branch has an entry, the generated `promote` job that targets it and every domain deploy job
gated on it carry `environment: <name>`. GitHub then applies that environment's protection
rules (required reviewers, wait timer, branch restrictions) before the job starts.

## Behaviours

- A branch with no entry generates exactly what it generates today.
- `autoPromote: true` with an environment still opens and merges the PR; the deploy job waits
  on the environment's reviewers. `autoPromote: false` with an environment gates twice: PR
  merge, then environment approval. The docs say this plainly.
- `pipecraft doctor` warns when a configured environment does not exist on the repository
  (`gh api repos/{owner}/{repo}/environments`).
- Snapshot tests pin the `environment:` line per flavor. `gated` gains an environment on
  `production`; the other flavors stay unchanged.

## Non-goals

Environment secrets, deployment status API calls, and per-environment variables. GitHub
supplies those once the job names the environment.

## Done when

- `generate` on the `gated` example emits `environment: production` on the promote and deploy
  jobs for `production` and nothing on the others.
- Removing the key and regenerating removes the line.
- The `gated` e2e flavor passes with a required-reviewer rule on `production`, and the run
  shows a pending approval before the deploy job starts.
