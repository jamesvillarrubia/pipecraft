---
sidebar_position: 8
---

# Frequently Asked Questions (FAQ)

Common questions and answers about PipeCraft.

---

## General Questions

### What is PipeCraft and how does it work?

PipeCraft is a CLI tool that generates GitHub Actions CI/CD workflows for your repository. Instead of writing workflows from scratch, you define your project structure in a configuration file (`.pipecraftrc.json`), and PipeCraft generates complete, production-ready workflows.

The generated workflows include:

- Domain-based change detection (only test what changed)
- Semantic versioning automation
- Branch promotion flows (develop → staging → main)
- Git tagging and GitHub releases
- Customizable test and deployment jobs

You own the generated files completely—they live in your `.github/` directory and can be customized as needed.

### How does PipeCraft compare to manually writing GitHub Actions workflows?

**Manual Workflows:**

- Write hundreds of lines of YAML
- Debug through trial and error (push, wait, fix, repeat)
- Copy/paste workflows between projects
- Manually keep workflows in sync
- Easy to make mistakes in conditional logic

**PipeCraft:**

- Generate workflows from configuration
- Start with proven, tested patterns
- Regenerate consistently across projects
- Safe regeneration preserves customizations
- Best practices built-in (caching, concurrency, etc.)

Think of it as scaffolding for CI/CD—you get a solid foundation and then customize the deployment and testing specifics for your project.

### Is PipeCraft only for monorepos?

No! PipeCraft works great for both monorepos and single-application projects:

- **Monorepos**: Domain-based change detection shines here—only test affected parts
- **Single repos**: Still benefit from semantic versioning, branch flow automation, and workflow generation
- **Nx monorepos**: Full integration with Nx dependency graphs

Even a simple project benefits from having a production-ready workflow with versioning and release automation built-in.

### Can I use PipeCraft without Nx?

Yes! PipeCraft has two modes:

1. **Path-based detection** (default): Uses glob patterns to detect changes

   - Works with any project structure
   - No additional dependencies
   - Configure domains with path patterns

2. **Nx-based detection** (optional): Leverages Nx dependency graphs
   - Automatically detects Nx workspaces
   - Maps Nx projects to domains
   - Uses `nx affected` for smarter change detection

You choose which mode fits your project. Most users start with path-based detection.

---

## Installation & Setup

### How do I install PipeCraft?

Three options:

**Option 1: npx (recommended for trying it out)**

```bash
npx pipecraft init
npx pipecraft generate
```

**Option 2: Global installation**

```bash
npm install -g pipecraft
pipecraft init
```

**Option 3: Local project installation**

```bash
npm install --save-dev pipecraft
npx pipecraft init
```

All options work the same—choose based on your preference.

### What are the prerequisites?

- **Node.js** 18.0.0 or higher
- **Git repository** (must be initialized)
- **GitHub** as your CI provider (GitLab support planned)
- **npm** or compatible package manager

That's it! No other dependencies required.

### Can I use PipeCraft with an existing project?

Yes! PipeCraft works with new and existing projects:

1. Run `npx pipecraft init` in your repo
2. Configure domains in `.pipecraftrc.json`
3. Run `npx pipecraft generate`
4. Review generated workflows
5. Commit and push

If you have existing workflows, PipeCraft will merge intelligently and preserve your customizations.

---

## Configuration

### What is a "domain" in PipeCraft?

A **domain** is a logical part of your codebase with its own testing and deployment needs. Examples:

- `api` domain: Backend API code
- `web` domain: Frontend web application
- `mobile` domain: Mobile app code
- `shared` domain: Shared libraries

Each domain has:

- **Path patterns**: Which files belong to this domain
- **Test configuration**: Whether it needs testing
- **Deployment configuration**: Whether it's deployable
- **Remote testing**: Whether it needs post-deployment testing

When you change files in a domain, only that domain's tests run—saving time and CI costs.

### How do I configure domains for my project?

In `.pipecraftrc.json`:

```json
{
  "domains": {
    "api": {
      "paths": ["apps/api/**", "libs/api-core/**"],
      "testable": true,
      "deployable": true,
      "description": "Backend API services"
    },
    "web": {
      "paths": ["apps/web/**", "libs/ui/**"],
      "testable": true,
      "deployable": true,
      "description": "Frontend web application"
    },
    "shared": {
      "paths": ["libs/shared/**"],
      "testable": true,
      "deployable": false,
      "description": "Shared utilities"
    }
  }
}
```

Changes to `shared` will trigger tests for both `api` and `web` (dependencies are detected automatically).

### What branch flows are supported?

Currently supported:

- **Trunk-based development**: develop → staging → main (default)
- **Two-stage flow**: develop → main
- **Custom flows**: Any linear progression you define

Planned for future:

- **GitHub Flow**: Feature branches → main
- **GitFlow**: develop → release → main with hotfix support

Configure your flow in `.pipecraftrc.json`:

```json
{
  "branchFlow": ["develop", "staging", "main"],
  "initialBranch": "develop",
  "finalBranch": "main"
}
```

---

## Workflow Generation

### What files does PipeCraft generate?

PipeCraft generates:

**Main workflow:**

- `.github/workflows/pipeline.yml` - Your complete CI/CD pipeline

**Composite actions:**

- `.github/actions/detect-changes/action.yml` - Change detection
- `.github/actions/calculate-version/action.yml` - Version calculation
- `.github/actions/create-tag/action.yml` - Git tagging
- `.github/actions/promote-branch/action.yml` - Branch promotion
- `.github/actions/create-release/action.yml` - GitHub releases
- (and others)

**Configuration:**

- `.pipecraftrc.json` - Your PipeCraft configuration

All files are yours—commit them and customize as needed.

### Can I customize the generated workflows?

Absolutely! Generated workflows have two types of sections:

**⚠️ Managed by PipeCraft (do not modify):**

- Workflow triggers and structure
- Change detection logic
- Version calculation
- Branch promotion logic

**✅ Customizable (modify freely):**

- Test commands in test jobs
- Deployment steps in deploy jobs
- Custom jobs you add
- Environment variables
- Secrets usage

PipeCraft's AST-based regeneration preserves your customizations. When you regenerate:

- Managed sections are updated
- Your customizations are preserved
- Custom jobs remain untouched

### Will regenerating workflows overwrite my changes?

No! PipeCraft uses **AST-based merging** to preserve customizations:

- Your test commands stay intact
- Your deployment scripts remain
- Custom jobs you added survive
- Comments are preserved

Only PipeCraft-managed structural sections get updated. This is safe to run repeatedly.

### How often should I regenerate workflows?

Regenerate when:

- You update PipeCraft to a new version
- You add/remove domains
- You change your branch flow
- You want to pull in new PipeCraft features

Regeneration is safe and preserves customizations, so you can regenerate as often as needed.

---

## Version Management

### How does semantic versioning work?

PipeCraft reads your **conventional commit messages** and calculates the next version:

- `feat: add login` → Minor bump (0.1.0 → 0.2.0)
- `fix: resolve crash` → Patch bump (0.1.0 → 0.1.1)
- `feat!: breaking change` → Major bump (0.1.0 → 1.0.0)
- `chore: update deps` → No version bump

Versions are calculated automatically—no manual decisions needed.

### What if I don't use conventional commits?

PipeCraft defaults to patch bumps if commits don't follow conventions. However, we strongly recommend:

1. Enable `requireConventionalCommits: true` in config
2. Set up PR title validation (PipeCraft generates this workflow)
3. Train your team on conventional commit format

This ensures accurate version bumps and better changelogs.

### Can I manually specify a version?

Yes! Two approaches:

**Option 1: Use conventional commit scopes**

```bash
git commit -m "feat(major): breaking API change"
```

**Option 2: Workflow dispatch with version input**

- Trigger workflow manually
- Specify version as input parameter
- Version gets used instead of auto-calculation

---

## Troubleshooting

### Why aren't my changes being detected?

Common causes:

1. **Wrong path patterns**: Check your domain `paths` in `.pipecraftrc.json`

   - Use `**` for recursive matching: `apps/api/**`
   - Patterns are relative to repo root

2. **Git issues**: Change detection uses `git diff`

   - Ensure files are committed
   - Check git history exists

3. **Branch comparison**: Verify correct base branch
   - Default: origin/main
   - Configure with `baseRef` in Nx mode

**Debug with:**

```bash
npx pipecraft verify  # Validates configuration
git diff origin/main --name-only  # See what git sees
```

### Why is my workflow failing to generate?

Run pre-flight checks:

```bash
npx pipecraft verify
```

This validates:

- Configuration syntax
- Git repository setup
- Domain configuration
- Branch flow setup
- Path patterns

Fix reported issues and try generating again.

### How do I debug workflow failures in GitHub Actions?

1. **Check the logs**: Actions tab → Click failed run → Expand failed step
2. **Enable verbose logging**: Add to workflow
   ```yaml
   env:
     ACTIONS_STEP_DEBUG: true
   ```
3. **Test locally with act**:
   ```bash
   npm install -g act
   act push --workflows .github/workflows/pipeline.yml
   ```
4. **Check change detection output**: Look at the `changes` job output

See the [Troubleshooting guide](./troubleshooting.md) for detailed debugging steps.

---

## CI/CD & GitHub Actions

### What permissions do workflows need?

PipeCraft workflows require:

- **contents: write** - For creating tags and pushing changes
- **pull-requests: write** - For branch promotion PRs
- **actions: read** (optional) - For triggering subsequent workflows

These are standard for CI/CD automation. Review the [Security guide](./security.md) for details.

### Can I use GitHub self-hosted runners?

Yes! Generated workflows use `runs-on: ubuntu-latest` by default, but you can change this:

1. Edit generated workflow
2. Replace `runs-on: ubuntu-latest` with your runner label
3. This customization survives regeneration

Example:

```yaml
runs-on: [self-hosted, linux, x64]
```

### How do I add deployment steps?

Deployment jobs are marked as customizable:

```yaml
deploy-api:
  # ✅ Customizable section
  needs: [version, changes]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    # TODO: Add your deployment steps here
    - name: Deploy to staging
      run: |
        echo "Add your deploy commands"
        # npm run deploy
        # docker push
        # kubectl apply
```

Add your deployment commands and they'll survive regeneration.

### Does PipeCraft work with other CI providers?

Currently **GitHub Actions only**. Planned for future:

- GitLab CI/CD
- Bitbucket Pipelines
- Azure DevOps

Vote on [roadmap issues](https://github.com/jamesvillarrubia/pipecraft/issues) to prioritize which provider comes next.

---

## Nx Integration

### How does PipeCraft detect Nx?

PipeCraft automatically detects Nx by looking for:

- `nx.json` in repository root
- `@nx/` or `@nrwl/` packages in package.json

If found, it offers Nx integration during `pipecraft init`.

### What's the difference between path-based and Nx-based detection?

**Path-based detection:**

- Uses glob patterns to match files
- Simple and works everywhere
- Doesn't understand dependencies

**Nx-based detection:**

- Uses Nx dependency graph
- Automatically detects affected projects
- Smarter about shared libraries
- Leverages Nx caching

If you have Nx, use Nx-based detection—it's more accurate and faster.

### Can I use PipeCraft with Nx Cloud?

Yes! They complement each other:

- **PipeCraft**: Generates the workflow orchestration
- **Nx Cloud**: Provides distributed caching and task distribution

Configure Nx Cloud separately and PipeCraft workflows will use it automatically.

---

## Cost & Performance

### How much does PipeCraft cost?

PipeCraft is **free and open-source** (MIT license).

You pay only for:

- GitHub Actions minutes (2,000 free per month for public repos)
- Storage for artifacts and caches

Domain-based testing reduces costs by running only necessary jobs.

### Does PipeCraft reduce CI costs?

Yes! By testing only changed domains:

**Before (test everything):**

- Change 1 line in API
- Run API tests (5 min)
- Run Web tests (10 min)
- Run Mobile tests (15 min)
- **Total: 30 minutes**

**With PipeCraft (test what changed):**

- Change 1 line in API
- Run API tests (5 min)
- Skip web and mobile
- **Total: 5 minutes** (83% reduction)

This adds up quickly in active repositories.

### How can I optimize workflow performance?

1. **Use caching**: PipeCraft workflows include dependency caching
2. **Enable Nx**: If you have Nx, use Nx-based detection for faster builds
3. **Parallelize domains**: Multiple domains test concurrently
4. **Use matrix strategies**: Test across Node versions in parallel
5. **Skip unnecessary jobs**: Use `testable: false` for non-testable domains

---

## Migration & Upgrades

### How do I migrate from existing workflows?

1. **Backup existing workflows**: Copy `.github/workflows/` to a safe location
2. **Run PipeCraft init**: `npx pipecraft init`
3. **Configure domains**: Define your domains in `.pipecraftrc.json`
4. **Generate workflows**: `npx pipecraft generate`
5. **Review diff**: Compare generated workflows with your backups
6. **Merge custom logic**: Copy your specific test/deploy commands to generated workflows
7. **Test**: Run workflows in a feature branch first
8. **Commit**: Once working, commit and push

### How do I upgrade PipeCraft versions?

For global installs:

```bash
npm update -g pipecraft
```

For project installs:

```bash
npm update pipecraft
```

Then regenerate workflows to get latest features:

```bash
npx pipecraft generate
```

Your customizations will be preserved during regeneration.

---

## Getting Help

### Where can I get help?

- **Documentation**: [pipecraft.thecraftlab.dev](https://pipecraft.thecraftlab.dev)
- **GitHub Discussions**: [Ask questions and share tips](https://github.com/jamesvillarrubia/pipecraft/discussions)
- **GitHub Issues**: [Report bugs and request features](https://github.com/jamesvillarrubia/pipecraft/issues)
- **Examples**: Check the [examples/ directory](https://github.com/jamesvillarrubia/pipecraft/tree/main/examples)

### How do I report a bug?

1. Check [existing issues](https://github.com/jamesvillarrubia/pipecraft/issues)
2. If not found, [create a new issue](https://github.com/jamesvillarrubia/pipecraft/issues/new)
3. Include:
   - PipeCraft version (`pipecraft --version`)
   - Node version (`node --version`)
   - Your `.pipecraftrc.json` (sanitized)
   - Error messages and logs
   - Steps to reproduce

### How can I contribute?

We welcome contributions! See the [Contributing guide](./contributing.md) for:

- Development setup
- Code architecture
- Testing guidelines
- Pull request process

Quick start:

```bash
git clone https://github.com/jamesvillarrubia/pipecraft.git
cd pipecraft
npm install
npm test
```

---

## Still have questions?

Can't find an answer? Ask in [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions) or [open an issue](https://github.com/jamesvillarrubia/pipecraft/issues/new).
