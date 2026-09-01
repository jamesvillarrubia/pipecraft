# AGENTS.md

Notes for coding agents working in or with Pipecraft.

Pipecraft generates GitHub Actions pipelines from a `.pipecraftrc`. It renders templates into
a repository's `.github/`, so almost every bug is "the generated YAML is wrong", not "the
TypeScript threw". Verify by generating and reading the output, not by reading the template.

## Using Pipecraft in someone's repository

### Setting it up without a terminal

`pipecraft init` prompts by default. Pass `--yes` to take defaults and never prompt:

```bash
pipecraft init --yes
pipecraft generate
```

It also skips prompting when stdin is not a TTY, so a piped or redirected run works without
the flag. Individual values take flags:

```bash
pipecraft init --yes \
  --initial-branch develop \
  --final-branch main \
  --merge-strategy fast-forward
```

The branch flow follows the branches you name. Defaults give `develop → staging → main`;
naming different ends gives exactly those two; naming the same branch twice gives a
single-branch flow.

### Check before you commit

```bash
pipecraft generate --dry-run
```

Lists every file it would create or update, and the domain jobs the config produces. That
last part matters most: **a domain with no `prefixes` generates no jobs.** If you configured
domains and the pipeline has no test jobs, this is why.

```json
{
  "domains": {
    "api": { "paths": ["src/api/**"], "description": "API", "prefixes": ["test", "deploy"] }
  }
}
```

That yields `test-api` and `deploy-api`. The older `testable` / `deployable` booleans still
work and are translated, but `prefixes` is the current shape.

### What Pipecraft will and will not write

It generates the managed jobs — `changes`, `version`, `gate`, `tag`, `promote`, `release` —
and a placeholder for each domain job, marked `# TODO: Replace with your <domain> test
logic`.

**Domain job bodies are the user's.** Pipecraft writes no install or toolchain steps into
them. Do not expect a working test command; write one.

`enforce-pr-target.yml` and `pr-title-check.yml` are wholly generated and overwritten on
every run. Never edit them; change the config instead. Hand-edits are lost silently. `pipeline.yml` preserves custom jobs between
its `# <--START CUSTOM JOBS-->` markers.

### Releases come from the pipeline

There is no local bump command. The `version` job resolves the next version from conventional
commits, `tag` creates the tag, `release` cuts the GitHub release.

`pipecraft version --check` reports what the pipeline would decide. It reads; it does not
write.

`tag` and `promote` only run for commits GitHub authored — that is, merged pull requests — or
for a `workflow_dispatch`. **A commit you push directly will not promote.** That is
deliberate; it stops an accidental push from cutting a release.

## Contributing to Pipecraft itself

Read `CLAUDE.md` first. It carries the traps in detail, and `MISTAKES.md` records the ones
that have already cost time.

The three that catch agents most often:

**`generate` resolves paths from `process.cwd()` and has no `--cwd` flag.** `cd` into the
target directory and call the binary by absolute path. Never use `pnpm --dir <repo> exec`,
which points the generator at the Pipecraft repo itself.

**`actions/` is generated** from `src/templates/actions/*.tpl.ts`. Edit the template, then
`pnpm build && pnpm sync-actions`. Editing `actions/*/action.yml` directly is undone on the
next sync.

**Build before integration tests.** They shell out to `dist/cli/index.js`, so a stale build
means you are testing old code.

```bash
pnpm build
pnpm vitest run --exclude '.worktrees/**'
pnpm lint
pnpm sync-actions:check
```

### Verify claims by running commands

The most common failure here is asserting what the code does instead of checking. Generate
into a scratch directory and read the output:

```bash
mkdir -p /tmp/probe && cd /tmp/probe && git init -q .
# write a .pipecraftrc, then:
node /path/to/pipecraft/dist/cli/index.js generate --skip-checks
```

Before concluding a config key is unused or a path is unreachable, run the search that would
find it. `tests/unit/config-key-coverage.test.ts` exists because five separate bugs were the
same shape: a key that validated, was documented, and was read by nothing.

**`doctor` exits 1 when it finds errors.** A non-zero exit means it ran and found problems, not that the command is broken.
