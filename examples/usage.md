# Flowcraft Usage Examples

## Quick Start

### 1. Initialize Flowcraft

```bash
# Interactive setup
npx pipecraft init

# Or with options
npx pipecraft init --interactive
```

### 2. Generate Workflows

```bash
# Generate GitHub Actions workflows
npx pipecraft generate

# Generate with custom output directory
npx pipecraft generate --output .github/workflows

# Dry run to see what would be generated
npx pipecraft generate --dry-run
```

### 3. Validate Configuration

```bash
# Validate your configuration
npx pipecraft validate

# Verify everything is set up correctly
npx pipecraft verify
```

## Configuration Examples

### Basic Project

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
      "paths": ["apps/api/**"],
      "description": "API application changes"
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Web application changes"
    }
  }
}
```

### Monorepo Project

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "frontend": {
      "paths": ["packages/frontend/**", "apps/web/**"],
      "description": "Frontend application changes"
    },
    "backend": {
      "paths": ["packages/backend/**", "apps/api/**"],
      "description": "Backend application changes"
    },
    "shared": {
      "paths": ["packages/shared/**", "libs/**"],
      "description": "Shared library changes"
    },
    "mobile": {
      "paths": ["packages/mobile/**", "apps/mobile/**"],
      "description": "Mobile application changes"
    }
  }
}
```

## Workflow Examples

### Generated GitHub Actions Workflows

After running `pipecraft generate`, you'll get:

- **`pipeline.yml`**: Main orchestration workflow
- **`job.changes.yml`**: Change detection workflow
- **`job.version.yml`**: Version calculation workflow
- **`job.tag.yml`**: Tag creation workflow
- **`job.createpr.yml`**: PR management workflow
- **`job.branch.yml`**: Branch operations workflow
- **`job.apps.yml`**: Application deployment workflow

### Example Pipeline Flow

1. **Push to `develop`**:
   - Detects changes in domains
   - Runs tests
   - Fast-forwards to `staging` if tests pass

2. **Push to `staging`**:
   - Calculates version bump
   - Creates PR to `main` for non-patch releases
   - Auto-fast-forwards to `main` for patch releases

3. **Push to `main`**:
   - Creates version tags
   - Deploys applications
   - Updates documentation

## Advanced Usage

### Custom Domain Patterns

```json
{
  "domains": {
    "api": {
      "paths": [
        "apps/api/**",
        "packages/backend/**",
        "src/api/**"
      ],
      "description": "API application changes"
    },
    "frontend": {
      "paths": [
        "apps/web/**",
        "packages/frontend/**",
        "src/components/**"
      ],
      "description": "Frontend application changes"
    }
  }
}
```

### Custom Branch Flow

```json
{
  "branchFlow": [
    "develop",
    "test",
    "staging",
    "main"
  ]
}
```

### Custom Semver Rules

```json
{
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major",
      "docs": "patch",
      "style": "patch",
      "refactor": "minor",
      "perf": "minor",
      "test": "patch"
    }
  }
}
```

## CLI Commands

### `pipecraft init`
Initialize a new Flowcraft configuration.

**Options:**
- `--force`: Overwrite existing configuration
- `--interactive`: Use interactive setup wizard

### `pipecraft generate`
Generate CI/CD workflows from configuration.

**Options:**
- `--output <path>`: Output directory for generated workflows
- `--dry-run`: Show what would be generated without writing files

### `pipecraft validate`
Validate the configuration file.

### `pipecraft verify`
Check if Flowcraft is properly set up.

### `pipecraft promote`
Promote current branch to next environment.

**Options:**
- `--force`: Force promotion even if checks fail

## Integration Examples

### With Existing Projects

```bash
# Initialize in existing project
cd my-existing-project
npx pipecraft init

# Generate workflows
npx pipecraft generate

# Commit the generated workflows
git add .github/workflows/
git commit -m "feat: add pipecraft workflows"
```

### With Monorepos

```bash
# Initialize with monorepo configuration
npx pipecraft init
# Select domains for your monorepo structure

# Generate workflows
npx pipecraft generate

# Verify setup
npx pipecraft verify
```

### With GitLab

```bash
# Initialize with GitLab CI
npx pipecraft init
# Select "gitlab" as CI provider

# Generate GitLab CI pipeline
npx pipecraft generate
```

## Troubleshooting

### Common Issues

1. **Configuration not found**
   ```bash
   # Make sure you're in the project root
   # Check if .trunkflowrc.json exists
   ls -la .trunkflowrc.json
   ```

2. **Workflows not generated**
   ```bash
   # Validate configuration first
   npx pipecraft validate
   
   # Then generate workflows
   npx pipecraft generate
   ```

3. **Permission issues**
   ```bash
   # Make sure you have write permissions
   # Check if .github/workflows directory exists
   mkdir -p .github/workflows
   ```

### Debug Mode

```bash
# Run with verbose output
npx pipecraft generate --verbose

# Dry run to see what would be generated
npx pipecraft generate --dry-run
```
