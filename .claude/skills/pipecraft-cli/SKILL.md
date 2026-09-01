---
name: pipecraft
description: Help users set up, configure, and use the Pipecraft CLI for GitHub Actions workflow generation. Use when users ask about CI/CD setup, workflow generation, branch promotion, domain configuration, or Pipecraft troubleshooting.
argument-hint: '[command|question]'
allowed-tools: Read, Grep, Glob, Bash(pipecraft *), Bash(npx pipecraft *), Bash(cat .pipecraftrc*), Bash(ls -la .pipecraftrc* .github/workflows/pipeline.yml 2>/dev/null), Edit, Write
---

# Pipecraft CLI Assistant

Help users with **Pipecraft** - a trunk-based CI/CD workflow generator for GitHub Actions.

## Current Project State

- Pipecraft version: !`pipecraft --version 2>/dev/null || echo "not installed"`
- Config file: !`ls .pipecraftrc* 2>/dev/null | head -1 || echo "none found"`
- Pipeline exists: !`test -f .github/workflows/pipeline.yml && echo "yes" || echo "no"`
- Current branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "not a git repo"`

## Commands Reference

| Command            | Purpose                         | Key Flags                                            |
| ------------------ | ------------------------------- | ---------------------------------------------------- |
| `init`             | Create `.pipecraftrc` config    | `--yes`, `--force`, `--with-versioning`              |
| `generate`         | Generate workflows              | `--dry-run`, `--verbose`, `--debug`, `--skip-checks` |
| `validate`         | Check config syntax             | (none)                                               |
| `doctor`           | Health check entire setup       | (none)                                               |
| `get-config <key>` | Read config value               | `--format json\|raw`                                 |
| `setup`            | Create branches from branchFlow | `--force`                                            |
| `setup-github`     | Configure GitHub permissions    | `--apply`                                            |
| `version`          | Version management              | `--check`                                            |
| `skill`            | Install this skill for AI tools | `--list`, `--uninstall`, `--target`, `--global`      |

### validate vs doctor: What's the Difference?

These two commands are often confused. Here's when to use each:

| Command    | What it checks                                                                                             | When to use                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `validate` | **Config syntax only** - Parses `.pipecraftrc` and checks required fields, valid values, schema compliance | After editing config, before `generate`          |
| `doctor`   | **Entire setup** - Config exists + is valid + workflows are generated + repo structure is correct          | Troubleshooting, CI health checks, after cloning |

**Use `validate` when:**

- You just edited `.pipecraftrc`
- You want fast feedback on config errors
- You're debugging a specific config issue

**Use `doctor` when:**

- Something isn't working and you don't know why
- You cloned a repo and want to check if Pipecraft is set up
- You want a full health check before pushing

**Example workflow:**

```bash
# After editing config - quick syntax check
pipecraft validate

# Something's broken - full diagnosis
pipecraft doctor
```

## Configuration

### Config File Locations (cosmiconfig)

Pipecraft searches in order:

1. `--config <path>` flag
2. `.pipecraftrc` (YAML or JSON) **← recommended**
3. `.pipecraftrc.json`, `.pipecraftrc.yaml`, `.pipecraftrc.yml`
4. `.pipecraftrc.js`, `pipecraft.config.js`
5. `"pipecraft"` key in `package.json`

### JSON Schema for IDE Validation

Add to config file for autocomplete and validation:

```json
{
  "$schema": "./.pipecraft-schema.json",
  "ciProvider": "github",
  ...
}
```

Schema location: [.pipecraft-schema.json](../../../.pipecraft-schema.json)

### Required Fields

```yaml
ciProvider: github # Only 'github' fully supported
mergeStrategy: fast-forward # or 'merge'
requireConventionalCommits: true
initialBranch: develop # MUST be first in branchFlow
finalBranch: main # MUST be last in branchFlow
branchFlow: [develop, main] # Ordered promotion path
semver:
  bumpRules:
    feat: minor
    fix: patch
    breaking: major
domains:
  app:
    paths: ['src/**']
    description: 'App code'
```

### Optional Fields

| Field                | Type          | Default | Purpose                       |
| -------------------- | ------------- | ------- | ----------------------------- |
| `autoPromote`        | bool/object   | `false` | Auto-promote between branches |
| `mergeMethod`        | string/object | `auto`  | `merge`, `squash`, `rebase`   |
| `actionSourceMode`   | string        | `local` | `local`, `remote`, `source`   |
| `actionVersion`      | string        | `v1`    | Version for remote actions    |
| `versioning.enabled` | bool          |         | Enable release-it versioning  |

### Domain Configuration

```yaml
domains:
  api:
    paths: ['packages/api/**', 'libs/shared/**']
    description: 'Backend API'
    prefixes: [test, deploy, remote-test] # Optional: job prefixes
```

### Reserved Domain Names (Cannot Use)

`version`, `changes`, `gate`, `tag`, `promote`, `release`

### Deprecated Fields (Don't Use)

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

### Debugging Issues

```bash
pipecraft doctor                    # Overall health check
pipecraft validate                  # Config syntax
pipecraft generate --dry-run        # Preview mode
pipecraft generate --debug          # Maximum detail
pipecraft get-config branchFlow     # Inspect specific values
```

## Common Errors

| Error                                       | Cause                                   | Fix                                   |
| ------------------------------------------- | --------------------------------------- | ------------------------------------- |
| "initialBranch must be first in branchFlow" | Config validation                       | Reorder branchFlow array              |
| "finalBranch must be last in branchFlow"    | Config validation                       | Reorder branchFlow array              |
| "Reserved job name used as domain"          | Domain named `version`, `changes`, etc. | Rename the domain                     |
| "Configuration not found"                   | No .pipecraftrc                         | Run `pipecraft init`                  |
| "Pre-flight checks failed"                  | Missing git repo or permissions         | Check git status, use `--skip-checks` |

## Branch Flow Patterns

```
# Two-stage (simple)
branchFlow: [develop, main]

# Three-stage (recommended)
branchFlow: [develop, staging, main]
autoPromote:
  staging: true   # Auto-promote develop → staging
  main: false     # Manual promotion staging → main

# Enterprise
branchFlow: [develop, staging, uat, production]
```

## Generated Files

When `pipecraft generate` runs:

- `.github/workflows/pipeline.yml` - Main CI/CD workflow
- `.github/actions/*/action.yml` - Reusable actions (if `actionSourceMode: local`)
- `.github/workflows/enforce-pr-target.yml` - PR targeting rules
- `.github/workflows/pr-title-check.yml` - Conventional commit validation
- `.release-it.cjs` - Version management config

## Managed vs Custom Jobs

**Pipecraft manages:** `changes`, `version`, `gate`, `tag`, `promote`, `release`

**You customize:** Everything between `# <--START CUSTOM JOBS-->` and `# <--END CUSTOM JOBS-->` markers - these survive regeneration.

## Questions to Clarify with User

1. **Project type:** Monorepo or single app?
2. **Branch strategy:** How many stages? (develop/main vs develop/staging/main)
3. **Domains:** What logical parts need separate CI jobs?
4. **Auto-promotion:** Should code auto-advance between branches?

## Full Reference

See [PIPECRAFT_AI_GUIDE.md](../../../PIPECRAFT_AI_GUIDE.md) for complete documentation.

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
