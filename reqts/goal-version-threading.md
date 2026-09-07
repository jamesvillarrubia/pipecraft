# Thread the established version through promotion

Rank 7. Decision: **implemented**. The design at
`docs/plans/version-promotion-threading.md` (B2, 2026-06-15) is wired in current code: see
that doc's Status line for the four file:line wiring points and the tests in
`tests/snapshots/workflow-snapshots.test.ts` that pin them. Only a live end-to-end proof
(a real promotion through a merge commit) remains, reserved for an attended session.

## Problem

`calculate-version` resolves the version from an explicit input, then a tag on `HEAD`, then a
`release-it` recompute, then a `git describe` fallback. After a merge-commit promotion the
tag is not on the final branch's `HEAD`, and the version can resolve empty. `release` then
skips with a `::warning::`. The B1 fallback catches most cases; none of the guards are the
fix.

## Contract

`promote` already dispatches the final-branch pipeline with `workflow_dispatch`. It passes the
version it just promoted as an input. `calculate-version` reads that input first and skips
recomputation when it is present.

## Behaviours

- A promoted run on the final branch releases the same version the initial branch tagged,
  by construction, without reading tags.
- A hand `workflow_dispatch` with no version input behaves as today.
- The `concurrency:` guard from the plan ships in the same change.

## Non-goals

Changing how the initial branch computes its version. Retagging.

## Why attended

The plan's "Why deferred" section names the risk: the change touches every workflow template
and every snapshot, and the behaviour is only testable through a real dispatch. Run it in a
sitting with the `basic` and `gated` e2e flavors, and land it as one PR.

## Done when

- `basic` and `gated` e2e flavors release on the final branch with the version input set,
  and the run log shows `calculate-version` taking the input path.
- A snapshot test pins the `version` input on the dispatch step and on the workflow's
  `workflow_dispatch.inputs`.
