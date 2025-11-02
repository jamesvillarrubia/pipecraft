<img src="https://raw.githubusercontent.com/jamesvillarrubia/pipecraft/main/assets/logo_banner.png" alt="PipeCraft Logo" width="auto">

# PipeCraft

[![npm version](https://badge.fury.io/js/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![NPM downloads](https://img.shields.io/npm/dm/pipecraft.svg)](https://www.npmjs.com/package/pipecraft)
[![License](https://img.shields.io/npm/l/pipecraft.svg)](https://github.com/jamesvillarrubia/pipecraft/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/en/)
[![Documentation](https://img.shields.io/badge/docs-pipecraft.thecraftlab.dev-blue)](https://pipecraft.thecraftlab.dev)
[![codecov](https://codecov.io/gh/jamesvillarrubia/pipecraft/branch/main/graph/badge.svg)](https://codecov.io/gh/jamesvillarrubia/pipecraft)
[![GitHub issues](https://img.shields.io/github/issues/jamesvillarrubia/pipecraft)](https://github.com/jamesvillarrubia/pipecraft/issues)
[![GitHub stars](https://img.shields.io/github/stars/jamesvillarrubia/pipecraft)](https://github.com/jamesvillarrubia/pipecraft/stargazers)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

**Pipeline Status:**
[![develop](https://img.shields.io/github/actions/workflow/status/jamesvillarrubia/pipecraft/pipeline.yml?branch=develop&label=develop)](https://github.com/jamesvillarrubia/pipecraft/actions/workflows/pipeline.yml?query=branch%3Adevelop)
[![staging](https://img.shields.io/github/actions/workflow/status/jamesvillarrubia/pipecraft/pipeline.yml?branch=staging&label=staging)](https://github.com/jamesvillarrubia/pipecraft/actions/workflows/pipeline.yml?query=branch%3Astaging)
[![main](https://img.shields.io/github/actions/workflow/status/jamesvillarrubia/pipecraft/pipeline.yml?branch=main&label=main)](https://github.com/jamesvillarrubia/pipecraft/actions/workflows/pipeline.yml?query=branch%3Amain)

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
git add .github/workflows .pipecraftrc
git commit -m "chore: add PipeCraft workflows"
git push
```

That's it. Your trunk-based development workflow is now automated.

## Key Features

**Smart change detection** analyzes your commits to determine which parts of your monorepo changed. When you modify your API code, only API tests run. When you change the web frontend, only web tests run. When you touch shared libraries, all dependent tests run. This intelligence is built into the generated workflows—you don't manage it yourself.

**Automatic semantic versioning** reads your conventional commit messages (feat:, fix:, breaking:) and calculates the next version number. No more manually deciding whether something is a major, minor, or patch release. PipeCraft handles version bumping, git tagging, and changelog generation based on your commits.

**Trunk-based development support** provides a complete branch flow system. Code moves through develop → staging → main automatically after passing tests at each stage. Fast-forward merging keeps git history clean. Version gating ensures only tested code promotes to production.

**Safe workflow regeneration** preserves your customizations when you update configuration. PipeCraft uses AST-based merging to separate managed workflow structure from your custom test and deployment commands. Add your own jobs, modify test steps, customize deployments—all survive regeneration.

**Pre-flight validation** catches configuration errors before they become cryptic workflow failures. PipeCraft validates your setup, checks git configuration, verifies permissions, and provides helpful error messages when something needs fixing.

## When to Use PipeCraft

**You're managing a monorepo** with multiple applications or services. Running all tests for every change wastes time and money. PipeCraft's domain-based testing ensures you only test what changed while automatically testing shared dependencies across all dependent code.

**You want consistent CI/CD** across multiple projects or teams. Define your organization's workflow pattern once, then generate it consistently across repos. Changes to the pattern propagate through regeneration while preserving project-specific customizations.

**You're tired of maintaining YAML** with hundreds of lines of repetitive workflow configuration. PipeCraft generates the boilerplate while letting you focus on what's unique about your project—the actual test and deployment commands.

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

Run `pipecraft generate` and you get a complete GitHub Actions workflow with:

- Change detection that identifies which domains modified
- Parallel test jobs for api and web (conditional on changes)
- Semantic versioning based on conventional commits
- Automatic branch promotion through your flow
- Version tagging and changelog generation

Add your specific test commands to the generated jobs, commit everything, and you're running.

## What Gets Generated

PipeCraft creates `.github/workflows/pipeline.yml` containing all the jobs that run when you push code. It also generates reusable actions in `actions/` for common operations like change detection and version calculation.

The generated workflows include clearly marked sections for your customizations. Anything you add in these sections survives regeneration—PipeCraft's AST-based merging ensures your test commands, deployment scripts, and custom jobs remain intact when you update configuration.

See the [Getting Started guide](https://pipecraft.thecraftlab.dev/docs/intro) for a complete walkthrough with examples, or check out [What Gets Generated](https://pipecraft.thecraftlab.dev/docs/intro#what-gets-generated) for detailed workflow structure.

## Next Steps

**Start with the tutorial**: The [Getting Started guide](https://pipecraft.thecraftlab.dev/docs/intro) walks through setting up PipeCraft in a real monorepo with detailed explanations of each step.

**Understand your configuration**: The [Configuration Reference](https://pipecraft.thecraftlab.dev/docs/configuration-reference) explains every option with examples of when and why to use each setting.

**See real-world examples**: The [Examples page](https://pipecraft.thecraftlab.dev/docs/examples) shows configurations for different scenarios—simple web apps, full-stack monorepos, microservices, and enterprise setups.

**Learn the commands**: The [Commands guide](https://pipecraft.thecraftlab.dev/docs/commands) covers all CLI commands with practical usage patterns and workflows.

**Explore workflow patterns**: Start with [Trunk Flow](https://pipecraft.thecraftlab.dev/docs/flows/trunk-flow) to understand how code moves through branches automatically.

## Troubleshooting

If you encounter issues, the [Troubleshooting guide](https://pipecraft.thecraftlab.dev/docs/troubleshooting) covers common problems with detailed solutions.

For questions and discussions, visit [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions).

To report bugs or request features, open an issue on [GitHub Issues](https://github.com/jamesvillarrubia/pipecraft/issues).

## Contributing

We welcome contributions! See the [Contributing guide](https://pipecraft.thecraftlab.dev/docs/contributing) for:

- Development setup instructions
- Code architecture overview
- Testing guidelines
- Pull request process

Quick development setup:

```bash
git clone https://github.com/jamesvillarrubia/pipecraft.git
cd pipecraft
npm install
npm test
```

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for trunk-based development teams**

[Documentation](https://pipecraft.thecraftlab.dev) · [Report Bug](https://github.com/jamesvillarrubia/pipecraft/issues) · [Request Feature](https://github.com/jamesvillarrubia/pipecraft/issues)

</div>
# Testing change detection
