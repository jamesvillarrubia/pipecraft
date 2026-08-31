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
- `enforce-pr-target.yml` — **not generated at all.** Its rule is "target initialBranch, not
  finalBranch", which is self-contradictory when they are the same branch. Regeneration also
  deletes a stale copy left by a previous multi-branch config.

## Generated files that need a sync step

`actions/` is **generated** from `src/templates/actions/*.tpl.ts`. Edit the template, never
`actions/*/action.yml` directly, then:

```bash
pnpm build && pnpm sync-actions        # regenerate
pnpm sync-actions:check                # CI-equivalent verification
```

## Config keys live in three places

Adding or changing a config field means touching all three, or `tsc` /
`tests/unit/schema-types-consistency.test.ts` will fail:

1. The `PipecraftConfig` interface in `src/types/index.ts`
2. `KNOWN_CONFIG_KEYS` in the same file (runtime allowlist)
3. `.pipecraft-schema.json` (hand-maintained; descriptions are _not_ checked, so keep them
   truthful yourself)

### `bumpRules` has two spellings and two generators

- Location: `semver.bumpRules` is what the schema requires. `versioning.bumpRules` is
  deprecated and must lose to it. Resolve as `{...versioning, ...semver}` everywhere.
- Generator: **`src/templates/release-it.cjs.tpl.ts` is the live path** used by `generate`.
  `VersionManager.generateReleaseItConfig()` in `src/utils/versioning.ts` is _not_ wired into
  `generate` — it is only exercised by unit tests. Keep the `baseDefaults` in the two files
  in step, and confirm which path a reported bug actually hits before changing code.

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

Use isolated workspaces (`tests/helpers/workspace.ts`), never a shared `TEST_DIR`.

## Reserved job names

Domains cannot be named `changes`, `version`, `gate`, `tag`, `promote`, or `release` —
those are Pipecraft-managed jobs.

## Gotchas

- Heredocs (`<<'NODE'`) break the GitHub Actions YAML parser. Use `node -e "…"`.
- GitHub does **not** enforce `required: true` on composite action inputs. An expression
  resolving to empty arrives silently, so validate inputs in the action's first step.
- A composite action step that `exit 0`s does not skip later steps. To abort, fail (`exit 1`)
  or gate every subsequent step.
