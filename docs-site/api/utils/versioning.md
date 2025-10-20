[**pipecraft v0.0.0-releaseit**](../README.md)

***

[pipecraft](../README.md) / utils/versioning

# utils/versioning

Version Management and Semantic Versioning Utilities

This module provides comprehensive version management using release-it and
conventional commits. It handles:
- Automatic version calculation based on commit history
- Generation of release-it, commitlint, and husky configurations
- Git tag creation and management
- Conventional commit validation
- Changelog generation

The VersionManager integrates with the trunk-based workflow to automatically
bump versions when code is promoted through the pipeline.

## Classes

### VersionManager

Defined in: [utils/versioning.ts:46](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L46)

Manager for semantic versioning and release automation.

This class handles all version-related operations including configuration
generation, version calculation, and commit validation. It integrates with
release-it for automated versioning and conventional-changelog for
changelog generation.

#### Example

```typescript
const versionManager = new VersionManager(config)

// Setup version management (creates config files)
versionManager.setupVersionManagement()

// Get current version from git tags
const currentVersion = versionManager.getCurrentVersion()

// Calculate next version based on commits
const { version, type } = versionManager.calculateNextVersion()
console.log(`Next version: ${version} (${type} bump)`)
```

#### Constructors

##### Constructor

> **new VersionManager**(`config`): [`VersionManager`](#versionmanager)

Defined in: [utils/versioning.ts:54](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L54)

Create a new VersionManager instance.

###### Parameters

###### config

[`PipecraftConfig`](../types.md#pipecraftconfig)

PipeCraft configuration object

###### Returns

[`VersionManager`](#versionmanager)

#### Methods

##### calculateNextVersion()

> **calculateNextVersion**(): `object`

Defined in: [utils/versioning.ts:385](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L385)

Calculate the next version based on conventional commits.

Runs release-it in dry-run mode to determine what version would be
created based on commits since the last tag. Analyzes conventional
commit messages to determine the appropriate bump level.

###### Returns

`object`

Object containing the next version string and bump type

###### type

> **type**: `string`

###### version

> **version**: `string`

###### Example

```typescript
const { version, type } = versionManager.calculateNextVersion()
console.log(`Next ${type} version: ${version}`)
// Output: "Next minor version: 1.3.0"
```

##### generateCommitlintConfig()

> **generateCommitlintConfig**(): `string`

Defined in: [utils/versioning.ts:166](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L166)

Generate commitlint configuration file content.

Creates a CommonJS module that configures commitlint to enforce
conventional commit message format. This ensures all commits follow
a consistent structure that can be parsed for automatic versioning.

Enforced rules include:
- Valid commit types (feat, fix, docs, etc.)
- Lowercase types
- Non-empty subjects
- Lowercase subject (except proper nouns)
- No trailing period in subject

###### Returns

`string`

JavaScript module string ready to write to commitlint.config.js

##### generateHuskyConfig()

> **generateHuskyConfig**(): `string`

Defined in: [utils/versioning.ts:205](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L205)

Generate husky commit-msg hook script.

Creates a shell script that runs commitlint on every commit message.
This hook automatically validates commit messages before they're accepted,
preventing non-conventional commits from entering the repository.

###### Returns

`string`

Shell script string ready to write to .husky/commit-msg

##### generateReleaseItConfig()

> **generateReleaseItConfig**(): `string`

Defined in: [utils/versioning.ts:79](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L79)

Generate release-it configuration file content.

Creates a CommonJS module exporting release-it configuration that:
- Disables npm publishing (for monorepos/private packages)
- Configures git tagging with conventional versioning
- Sets up conventional-changelog plugin for automatic version bumping
- Merges user-defined bump rules with sensible defaults

The generated config uses a custom whatBump function that analyzes
conventional commits to determine the appropriate version bump level
(major, minor, or patch).

###### Returns

`string`

JavaScript module string ready to write to .release-it.cjs

###### Example

```typescript
const config = versionManager.generateReleaseItConfig()
writeFileSync('.release-it.cjs', config)
```

##### getCurrentVersion()

> **getCurrentVersion**(): `string`

Defined in: [utils/versioning.ts:356](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L356)

Get the current version from git tags.

Finds the most recent git tag matching semantic versioning format (v*.*.*)
and returns it as a version string. Strips the leading 'v' if present.

###### Returns

`string`

Current version string (e.g., "1.2.3") or "0.0.0" if no tags exist

###### Example

```typescript
const currentVersion = versionManager.getCurrentVersion()
console.log(`Current version: v${currentVersion}`)
```

##### setupVersionManagement()

> **setupVersionManagement**(): `void`

Defined in: [utils/versioning.ts:235](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L235)

Setup version management infrastructure.

Creates all necessary configuration files and hooks for automated
version management:
- .release-it.cjs (release-it configuration)
- commitlint.config.js (commit message linting)
- .husky/commit-msg (git hook for commit validation)
- package.json scripts (release, changelog commands)

Only runs if versioning is enabled in configuration.
Installs husky if not already present.

###### Returns

`void`

###### Example

```typescript
versionManager.setupVersionManagement()
// Files created:
// - .release-it.cjs
// - commitlint.config.js
// - .husky/commit-msg
// - Updated package.json
```

##### validateConventionalCommits()

> **validateConventionalCommits**(): `boolean`

Defined in: [utils/versioning.ts:324](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/utils/versioning.ts#L324)

Validate that recent commits follow conventional commit format.

Checks the last 10 commits to determine if the repository is following
conventional commit conventions. This can be used as a pre-flight check
before enabling versioning features.

Expected format: `type(scope?): subject`
Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

###### Returns

`boolean`

true if all recent commits follow conventional format

###### Example

```typescript
if (!versionManager.validateConventionalCommits()) {
  console.warn('⚠ Some commits do not follow conventional format')
  console.log('Enable with: git config commit.template .gitmessage')
}
```
