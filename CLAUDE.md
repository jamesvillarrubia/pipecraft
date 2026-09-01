# Pipecraft — working notes for Claude

Pipecraft generates GitHub Actions pipelines from a `.pipecraftrc`. It renders templates
into a consumer repo's `.github/`, so almost every bug is "the generated YAML is wrong",
not "the TypeScript threw".

Read `MISTAKES.md` before starting. It records failures that already cost time here.

## Verify by generating, not by reading

The single highest-value habit in this repo: when you think you know what the generator
emits, **generate it and look**. Reasoning from template source is how you get confident
wrong answers, because the output depends on config shape, path operations applied to a
YAML AST, and additive-merge behavior against pre-existing files.

```bash
mkdir -p /tmp/probe && cd /tmp/probe && git init -q .
# write a .pipecraftrc, then:
node /path/to/pipecraft/dist/cli/index.js generate --skip-checks
```

`generate` resolves paths from **`process.cwd()`** and has no `--cwd` flag. Run it with the
scratch directory as the working directory. Do not use `pnpm --dir <repo> exec …` for this —
that sets cwd to the Pipecraft repo and the generator will write into Pipecraft itself.

## The e2e flavors are the real test bed

`the-craftlab/pipecraft-example-<flavor>` are **disposable sandbox repos that exist to be
wiped**. `reset` deleting their branch protection, releases, and tags is the designed
behavior, not damage. Run them.

```bash
pnpm build                                   # harness uses dist/cli/index.js
pnpm exec tsx scripts/e2e/harness.ts run <flavor|all>
```

Each flavor's expectations are derived from its committed `examples/<flavor>/.pipecraftrc.json`,
so the config _is_ the spec. Know which flavor covers your change before claiming e2e is
irrelevant to it:

| Flavor    | Branch flow                                   | `autoPromote`                  | Covers                                              |
| --------- | --------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| `minimal` | develop → main                                | `{main: true}`                 | Two-branch baseline                                 |
| `library` | **main only**                                 | unset                          | **Single-branch flow**                              |
| `basic`   | develop → staging → main                      | all `true`                     | Fully auto-promoted chain                           |
| `gated`   | develop → alpha → beta → release → production | all `false`                    | Long chain, every hop human-gated                   |
| `mixed`   | develop → staging → main                      | `{staging: true, main: false}` | Auto to staging, manual to main                     |
| `remote`  | develop → main                                | `true`                         | `actionSourceMode: remote` + pinned `actionVersion` |

A change to branch-flow handling that you have not run against `library` **and** one
multi-branch flavor is not verified.

## Single-branch flows are supported

`initialBranch === finalBranch` with a one-entry `branchFlow` is legitimate — you still get
change detection, versioning, tagging, releases, and domain build/deploy jobs. You just
don't get promotion.

Never answer "single-branch isn't supported". What is true:

- `changes`, `version`, `gate`, `tag`, `release`, domain jobs — all generate, gated on the
  one branch.
- `promote` — deliberately emitted with a `(false)` condition and an empty `targetBranch`.
  Dead job by design; `tests/snapshots/workflow-snapshots.test.ts` pins this.
- `enforce-pr-target.yml` — still generated, but as a **confirm-only workflow with no reject
  step.** Its normal rule is "target initialBranch, not finalBranch", which names the same
  branch twice when they are equal; emitting both steps gives them an identical `if`, so the
  reject step runs first and fails every PR. The file is kept rather than skipped so that a
  branch protection rule requiring the `check-pr-target` status still gets a result.

`generate` never deletes. Files are repaired by being rewritten — see the note on `force`
below.

## Generated files that need a sync step

`actions/` is **generated** from `src/templates/actions/*.tpl.ts`. Edit the template, never
`actions/*/action.yml` directly, then:

```bash
pnpm build && pnpm sync-actions        # regenerate
pnpm sync-actions:check                # CI-equivalent verification
```

## Fully-generated workflows render with `force`

Pinion **skips writing any file that already exists**. For a file rendered whole from config
that means it is written once and then never updated — `generate` prints "Skipped file" and
exits 0, so it looks like success.

`enforce-pr-target.yml` and `pr-title-check.yml` therefore pass `{ force: true }` to
`renderTemplate`. They have no user-editable regions, unlike `pipeline.yml`, which merges
into existing YAML to preserve custom jobs. Without force, renaming `finalBranch` left the
old name enforced and adding a commit type left `pr-title-check` rejecting it.

If you add another fully-generated workflow, pass `{ force: true }` and cover it in
`tests/integration/regenerate-managed-workflows.test.ts`.

## Config keys live in three places

Adding or changing a config field means touching all three, or `tsc` /
`tests/unit/schema-types-consistency.test.ts` will fail:

1. The `PipecraftConfig` interface in `src/types/index.ts`
2. `KNOWN_CONFIG_KEYS` in the same file (runtime allowlist)
3. `.pipecraft-schema.json` (hand-maintained; descriptions are _not_ checked, so keep them
   truthful yourself)

`tests/unit/config-key-coverage.test.ts` then fails if nothing under `src/` reads the new
key. The most common defect here is a key that validates, gets documented, and is read by
nothing — #483, #287, #499, #506 and #290 were all that shape. If a key is inert on purpose,
add it to that test's `EXEMPT` map with the reason.

The test greps, so it catches "nothing reads this at all", not "this is read correctly".
#499's `testable` was mentioned in `getDomainJobNames()` while the code that built jobs
ignored it. Behavioural tests are still what prove a key works.

### `bumpRules` has two spellings and one generator

- Location: `semver.bumpRules` is what the schema requires. `versioning.bumpRules` is
  deprecated and must lose to it. Resolve as `{...versioning, ...semver}` everywhere.
- Generator: **one**, `buildReleaseItConfig()` in `src/utils/release-it-config.ts`. Two
  callers reach it: `src/templates/release-it.cjs.tpl.ts` (rendered by `generate`) and
  `VersionManager.generateReleaseItConfig()` (called by `setupVersionManagement()`, which
  `pipecraft init --with-versioning` invokes). Both write `.release-it.cjs`, so they have to
  agree; put changes in the builder, never in a caller.
- Those two used to diverge, and every divergence was a bug: #483 (different config keys),
  #287 (`Infinity` on empty commits), #496 (`github.release`, and whether
  `options.preset.types` is read). `tests/integration/release-it-unified.test.ts` asserts
  the two callers produce byte-identical output, and
  `tests/fixtures/release-it-golden.cjs` pins what `generate` emits so a change to the
  builder cannot silently alter it.

### `whatBump`: config beats preset

`DEFAULT_PREFIXES` in the generated `.release-it.cjs` is `baseDefaults` merged with the
user's `semver.bumpRules`, so it is the stated intent. The preset from
conventional-changelog only fills types the config never mentions:

```js
types = Object.assign({}, presetTypes, DEFAULT_PREFIXES) // config last, so config wins
```

Merged the other way round, a preset silently overrode configured rules — a `docs` commit
bumped minor when the config said patch. Same failure as #483: a configured value dropped
before it reached the consumer.

## Check the tracker before rewriting

This repo has ~27 open issues, several naming exact defects in specific generators and
composite actions. Before rewriting a function, search for its name and its file:

```bash
gh issue list --repo the-craftlab/pipecraft --search "generateReleaseItConfig OR release-it"
```

Rewriting `generateReleaseItConfig` without doing this left #287's bug on lines that were
being replaced anyway — see `MISTAKES.md`.

## Only GitHub-authored commits promote

`tag` and `promote` carry `PROMOTION_SOURCE_GATE` from
`src/templates/workflows/shared/operations-tag-promote.ts`:

```
github.event.head_commit.committer.email == 'noreply@github.com' ||
  github.event_name == 'workflow_dispatch'
```

GitHub stamps that committer on the commit it creates when a pull request is merged, and a
fast-forward promotion preserves it, so the marker survives the whole flow. Verified on this
repo: `develop` and `main` both show `noreply@github.com`.

A hand-pushed commit keeps its author's address and does not promote. `version`, change
detection and domain jobs still run, so only tagging and promotion are held back.

**This is why the e2e harness commits as `noreply@github.com`.** A plain `git push` from the
harness is the direct push the gate exists to stop, so `prove` would never reach promotion.
If you change how the harness commits, promotion silently stops and every flavor fails at
`auto=false`.

## `autoPromote` controls the merge, not the PR

`autoPromote: false` still **opens** the promotion PR; it just leaves it for a human. There
is no value that suppresses PR creation — removing the branch from `branchFlow` is the way
to stop promoting to it. Say this explicitly whenever the key comes up; the name misleads.

## Testing

```bash
pnpm vitest run --exclude '.worktrees/**'    # full suite
pnpm vitest run tests/unit/config.test.ts    # single file
pnpm vitest run tests/snapshots/ --update    # refresh snapshots (review the diff!)
pnpm lint
```

Assert on **behavior, not serialization**. A test like
`expect(config).toContain('"@release-it/conventional-changelog"')` passes on JSON quoting
alone and let a silently-dropped function survive indefinitely — see `MISTAKES.md`. Assert
that the rule you configured appears with the value you gave it, and where a generated file
is meant to be executable, evaluate it and assert on the resulting object.

Integration tests shell out to `dist/cli/index.js`, so **`pnpm build` before running them**
or you are testing stale output.

Use isolated workspaces (`tests/helpers/workspace.ts`), never a shared `TEST_DIR`. When a
test shells out to the CLI, always pass a temp `cwd` — **never `process.cwd()`**. Only
`pipeline.yml` honours an output override (`--output-pipeline`); the auxiliary workflows are
always written relative to cwd, so a test run from the repo root overwrites this repo's own
`.github/workflows`.

After changing anything about how files are written, run the suite and confirm
`git status` is clean. A test that quietly wrote into the repo went unnoticed for as long as
those writes were being skipped.

For a generated file that must track config, assert that it **changes**: generate, edit the
config, regenerate, then check the new value is present _and_ the old one is gone. See
`tests/integration/regenerate-managed-workflows.test.ts`.

## Reserved job names

Domains cannot be named `changes`, `version`, `gate`, `tag`, `promote`, or `release` —
those are Pipecraft-managed jobs.

## Gotchas

- Heredocs (`<<'NODE'`) break the GitHub Actions YAML parser. Use `node -e "…"`.
- GitHub does **not** enforce `required: true` on composite action inputs. An expression
  resolving to empty arrives silently, so validate inputs in the action's first step.
- A composite action step that `exit 0`s does not skip later steps. To abort, fail (`exit 1`)
  or gate every subsequent step.
