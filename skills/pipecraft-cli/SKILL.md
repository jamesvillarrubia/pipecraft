---
name: pipecraft
description: Help users set up, configure, and use the Pipecraft CLI for GitHub Actions workflow generation. Assists with CI/CD setup, workflow generation, branch promotion, domain configuration, and troubleshooting. Invoke when users ask about trunk-based development, GitHub Actions pipelines, or Pipecraft configuration.
argument-hint: '[command|question]'
allowed-tools: Read, Grep, Glob, Bash(pipecraft *), Bash(npx pipecraft *), Bash(cat .pipecraftrc*), Bash(ls -la .pipecraftrc* .github/workflows/pipeline.yml 2>/dev/null), Edit, Write
---

# Pipecraft CLI Assistant

Help users with **Pipecraft** - a trunk-based CI/CD workflow generator for GitHub Actions.

<!-- claude-only:start -->

## Current Project State

- Pipecraft version: !`pipecraft --version 2>/dev/null || echo "not installed"`
- Config file: !`ls .pipecraftrc* 2>/dev/null | head -1 || echo "none found"`
- Pipeline exists: !`test -f .github/workflows/pipeline.yml && echo "yes" || echo "no"`
- Current branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "not a git repo"`

<!-- claude-only:end -->

**Documentation:** https://pipecraft.thecraftlab.dev
**GitHub:** https://github.com/the-craftlab/pipecraft

## Commands Reference

| Command                      | Purpose                         | Key Flags                                            |
| ---------------------------- | ------------------------------- | ---------------------------------------------------- |
| `pipecraft init`             | Create `.pipecraftrc` config    | `--yes`, `--force`, `--with-versioning`              |
| `pipecraft generate`         | Generate workflows              | `--dry-run`, `--verbose`, `--debug`, `--skip-checks` |
| `pipecraft validate`         | Check config syntax             | -                                                    |
| `pipecraft doctor`           | Health check entire setup       | -                                                    |
| `pipecraft get-config <key>` | Read config value               | `--format json\|raw`                                 |
| `pipecraft setup`            | Create branches from branchFlow | `--force`                                            |
| `pipecraft setup-github`     | Configure GitHub permissions    | `--apply`                                            |
| `pipecraft version`          | Version management              | `--check`                                            |
| `pipecraft skill`            | Install this skill for AI tools | `--list`, `--uninstall`, `--target`, `--global`      |

### validate vs doctor

| Command    | Scope              | When to use                                   |
| ---------- | ------------------ | --------------------------------------------- |
| `validate` | Config syntax only | After editing config, before `generate`       |
| `doctor`   | Entire setup       | Troubleshooting, health checks, after cloning |

## Configuration

### Config File Locations

Pipecraft searches (via cosmiconfig):

1. `--config <path>` flag
2. `.pipecraftrc` (YAML or JSON) **recommended**
3. `.pipecraftrc.json`, `.pipecraftrc.yaml`, `.pipecraftrc.yml`
4. `.pipecraftrc.js`, `pipecraft.config.js`
5. `"pipecraft"` key in `package.json`

### JSON Schema

Add to config for IDE validation:

```json
{
  "$schema": "https://raw.githubusercontent.com/the-craftlab/pipecraft/main/.pipecraft-schema.json"
}
```

### Required Fields

```yaml
ciProvider: github # Only 'github' fully supported
mergeStrategy: fast-forward # or 'merge'
requireConventionalCommits: true
initialBranch: develop # MUST be first in branchFlow
finalBranch: main # MUST be last in branchFlow
branchFlow: [develop, main] # Ordered promotion path
domains:
  app:
    paths: ['src/**']
    description: 'App code'
```

### Optional Fields

| Field                | Type          | Default  | Purpose                                                   |
| -------------------- | ------------- | -------- | --------------------------------------------------------- |
| `autoPromote`        | bool/object   | `false`  | Auto-promote between branches                             |
| `mergeMethod`        | string/object | `auto`   | `merge`, `squash`, `rebase`                               |
| `actionSourceMode`   | string        | `local`  | `local`, `remote`, `source`                               |
| `actionVersion`      | string        | `v1`     | Version for remote actions                                |
| `versioning.enabled` | bool          | -        | Enable release-it versioning                              |
| `semver.bumpRules`   | object        | built-in | Commit type → bump size, e.g. `feat: minor`, `fix: patch` |

### Domain Configuration

```yaml
domains:
  api:
    paths: ['packages/api/**', 'libs/shared/**']
    description: 'Backend API'
    prefixes: [test, deploy, remote-test] # Optional job prefixes
```

### Reserved Domain Names (Cannot Use)

`version`, `changes`, `gate`, `tag`, `promote`, `release`

### Deprecated Fields

| Deprecated             | Use Instead               |
| ---------------------- | ------------------------- |
| `testable: true`       | `prefixes: [test]`        |
| `deployable: true`     | `prefixes: [deploy]`      |
| `remoteTestable: true` | `prefixes: [remote-test]` |
| `autoMerge`            | `autoPromote`             |

## Typical Workflows

### New Project Setup

```bash
pipecraft init              # Create config
# Edit .pipecraftrc
pipecraft validate          # Check config
pipecraft generate          # Create workflows
pipecraft setup             # Create branches
pipecraft setup-github      # GitHub permissions
git add .github/ .pipecraftrc
git commit -m "chore: add Pipecraft CI/CD"
```

### Debugging

```bash
pipecraft doctor                    # Health check
pipecraft validate                  # Config syntax
pipecraft generate --dry-run        # Preview mode
pipecraft generate --debug          # Maximum detail
pipecraft get-config branchFlow     # Inspect values
```

## Common Errors

| Error                                       | Fix                                                          |
| ------------------------------------------- | ------------------------------------------------------------ |
| "initialBranch must be first in branchFlow" | Reorder branchFlow array                                     |
| "finalBranch must be last in branchFlow"    | Reorder branchFlow array                                     |
| "Reserved job name used as domain"          | Rename domain (not version/changes/gate/tag/promote/release) |
| "Configuration not found"                   | Run `pipecraft init`                                         |
| "Pre-flight checks failed"                  | Check git status, use `--skip-checks`                        |

## Branch Flow Patterns

```yaml
# Two-stage (simple)
branchFlow: [develop, main]

# Three-stage (recommended)
branchFlow: [develop, staging, main]
autoPromote:
  staging: true
  main: false

# Enterprise
branchFlow: [develop, staging, uat, production]
```

## Generated Files

- `.github/workflows/pipeline.yml` - Main CI/CD workflow
- `.github/actions/*/action.yml` - Reusable actions (if `actionSourceMode: local`)
- `.github/workflows/enforce-pr-target.yml` - PR targeting rules
- `.github/workflows/pr-title-check.yml` - Conventional commit validation
- `.release-it.cjs` - Version management config

## Managed vs Custom Jobs

**Pipecraft manages:** `changes`, `version`, `gate`, `tag`, `promote`, `release`

**You customize:** Everything between `# <--START CUSTOM JOBS-->` and `# <--END CUSTOM JOBS-->` markers.

## Questions to Ask Users

1. **Project type:** Monorepo or single app?
2. **Branch strategy:** How many stages? (develop/main vs develop/staging/main)
3. **Domains:** What parts need separate CI jobs?
4. **Auto-promotion:** Should code auto-advance between branches?

## Behaviour that surprises agents

**A direct push does not release.** `tag`, `release` and `promote` only run for commits
GitHub authored (merged PRs) or a `workflow_dispatch`. A hand-pushed commit is tested, the
version is reported, and those three jobs skip. Run the workflow from the Actions tab to
release it deliberately.

**Domain job bodies are the user's.** Pipecraft writes a placeholder marked
`# TODO: Replace with your <domain> test logic` and no install or test commands. Jobs that
only echo are not broken; they are unfilled.

**`enforce-pr-target.yml` and `pr-title-check.yml` are overwritten on every generate.** Never
edit them; change the config. `pipeline.yml` preserves custom jobs between its
`# <--START CUSTOM JOBS-->` markers.

**A domain with no `prefixes` generates no jobs.** Check with `pipecraft generate --dry-run`,
which lists the domain jobs the config produces.

**`doctor` exits 1 when it finds errors.** A non-zero exit means it ran and found problems, not that the command is broken.
