# Security

PipeCraft generates workflows that run in your CI/CD environment with access to your code and secrets. Understanding the security implications will help you use it safely.

## Protecting your GitHub token

When you run `pipecraft setup`, you need to provide a GitHub personal access token. This token has powerful permissions - it can modify your repository settings, create branches, and update workflows. Keeping it secure is critical.

Always store your token in an environment variable, never in a file:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
pipecraft setup
```

Never commit tokens to your repository. It's tempting to add them to a `.env` file for convenience, but this is dangerous. Even if you think you'll remember to add `.env` to `.gitignore`, it's easy to make a mistake. Use environment variables exclusively.

Your GitHub token needs two permissions: `repo` (full repository access) and `workflow` (ability to update GitHub Actions). When creating a personal access token in GitHub's settings, select only these scopes. Limiting permissions reduces risk if the token is ever compromised.

## Managing secrets in workflows

PipeCraft generates workflows that may need access to secrets - API keys, database credentials, deployment tokens, and so on. GitHub provides a secure way to store these through repository secrets.

Store secrets in your repository settings (Settings → Secrets and variables → Actions), then reference them in your workflow customizations:

```yaml
deploy-api:
  steps:
    - name: Deploy to production
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
        API_KEY: ${{ secrets.API_KEY }}
      run: npm run deploy
```

Never hardcode secrets directly in workflow files. Even if the repository is private, this is a dangerous practice. Secrets in files can be accidentally exposed through screenshots, logs, or if the repository visibility changes.

## Branch protection

The `pipecraft setup` command configures branch protection rules automatically. These rules prevent direct pushes to important branches like `main` and `staging`, requiring all changes to go through pull requests with status checks.

This protection is important because it ensures your CI/CD pipeline runs before code reaches production. Without it, someone could bypass testing by pushing directly to the main branch.

If you prefer to configure branch protection manually, the key settings are:
- Require status checks to pass before merging
- Require pull request reviews before merging
- Restrict who can push to protected branches

## Keeping things secure

A few simple practices will keep your PipeCraft setup secure:

**Rotate your GitHub token periodically.** If you created a token six months ago and it's still in use, generate a new one and revoke the old one. This limits the damage if a token is ever compromised.

**Review generated workflows before committing them.** While PipeCraft is designed to generate safe workflows, you should understand what's being created. Look through the workflow files and make sure they make sense for your project.

**Use minimal token permissions.** Don't give your GitHub token more access than it needs. Stick to `repo` and `workflow` scopes.

**Enable branch protection on all important branches.** Your main and staging branches should always be protected. Development branches can be more permissive.

## Reporting security issues

If you discover a security vulnerability in PipeCraft itself, please report it responsibly. Don't open a public GitHub issue. Instead, contact the maintainers directly so the issue can be fixed before it's disclosed publicly.

Email: [Security contact to be added]
