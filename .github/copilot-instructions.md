# Pipecraft - GitHub Copilot Instructions

This is **Pipecraft** - a trunk-based CI/CD workflow generator for GitHub Actions.

## What Pipecraft Does

- Generates GitHub Actions workflows from `.pipecraftrc` configuration
- Implements domain-based change detection (only run jobs for changed code)
- Manages semantic versioning from conventional commits
- Automates branch promotion (develop → staging → main)

## CLI Commands

```bash
pipecraft init              # Create .pipecraftrc config
pipecraft generate          # Generate workflows
pipecraft validate          # Check config syntax
pipecraft doctor            # Full setup health check
pipecraft setup             # Create branches from branchFlow
pipecraft setup-github      # Configure GitHub permissions
pipecraft get-config <key>  # Read config value
pipecraft version --check   # Preview next version
```

## Configuration Required Fields

```yaml
ciProvider: github
mergeStrategy: fast-forward
requireConventionalCommits: true
initialBranch: develop # Must be FIRST in branchFlow
finalBranch: main # Must be LAST in branchFlow
branchFlow: [develop, main]
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

## Reserved Domain Names

These cannot be used as domain names: `version`, `changes`, `gate`, `tag`, `promote`, `release`

## Development

- TypeScript with strict mode
- pnpm for package management
- Vitest for testing
- Run tests: `pnpm vitest run --exclude '.worktrees/**'`

## References

- Documentation: https://pipecraft.thecraftlab.dev
- Full AI Guide: PIPECRAFT_AI_GUIDE.md
- Schema: .pipecraft-schema.json

## Gotchas

- A directly-pushed commit does not release. `tag`/`release`/`promote` need a merged PR or a
  manual `workflow_dispatch`.
- Domain job bodies are the user's; Pipecraft writes placeholders with no test commands.
- `enforce-pr-target.yml` and `pr-title-check.yml` are overwritten on every generate.
- A domain with no `prefixes` generates no jobs.
- `pipecraft init` prompts; pass `--yes` for CI, scripts and agents.
