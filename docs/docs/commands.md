---
sidebar_position: 2
---

# CLI Reference

PipeCraft provides a focused set of commands designed to get you from zero to a working CI/CD pipeline with minimal friction. Each command serves a specific purpose in your workflow, from initial setup through ongoing maintenance and troubleshooting.

## Understanding the Command Flow

When you're setting up PipeCraft for the first time, you'll typically follow a simple pattern: initialize your configuration, generate your workflows, and commit everything to your repository. After that, you'll occasionally regenerate workflows when you change your configuration, and use the diagnostic commands when something needs attention.

The beauty of PipeCraft is that most of the time, you won't need to think about it at all. Your workflows run automatically based on your commits and branch merges. The commands exist primarily for setup and customization.

## Setup Commands

### pipecraft init

The `init` command creates your `.pipecraftrc`. Run it with a terminal attached and it asks
a short series of questions — CI provider, merge strategy, branches, and how to group your
domains:

```bash
pipecraft init
```

#### Without prompts

Pass `--yes` to accept defaults and answer nothing. Use this in CI, in setup scripts, and
when a coding agent is driving:

```bash
pipecraft init --yes
```

Flags set individual values, so you can shape the config without a terminal:

```bash
pipecraft init --yes \
  --initial-branch develop \
  --final-branch main \
  --merge-strategy fast-forward \
  --ci-provider github
```

| Flag                          | Default        |
| ----------------------------- | -------------- |
| `--ci-provider <provider>`    | `github`       |
| `--merge-strategy <strategy>` | `fast-forward` |
| `--initial-branch <branch>`   | `develop`      |
| `--final-branch <branch>`     | `main`         |

`init` also skips prompting when stdin is not a terminal, so piping or redirecting works
without `--yes`. It prints a line saying it did so.

**The branch flow follows the branches you choose.** With the defaults you get
`develop → staging → main`. Name different ends and you get exactly those two, so
`--initial-branch trunk --final-branch production` produces `trunk → production`. Give the
same branch for both and you get a single-branch flow.

#### Overwriting

```bash
pipecraft init --force
```

This replaces your entire configuration with a fresh one. Commit your changes first.

### pipecraft setup

Once you have a configuration, you might need to create the branches it references. The `setup` command reads your branch flow configuration and creates any missing branches in your repository:

```bash
pipecraft setup
```

This is particularly useful when you're setting up a new repository or when you've added a new branch to your flow. The command creates each branch and pushes it to your remote, ensuring your repository structure matches your configuration.

It does not check anything out. Branches are created as refs from your current `HEAD`, so
you stay on the branch you were on and your working tree is untouched — uncommitted changes
included. If the command fails partway, you are still where you started.

If branches already exist, the command skips them gracefully. You can force recreation of branches if needed, though this is rarely necessary:

```bash
pipecraft setup --force
```

## Generation Commands

### pipecraft generate

This is the command you'll use most often. It reads your configuration and generates the GitHub Actions workflow files that power your CI/CD pipeline:

```bash
pipecraft generate
```

Before generating anything, this command runs automatic pre-flight checks to validate your setup. It verifies that you're in a git repository, that you have a valid configuration, that the necessary directories exist with proper permissions, and that your git remote is configured. If any checks fail, you'll see clear error messages explaining what needs to be fixed.

The generate command is smart about when it regenerates workflows. By default, it only creates new workflow files if your configuration has changed or if the PipeCraft templates have been updated. This means you can run it repeatedly without worrying about unnecessary changes cluttering your git history.

When you want to see what's happening behind the scenes, use verbose mode:

```bash
pipecraft generate --verbose
```

This shows you exactly which files are being created or updated, how configuration values map to workflow steps, and what the merge process looks like when combining generated code with your customizations.

For even more detail, especially when debugging issues or contributing to PipeCraft development, debug mode shows internal processing details:

```bash
pipecraft generate --debug
```

Sometimes you need to force regeneration even when nothing has changed—for example, if you're testing modifications to custom workflow jobs:

```bash
pipecraft generate --force
```

To see what would be generated without creating or modifying anything:

```bash
pipecraft generate --dry-run
```

It lists every file it would touch, marking each `create` or `update`, then the domain
jobs your config produces:

```
🔍 Dry run — no files will be written.

Workflows:
  create .github/workflows/pipeline.yml
  create .github/workflows/enforce-pr-target.yml
  create .github/workflows/pr-title-check.yml

Composite actions:
  create .github/actions/detect-changes/action.yml
  …

Domain jobs:
  deploy-api
  test-api
  test-web

Managed jobs: changes, version, gate, tag, promote, release
Branch flow:  develop → main
```

The domain jobs list is the part worth reading. A domain that declares no `prefixes`
generates no jobs, and this is where that becomes visible rather than after you have
committed a pipeline missing its tests.

The generate command also supports custom paths, which is useful if you're managing multiple configurations or experimenting with different setups:

```bash
pipecraft generate --config custom-config.json --output-pipeline .github/workflows/custom.yml
```

#### Skipping Pre-Flight Checks

The pre-flight checks exist to save you from cryptic error messages later, but there are legitimate reasons to skip them—particularly in CI/CD environments or automated scripts where the repository structure might not match standard assumptions:

```bash
pipecraft generate --skip-checks
```

Use this option carefully. The checks are fast and prevent frustrating debugging sessions when your workflows don't run as expected.

## Validation Commands

### pipecraft validate

Before committing configuration changes, it's good practice to validate that your JSON is correct and that all required fields are present:

```bash
pipecraft validate
```

This command checks your configuration against PipeCraft's schema, verifies that branch names are consistent, ensures domains have valid path patterns, and confirms that all required fields are present. It's particularly useful when you're making significant changes to your setup or when you're troubleshooting unexpected behavior.

You can validate a specific configuration file:

```bash
pipecraft validate --config custom-config.json
```

Validation is also built into the generate command, so you'll catch configuration errors there too. But running validation separately can help you iterate faster when you're making multiple changes.

### pipecraft doctor

While `validate` checks your configuration file, `verify` checks your entire PipeCraft setup:

```bash
pipecraft doctor
```

This command confirms that your configuration exists, that your workflow files have been generated, and that your repository structure matches what PipeCraft expects. Think of it as a health check for your complete setup.

Use verify when you're troubleshooting why workflows aren't running, when you're setting up PipeCraft in a new environment, or when you want to confirm that everything is ready before pushing to your remote.

## GitHub Setup Commands

### pipecraft setup-github

PipeCraft workflows need specific GitHub Actions permissions to function correctly. They need to create tags for versioning, push commits for automated changes, and potentially create pull requests. The `setup-github` command configures all of these permissions automatically:

```bash
pipecraft setup-github
```

By default, this command runs in interactive mode. It checks your current repository settings and prompts you before making changes. You'll see what permissions need to be updated and can approve each change individually.

For automation or when you're confident about the changes, auto-apply mode configures everything without prompting:

```bash
pipecraft setup-github --apply
```

This command requires a GitHub token with admin access to your repository. It will automatically use your `GITHUB_TOKEN` environment variable, your `GH_TOKEN` variable, or the GitHub CLI authentication if any of those are configured.

The command handles three types of configuration:

**Workflow Permissions**: Your workflows need write access to create tags and push changes. The command updates your default workflow permissions from read-only to read-write and enables the ability for workflows to create and approve pull requests.

**Repository Auto-Promote**: For branch promotion flows that use auto-merge, this feature must be enabled at the repository level.

**Branch Protection**: Branches configured with auto-merge require basic branch protection rules. The command sets up these rules with sensible defaults: status checks enabled, linear history required, and protection against force pushes.

## Version Management Commands

### pipecraft version --check

When you're using semantic versioning with conventional commits, it's helpful to preview what your next version will be before you actually bump it:

```bash
pipecraft version --check
```

This command analyzes your commit history since the last version tag, applies your bump rules (from the configuration), and shows you what the next version would be. It also validates that your recent commits follow the conventional commit format.

Use this before releases to confirm that your commits will result in the version bump you expect.

### Bumping and releasing

The `version` command has no `--bump` or `--release`. Bumping is the pipeline's job, not a
local command.

The generated `version` job resolves the next version from your conventional commits, `tag`
creates the git tag, and `release` cuts the GitHub release. That keeps one machine deciding
version numbers, so a developer running a command locally cannot produce a tag that
disagrees with CI.

Use `pipecraft version --check` to see what the pipeline will decide before you push.

## AI Assistant Commands

### pipecraft skill

Writes the Pipecraft skill in the format each AI coding assistant reads:

```bash
pipecraft skill                                   # install into this project
pipecraft skill --list                            # show which tools this project uses
pipecraft skill --target cursor,codex             # pick the tools yourself
pipecraft skill --global                          # ~/.claude/skills/pipecraft/SKILL.md
pipecraft skill --uninstall                       # remove it again
```

| Tool             | File                                | Written as             |
| ---------------- | ----------------------------------- | ---------------------- |
| Claude Code      | `.claude/skills/pipecraft/SKILL.md` | whole file             |
| Cursor           | `.cursorrules`                      | block inside your file |
| GitHub Copilot   | `.github/copilot-instructions.md`   | block inside your file |
| Windsurf         | `.windsurfrules`                    | block inside your file |
| Cline / Roo Code | `.clinerules`                       | block inside your file |
| Codex            | `AGENTS.md`                         | block inside your file |

Five of those files belong to you and may already hold your own instructions. Pipecraft
writes only between `<!-- pipecraft:start -->` and `<!-- pipecraft:end -->` and changes
nothing outside those markers. Reinstalling replaces the block in place, so your text
survives a Pipecraft upgrade. `--uninstall` removes the block and leaves the file; a file
that held nothing but the block is deleted.

Claude Code is the exception. `.claude/skills/pipecraft/SKILL.md` is a file Pipecraft owns
outright, so it is written whole and removed with its directory.

Without `--target`, the command installs for the tools whose files or directories already
exist in the project (`.claude`, `CLAUDE.md`, `.cursor`, `.cursorrules`, `.github`,
`.windsurf`, `.windsurfrules`, `.clinerules`, `AGENTS.md`). Finding none, it installs every
format, on the reasoning that a project with no AI tool configured has no preference to
respect.

`--global` applies to Claude Code alone. The other five formats are project files, and a copy
in your home directory is a file no tool loads.

`pipecraft init --with-skill` runs the same installation as part of `init`.

## Global Options

Several options work with every command to give you more control or visibility:

### Verbosity and Debugging

Every command supports verbose and debug modes for when you need more information:

```bash
pipecraft <command> --verbose   # Shows file operations and decision-making
pipecraft <command> --debug     # Shows internal processing details
```

Verbose mode is perfect for understanding what PipeCraft is doing during normal operations. Debug mode is primarily useful when reporting issues or contributing to development.

### Custom Paths

When working with non-standard setups or testing configurations, you can override the default file paths:

```bash
pipecraft <command> --config .pipecraft.json              # Use different config file
pipecraft <command> --output-pipeline workflows/ci.yml    # Output to different location
```

### Force Operations

Most commands have a `--force` flag that bypasses safety checks or caching:

```bash
pipecraft <command> --force
```

Use this when you explicitly want to overwrite existing files, regenerate cached workflows, or recreate existing branches.

### Dry Run

`generate` supports a dry-run mode that reports what it would do without writing anything:

```bash
pipecraft generate --dry-run
```

Use it to check a config change before it lands: which files appear, which get merged into,
and which domain jobs the config actually produces. See
[Generation Commands](#generation-commands) for the output.

## Common Command Patterns

### Initial Setup

When setting up PipeCraft in a new repository:

```bash
pipecraft init                           # Create configuration
# Edit .pipecraftrc.json to customize
pipecraft validate                       # Verify your changes
pipecraft setup                          # Create branches
pipecraft generate                       # Generate workflows
pipecraft setup-github                   # Configure permissions
git add .github/workflows .pipecraftrc.json
git commit -m "chore: add PipeCraft workflows"
git push
```

### Updating Configuration

When modifying your PipeCraft setup:

```bash
# Edit .pipecraftrc.json
pipecraft validate                       # Check for errors
pipecraft generate --verbose             # Preview changes
git diff .github/workflows/              # Review workflow changes
git add .pipecraftrc.json .github/workflows/
git commit -m "chore: update workflow configuration"
```

### Troubleshooting

When workflows aren't behaving as expected:

```bash
pipecraft doctor                         # Check overall setup
pipecraft validate                       # Check configuration
pipecraft generate --debug --dry-run     # See what would be generated
pipecraft setup-github                   # Verify permissions
```

### Version Management

When preparing a release:

```bash
pipecraft version --check                # Preview next version
# Create and merge your feature branches
git push --follow-tags                   # Push version tag
```

## Getting Help

Every command supports the `--help` flag for quick reference:

```bash
pipecraft --help                         # List all commands
pipecraft <command> --help               # Show command-specific options
```

For more detailed explanations of what PipeCraft generates and how the workflows function, see the [Workflow Generation](workflow-generation.md) documentation. For issues and troubleshooting, check the [Troubleshooting](troubleshooting.md) guide.
