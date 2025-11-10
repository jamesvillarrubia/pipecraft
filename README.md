<img src="https://raw.githubusercontent.com/pipecraft-lab/pipecraft/main/assets/logo_banner.png" alt="PipeCraft Logo" width="auto">

# PipeCraft

[![npm version](https://badge.fury.io/js/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![NPM downloads](https://img.shields.io/npm/dm/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![License](https://img.shields.io/npm/l/pipecraft.svg)](https://github.com/pipecraft-lab/pipecraft/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/en/)
[![Documentation](https://img.shields.io/badge/docs-pipecraft.thecraftlab.dev-blue)](https://pipecraft.thecraftlab.dev)
[![codecov](https://codecov.io/gh/pipecraft-lab/pipecraft/branch/main/graph/badge.svg)](https://codecov.io/gh/pipecraft-lab/pipecraft)
[![GitHub issues](https://img.shields.io/github/issues/pipecraft-lab/pipecraft)](https://github.com/pipecraft-lab/pipecraft/issues)
[![GitHub stars](https://img.shields.io/github/stars/pipecraft-lab/pipecraft)](https://github.com/pipecraft-lab/pipecraft/stargazers)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

**Pipeline Status:**
[![develop](https://img.shields.io/github/actions/workflow/status/pipecraft-lab/pipecraft/pipeline.yml?branch=develop&label=develop)](https://github.com/pipecraft-lab/pipecraft/actions/workflows/pipeline.yml?query=branch%3Adevelop)
[![staging](https://img.shields.io/github/actions/workflow/status/pipecraft-lab/pipecraft/pipeline.yml?branch=staging&label=staging)](https://github.com/pipecraft-lab/pipecraft/actions/workflows/pipeline.yml?query=branch%3Astaging)
[![main](https://img.shields.io/github/actions/workflow/status/pipecraft-lab/pipecraft/pipeline.yml?branch=main&label=main)](https://github.com/pipecraft-lab/pipecraft/actions/workflows/pipeline.yml?query=branch%3Amain)

Skip the debugging cycles. Generate battle-tested CI/CD workflows into your repository with best practices built in. Fully customizable, completely yours.

---

## 📚 Complete Documentation

**[Read the full documentation at pipecraft.thecraftlab.dev →](https://pipecraft.thecraftlab.dev)**

The documentation site includes comprehensive guides, real-world examples, configuration references, and troubleshooting help.

---

## What is PipeCraft?

Debugging CI/CD pipelines is tedious. You push a change, wait 10 minutes for the pipeline to run, discover a tiny YAML syntax error, fix it, wait another 10 minutes, find another issue. Repeat until you've wasted hours on what should be simple workflow setup.

PipeCraft solves this by providing battle-tested CI/CD templates that you generate into your own repository. Instead of writing GitHub Actions workflows from scratch and debugging them through trial and error, you start with proven patterns that handle common scenarios: domain-based testing for monorepos, semantic versioning, branch promotion flows, and deployment automation.

The generated workflows live in your repository—you own them completely. Customize them as much as you need: add deployment steps, integrate with your tools, modify job configurations. When customizations get complex or you want to start fresh, regenerate from templates. PipeCraft preserves your customizations while updating the core workflow structure.

This approach means you get a fully functional CI/CD pipeline with best practices built in from day one, without the debugging cycles and without the maintenance burden of keeping workflows synchronized across projects.

## Quick Start

Get a working pipeline in three commands:

```bash
# Initialize PipeCraft in your project
npx pipecraft init

# Edit the generated .pipecraftrc to customize:
# - Branch names (branchFlow, initialBranch, finalBranch)
# - Domain paths and configurations
# - CI provider and merge strategy
# (Supports .pipecraftrc, .json, .yml, .yaml, or .js formats)

# Generate your CI/CD workflows
npx pipecraft generate

# Commit the generated files
git add .github/workflows .github/actions .pipecraftrc
git commit -m "chore: add PipeCraft workflows"
git push
```

That's it. You now have a structured CI/CD workflow with change detection. Add your test commands to the generated jobs.

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
npx pipecraft init
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

Create a `.pipecraftrc.json` configuration describing your project:

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "api": {
      "paths": ["apps/api/**", "libs/api-core/**"],
      "description": "API services and core logic"
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui-components/**"],
      "description": "Web application and UI"
    }
  }
}
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

If you encounter issues, the [Troubleshooting guide](https://pipecraft.thecraftlab.dev/docs/troubleshooting) covers common problems with detailed solutions.

For questions and discussions, visit [GitHub Discussions](https://github.com/pipecraft-lab/pipecraft/discussions).

To report bugs or request features, open an issue on [GitHub Issues](https://github.com/pipecraft-lab/pipecraft/issues).

## Contributing

We welcome contributions! See the [Contributing guide](https://pipecraft.thecraftlab.dev/docs/contributing) for:

- Development setup instructions
- Code architecture overview
- Testing guidelines
- Pull request process

Quick development setup:

```bash
git clone https://github.com/pipecraft-lab/pipecraft.git
cd pipecraft
npm install
npm test
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for trunk-based development teams**

[Documentation](https://pipecraft.thecraftlab.dev) · [Report Bug](https://github.com/pipecraft-lab/pipecraft/issues) · [Request Feature](https://github.com/pipecraft-lab/pipecraft/issues)

</div>
# Testing change detection
