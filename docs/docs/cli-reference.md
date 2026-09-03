# Quickstart

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

`init` prompts you through the choices. Pass the values as flags to skip the questions they
answer:

```bash
npx pipecraft init --initial-branch develop --final-branch main --ci-provider github
```

In CI, a script, or an agent session, `--yes` accepts every default and never prompts:

```bash
npx pipecraft init --yes
```

Once complete, you'll have a `.pipecraftrc` file you can edit to define your branch flow and domains (format can be JSON, YAML, or JavaScript). Domain change detection is path-based, so any project — including monorepos — is configured by pointing each domain at its file globs.

## Generating workflows

After you have a configuration file, generate your workflows:

```bash
pipecraft generate
```

This reads your `.pipecraftrc` (or `.pipecraftrc.json`, `.pipecraftrc.yml`, etc.) and creates workflow files in `.github/workflows/` and `actions/`. The first time you run this, it will create all the necessary files. On subsequent runs, it only regenerates if your configuration has changed, making it fast and efficient.

### Pre-flight checks

Before generating any files, PipeCraft runs automatic pre-flight checks to validate your setup. These checks help catch common issues early, before you end up with cryptic errors or workflows that don't run. The checks verify:

**Configuration file discovery**: PipeCraft searches for your configuration using cosmiconfig, looking in `.pipecraftrc`, `.pipecraftrc.json`, `.pipecraftrc.yml`, `.pipecraftrc.yaml`, `.pipecraftrc.js`, `pipecraft.config.js`, or the `pipecraft` key in `package.json`. It searches parent directories recursively, so you can run commands from subdirectories. If no configuration is found, you'll see a clear message suggesting you run `pipecraft init` first.

**Configuration validation**: Your configuration JSON must be syntactically valid and include all required fields. PipeCraft checks that you've defined a `ciProvider` (github or gitlab), a `branchFlow` array with at least one branch (a single-branch flow is valid), and at least one domain with valid path patterns. If anything is missing or malformed, the error message explains exactly what needs to be fixed.

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

## Running diagnostics

The `doctor` command checks your PipeCraft setup for common configuration problems and permission issues:

```bash
pipecraft doctor
```

It requires a `GITHUB_TOKEN` (or `GH_TOKEN`, or `gh` CLI auth) to check GitHub-side settings.

Doctor runs these checks:

- **Configuration**: config file exists, required fields are set, `branchFlow` order is valid
- **Workflow files**: generated workflows are present and structurally valid
- **GitHub permissions**: repository Actions permissions allow write access and PR creation
- **Org-level lock**: detects when an organization admin has disabled "Allow GitHub Actions to create and approve pull requests" — a common cause of promotion failures in enterprise repos (see [Troubleshooting](troubleshooting.md) for remediation)

Run `pipecraft doctor` any time promotions fail unexpectedly or after making changes to your repository or org settings.

## Teaching your AI assistant

Pipecraft ships a skill describing its commands, its configuration, and the behaviours that
surprise people. `pipecraft skill` writes it in the format each tool reads:

```bash
pipecraft skill                          # install into this project
pipecraft skill --list                   # which tools this project uses, and where it would go
pipecraft skill --target cursor,codex    # pick the tools yourself
pipecraft skill --uninstall              # take it back out
```

| Tool             | File                                | Written as             |
| ---------------- | ----------------------------------- | ---------------------- |
| Claude Code      | `.claude/skills/pipecraft/SKILL.md` | whole file             |
| Cursor           | `.cursorrules`                      | block inside your file |
| GitHub Copilot   | `.github/copilot-instructions.md`   | block inside your file |
| Windsurf         | `.windsurfrules`                    | block inside your file |
| Cline / Roo Code | `.clinerules`                       | block inside your file |
| Codex            | `AGENTS.md`                         | block inside your file |

Five of those files are yours, and most projects already have something in them. Pipecraft
writes only between `<!-- pipecraft:start -->` and `<!-- pipecraft:end -->` and changes nothing
outside those markers. Reinstalling after an upgrade replaces that block in place, so your own
instructions survive. `--uninstall` removes the block and leaves the file; a file that held
nothing else is deleted.

Given no `--target`, the command installs for the tools whose files or directories already
exist in the project, and installs every format when it finds none.

`--global` writes `~/.claude/skills/pipecraft/SKILL.md` and covers Claude Code alone. The other
five formats are project files, so a copy in your home directory is one no tool loads.

`pipecraft init --with-skill` runs the same installation as part of `init`.

Two other routes install the same file without the CLI:

```bash
npx @thecraftlab/pipecraft-skill
npx openskills install the-craftlab/pipecraft
```

## Example workflow

Here's a typical workflow when adding PipeCraft to an existing project:

```bash
# 1. Navigate to your project
cd my-monorepo

# 2. Initialize configuration
npx pipecraft init

# 3. Generate workflows
npx pipecraft generate

# 4. Review the generated files
ls -la .github/workflows/
cat .github/workflows/pipeline.yml

# 5. Commit the changes
git add .github/ .pipecraftrc
git commit -m "chore: add pipecraft workflows"
git push

# 6. Create the branch flow (develop, staging, main, ...) on the remote
pipecraft setup

# 7. Configure GitHub Actions permissions (requires a token)
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
pipecraft setup-github --apply
```

Two distinct setup commands, both needed before promotions work:

- **`pipecraft setup`** creates the branches in your `branchFlow` on the remote (e.g. `staging`, `production`). Promotion opens PRs into these branches, so they must exist first.
- **`pipecraft setup-github`** configures the repository's Actions permissions (read/write, allow PR creation) so the version/tag/promote jobs can run.

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
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main",
  "semver": {
    "bumpRules": { "feat": "minor", "fix": "patch", "breaking": "major" }
  },
  "domains": {
    "app": {
      "paths": ["src/**"],
      "prefixes": ["test", "deploy"]
    }
  }
}
```

`mergeStrategy` and `requireConventionalCommits` are required; `pipecraft validate` reports any that are missing. `semver` is optional, and the built-in bump rules apply when it is omitted. Use `prefixes` to choose which jobs a domain generates (e.g. `["test", "deploy"]`); the older `testable`/`deployable` flags are deprecated.

This configuration tells PipeCraft to:

- Generate GitHub Actions workflows
- Use a develop → staging → main branch flow
- Track one domain called "app" that includes all files in `src/**`
- Generate test and deployment jobs for this domain
