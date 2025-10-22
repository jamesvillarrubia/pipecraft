# Architecture

PipeCraft generates CI/CD workflows from a simple configuration file. Understanding how it works will help you use it effectively and troubleshoot issues when they arise.

## The big picture

At its core, PipeCraft is a template generator. You provide a configuration file that describes your project structure, and PipeCraft transforms that into complete GitHub Actions workflows. The generated workflows handle testing, versioning, branch promotions, and deployments automatically.

The process looks like this: you run `pipecraft generate`, which reads your `.pipecraftrc.json` file, applies some validation checks, and then generates workflow files in `.github/workflows/` and `.github/actions/`. These files are committed to your repository and run automatically when you push code.

## Domain-based testing

One of PipeCraft's key features is domain-based change detection. In a monorepo, you might have multiple applications or packages that can be tested and deployed independently. PipeCraft uses this to optimize your CI/CD pipeline.

When you define domains in your configuration:

```json
{
  "domains": {
    "api": { "paths": ["packages/api/**"] },
    "web": { "paths": ["packages/web/**"] }
  }
}
```

PipeCraft generates workflows that detect which files changed and only run jobs for affected domains. If you modify a file in `packages/api/`, only the API tests and deployment run. The web jobs are skipped entirely. This saves time and reduces CI costs, especially in large monorepos.

## Safe regeneration

A unique aspect of PipeCraft is that it's designed to be regenerated repeatedly. Unlike many code generators that you run once and then edit the output manually, PipeCraft expects you to regenerate workflows whenever your configuration changes.

To make this safe, PipeCraft uses YAML AST (Abstract Syntax Tree) manipulation. When it regenerates workflows, it:

1. Parses your existing workflow files to understand their structure
2. Identifies sections it manages (marked with special comments)
3. Updates only those managed sections
4. Preserves everything else - your custom test commands, deploy scripts, and comments

This means you can freely customize the test and deploy jobs without worrying about losing your changes. PipeCraft only modifies the workflow structure, job dependencies, and promotion logic.

## Version-gated promotions

PipeCraft promotes code through branches (develop → staging → main) based on semantic versioning. Only commits that bump the version number trigger promotions.

This ensures that housekeeping commits (tests, documentation, refactoring) stay on the development branch while meaningful changes (features and fixes) automatically flow through to production. It creates a clean history where every promotion represents a versioned release.

The version calculation is based on conventional commits:
- `feat:` commits bump the minor version (1.0.0 → 1.1.0)
- `fix:` commits bump the patch version (1.0.0 → 1.0.1)
- Breaking changes bump the major version (1.0.0 → 2.0.0)

## Performance through caching

PipeCraft caches a hash of your configuration and template files in `.pipecraft-cache.json`. When you run `pipecraft generate`, it first checks if anything has changed. If your configuration is unchanged and you haven't updated PipeCraft itself, the command completes almost instantly without regenerating files.

This makes PipeCraft fast enough to include in pre-commit hooks or CI pipelines without slowing down your workflow.

## Why these design choices?

The architecture reflects a few key principles:

**Simplicity:** Configuration should directly map to behavior. If you define a domain, you get test and deploy jobs for it. No magic or hidden complexity.

**Safety:** Regeneration should never destroy your work. The AST-based approach ensures your customizations are preserved.

**Performance:** CI/CD costs add up quickly in monorepos. Domain-based testing and caching make workflows fast and efficient.

These principles guide all architectural decisions in PipeCraft.
