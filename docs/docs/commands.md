---
sidebar_position: 2
---

# Commands

PipeCraft provides a focused set of commands designed to get you from zero to a working CI/CD pipeline with minimal friction. Each command serves a specific purpose in your workflow, from initial setup through ongoing maintenance and troubleshooting.

## Understanding the Command Flow

When you're setting up PipeCraft for the first time, you'll typically follow a simple pattern: initialize your configuration, generate your workflows, and commit everything to your repository. After that, you'll occasionally regenerate workflows when you change your configuration, and use the diagnostic commands when something needs attention.

The beauty of PipeCraft is that most of the time, you won't need to think about it at all. Your workflows run automatically based on your commits and branch merges. The commands exist primarily for setup and customization.

## Setup Commands

### pipecraft init

The `init` command creates your initial configuration file with sensible defaults. When you run it, PipeCraft creates a `.pipecraftrc.json` file in your project root configured for trunk-based development with a standard three-branch flow: develop, staging, and main.

```bash
pipecraft init
```

This command is intentionally simple. It doesn't ask you a lot of questions or try to detect your project structure. Instead, it gives you a working configuration that you can customize by editing the JSON file directly. This approach gives you complete control while still providing a quick start.

If you've already initialized PipeCraft and want to start fresh, you can force overwrite your existing configuration:

```bash
pipecraft init --force
```

Use this carefully—it will replace your entire configuration file with the defaults. If you've customized your setup, make sure you have a backup or have committed your changes to git first.

### pipecraft setup

Once you have a configuration, you might need to create the branches it references. The `setup` command reads your branch flow configuration and creates any missing branches in your repository:

```bash
pipecraft setup
```

This is particularly useful when you're setting up a new repository or when you've added a new branch to your flow. The command creates each branch and pushes it to your remote, ensuring your repository structure matches your configuration.

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

If you want to preview what would be generated without actually creating or modifying files, dry-run mode is perfect:

```bash
pipecraft generate --dry-run
```

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

### pipecraft verify

While `validate` checks your configuration file, `verify` checks your entire PipeCraft setup:

```bash
pipecraft verify
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

**Repository Auto-Merge**: For branch promotion flows that use auto-merge, this feature must be enabled at the repository level.

**Branch Protection**: Branches configured with auto-merge require basic branch protection rules. The command sets up these rules with sensible defaults: status checks enabled, linear history required, and protection against force pushes.

## Version Management Commands

### pipecraft version --check

When you're using semantic versioning with conventional commits, it's helpful to preview what your next version will be before you actually bump it:

```bash
pipecraft version --check
```

This command analyzes your commit history since the last version tag, applies your bump rules (from the configuration), and shows you what the next version would be. It also validates that your recent commits follow the conventional commit format.

Use this before releases to confirm that your commits will result in the version bump you expect.

### pipecraft version --bump

When you're ready to update your version, this command handles the entire process:

```bash
pipecraft version --bump
```

It determines the appropriate version number based on your commits, updates your `package.json`, creates a git tag, and optionally generates changelog entries. This command respects your configuration for how different commit types (feat, fix, breaking changes) affect versioning.

### pipecraft version --release

For a complete release process including changelog generation and git tag creation, use the release command:

```bash
pipecraft version --release
```

This runs the full release-it flow with PipeCraft's configuration, creating a tagged release with proper semantic versioning and change documentation.

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

Many commands support a dry-run mode that shows you what would happen without actually making changes:

```bash
pipecraft <command> --dry-run
```

This is invaluable for testing configuration changes, previewing workflow generation, or understanding what a command will do before you commit to it.

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
pipecraft verify                         # Check overall setup
pipecraft validate                       # Check configuration
pipecraft generate --debug --dry-run     # See what would be generated
pipecraft setup-github                   # Verify permissions
```

### Version Management

When preparing a release:

```bash
pipecraft version --check                # Preview next version
# Create and merge your feature branches
pipecraft version --bump                 # Update version
git push --follow-tags                   # Push version tag
```

## Getting Help

Every command supports the `--help` flag for quick reference:

```bash
pipecraft --help                         # List all commands
pipecraft <command> --help               # Show command-specific options
```

For more detailed explanations of what PipeCraft generates and how the workflows function, see the [Workflow Generation](workflow-generation.md) documentation. For issues and troubleshooting, check the [Troubleshooting](troubleshooting.md) guide.
