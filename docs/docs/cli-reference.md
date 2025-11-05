# CLI Reference

PipeCraft is a command-line tool that generates CI/CD workflows for your project. This guide covers the essential commands you'll use day-to-day.

## Installation

**Recommended: Use npx** (no installation required):

```bash
npx pipecraft init
npx pipecraft generate
```

**Alternative: Install globally**:

```bash
npm install -g pipecraft
pipecraft init
```

## Getting started with a new project

When you're ready to add PipeCraft to your project, run the init command in your project directory:

```bash
cd your-project
npx pipecraft init
```

This launches an interactive setup that asks you about your project structure. It will ask questions like:

- Which branches you want to use (develop, staging, main)
- Which package manager you use (npm, yarn, or pnpm) - auto-detected from lockfiles
- What domains exist in your codebase (api, web, etc.)
- Which paths belong to each domain

The init command automatically detects your package manager by checking for lockfiles:

- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `package-lock.json` → npm
- No lockfile → defaults to npm

You can confirm or override the detected package manager during the interactive prompts.

Once complete, you'll have a `.pipecraftrc` file that contains your configuration (format can be JSON, YAML, or JavaScript).

## Generating workflows

After you have a configuration file, generate your workflows:

```bash
pipecraft generate
```

This reads your `.pipecraftrc` (or `.pipecraftrc.json`, `.pipecraftrc.yml`, etc.) and creates workflow files in `.github/workflows/` and `actions/`. The first time you run this, it will create all the necessary files. On subsequent runs, it only regenerates if your configuration has changed, making it fast and efficient.

### Pre-flight checks

Before generating any files, PipeCraft runs automatic pre-flight checks to validate your setup. These checks help catch common issues early, before you end up with cryptic errors or workflows that don't run. The checks verify:

**Configuration file discovery**: PipeCraft searches for your configuration using cosmiconfig, looking in `.pipecraftrc`, `.pipecraftrc.json`, `.pipecraftrc.yml`, `.pipecraftrc.yaml`, `.pipecraftrc.js`, `pipecraft.config.js`, or the `pipecraft` key in `package.json`. It searches parent directories recursively, so you can run commands from subdirectories. If no configuration is found, you'll see a clear message suggesting you run `pipecraft init` first.

**Configuration validation**: Your configuration JSON must be syntactically valid and include all required fields. PipeCraft checks that you've defined a `ciProvider` (github or gitlab), a `branchFlow` array with at least two branches, and at least one domain with valid path patterns. If anything is missing or malformed, the error message explains exactly what needs to be fixed.

**Git repository check**: PipeCraft verifies you're in a git repository before generating workflows. If you're not, it suggests running `git init` or cloning an existing repository. This prevents the confusing situation where workflows generate successfully but can't run because there's no git history.

**Git remote configuration**: Your repository needs a configured remote for workflows to work properly. PipeCraft checks that `git remote` returns at least one remote repository and shows you which remote it found. If no remote exists, it suggests adding one with `git remote add origin <url>`.

**Write permissions**: Finally, PipeCraft tests that it can write to the `.github/workflows` directory. It checks file system permissions and creates the directory if it doesn't exist. Permission issues are rare but can be confusing, so catching them early saves trouble.

When all checks pass, you'll see a success message and generation proceeds. When checks fail, you'll see specific error messages with suggestions for fixing each issue:

```
🔍 Running pre-flight checks...

❌ No PipeCraft configuration found
   💡 Run 'pipecraft init' to create a configuration file

❌ Not in a git repository
   💡 Initialize git: 'git init' or clone an existing repository

❌ No git remote configured
   💡 Add a remote: 'git remote add origin <url>'
```

The pre-flight checks run automatically with every `pipecraft generate` command. If you're in an unusual environment (like certain CI/CD setups) where the standard checks don't apply, you can skip them:

```bash
pipecraft generate --skip-checks
```

Use this option carefully. The checks exist to prevent frustrating debugging sessions when your workflows don't work as expected. Only skip them when you're confident your environment is correct despite failing the standard checks.

### Generation options

If you need to force a regeneration (for example, after updating PipeCraft itself), use the `--force` flag:

```bash
pipecraft generate --force
```

For troubleshooting, add the `--verbose` flag to see detailed output about what's happening:

```bash
pipecraft generate --verbose
```

For even more detail when debugging or contributing to PipeCraft, use debug mode:

```bash
pipecraft generate --debug
```

## Validating your setup

Before committing your generated workflows, you can validate them:

```bash
pipecraft validate
```

This checks your workflow files for common issues like syntax errors or missing dependencies. It's a good sanity check before pushing changes.

## Setting up GitHub permissions

PipeCraft workflows need specific GitHub Actions permissions and repository settings to function correctly. Workflows need write access to create tags, push commits for versioning, and potentially create pull requests. The `setup-github` command handles all of this configuration automatically.

### What gets configured

The setup command configures three types of settings:

**Workflow permissions**: PipeCraft updates your repository's default GitHub Actions permissions from read-only to read-write. This allows workflows to create version tags and push automated commits. It also enables workflows to create and approve pull requests, which is necessary for automated branch promotions.

**Repository auto-merge**: If your configuration uses auto-merge for branch promotions, the command enables this feature at the repository level. This is a prerequisite for GitHub's auto-merge functionality to work on individual pull requests.

**Branch protection rules**: For branches configured with auto-merge enabled, GitHub requires basic branch protection rules. The setup command creates these rules with sensible defaults: status checks enabled (though no specific checks are required initially), linear history required to maintain clean git history, and protection against force pushes and branch deletion.

### Using the setup command

By default, the command runs in interactive mode, prompting you before making each change:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
pipecraft setup-github
```

You'll see your current settings and be asked to confirm each change. This gives you control over what gets modified and helps you understand what's happening.

For automation scenarios or when you're confident about the changes, use auto-apply mode:

```bash
pipecraft setup-github --apply
```

This applies all necessary changes without prompting. It's useful in CI/CD setup scripts or when configuring multiple repositories.

### Authentication

The command requires a GitHub token with admin access to your repository. It automatically uses tokens from several sources, checking in this order:

1. `GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. GitHub CLI (`gh`) authentication

To authenticate with GitHub CLI (recommended for local use):

```bash
gh auth login
pipecraft setup-github
```

To use an environment variable (recommended for automation):

```bash
export GITHUB_TOKEN=ghp_your_token_here
pipecraft setup-github --apply
```

Your token needs the `repo` scope for full access to repository settings. Create one at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

### Manual configuration

If you prefer to configure settings manually or need to audit what the command would change, you can set everything up through the GitHub web interface:

**For workflow permissions**, navigate to your repository's Settings → Actions → General. Under "Workflow permissions", select "Read and write permissions" and check "Allow GitHub Actions to create and approve pull requests". Click Save.

**For repository auto-merge**, go to Settings → General, scroll to "Pull Requests", and check "Allow auto-merge". This enables the feature repository-wide.

**For branch protection**, navigate to Settings → Branches and click "Add branch protection rule". Enter the branch name (like `staging`) and configure: check "Require status checks to pass before merging", check "Require linear history", and leave other options as needed. Branch protection rules are necessary for auto-merge to work.

See the [Security](security.md) documentation for more details on why these permissions are needed and how to manage them safely.

## Example workflow

Here's a typical workflow when adding PipeCraft to an existing project:

```bash
# 1. Navigate to your project
cd my-monorepo

# 2. Initialize configuration
npx pipecraft init

# 3. Generate workflows
npx pipecraft generate

# 5. Review the generated files
ls -la .github/workflows/
cat .github/workflows/pipeline.yml

# 6. Commit the changes
git add .github/ .pipecraftrc
git commit -m "chore: add pipecraft workflows"
git push

# 7. Set up GitHub (requires a token)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
pipecraft setup
```

## Configuration file

PipeCraft looks for configuration in several places, in this order:

1. `.pipecraftrc` (YAML or JSON, recommended)
2. `.pipecraftrc.json`
3. `.pipecraftrc.yaml` or `.pipecraftrc.yml`
4. `.pipecraftrc.js`
5. `pipecraft.config.js`
6. `package.json` under a "pipecraft" key

Most projects use `.pipecraftrc` because it's simple and can be either JSON or YAML format. Here's a minimal JSON example:

```json
{
  "ciProvider": "github",
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main",
  "domains": {
    "app": {
      "paths": ["src/**"],
      "testable": true,
      "deployable": true
    }
  }
}
```

This configuration tells PipeCraft to:

- Generate GitHub Actions workflows
- Use a develop → staging → main branch flow
- Track one domain called "app" that includes all files in `src/**`
- Generate test and deployment jobs for this domain
