# Pipecraft Roadmap & TODOs

**Updated:** 2026-06-18 · **Sources:** `docs/analysis/2026-06-18-state-review.md`,
`docs/analysis/2026-06-18-architecture-review.md`, deferred items from prior work.

Authoritative engineering TODO list. **P0** = correctness/trust (system silently does the
wrong thing); **P1** = important; **P2** = improvements / forward features. Each item:
_what · why · source_.

> User-facing aspirational roadmap (GitLab CI, flow patterns) lives in
> `docs/docs/roadmap.md`; this file is the internal, gap-driven plan.

## Status (2026-06-18)

**✅ Shipped in #436** (squash `f9c4396` on `develop`): all of **P0 (1–5)** and **P1
items 6, 7 (concurrency only), 8, 9, 10, 11**. Each landed as its own tested commit.

**Still open:**

- **P1.7 / B2** — thread the version through promotion (only the `concurrency:` guard
  shipped; the durable version-threading remains).
- **P1.10 follow-up** — rework the custom-jobs merge to dedup managed-named jobs so the
  duplicate-key detection (currently a non-fatal warning) can become a hard error.
- **P1.12** — publish the marketplace actions for discoverability (out-of-band release step);
  `remote` mode already works today through repository refs.
- **P2 (12–17)** — improvements & forward features (below).
- **Out-of-band (not code):** set branch protection's required check to `gate` so the
  now-robust gate is actually enforced at merge.

Items below are kept for history/context; see the strikethrough/✅ markers.

---

## P0 — Correctness & trust (verified High-severity)

1. **Make the merge gate actually gate.** Required checks are path-filtered (a skipped check
   counts as passed); the `gate` job is inert on PRs (requires the PR-skipped `version` job)
   and isn't the required check; `test-cicd` runs only `validate-pipeline.cjs`, not the suite.
   _Why:_ a broken change can merge green. _Source:_ arch Pass 3 (verified F + High).
   _Fix:_ make `gate` always-run + PR-valid, set it as the sole required check; have
   `test-cicd` run `pnpm test` + `lint` + `sync-actions:check`.
2. **Enforce the config schema (reject unknown keys).** `validateConfig` is an allowlist that
   silently ignores unknown/misspelled keys — root cause of the `autoMerge`/`nx` bugs.
   _Source:_ Pass 4 (verified C). _Fix:_ validate against `.pipecraft-schema.json` with `ajv` +
   `additionalProperties:false`; add "did you mean…" hints.
3. **Sync `.pipecraft-schema.json` with `src/types` + add a consistency test.** `runtime` missing
   from schema; `mergeMethod`/`mergeStrategy:'merge'` in schema/types but implemented nowhere.
   _Source:_ Pass 4 (verified D, E). _Fix:_ add `runtime`; resolve mergeMethod (P1.6); add a
   schema↔types test.
4. **Managed-section enforcement must work without `--force` (or be documented honestly).**
   Reproduced: a tampered managed job survives a default `generate`; only `--force` heals it,
   yet the generated header claims those sections are managed. _Source:_ Pass 2 (verified A).
   _Fix:_ heal managed jobs in default mode, or correct the header/docs to say managed-section
   resets require `--force`.
5. **Fix the stale default action set + extend the drift gate.** `.github/actions/detect-changes`
   (the **default** `local` mode) still has removed Nx code (59 refs) with a different input
   contract than the template; `sync-actions` only checks `actions/`. _Source:_ Pass 2 (verified
   B) + docs audit. _Fix:_ regenerate all `.github/actions/*`; extend `sync-actions:check` to
   cover `local` mode + `examples/`.

## P1 — Important

6. **Decide `mergeMethod` / `mergeStrategy:'merge'`: implement or remove.** Documented in
   types + schema + 6 doc pages, honored nowhere (promote hardcodes `--ff-only`).
   _Source:_ Pass 4 (verified D), Pass 1.
7. **B2 — thread the version through promotion (+ `concurrency:` guard).** Release identity rests
   on `git describe` tag-reachability (B1), which can pick the wrong tag on merge-commit
   promotion; no concurrency guard → racing pipelines half-promote. _Source:_ Pass 1.
   _Fix:_ parse the version from `release/{src}-to-{tgt}-{version}` on the target push; emit
   `concurrency: { group: pipeline-${{ github.ref_name }} }`.
8. ✅ **Verify promote actually triggered the target run.** Shipped in #436 (`f9c4396`);
   confirmed present at `src/templates/actions/promote-branch.yml.tpl.ts:363-379`. After
   dispatch, the action polls `gh run list` for the target branch (six attempts, 5 s apart)
   and warns if no run appears within ~30 s. _Source:_ arch review (dispatch finding).
9. **`create-release` idempotency + release-it failure handling.** Re-running a released version
   fails the job; a transient release-it failure reads as "no version" (silent skip).
   _Source:_ Pass 1.
10. **Guard custom-job vs managed-job name collisions.** A custom `release`/`tag`/etc. job emits
    duplicate keys → unparseable workflow + partial write. _Source:_ Pass 2. _Fix:_ detect
    reserved names; make generation transactional. (Also fixes the marker-fallback comment loss.)
11. **Pin generator default `pnpmVersion` to an exact patch + add `packageManager`.** Default is
    `'10'` (major); `package.json` has no `packageManager`. _Source:_ Pass 3.
12. **Publish the marketplace actions.** Prepped (#206/#207/#217) + reconciled (#409) but not
    published. `remote` action mode already works today through pinned repository refs
    (`actionSourceMode: remote` + `actionVersion`; see `examples/remote/.pipecraftrc.json` and
    `src/utils/action-reference.ts`). The `remote` e2e flavor passed on 2026-09-03. A
    Marketplace listing adds discoverability: teams browse the Marketplace instead of
    pointing at the repo directly. _Source:_ drift assessment.

## P2 — Improvements & forward features

13. **Supply-chain: pin third-party action SHAs + Dependabot (github-actions).** Floating tags
    (`codecov`, `dorny`, `marocchino`, `amannn`, `pnpm/action-setup`, mixed `checkout@v4/v5`) are
    the class that already broke CI; worst on `publish.yml`'s OIDC path. _Source:_ Pass 3.
14. **`detect-changes`: JSON membership, not substring `grep`** (overlapping domain names
    mis-detect). _Source:_ Pass 3.
15. **Config value validation:** `runtime.*` semver pattern; `autoPromote` shape (reject
    string/array); `semver` required + structural; `branchFlow` duplicate/no-op detection; make
    preflight delegate to `validateConfig`. _Source:_ Pass 4.
16. **Docs tooling:** migrate docusaurus `onBrokenMarkdownLinks` to the v4 location; add a CI gate
    running `docs:typedoc` that fails on drift (deterministic since #433). _Source:_ docs audit.
17. **Forward features (from `docs/docs/roadmap.md`):** GitLab CI generation; flow patterns
    (GitHub Flow, GitFlow, custom); workflow visualization; matrix builds; deploy environments.

---

## Known gaps (state vs intent)

- **Marketplace publication** prepped but not done. `remote` mode already works through
  repository refs. Publication adds Marketplace discoverability.
- **Durable promote/version threading (B2)** designed but deferred; B1 is a guard, not the fix.
- **`mergeMethod` / `mergeStrategy:'merge'`** advertised but inert (intent is fast-forward).
- **Self-CI is not a trustworthy gate** (path-filtered required checks; inert `gate` on PRs).
- **Config is permissive** — unknown keys silently dropped; schema not enforced.

## What's next (sequenced)

1. **Trust the gate** (P0.1) — without it, every other fix can regress silently.
2. **Enforce config + sync schema** (P0.2, P0.3) — stops silent-wrong-config; keeps
   schema/types/docs honest.
3. **Heal managed drift + fix the default action set** (P0.4, P0.5) — restores the core
   preserve/generate guarantee for the default user.
4. **B2 durable version threading** (P1.7) — concurrency guard, dispatch verification, and
   release idempotency shipped in #436; the version-threading half of B2 remains.
5. **Resolve `mergeMethod`** (P1.6) and **pin pnpm exactly** (P1.11) — remove dead surface,
   finish retiring the pin.
6. **Publish marketplace actions for discoverability** (P1.12), then **forward features**
   (P2.17).

Each P0/P1 item is independently shippable as its own PR with tests; work top-down.
