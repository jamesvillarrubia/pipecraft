# Troubleshooting

When something goes wrong with PipeCraft, this guide will help you diagnose and fix common issues.

## My workflow isn't running

If you push code but don't see any workflow runs in GitHub Actions, there are a few things to check.

First, make sure the workflow file actually exists in the right location:

```bash
ls .github/workflows/pipeline.yml
```

If the file doesn't exist, run `pipecraft generate` to create it.

Second, verify that your branch name matches your configuration. The workflow only runs on branches you've specified:

```bash
# Check your current branch
git branch --show-current

# Compare with your config
cat .pipecraftrc.json | jq .branchFlow
```

If you're on a branch that's not in your `branchFlow` array, the workflow won't trigger. Push to one of your configured branches (usually `develop`) to see the workflow run.

Third, make sure GitHub Actions is enabled for your repository. Go to your repository Settings → Actions and verify that "Allow all actions and reusable workflows" is enabled.

## Version numbers aren't changing

PipeCraft calculates versions based on your commit messages. If you're not seeing version bumps, it's likely because your commits don't follow the conventional commit format.

Commits that bump versions:
```bash
git commit -m "feat: add new feature"    # Bumps minor version
git commit -m "fix: fix bug"             # Bumps patch version
git commit -m "feat!: breaking change"   # Bumps major version
```

Commits that don't bump versions:
```bash
git commit -m "chore: update docs"       # No version bump
git commit -m "test: add tests"          # No version bump
git commit -m "refactor: clean code"     # No version bump
```

Only `feat`, `fix`, and commits with `!` (breaking changes) trigger version bumps. If all your recent commits are chores or tests, there won't be a new version.

## Code isn't promoting to the next branch

PipeCraft only promotes commits that bump the version. This is intentional - it ensures that only meaningful changes (features and fixes) move through your pipeline, while housekeeping commits stay on the development branch.

If you want a commit to promote, make sure it uses a commit message that triggers a version bump:

```bash
git commit -m "feat: enable promotion"
```

## Regeneration says "No changes detected"

PipeCraft caches your configuration to avoid unnecessary regeneration. If you see this message but want to regenerate anyway, use the `--force` flag:

```bash
pipecraft generate --force
```

This bypasses the cache and regenerates everything.

## Permission errors when generating

If you see "EACCES: permission denied" errors, your `.github` directory permissions might be incorrect:

```bash
chmod 755 .github .github/workflows
chmod 644 .github/workflows/*.yml
```

This sets the correct permissions for workflow files.

## Getting more information

If you're stuck, enable verbose output to see what PipeCraft is doing:

```bash
pipecraft generate --verbose
```

This shows detailed information about configuration loading, pre-flight checks, and file generation.

You can also check the workflow logs in GitHub Actions:

```bash
gh run list                     # List recent runs
gh run view <run-id> --log      # View logs for a specific run
```

## Still need help?

If you can't resolve the issue, open an issue on GitHub with:
- Your PipeCraft version (`pipecraft version`)
- Your `.pipecraftrc.json` (remove any secrets)
- The full error message
- Steps to reproduce the problem

We'll help you figure it out: [github.com/jamesvillarrubia/pipecraft/issues](https://github.com/jamesvillarrubia/pipecraft/issues)
