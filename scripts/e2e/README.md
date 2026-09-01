# E2E flavor harness

Programmatic **reset + proof** for the live `the-craftlab/pipecraft-example-*` repos. Each
flavor's expectations are derived from its committed `examples/<flavor>/.pipecraftrc.json`
(see `flavors.ts`), so the harness stays correct as the flavors evolve.

```bash
pnpm build                       # the harness uses the repo's freshly built CLI

pnpm e2e:reset <flavor|all>      # wipe a repo to a pristine baseline (+ setup-github)
pnpm e2e:prove <flavor|all>      # push a feat and assert the flavor's outcome
pnpm e2e:run   <flavor|all>      # reset, then prove
```

Flavors: `minimal library basic gated mixed remote` (or `all`, or a comma list).

## What each step does

**reset** (idempotent, repeatable):

1. Clones the repo, writes the canonical `examples/<flavor>` config.
2. Ensures a source file per domain + a minimal `package.json`.
3. Generates the workflow with the repo's CLI (`generate --force`).
4. Force-pushes a single pristine baseline commit to **every** branch in the flow.
5. Deletes all releases + tags.
6. Runs `setup-github --apply` and grants workflow write permissions.

**prove** (exercises the real pipeline — minutes per flavor):

1. Pushes a unique `feat:` touching the first domain.
2. Polls GitHub until the **config-derived** expectations hold, then exits 0:
   - feat reaches the furthest **auto-promoted** branch,
   - a promotion **PR is opened** to the first manual-gate target (if any),
   - a **release** is created (when the cascade auto-reaches the final branch, or single-branch).
3. Fails (exit 1) on timeout.

| Flavor  | auto-reaches                 | gate PR | release |
| ------- | ---------------------------- | ------- | ------- |
| minimal | main                         | —       | ✓       |
| library | main (only branch)           | —       | ✓       |
| basic   | main                         | —       | ✓       |
| mixed   | staging                      | → main  | —       |
| gated   | develop                      | → alpha | —       |
| remote  | main (via published actions) | —       | ✓       |

## Requirements

- `gh` authenticated with write access to the example repos.
- `pnpm build` run first (the harness invokes `dist/cli/index.js`).
- These are **disposable** repos — `reset` force-pushes and wipes history/tags by design.
