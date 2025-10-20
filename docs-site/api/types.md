[**pipecraft v0.0.0-releaseit**](README.md)

***

[pipecraft](README.md) / types

# types

PipeCraft Type Definitions

This module contains the core TypeScript interfaces and types used throughout PipeCraft.
These types define the configuration schema, context objects, and domain specifications
for generating CI/CD pipelines with trunk-based development workflows.

## Interfaces

### DomainConfig

Defined in: [types/index.ts:27](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L27)

Configuration for a single domain (monorepo workspace) in a PipeCraft project.

Domains enable path-based change detection in monorepo architectures, allowing
different parts of the codebase to be tested and deployed independently.

#### Example

```typescript
const apiDomain: DomainConfig = {
  paths: ['packages/api/**', 'libs/shared/**'],
  description: 'Backend API services',
  testable: true,
  deployable: true
}
```

#### Properties

##### deployable?

> `optional` **deployable**: `boolean`

Defined in: [types/index.ts:52](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L52)

Whether this domain should be deployed.
If true, generates deployment jobs for this domain.

###### Default

```ts
false
```

##### description

> **description**: `string`

Defined in: [types/index.ts:38](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L38)

Human-readable description of the domain's purpose.
Used in workflow comments and documentation.

##### paths

> **paths**: `string`[]

Defined in: [types/index.ts:32](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L32)

Glob patterns matching files in this domain.
Changes to these paths will trigger domain-specific jobs.

##### testable?

> `optional` **testable**: `boolean`

Defined in: [types/index.ts:45](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L45)

Whether this domain has tests that should be run.
If true, generates test jobs for this domain.

###### Default

```ts
false
```

***

### PipecraftConfig

Defined in: [types/index.ts:86](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L86)

Complete PipeCraft configuration schema.

This is the main configuration interface loaded from `.pipecraftrc.json` or
the `pipecraft` key in `package.json`. It defines the entire CI/CD pipeline
behavior including branch flow, merge strategies, domain configuration,
versioning, and automated actions.

#### Example

```typescript
const config: PipecraftConfig = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'staging', 'main'],
  autoMerge: { staging: true },
  semver: {
    bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' }
  },
  actions: {
    onDevelopMerge: ['runTests'],
    onStagingMerge: ['runTests', 'calculateVersion']
  },
  domains: {
    api: { paths: ['packages/api/**'], description: 'API', testable: true }
  }
}
```

#### Properties

##### actions

> **actions**: `object`

Defined in: [types/index.ts:176](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L176)

Actions to execute when code is merged to specific branches.
These define the automated workflow steps like running tests,
calculating versions, and promoting code to the next branch.

###### onDevelopMerge

> **onDevelopMerge**: `string`[]

Actions triggered when code merges to the initial branch (e.g., develop).
Common actions: runTests, fastForwardToNext

###### onStagingMerge

> **onStagingMerge**: `string`[]

Actions triggered when code merges to staging branch.
Common actions: runTests, calculateVersion, createOrFastForwardToMain

##### autoMerge?

> `optional` **autoMerge**: `boolean` \| `Record`\<`string`, `boolean`\>

Defined in: [types/index.ts:135](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L135)

Auto-merge configuration for branch promotions.
- boolean: Enable/disable auto-merge for all branches
- Record: Per-branch auto-merge settings (e.g., { staging: true, main: false })

When enabled, PRs are automatically merged after checks pass.

###### Default

```ts
false
```

##### branchFlow

> **branchFlow**: `string`[]

Defined in: [types/index.ts:125](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L125)

Ordered list of branches in the promotion flow from initial to final.
Must start with initialBranch and end with finalBranch.

###### Example

```ts
['develop', 'staging', 'main']
```

##### ciProvider

> **ciProvider**: `"github"` \| `"gitlab"`

Defined in: [types/index.ts:91](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L91)

CI/CD provider platform.
Currently 'github' is fully supported, 'gitlab' support is planned.

##### domains

> **domains**: `Record`\<`string`, [`DomainConfig`](#domainconfig)\>

Defined in: [types/index.ts:195](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L195)

Domain definitions for monorepo path-based change detection.
Each domain represents a logical part of the codebase with its own
test and deployment requirements.

##### finalBranch

> **finalBranch**: `string`

Defined in: [types/index.ts:117](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L117)

The final production branch (typically 'main' or 'master').
This is the last branch in the promotion flow.

##### initialBranch

> **initialBranch**: `string`

Defined in: [types/index.ts:111](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L111)

The first branch in the promotion flow (typically 'develop' or 'dev').
All feature branches merge into this branch.

##### mergeMethod?

> `optional` **mergeMethod**: `"merge"` \| `"auto"` \| `"squash"` \| `"rebase"` \| `Record`\<`string`, `"merge"` \| `"auto"` \| `"squash"` \| `"rebase"`\>

Defined in: [types/index.ts:147](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L147)

Git merge method for auto-merge operations.
- 'auto': Use fast-forward when possible, merge otherwise
- 'merge': Always create merge commit
- 'squash': Squash all commits into one
- 'rebase': Rebase and fast-forward

Can be set globally or per-branch.

###### Default

```ts
'auto'
```

##### mergeStrategy

> **mergeStrategy**: `"fast-forward"` \| `"merge"`

Defined in: [types/index.ts:98](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L98)

Git merge strategy for branch promotions.
- 'fast-forward': Requires linear history, fails if branches diverged
- 'merge': Creates merge commits

##### rebuild?

> `optional` **rebuild**: `object`

Defined in: [types/index.ts:201](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L201)

Idempotency and rebuild configuration.
Controls when workflows should be regenerated based on config/template changes.

###### cacheFile

> **cacheFile**: `string`

Path to cache file storing previous config hash.

###### enabled

> **enabled**: `boolean`

Whether idempotency checking is enabled.
If true, workflows are only regenerated when config or templates change.

###### forceRegenerate

> **forceRegenerate**: `boolean`

Force regeneration even if hash matches.
Useful for debugging or manual overrides.

###### hashAlgorithm

> **hashAlgorithm**: `"md5"` \| `"sha1"` \| `"sha256"`

Hashing algorithm for detecting config changes.

###### ignorePatterns

> **ignorePatterns**: `string`[]

Patterns to ignore when calculating config hash.

###### skipIfUnchanged

> **skipIfUnchanged**: `boolean`

Skip regeneration if config hash hasn't changed.

###### watchMode

> **watchMode**: `boolean`

Enable watch mode for automatic regeneration on config changes.

##### requireConventionalCommits

> **requireConventionalCommits**: `boolean`

Defined in: [types/index.ts:105](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L105)

Whether to enforce conventional commit message format.
If true, commit messages must follow the Conventional Commits specification.

###### See

https://www.conventionalcommits.org/

##### semver

> **semver**: `object`

Defined in: [types/index.ts:164](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L164)

Semantic versioning configuration.
Maps conventional commit types to version bump levels.

###### bumpRules

> **bumpRules**: `Record`\<`string`, `string`\>

Mapping of commit types to semver bump levels (major, minor, patch).

###### Example

```typescript
semver: {
  bumpRules: {
    feat: 'minor',      // New features bump minor version
    fix: 'patch',        // Bug fixes bump patch version
    breaking: 'major'    // Breaking changes bump major version
  }
}
```

##### versioning?

> `optional` **versioning**: `object`

Defined in: [types/index.ts:244](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/types/index.ts#L244)

Version management configuration using release-it.
Enables automatic version bumping, tagging, and changelog generation.

###### autoPush

> **autoPush**: `boolean`

Automatically push tags to remote after creation.

###### autoTag

> **autoTag**: `boolean`

Automatically create git tags for new versions.

###### bumpRules

> **bumpRules**: `Record`\<`string`, `string`\>

Mapping of commit types to version bump levels.

###### changelog

> **changelog**: `boolean`

Generate CHANGELOG.md from conventional commits.

###### conventionalCommits

> **conventionalCommits**: `boolean`

Use conventional commits for version calculation.

###### enabled

> **enabled**: `boolean`

Whether version management is enabled.

###### releaseItConfig

> **releaseItConfig**: `string`

Path to release-it configuration file.
