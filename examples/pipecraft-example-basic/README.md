# Trunk-Based Development Demo

This is an example repository demonstrating PipeCraft's trunk-based development workflow.

## About This Demo

This repository showcases how PipeCraft automates:

- **Branch Flow Management**: develop → staging → main
- **Automatic Versioning**: Semantic versioning based on conventional commits
- **Change Detection**: Domain-specific testing and deployment
- **Pull Request Automation**: Auto-creation and merging of promotion PRs

## Repository Structure

```
├── src/
│   ├── api/          # API domain changes
│   ├── web/          # Web application changes
│   └── libs/         # Shared library changes
├── .github/
│   └── workflows/    # PipeCraft generated workflows
└── .pipecraftrc.json # PipeCraft configuration
```

## Workflow

1. **Feature Development**: Create feature branches from `develop`
2. **Pull Requests**: Target `develop` branch
3. **Auto-Promotion**: PipeCraft automatically promotes through branch flow
4. **Versioning**: Semantic versions based on commit messages
5. **Releases**: Automatic GitHub releases

## Commit Types

- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `feat!:` - Breaking changes (major version bump)
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks

## Getting Started

This repository is managed by PipeCraft. The workflows are automatically generated and maintained.

For more information about PipeCraft, visit the [main repository](https://github.com/pipecraft-lab/pipecraft).
