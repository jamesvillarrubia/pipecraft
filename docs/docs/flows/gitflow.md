# GitFlow

GitFlow support is planned for a future release. This page explains the GitFlow branching model and how it differs from trunk-based development.

## What is GitFlow?

GitFlow is a traditional branching model designed for projects with scheduled releases. It uses multiple long-lived branches (main, develop, release, hotfix) to manage different stages of development. Feature branches merge into develop, which eventually creates release branches that get merged to main.

This model works well for software with versioned releases - think desktop applications, mobile apps, or on-premise software where customers install specific versions. It provides clear separation between development work, release preparation, and production code.

## How it would work in PipeCraft

When GitFlow support is added, your configuration might look like:

```json
{
  "flowPattern": "gitflow",
  "branches": {
    "main": "production releases",
    "develop": "integration branch",
    "release": "release-*",
    "hotfix": "hotfix-*",
    "feature": "feature-*"
  }
}
```

PipeCraft would generate workflows that handle the complex merging and tagging required by GitFlow - creating release branches from develop, merging releases into main with tags, and creating hotfix branches from main when needed.

## When to use GitFlow

This pattern makes sense when:
- You ship versioned releases on a schedule
- Multiple releases might be in development simultaneously
- You need to support older versions with hotfixes
- Your release process includes QA cycles or beta testing
- Different features need isolated development before integration

## When to stick with trunk flow

The current trunk-based flow is simpler and more suitable when:
- You deploy continuously rather than in batches
- You only maintain one version in production
- Your team is small and features integrate quickly
- You prefer automation over manual release management

## Timeline

GitFlow is on the roadmap but hasn't been scheduled yet. The complexity of implementing GitFlow properly means it will take longer than simpler patterns like GitHub Flow. If your team needs GitFlow support, share your use case on [GitHub Discussions](https://github.com/jamesvillarrubia/pipecraft/discussions).
