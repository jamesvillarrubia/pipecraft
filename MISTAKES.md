# Mistakes

Repo-specific failures and what would have prevented them. Newest first.

## 2026-08-31 — Rewrote generateReleaseItConfig while an open issue described a third bug in it

**What happened:** I rewrote `VersionManager.generateReleaseItConfig()` in v0.43.2 to fix
two bugs: it read `versioning.bumpRules` instead of `semver.bumpRules`, and
`JSON.stringify` dropped its `whatBump` function. Open issue #287 describes a third bug in
the same function. `Math.min.apply(Math, commits.map(...))` returns `Infinity` when
`commits` is empty, which is an invalid bump level. My rewrite carried that straight over
as `Math.min(...commits.map(...))`.

`src/templates/release-it.cjs.tpl.ts`, the path `generate` actually uses, handles this
correctly and returns `{ level: null, reason: 'No commits found - skipping release' }`. It
also quotes the `'after:release'` hook key, which is #287's other half. So the shipped
config is fine and only the `VersionManager` copy carries the gap — the exact
inconsistency between the two generators that I had rewritten the method to remove.

**Root cause:** I scoped the work to the bug I was handed and never asked what was already
known about this code. One `gh issue list` would have surfaced #287. I ran it only when
James asked about open issues, after two releases had shipped.

**Consequence:** v0.43.2 went out with a filed, one-line bug still sitting in a function I
had just rewritten line by line. Closing it needs another PR and another release cascade.

**Prevention:** Before rewriting a function here, search the tracker for its name and its
file. This repo has 27 open issues, several describing exact defects in generators and
composite actions, so the odds that the thing you are touching is already filed are high.
Note also that a bug in `VersionManager` is invisible through `generate` — see the note in
CLAUDE.md about which release-it generator is live.

## 2026-08-31 — A "skip if it exists" write hid both a product bug and a test leak for months

**What happened:** Pinion skips writing any file that already exists, so `generate` never
updated `enforce-pr-target.yml` or `pr-title-check.yml` after the first run. Renaming
`finalBranch` left the old branch enforced; adding a commit type to `semver.bumpRules` left
PR titles using it rejected. `generate` printed "Skipped file" and exited 0, so nothing
looked wrong. This repo's own `enforce-pr-target.yml` had silently missed the trigger
scoping and promote-branch guard added to the template in #480.

Rendering those two templates with `{ force: true }` then exposed a second bug hiding behind
the first: `tests/unit/job-order.test.ts` ran the CLI with `cwd: process.cwd()`, the repo
root. It redirected the pipeline with `--output-pipeline`, but the auxiliary workflows are
written relative to cwd, so they landed in this repo's own `.github/workflows`. Previously
those writes were skipped and invisible; with force they clobbered the real files, and the
corrupted state then failed three unrelated tests.

**Root cause:** A no-op that reports success is indistinguishable from work. "Skipped file"
read as "nothing to do" rather than "refused to update", and because the write never landed,
the test that was aiming at the repo root looked harmless.

**Consequence:** Two silently wrong generated workflows shipped to every consumer, plus a
stale workflow in this repo. I also first "fixed" the single-branch case by deleting the
file, which was really a workaround for the skip — it would have made `generate` destructive
for no reason.

**Prevention:** When a generated file must reflect config, prove it _changes_: generate,
edit the config, regenerate, and assert the new value is present and the old one is gone.
`tests/integration/regenerate-managed-workflows.test.ts` does this for both files. When a
test shells out to the CLI, pass a temp `cwd` — never `process.cwd()` — because only
`pipeline.yml` honours an output override; everything else is cwd-relative. After changing
anything about how files are written, run the suite and check `git status` is clean.

## 2026-08-30 — Called the e2e sandbox repos "real repos" and skipped the one test that covered the change

**What happened:** After fixing single-branch flow handling, I declined to run
`pnpm exec tsx scripts/e2e/harness.ts` on the grounds that it "touches real repos" and
needed approval, and asserted that e2e "wouldn't have covered this change anyway, because
all the example configs are multi-branch." Both claims were wrong. The
`the-craftlab/pipecraft-example-*` repos are disposable sandboxes whose entire purpose is
to be reset and rebuilt. And `examples/library/.pipecraftrc.json` is
`{initialBranch: main, finalBranch: main, branchFlow: [main]}` — the single-branch case I
had just spent the session fixing. The live `pipecraft-example-library` repo was serving
the broken workflow, emitting `must target 'main' branch, not 'main'`.

**Root cause:** I read the harness header phrase "Operates on the live … repos" and stopped
reading. I never opened `scripts/e2e/flavors.ts` or the six `examples/*/.pipecraftrc.json`
files, so the sentence "all the example configs are multi-branch" was invented, not
observed. One `jq` across six files would have shown `library` immediately. I then stated
it as fact in a summary.

**Consequence:** Nearly shipped a single-branch fix without exercising the only e2e flavor
that covers single-branch. Burned two correction turns. Left a broken workflow live in the
example repo longer than necessary, and produced a summary containing a confident false
claim about test coverage.

**Prevention:** Before saying a test suite does not cover a change, enumerate what it covers
and show the evidence. For e2e here that is one command:
`for f in minimal library basic gated mixed remote; do jq -c '{i:.initialBranch,f:.finalBranch,flow:.branchFlow}' examples/$f/.pipecraftrc.json; done`.
"Disposable test fixture" and "live" are not opposites — check who owns a repo and what it
is for before treating destruction as a risk. See CLAUDE.md § "The e2e flavors are the real
test bed".

## 2026-08-30 — Ran the generator with cwd pointed at the Pipecraft repo itself

**What happened:** To generate a probe pipeline into a scratch directory I ran
`pnpm --dir "$WT" exec tsx src/cli/index.ts generate`. `pnpm --dir` sets the working
directory to the Pipecraft repo, and `generate` resolves output paths from `process.cwd()`,
so it ran against Pipecraft's own `.github/` and printed YAML duplicate-key errors from
Pipecraft's committed pipeline.

**Root cause:** Assumed `--dir` only affected package resolution. Also reached for
`--cwd` on the CLI first, which does not exist — the generator is cwd-driven with no flag
to override it.

**Consequence:** No damage, purely by luck: the additive-merge path hit "Skipped file" and
wrote nothing. Had the config differed it would have rewritten the repo's own workflows.
Cost a confused detour reading duplicate-key errors that had nothing to do with the probe.

**Prevention:** Invoke the CLI by `cd`-ing into the target directory and calling the binary
by absolute path — never via a package-manager flag that relocates cwd. Before any command
that writes generated files, confirm the effective cwd. See CLAUDE.md § "Verify by
generating, not by reading".

## 2026-08-30 — A test asserted on JSON quoting and hid a silently dropped function for months

**What happened:** `VersionManager.generateReleaseItConfig()` built a config object
containing a `whatBump` function and serialized it with `JSON.stringify`, which drops
function values. The emitted `.release-it.cjs` therefore had
`"@release-it/conventional-changelog": {}` — no `whatBump`, and `whatBump` is the only
consumer of `bumpRules`. The same method also read `versioning.bumpRules` while the schema
requires `semver.bumpRules`. The guarding test was
`expect(configString).toContain('"@release-it/conventional-changelog"')`, which passes on
the JSON-quoted key alone and is blind to both defects.

**Root cause:** The assertion tested that a string appeared in the output, not that the
configured behavior reached the output. It was labelled "should generate config with custom
bump rules" but never checked that any custom bump rule was present.

**Consequence:** Two real defects sat behind a green test. They also generated a false
upstream bug report (#483) claiming the _version calculator_ ignored `semver.bumpRules` —
it does not; the live template path was always correct. Investigating the wrong code path
cost the bulk of that fix's time.

**Prevention:** For any generator, assert that the input you configured appears in the
output with the value you gave it. Where the artifact is executable, `new Function(...)` it
and assert on the resulting object rather than on its text. A test whose name mentions a
config field must reference that field's value in an assertion. See CLAUDE.md § "Testing".
