# Roadmap

PipeCraft currently focuses on trunk-based development with GitHub Actions. The roadmap expands this foundation to support more platforms and workflow patterns.

## What's coming next

**GitLab CI Support** is the highest priority addition. Many teams use GitLab instead of GitHub, and they need the same automated pipeline capabilities. The goal is to generate `.gitlab-ci.yml` files with the same features that GitHub Actions users get today - domain-based testing, semantic versioning, and automated promotions.

**Additional workflow patterns** will give teams more flexibility in how they structure their development process. GitHub Flow is a simpler pattern that skips staging and promotes directly from feature branches to main. It's ideal for projects that deploy continuously. GitFlow is a traditional branching model with release and hotfix branches, better suited for projects with scheduled releases. Eventually, Custom Flows will let you define entirely custom branch patterns and promotion rules.

## Ideas under consideration

Several features are being evaluated but haven't been prioritized yet:

**Workflow visualization** would generate diagrams showing how code flows through your pipeline. This helps teams understand and communicate their deployment process.

**Matrix builds** would let you test across multiple Node versions or operating systems simultaneously. This is particularly useful for libraries that need to support multiple environments.

**Deployment environments** would integrate with GitHub's environment protection rules, adding manual approval gates and environment-specific secrets.

**Notifications** could alert your team on Slack or Discord when deployments happen or tests fail.

**Auto-rollback** would automatically revert failed deployments by detecting health check failures.

These ideas need community feedback before they're prioritized. If one of these would be valuable for your team, let us know through GitHub Issues or Discussions.

## How you can help

The roadmap is shaped by user feedback. If you want to influence what gets built next:

Vote on existing feature requests using GitHub issue reactions. Issues with more upvotes get higher priority.

Open new feature requests if you need something that isn't listed. Describe your use case in detail - understanding the problem helps more than suggesting a specific solution.

Contribute code if you're comfortable with TypeScript and GitHub Actions. The project welcomes pull requests for both bug fixes and new features.

Join discussions on GitHub Discussions to share ideas and debate approaches. Many features start as discussion threads before becoming formal proposals.

Links:
- [GitHub Issues](https://github.com/jamesvillarrubia/pipecraft/issues) for bugs and feature requests
- [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions) for open-ended questions and ideas
