# cli

PipeCraft Command-Line Interface

Main CLI entry point for PipeCraft - automated CI/CD pipeline generator for
trunk-based development workflows. This CLI provides commands for:

- **init**: Initialize PipeCraft configuration interactively or with flags
- **generate**: Generate GitHub Actions workflows from configuration
- **validate**: Validate existing workflows and configuration
- **verify**: Verify pipeline structure and job order
- **setup**: Configure GitHub repository permissions and settings
- **version**: Display version information

## Command Overview

### init

Creates .pipecraftrc.json configuration file with project settings.
Can run interactively or accept flags for automation.

### generate

Generates GitHub Actions workflows based on configuration:

- Main pipeline workflow (.github/workflows/pipeline.yml)
- Reusable actions (.github/actions/\*)
- Idempotent regeneration (only when config/templates change)

### validate

Validates workflow YAML syntax and structure, checks for common issues.

### verify

Verifies pipeline job order and dependencies are correct.

### setup

Configures GitHub repository:

- Workflow permissions (read/write)
- Branch protection rules
- Auto-merge settings

## Global Options

- `-c, --config <path>`: Path to config file (default: .pipecraftrc.json)
- `-v, --verbose`: Verbose output
- `--debug`: Debug output (maximum detail)
- `--force`: Force regeneration even if unchanged
- `--dry-run`: Show what would be done without making changes

## Examples

```bash
# Initialize configuration interactively
pipecraft init --interactive

# Generate workflows
pipecraft generate

# Generate with version management
pipecraft init --with-versioning
pipecraft generate

# Validate existing workflows
pipecraft validate

# Setup GitHub repository
pipecraft setup --verify

# Debug mode
pipecraft generate --debug
```
