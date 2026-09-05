# Regenerate pipeline.yml on every `generate`

Rank: defect found while building goal 5 (2026-09-04). Ships in one PR with the
deployment-environments recipe, because the recipe describes a rerun of `generate`.

## Problem

`generate` writes `.github/workflows/pipeline.yml` once. Every later run without `--force`
prints "Skipped file", exits 0, and drops config changes. Reproduced on develop 48d0149 with
`examples/minimal`: after adding a `docs` domain, the second run warns about duplicate keys,
skips the file, and `test-docs` never appears. Every published version from 0.29.3 to
0.47.12 behaves this way (bisect, 2026-09-04).

Two defects in the no-force branch of `src/templates/workflows/pipeline.yml.tpl.ts`
(`:588` onward) stack with a third at the write:

1. The branch parses the existing file, patches the managed jobs, and stringifies. The
   custom jobs and the `<--START/END CUSTOM JOBS-->` marker comments survive that round
   trip. It then splices the extracted user section back in as text, so every custom job
   and both markers appear twice.
2. The branch never calls `mergeCustomJobsContent`, so a domain added to the config gets no
   placeholder job. Only the `!fileExists || force` branch (`:505`) does.
3. The final `renderTemplate` (`:662`) passes no `{ force: true }`. Pinion skips a file that
   exists, so whatever the merge produced is discarded. `enforce-pr-target.yml` and
   `pr-title-check.yml` already pass force for this reason.

## Contract this must keep

`tests/unit/managed-section-contract.test.ts` (P0.4): without `--force`, regeneration
preserves customisable fields on managed jobs (`gate.needs`, `runs-on`) and re-asserts the
correctness-critical wiring (`gate.if`, the fail step). `--force` is the full reset. The
merge branch is what implements the preserve half, so it stays.

## Change

In the no-force branch:

- After stringifying the patched document, remove the region from the START marker line
  through the END marker line, inclusive. If no markers exist, remove nothing.
- Build the custom section with `mergeCustomJobsContent(userSection, placeholders)`, where
  placeholders are filtered against the union of job names in `userSection` and job names
  already in the parsed document, so a job the user moved outside the markers is not
  duplicated.
- Splice the merged section after the `version` job's outputs, as the force branch does.
- When markers were missing and custom jobs were recovered from the AST, delete those jobs
  from the parsed document before stringifying; the recovered text is re-inserted through
  the custom section, and the AST copy would render a second time.
- The yaml parser attaches the comment above the first job to the `jobs` map, and the path
  operations set the managed CHANGES banner on the `changes` key again, so both render.
  Remove only the banner text from the map's comment and keep anything else there, such as
  a comment the user wrote above `changes:`.
- Pass `{ force: true }` to the final `renderTemplate`.

## Done when

- Integration test, temp cwd, `dist/cli/index.js` twice: after editing a domain's glob and
  adding a domain between runs, the new glob and the new job are present, the old glob is
  gone, and the output contains neither "Skipped file .github/workflows/pipeline.yml" nor
  the duplicate-keys warning. Fails on 48d0149.
- Integration test: after the first run, add `environment: production` to `test-app` and a
  `smoke:` job inside the markers by hand; run twice more; both survive, each job name
  appears once, and runs 2 and 3 produce byte-identical files.
- `generate --verbose` on `examples/minimal` and `examples/mixed` prints no duplicate-keys
  warning and no skip for pipeline.yml on the second run.
- e2e passes on `library` and one multi-branch flavor.

## Not doing

- Regenerating `.github/actions/*/action.yml` or `.release-it.cjs`, which are also skipped on
  rerun. Follow-up issue.
- Adding a new domain's job to `gate.needs` on an existing file; `needs` is user-owned.
- Changing `--force`.
