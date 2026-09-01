<img src="https://raw.githubusercontent.com/the-craftlab/pipecraft/main/assets/logo_banner.png" alt="PipeCraft Logo" width="auto">

# PipeCraft

**Your CI/CD decisions, already made.**

Nx and Turbo hand the pipeline decisions back to you. How branches promote, when a version
is cut, which tests run for which change, what stops a bad push reaching production — every
team works those out again, and makes the same mistakes doing it.

PipeCraft has made those decisions. It generates GitHub Actions workflows into your
repository that encode them, and the workflows are yours from the moment they land.

```bash
npx pipecraft init --yes
npx pipecraft generate
```

Two commands, and you have this:

```
changes    which domains changed, from your path globs
version    next semantic version, from your conventional commits
test-api   ─┐
test-web    ├─ one job per domain, run only when that domain changed
test-cicd  ─┘
gate       every prerequisite passed
tag        the version tag, on the commit that earned it
promote    a PR to the next branch in your flow
release    the GitHub release, on your final branch
```

The domain jobs are placeholders holding your test commands. Everything else works on the
first push.

## What it decides for you

**Only merged pull requests cut releases.** A commit pushed straight to your branch runs
your tests and reports the version it would have used, then stops. A hotfix typed on the
wrong branch cannot ship.

**Promotion is a pull request.** Code moves along `develop → staging → main` through PRs
that Pipecraft opens. Set `autoPromote` per branch to say which hops merge themselves and
which wait for a person.

**Versions come from commits, in one place.** Conventional commits decide the bump, the
pipeline resolves it, and no local command can produce a tag CI disagrees with.

**Tests run for what changed.** Domains are path globs; the `changes` job turns them into
flags your jobs are gated on.

Disagree with any of it? The workflows are in your repository. Edit them, or change the
config and regenerate — custom jobs are preserved.

## Documentation

**[pipecraft.thecraftlab.dev](https://pipecraft.thecraftlab.dev)** — guides, configuration
reference, examples, and troubleshooting.

Working in this repo with an AI agent? See [AGENTS.md](AGENTS.md).

[![npm version](https://badge.fury.io/js/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![NPM downloads](https://img.shields.io/npm/dm/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![License](https://img.shields.io/npm/l/pipecraft.svg)](https://github.com/the-craftlab/pipecraft/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/en/)
[![Documentation](https://img.shields.io/badge/docs-pipecraft.thecraftlab.dev-blue)](https://pipecraft.thecraftlab.dev)
[![codecov](https://codecov.io/gh/the-craftlab/pipecraft/branch/main/graph/badge.svg)](https://codecov.io/gh/the-craftlab/pipecraft)
[![GitHub stars](https://img.shields.io/github/stars/the-craftlab/pipecraft)](https://github.com/the-craftlab/pipecraft/stargazers)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

**Pipeline Status:**
[![develop](https://img.shields.io/github/actions/workflow/status/the-craftlab/pipecraft/pipeline.yml?branch=develop&label=develop)](https://github.com/the-craftlab/pipecraft/actions/workflows/pipeline.yml?query=branch%3Adevelop)
[![staging](https://img.shields.io/github/actions/workflow/status/the-craftlab/pipecraft/pipeline.yml?branch=staging&label=staging)](https://github.com/the-craftlab/pipecraft/actions/workflows/pipeline.yml?query=branch%3Astaging)
[![main](https://img.shields.io/github/actions/workflow/status/the-craftlab/pipecraft/pipeline.yml?branch=main&label=main)](https://github.com/the-craftlab/pipecraft/actions/workflows/pipeline.yml?query=branch%3Amain)

## Quick Start

```bash
# Create .pipecraftrc. Prompts unless you pass --yes.
npx pipecraft init --yes

# See what would be generated, including the domain jobs your config produces
npx pipecraft generate --dry-run

# Write the workflows
npx pipecraft generate

git add .github .pipecraftrc && git commit -m "chore: add PipeCraft workflows"
```

Then edit `.pipecraftrc` to match your repository — the branch names in `branchFlow`, and
the path globs and `prefixes` for each domain — and regenerate.

## Key Features

**Smart change detection** - PipeCraft generates workflows that detect which parts of your monorepo changed. The `changes` job outputs domain flags (`api: true`, `web: false`) that you use in conditional job execution. You write the test commands—PipeCraft handles running them only when needed.

```yaml
test-api:
  needs: changes
  if: ${{ needs.changes.outputs.api == 'true' }} # Only runs when API changed
  runs-on: ubuntu-latest
  steps:
    # You add your test commands here:
    - run: npm run test:api
```

**Semantic versioning scaffolding** - PipeCraft generates a `version` job that reads conventional commits and calculates version numbers. You get the version as an output to use in your deployment jobs. Tag creation and branch promotion workflows are generated—you add the deployment commands.

**Branch promotion structure** - PipeCraft generates `tag`, `promote`, and `release` jobs that run after your tests pass. These jobs handle git operations (creating tags, merging branches, creating releases). You add deploy steps to run when code reaches each branch.

**Safe workflow regeneration** - PipeCraft preserves your custom jobs when you regenerate. The generated workflow has clearly marked sections (`<--START CUSTOM JOBS-->` / `<--END CUSTOM JOBS-->`) where your test, deploy, and custom logic lives. Regeneration updates the managed sections (changes detection, version calculation, tag/promote jobs) while keeping your customizations intact.

**Change detection works with both strategies** - For standard repos, PipeCraft uses path-based detection (you define glob patterns per domain). For Nx monorepos, it automatically uses Nx's dependency graph for precise change detection. Either way, you get domain-based conditional job execution.

## When to Use PipeCraft

**You're managing a monorepo** with multiple applications or services. PipeCraft gives you the scaffolding for domain-based testing—change detection, conditional job execution, and the workflow structure. You add your actual test commands.

**You want a structured trunk-based workflow** with version calculation, tagging, and branch promotions. PipeCraft generates the git operations and flow control. You add your deployment steps at each stage.

**You need smart change detection** that understands your monorepo structure. PipeCraft provides path-based detection (or Nx graph integration) so you can run `if: ${{ needs.changes.outputs.api == 'true' }}` in your jobs and test only what changed.

## Installation

### Using npx (recommended)

No installation required—just run commands directly:

```bash
npx pipecraft init --yes   # drop --yes to answer the prompts
npx pipecraft generate
```

### Global installation

Install once, use everywhere:

```bash
npm install -g pipecraft
pipecraft init
```

### Local project installation

Add to your project's dev dependencies:

```bash
npm install --save-dev pipecraft
```

Then add npm scripts to your package.json:

```json
{
  "scripts": {
    "workflow:init": "pipecraft init",
    "workflow:generate": "pipecraft generate",
    "workflow:validate": "pipecraft validate"
  }
}
```

## Simple Example

Create a `.pipecraftrc` configuration describing your project:

```yaml
# PipeCraft Configuration
ciProvider: github
mergeStrategy: fast-forward
requireConventionalCommits: true

# Branch flow configuration
initialBranch: develop
finalBranch: main

# Promotion flow: develop → staging → main
branchFlow:
  - develop
  - staging
  - main

# Domain definitions - what parts of your codebase trigger which jobs
domains:
  api:
    description: 'API services and core logic'
    paths:
      - apps/api/**
      - libs/api-core/**

  web:
    description: 'Web application and UI'
    paths:
      - apps/web/**
      - libs/ui-components/**
```

Run `pipecraft generate` and you get workflow scaffolding with:

- **Change detection job** - Outputs `api: true/false` and `web: true/false` based on what changed
- **Conditional test job structure** - `test-api` and `test-web` jobs with `if:` conditions, ready for your test commands
- **Version calculation job** - Reads conventional commits, outputs semantic version
- **Tag/promote/release jobs** - Handle git operations after tests pass

**What you add**:

- Test commands in each `test-*` job (e.g., `npm run test:api`)
- Deploy commands in custom jobs for each branch (staging deploy, production deploy)
- Remote test commands if you need post-deployment testing

**Example of what a generated test job looks like**:

```yaml
test-api:
  needs: [changes, version]
  if: ${{ needs.changes.outputs.api == 'true' }}
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    # <--START CUSTOM TEST STEPS-->
    # Add your test commands here:
    # - run: npm install
    # - run: npm run test:api
    # <--END CUSTOM TEST STEPS-->
```

You fill in the custom sections with your actual test logic.

## What Gets Generated

**Managed sections** (PipeCraft controls these):

- `changes` job - Detects which domains changed using path patterns or Nx graph
- `version` job - Calculates semantic version from conventional commits
- `tag` job - Creates git tags for new versions
- `promote` job - Merges code through your branch flow (develop → staging → main)
- `release` job - Creates GitHub releases
- Domain test job structure with conditional execution

**Custom sections** (you control these):

- Test commands inside each `test-*` job
- Deploy jobs for each environment (staging-deploy, production-deploy)
- Remote test jobs for post-deployment testing
- Any additional jobs you need (e.g., security scanning, notifications)

**Example workflow structure**:

```yaml
changes: # Managed - detects what changed
version: # Managed - calculates version
test-api: # Managed structure, you add test commands
test-web: # Managed structure, you add test commands

# <--START CUSTOM JOBS-->
deploy-staging: # You create this
remote-test-api: # You create this
deploy-prod: # You create this
# <--END CUSTOM JOBS-->

tag: # Managed - creates git tags
promote: # Managed - merges branches
release: # Managed - creates GitHub release
```

Regeneration preserves everything in custom sections. See the [Getting Started guide](https://pipecraft.thecraftlab.dev/docs/intro) for a complete walkthrough.

## Next Steps

**Start with the tutorial**: The [Getting Started guide](https://pipecraft.thecraftlab.dev/docs/intro) walks through setting up PipeCraft in a real monorepo with detailed explanations of each step.

**Understand your configuration**: The [Configuration Reference](https://pipecraft.thecraftlab.dev/docs/configuration-reference) explains every option with examples of when and why to use each setting.

**See real-world examples**: The [Examples page](https://pipecraft.thecraftlab.dev/docs/examples) shows configurations for different scenarios—simple web apps, full-stack monorepos, microservices, and enterprise setups.

**Learn the commands**: The [Commands guide](https://pipecraft.thecraftlab.dev/docs/commands) covers all CLI commands with practical usage patterns and workflows.

**Explore workflow patterns**: Start with [Trunk Flow](https://pipecraft.thecraftlab.dev/docs/flows/trunk-flow) to understand how code moves through branches automatically.

## Troubleshooting

### Quick Health Check

Run diagnostic checks on your Pipecraft setup:

```bash
pipecraft doctor
```

This checks:

- Configuration validation
- GitHub workflow permissions
- Branch existence on remote
- Generated file verification
- Workflow semantic validation (circular dependencies, missing job references)
- Domain path validation

### Common Issues

If you encounter issues, the [Troubleshooting guide](https://pipecraft.thecraftlab.dev/docs/troubleshooting) covers common problems with detailed solutions.

For questions and discussions, visit [GitHub Discussions](https://github.com/the-craftlab/pipecraft/discussions).

To report bugs or request features, open an issue on [GitHub Issues](https://github.com/the-craftlab/pipecraft/issues).

## AI Assistant Integration

Pipecraft includes AI skills for Claude Code, Cursor, GitHub Copilot, and other coding assistants.

### Install the Skill

```bash
# Via npm (Claude Code + Cursor)
npm install -g @pipecraft/claude-skill

# Via OpenSkills (universal)
npx openskills install the-craftlab/pipecraft
```

### Manual Setup

| Tool           | Configuration File                                   |
| -------------- | ---------------------------------------------------- |
| Claude Code    | `.claude/skills/pipecraft/SKILL.md`                  |
| Cursor         | `.cursorrules` (included in repo)                    |
| GitHub Copilot | `.github/copilot-instructions.md` (included in repo) |

### What the Skill Provides

- Set up Pipecraft from scratch
- Configure domains and branch flows
- Troubleshoot configuration issues
- Understand generated workflow structure

See [PIPECRAFT_AI_GUIDE.md](PIPECRAFT_AI_GUIDE.md) for the full reference, or use `/pipecraft` in Claude Code.

## Contributing

We welcome contributions! See the [Contributing guide](https://pipecraft.thecraftlab.dev/docs/contributing) for:

- Development setup instructions
- Code architecture overview
- Testing guidelines
- Pull request process

Quick development setup:

```bash
git clone https://github.com/the-craftlab/pipecraft.git
cd pipecraft
npm install
npm test
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for trunk-based development teams**

[Documentation](https://pipecraft.thecraftlab.dev) · [Report Bug](https://github.com/the-craftlab/pipecraft/issues) · [Request Feature](https://github.com/the-craftlab/pipecraft/issues)

</div>
