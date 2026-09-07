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
`renderTemplate`. They have no user-editable regions. Without force, renaming `finalBranch`
left the old name enforced and adding a commit type left `pr-title-check` rejecting it.

`pipeline.yml` passes force too, since the regenerate fix (reqts/goal-regenerate-pipeline.md). Its merge into the existing YAML is what
preserves custom jobs; force only makes Pinion write the merged result. Before that fix
the file was written once and never again, on every published version back to 0.29.3, and
the no-force branch also duplicated the custom section. `tests/integration/regenerate-pipeline.test.ts`
pins the second run.

`release-it.cjs.tpl.ts` passes force too (#618): the file has no user-editable region
(`buildReleaseItConfig()` builds the whole thing), so without force a later `semver.bumpRules`
change never reached `.release-it.cjs` and `generate` still exited 0.
`tests/integration/regenerate-managed-workflows.test.ts` pins a changed bump rule landing on
the second run. The composite action templates (`src/templates/actions/*.tpl.ts`) still
render without force by decision, not by gap: `docs/docs/cli-reference.md` and
`docs/docs/workflow-generation.md` already tell users to pass `--force` after upgrading
PipeCraft, and a consumer may have hand-edited a generated action.

If you add another generated file that must track config, pass `{ force: true }` and cover
it in `tests/integration/regenerate-managed-workflows.test.ts`.

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

**Building is not enough — check the checkout is current first.** Merges go through
worktrees, so nothing pulls the parent checkout and it drifts behind `origin/develop` over a
session. Building it then faithfully compiles old source, and e2e goes green while proving
nothing about your change:

```bash
git rev-list --count HEAD..origin/develop   # must be 0
git pull --ff-only origin develop && pnpm build
```

This nearly shipped a full e2e sweep as verification when the checkout was 15 commits
behind. The flavors passed, because they passed before the change too.

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

## What ships is not what the repo holds

`package.json` `files` is `dist`, `src/generators`, `skills/pipecraft-cli/SKILL.md` and
`README.md`. Everything else in the repo is invisible to an npm user, so a correction to a
file outside that list changes nothing for anyone.

`getSkillContent()` in `src/utils/skill-installer.ts` reads that SKILL.md and falls back to
an embedded template string. While `skills/` went unpublished, the fallback was the only
path a user could reach, and it kept teaching `pipecraft verify` through the release that
claimed to remove it — see `MISTAKES.md`.

After changing anything a user reads, check the artifact:

```bash
npm pack --pack-destination /tmp/pcpack && tar xzf /tmp/pcpack/*.tgz -C /tmp/pcpack
rg 'the string you changed' /tmp/pcpack/package/
```

`tests/unit/documented-commands-exist.test.ts` covers this mechanically: markdown, string
literals under `src/`, `package.json` scripts, and `npm pack --dry-run` contents.

### `npm pack` is not `npm publish`

The pack path is more forgiving than the publish path, so a packed-and-installed tarball
proves less than it looks. `skills/pipecraft-cli` declared `"bin": {"pipecraft-skill":
"./bin.js"}`. `npm pack` kept it, installing that tarball gave a working `pipecraft-skill`,
and publishing answered:

```
npm warn publish "bin[pipecraft-skill]" script name bin.js was invalid and removed
```

npm drops a bin path with a leading `./` at publish, so the published package would have had
no bin at all. `--dry-run` is no better: it accepts `--provenance` outside CI, which a real
publish rejects. Both are now pinned in `documented-commands-exist.test.ts` and
`publish-skill-script.test.ts`, because neither is reachable by packing.

`skills/pipecraft-cli` publishes as `@thecraftlab/pipecraft-skill` through
`scripts/publish-skill.sh`, which the release workflow calls. It carries the same `SKILL.md`
file the main package ships, so the two cannot disagree. A version already on the registry is
skipped and a package the registry has never seen is a warning, because neither is a broken
release; a failure on a package that exists still fails the job.

## One SKILL.md, and installers that read the repo

The repo must hold exactly one `SKILL.md`. It once held two, both declaring `name: pipecraft`,
and nothing in the repo showed the problem. The install command did:

```
$ npx openskills install the-craftlab/pipecraft
Found 2 skill(s)
❯ ◉ pipecraft-cli             12.0KB
  ◉ pipecraft-cli             14.4KB
```

Skill installers clone the repository and walk it, so any second copy becomes a second choice
for a stranger. `.claude/skills/pipecraft/` is gitignored for that reason: it is what
`pipecraft skill` installs here, not a file to commit.

Claude Code reads `argument-hint`, `allowed-tools` and `!`-prefixed command substitution;
the other five tools print them as text. Those parts live in the one source between
`<!-- claude-only:start -->` and `<!-- claude-only:end -->`, which `skillBody()` strips for
everyone else.

## GitHub approval gates run before a job's `if`

A workflow run can fail before any job exists. `gh run view` calls that "This run likely
failed because of a workflow file issue", which is a guess and was wrong: the file parsed and
was byte-identical on all three branches. The annotation on the run page said

```
This workflow run required approval but was not approved before it expired.
```

`github-actions[bot]` authors promotion PRs, GitHub counts a bot as a first-time contributor,
and this repo's `fork-pr-contributor-approval` policy is `first_time_contributors`. Approval
is evaluated before a job's `if`, so a job-level guard cannot skip a run that never starts.
`enforce-pr-target.yml` uses `pull_request_target`, which runs in the base repository's
context and has no approval gate; it checks out nothing and declares `permissions: {}`.

When a run fails with zero jobs, read the annotation on the run page. The API exposes no
check run for it, and `gh run view --log-failed` returns "log not found".

## The e2e harness counts failures it did not cause

`prove` prints `(failed runs seen: N)` from the repository's recent runs, not only the ones
its own push produced. A green sweep can still print a number. Date them before reading
anything into it:

```bash
gh run list --repo the-craftlab/pipecraft-example-<flavor> \
  --workflow "<name>" --limit 3 --json conclusion,createdAt,headBranch
```

A full sweep on 2026-09-03 reported `failed runs seen: 1` for `minimal`, `basic` and `mixed`
while every run it created succeeded. The failures were from 2026-09-01, before the approval
gate was fixed.

## Reserved job names

Domains cannot be named `changes`, `version`, `gate`, `tag`, `promote`, or `release` —
those are Pipecraft-managed jobs.

## Gotchas

- Heredocs (`<<'NODE'`) break the GitHub Actions YAML parser. Use `node -e "…"`.
- GitHub does **not** enforce `required: true` on composite action inputs. An expression
  resolving to empty arrives silently, so validate inputs in the action's first step.
- A composite action step that `exit 0`s does not skip later steps. To abort, fail (`exit 1`)
  or gate every subsequent step.
