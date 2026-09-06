# Thread the established version through promotion (FOLLOW-UP B2)

**Branch:** fix/version-promotion-robustness
**Created:** 2026-06-15
**Status:** Implemented. The design below (B2) is wired in current code, added
by a commit that predates this status update and that neither this doc nor
`reqts/goal-version-threading.md` had been checked against. Four wiring points
carry the established version end to end:

1. `src/templates/actions/promote-branch.yml.tpl.ts:350` dispatches the target
   branch's pipeline with `--field version="$VERSION"`.
2. `src/templates/workflows/shared/operations-header.ts:171-181` declares
   `on.workflow_dispatch.inputs.version` on the pipeline.
3. `src/templates/workflows/shared/operations-version.ts` passes
   `with: version: ${{ inputs.version }}` to the version job's
   `calculate-version` step.
4. `src/templates/actions/calculate-version.yml.tpl.ts:119-127` reads
   `inputs.version` in its `check_input_version` step first; the tag-lookup
   step is gated `if: steps.check_input_version.outputs.version == ''`, so an
   explicit input skips the tag lookup entirely.

`tests/snapshots/workflow-snapshots.test.ts` (`Specific Validations`) asserts
(1) and (4) against the generated composite actions and (2) and (3) against
generated workflow YAML; each assertion was confirmed to fail when its wiring
point was reverted.

What remains: a live end-to-end proof (a real `basic` or `gated` flavor
promotion through a merge-commit, watching `release` cut on the final branch
without a tag-on-HEAD). That is reserved for an attended session per "Why
deferred" below, since it needs a real dispatch against a sandbox repo.

## Problem

Release/tag jobs gate on a non-empty version. `calculate-version` resolves the
version by precedence:

1. `inputs.version` (explicit)
2. exact tag on `HEAD` (`git tag --points-at HEAD`)
3. recompute via `release-it`
4. empty

In a flow where the tag is created on the initial branch and `release` is gated
to the final branch, a **merge-commit** promotion leaves the version tag off the
final branch's `HEAD`. Steps 2 and 3 then yield nothing and the version resolves
empty, so `release` silently skips — no tag-on-HEAD, no GitHub Release.

## Mitigations already shipped (lightweight guards)

- **Patch 2** (`fix/version-final-branch-warning`): emits a `::warning::pipecraft`
  on the final branch when the version resolves empty, making the silent skip
  visible.
- **FOLLOW-UP B1** (this branch, commit `fix(calculate-version): fall back to
nearest reachable tag`): adds a last-resort `git describe --tags --abbrev=0`
  step so a merge-commit promotion still cuts the release in most cases.

These reduce the blast radius but still rely on tag reachability/heuristics.

## Durable fix (B2)

Pass the **established version** into the final-branch pipeline invocation as an
explicit input, so release no longer depends on tag-on-HEAD.

Key finding while scoping: the promote job **already triggers the final-branch
pipeline via `workflow_dispatch`** (see `docs/docs/troubleshooting.md` —
"Resource not accessible by integration"; requires `actions: write`). So the
plumbing for passing a value already exists — this is a `workflow_dispatch`
input, not a new `workflow_call` wiring.

### Proposed design

1. The promote branch name already encodes the version:
   `release/<src>-to-<dst>-<version>` (e.g. `release/develop-to-main-1.4.0`).
   Parse `<version>` from the ref.
2. Add a `version` input to the pipeline's `on.workflow_dispatch.inputs`.
3. When the promote job dispatches the final-branch pipeline, pass the parsed
   version as that input.
4. The `version` job forwards `inputs.version` into the `calculate-version`
   action's `version` input (precedence step 1), making release independent of
   merge method.
5. Keep B1's `git describe` fallback for the push-triggered path (when the
   pipeline runs on `push`, not via dispatch, there is no input to forward).

### Files to touch (templates are the source of truth)

- `src/templates/workflows/pipeline.yml.tpl.ts` — add `workflow_dispatch.inputs.version`;
  forward it into the version job's `with.version`.
- `src/templates/actions/promote-branch.yml.tpl.ts` (and/or the promote job in
  the pipeline template) — parse version from the promote ref and include it in
  the dispatch payload.
- Regenerate all committed action/workflow copies (`actions/`, `.github/actions/`,
  `examples/**`) — NOTE the regeneration tooling is currently broken (see below).
- Update snapshots: `tests/snapshots/__snapshots__/workflow-snapshots.test.ts.snap`
  across every snapshot config.
- Tests: add a contract test asserting the dispatch input is parsed/forwarded.

## Why deferred (overnight)

- Multi-file template change that ripples into many generated copies and **every**
  snapshot config — high chance of a large, hard-to-review diff if done unattended.
- The behavior is release-critical and not behaviorally testable locally without
  running real dispatch flows.
- B1 + Patch 2 already mitigate the concrete failure, so the urgency is lower.

## Pre-existing blocker discovered: action-copy drift + broken sync tooling

While doing B1 I found the committed `.github/actions/calculate-version/action.yml`
and the three `examples/**` copies are **stale** relative to the template (older
generation: a separate "Install dependencies" step, `npx release-it` without
`--package`, "Using old/new version" wording). Only `actions/` (source mode) was
in sync. Also:

- `package.json` `sync-actions` points at `scripts/sync-actions.ts`, but the file
  lives at `tests/scripts/sync-actions.ts`.
- That script computes `rootDir = resolve(__dirname, '..')` = `tests/`, so its
  `actions/...` paths resolve under `tests/`. It is effectively broken and is not
  run in CI.

**Recommendation:** fix `sync-actions` (path + rootDir) and add a CI
`sync-actions --check` gate, then regenerate all action copies once. Do this
before/with B2 so B2's regeneration is reliable. Tracked as a BLOCKER.

## References

- B1 commit: `fix(calculate-version): fall back to nearest reachable tag`
- Patch 2 branch: `fix/version-final-branch-warning`
- `src/templates/actions/calculate-version.yml.tpl.ts`
- `docs/docs/troubleshooting.md` — "No GitHub Release was created after merging a
  promotion PR"
