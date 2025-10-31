# Contributing

PipeCraft is an open source project that welcomes contributions. Whether you're fixing a bug, adding a feature, or improving documentation, your help is appreciated.

## Getting set up

Start by cloning the repository and installing dependencies:

```bash
git clone https://github.com/jamesvillarrubia/pipecraft.git
cd pipecraft
pnpm install
pnpm run build
pnpm test
```

The project uses pnpm for package management, TypeScript for the source code, and Vitest for testing. After running these commands, you should see all tests passing. If something fails, check that you're using Node.js 18 or higher.

## Making your first contribution

When you're ready to make changes, create a new branch from `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feat/your-feature-name
```

Branch names should follow the conventional commit format: `feat/` for new features, `fix/` for bug fixes, `docs/` for documentation changes.

Make your changes in the codebase. PipeCraft uses TypeScript with strict mode enabled, so you'll need to maintain proper typing throughout. Every public function should have JSDoc comments explaining what it does, its parameters, and its return value.

Write tests for your changes. The test suite is organized into unit tests (test individual functions), integration tests (test components working together), and end-to-end tests (test complete workflows). New features should include all three types of tests when appropriate.

## Committing changes

PipeCraft uses conventional commits for all commit messages. This format enables automatic version calculation and changelog generation. Your commits should look like:

```bash
git commit -m "feat: add GitLab CI support"
git commit -m "fix: correct version calculation for pre-release tags"
git commit -m "docs: update CLI reference"
```

The commit type (`feat`, `fix`, `docs`, etc.) determines how the version number is bumped. Features increment the minor version, fixes increment the patch version, and breaking changes (marked with `!`) increment the major version.

## Opening a pull request

Push your branch to your fork and open a pull request against the `develop` branch (not `main`). The PR title should also follow conventional commit format since it's used in the merge commit.

In your PR description, explain what you changed and why. If you're fixing a bug, describe how to reproduce it. If you're adding a feature, explain the use case. Include screenshots for UI changes.

Your PR will be reviewed by maintainers. They may ask questions or request changes. This is normal and helps maintain code quality. Don't be discouraged - every contributor goes through this process.

## Code style

PipeCraft enforces strict TypeScript typing. Never use `any` types - always provide specific types:

```typescript
// ✅ Good - proper typing
function generate(config: PipecraftConfig): string {
  return generateWorkflow(config)
}

// ❌ Bad - using any
function generate(config: any): any {
  return generateWorkflow(config)
}
```

When you need to type something complex, define an interface in `src/types/index.ts` rather than using inline types. This keeps type definitions centralized and reusable.

## Getting help

If you're stuck or have questions:

**GitHub Discussions** is the best place for open-ended questions about contributing, architecture decisions, or feature ideas.

**GitHub Issues** is for specific bugs or feature requests. Check if someone else has already reported your issue before opening a new one.

The maintainers are happy to help new contributors get started. Don't hesitate to ask questions.
