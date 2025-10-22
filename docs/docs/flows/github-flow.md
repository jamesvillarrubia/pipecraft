# GitHub Flow

GitHub Flow support is planned for a future release. This page explains what it is and why you might want to use it.

## What is GitHub Flow?

GitHub Flow is a simpler workflow pattern that eliminates staging branches entirely. You create feature branches, open pull requests, and merge directly to main. Every merge to main triggers a deployment to production.

This pattern works well for teams that practice continuous deployment - shipping small changes frequently rather than batching them into releases. It's also popular with web applications where rolling back is easy and downtime is acceptable for brief periods.

## How it would work in PipeCraft

When GitHub Flow support is added, your configuration would look like:

```json
{
  "flowPattern": "github-flow",
  "branchFlow": ["main"],
  "deployOnMerge": true
}
```

Instead of the current develop → staging → main progression, you'd have feature branches merging directly to main. Each merge would run tests and deploy to production immediately.

## When to use GitHub Flow

This pattern is ideal when:
- You deploy multiple times per day
- Rolling back is fast and easy
- Your application can tolerate brief outages
- Your team is comfortable with continuous deployment
- You don't need a staging environment for integration testing

## When to stick with trunk flow

The current trunk-based flow is better when:
- You need a staging environment for integration testing
- Multiple teams need to coordinate releases
- You have scheduled release windows
- Rollbacks are complex or risky
- You want a buffer between code and production

## Timeline

GitHub Flow is on the roadmap but hasn't been scheduled yet. If this workflow would be valuable for your team, let us know on [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions). Community feedback helps prioritize features.
