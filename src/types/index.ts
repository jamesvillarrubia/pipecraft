/**
 * PipeCraft Type Definitions
 *
 * This module contains the core TypeScript interfaces and types used throughout PipeCraft.
 * These types define the configuration schema, context objects, and domain specifications
 * for generating CI/CD pipelines with trunk-based development workflows.
 *
 * @module types
 */

/**
 * Configuration for a single domain (monorepo workspace) in a PipeCraft project.
 *
 * Domains enable path-based change detection in monorepo architectures, allowing
 * different parts of the codebase to be tested and deployed independently.
 *
 * @example
 * ```typescript
 * const apiDomain: DomainConfig = {
 *   paths: ['packages/api/**', 'libs/shared/**'],
 *   description: 'Backend API services',
 *   prefixes: ['test', 'deploy']
 * }
 * ```
 */
export interface DomainConfig {
  /**
   * Glob patterns matching files in this domain.
   * Changes to these paths will trigger domain-specific jobs.
   */
  paths: string[]

  /**
   * Human-readable description of the domain's purpose.
   * Used in workflow comments and documentation.
   */
  description: string

  /**
   * Job prefixes to generate for this domain.
   * Each prefix generates a customizable placeholder job named `{prefix}-{domain}`.
   *
   * For example, with domain 'core' and prefixes: ['test', 'deploy', 'lint']:
   * - test-core (runs when core/ changes)
   * - deploy-core (runs when core/ changes)
   * - lint-core (runs when core/ changes)
   *
   * These are placeholder jobs where you add your own logic in the custom jobs section.
   * Prefixes are the mechanism job generation reads. The deprecated boolean flags are
   * translated into this array during config validation.
   *
   * @example ['test', 'deploy', 'remote-test']
   * @example ['lint', 'build', 'test', 'deploy', 'e2e']
   */
  prefixes?: string[]

  /**
   * Whether this domain has tests that should be run.
   * If true, generates test jobs for this domain.
   * @default false
   * @deprecated Use `prefixes: ['test']` instead for more flexibility
   */
  testable?: boolean

  /**
   * Whether this domain should be deployed.
   * If true, generates deployment jobs for this domain.
   * @default false
   * @deprecated Use `prefixes: ['deploy']` instead for more flexibility
   */
  deployable?: boolean

  /**
   * Whether this domain should be tested remotely after deployment.
   * If true, generates remote test jobs for this domain.
   * @default false
   * @deprecated Use `prefixes: ['remote-test']` instead for more flexibility
   */
  remoteTestable?: boolean
}

/**
 * Complete PipeCraft configuration schema.
 *
 * This is the main configuration interface loaded from `.pipecraftrc` (YAML or JSON),
 * `.pipecraftrc.json` (legacy), or the `pipecraft` key in `package.json`.
 * It defines the entire CI/CD pipeline behavior including branch flow, merge
 * strategies, domain configuration, versioning, and automated actions.
 *
 * @example
 * ```typescript
 * const config: PipecraftConfig = {
 *   ciProvider: 'github',
 *   mergeStrategy: 'fast-forward',
 *   requireConventionalCommits: true,
 *   initialBranch: 'develop',
 *   finalBranch: 'main',
 *   branchFlow: ['develop', 'staging', 'main'],
 *   autoPromote: { staging: true },
 *   semver: {
 *     bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' }
 *   },
 *   actions: {
 *     onDevelopMerge: ['runTests'],
 *     onStagingMerge: ['runTests', 'calculateVersion']
 *   },
 *   domains: {
 *     api: { paths: ['packages/api/**'], description: 'API', prefixes: ['test'] }
 *   }
 * }
 * ```
 */
export interface PipecraftConfig {
  /**
   * CI/CD provider platform.
   * Currently 'github' is fully supported, 'gitlab' support is planned.
   */
  ciProvider: 'github' | 'gitlab'

  /**
   * Git merge strategy for branch promotions.
   * - 'fast-forward': Requires linear history, fails if branches diverged
   * - 'merge': Creates merge commits
   */
  mergeStrategy: 'fast-forward' | 'merge'

  /**
   * Whether to enforce conventional commit message format.
   * If true, commit messages must follow the Conventional Commits specification.
   * @see https://www.conventionalcommits.org/
   */
  requireConventionalCommits: boolean

  /**
   * The first branch in the promotion flow (typically 'develop' or 'dev').
   * All feature branches merge into this branch.
   */
  initialBranch: string

  /**
   * The final production branch (typically 'main' or 'master').
   * This is the last branch in the promotion flow.
   */
  finalBranch: string

  /**
   * Ordered list of branches in the promotion flow from initial to final.
   * Must start with initialBranch and end with finalBranch.
   *
   * @example ['develop', 'staging', 'main']
   */
  branchFlow: string[]

  /**
   * Auto-promote configuration for branch promotions.
   * - boolean: Enable/disable auto-promotion for all branches
   * - Record: Per-branch auto-promote settings (e.g., `{ staging: true, main: false }`)
   *
   * This controls how a promotion PR is *merged*, not whether one is *opened*.
   * PipeCraft opens the promotion PR either way:
   *
   * - `true`  — the PR is opened and merged automatically once checks pass.
   * - `false` — the PR is opened and left for a human to merge.
   *
   * There is no value here that stops promotion PRs from being created. To stop
   * promoting to a branch at all, remove it from `branchFlow`.
   *
   * @default false
   */
  autoPromote?: boolean | Record<string, boolean>

  /**
   * Git merge method for auto-merge operations.
   * - 'auto': Use fast-forward when possible, merge otherwise
   * - 'merge': Always create merge commit
   * - 'squash': Squash all commits into one
   * - 'rebase': Rebase and fast-forward
   *
   * Can be set globally or per-branch.
   * @default 'auto'
   */
  mergeMethod?:
    | 'auto'
    | 'merge'
    | 'squash'
    | 'rebase'
    | Record<string, 'auto' | 'merge' | 'squash' | 'rebase'>

  /**
   * Auto-merge configuration.
   *
   * @deprecated Use `autoPromote` instead. This is a backwards-compatible alias and
   * has no independent effect.
   */
  autoMerge?: boolean | Record<string, boolean>

  /**
   * Semantic versioning configuration.
   * Maps conventional commit types to version bump levels.
   *
   * @example
   * ```typescript
   * semver: {
   *   bumpRules: {
   *     feat: 'minor',      // New features bump minor version
   *     fix: 'patch',        // Bug fixes bump patch version
   *     breaking: 'major'    // Breaking changes bump major version
   *   }
   * }
   * ```
   */
  semver: {
    /**
     * Mapping of commit types to semver bump levels (major, minor, patch).
     */
    bumpRules: Record<string, string>
  }

  /**
   * Domain definitions for monorepo path-based change detection.
   * Each domain represents a logical part of the codebase with its own
   * test and deployment requirements.
   */
  domains: Record<string, DomainConfig>

  /**
   * Package manager used for dependency installation.
   *
   * @deprecated This field is no longer used by PipeCraft workflows.
   * It was originally intended for JavaScript/Node.js projects but
   * PipeCraft now supports language-agnostic workflows. Existing
   * configs with this field will continue to work, but it has no effect.
   */
  packageManager?: 'npm' | 'yarn' | 'pnpm'

  /**
   * Runtime tool versions for generated CI/CD workflows.
   *
   * Controls the `NODE_VERSION` / `PNPM_VERSION` workflow env vars (and the
   * version job's `node-version`) without hand-editing generated files. When a
   * value is set here it is authoritative — regeneration overwrites the env var
   * with the configured value; when unset, the existing value is preserved and
   * falls back to the defaults.
   *
   * @example
   * ```typescript
   * runtime: { nodeVersion: '22', pnpmVersion: '10' }
   * ```
   */
  runtime?: {
    /**
     * Node.js version for workflows. Accepts a major (e.g. `'22'`) or an exact
     * version (e.g. `'22.18.0'`).
     * @default '22'
     */
    nodeVersion?: string

    /**
     * pnpm version for workflows (used when the project installs with pnpm).
     * Accepts a major (e.g. `'10'`) or an exact version (e.g. `'10.6.2'`).
     * @default '10.6.2'
     */
    pnpmVersion?: string
  }

  /**
   * How workflows should reference PipeCraft actions.
   *
   * - 'local': Actions copied to ./.github/actions/ (default, full control)
   * - 'remote': Reference published marketplace actions (e.g., the-craftlab/pipecraft/actions/detect-changes@v1)
   * - 'source': Use ./actions/ from repo root (internal use only, for PipeCraft's own CI)
   *
   * @default 'local'
   * @example
   * ```typescript
   * // User repos (local mode)
   * actionSourceMode: 'local'
   * // Generates: uses: ./.github/actions/detect-changes
   *
   * // User repos (remote mode)
   * actionSourceMode: 'remote'
   * actionVersion: 'v1.2.3'
   * // Generates: uses: the-craftlab/pipecraft/actions/detect-changes@v1.2.3
   *
   * // PipeCraft repo only (source mode)
   * actionSourceMode: 'source'
   * // Generates: uses: ./actions/detect-changes
   * ```
   */
  actionSourceMode?: 'local' | 'remote' | 'source'

  /**
   * Version/tag to use when actionSourceMode is 'remote'.
   * Pins workflows to a specific marketplace action version.
   *
   * @example 'v1.2.3', 'v1', 'main'
   * @default 'v1'
   */
  actionVersion?: string

  /**
   * Idempotency and rebuild configuration.
   * Controls when workflows should be regenerated based on config/template changes.
   */
  rebuild?: {
    /**
     * Whether idempotency checking is enabled.
     * If true, workflows are only regenerated when config or templates change.
     */
    enabled: boolean

    /**
     * Skip regeneration if config hash hasn't changed.
     */
    skipIfUnchanged: boolean

    /**
     * Force regeneration even if hash matches.
     * Useful for debugging or manual overrides.
     */
    forceRegenerate: boolean

    /**
     * Enable watch mode for automatic regeneration on config changes.
     */
    watchMode: boolean

    /**
     * Hashing algorithm for detecting config changes.
     */
    hashAlgorithm: 'md5' | 'sha1' | 'sha256'

    /**
     * Path to cache file storing previous config hash.
     */
    cacheFile: string

    /**
     * Patterns to ignore when calculating config hash.
     */
    ignorePatterns: string[]
  }

  /**
   * Version management configuration using release-it.
   * Enables automatic version bumping, tagging, and changelog generation.
   */
  versioning?: {
    /**
     * Whether version management is enabled.
     */
    enabled: boolean

    /**
     * Path to release-it configuration file.
     */
    releaseItConfig: string

    /**
     * Use conventional commits for version calculation.
     */
    conventionalCommits: boolean

    /**
     * Automatically create git tags for new versions.
     */
    autoTag: boolean

    /**
     * Automatically push tags to remote after creation.
     */
    autoPush: boolean

    /**
     * Generate CHANGELOG.md from conventional commits.
     */
    changelog: boolean

    /**
     * Mapping of commit types to version bump levels.
     * @deprecated Use semver.bumpRules instead. This field is ignored if semver.bumpRules is present.
     */
    bumpRules?: Record<string, string>
  }
}

/**
 * Runtime context object passed to template generators.
 *
 * This is a simplified version of PipecraftConfig used during template
 * rendering. It contains only the fields needed by the template engine
 * and is created by transforming the full config.
 *
 * @internal
 */
export interface PipecraftContext {
  /**
   * Project name extracted from package.json or git repository.
   */
  projectName: string

  /**
   * CI/CD provider platform.
   */
  ciProvider: 'github' | 'gitlab'

  /**
   * Git merge strategy for branch promotions.
   */
  mergeStrategy: 'fast-forward' | 'merge'

  /**
   * Whether conventional commits are required.
   */
  requireConventionalCommits: boolean

  /**
   * The initial branch in the promotion flow.
   */
  initialBranch: string

  /**
   * The final production branch.
   */
  finalBranch: string

  /**
   * Complete ordered branch flow.
   */
  branchFlow: string[]

  /**
   * Simplified domain configuration for template rendering.
   */
  domains: Record<
    string,
    {
      paths: string[]
      description: string
      prefixes?: string[]
      testable?: boolean
      deployable?: boolean
      remoteTestable?: boolean
    }
  >

  /**
   * Semantic versioning rules.
   */
  semver: {
    bumpRules: Record<string, string>
  }
}

/**
 * Every recognized top-level config key.
 *
 * This is the runtime allowlist counterpart to {@link PipecraftConfig}. It is kept in
 * lockstep with the interface by the compile-time assertions below (a missing or extra
 * key fails `tsc`) and with `.pipecraft-schema.json` by
 * `tests/unit/schema-types-consistency.test.ts`. When you add a config field, add it in
 * all three places.
 */
export const KNOWN_CONFIG_KEYS = [
  'ciProvider',
  'mergeStrategy',
  'requireConventionalCommits',
  'initialBranch',
  'finalBranch',
  'branchFlow',
  'autoPromote',
  'mergeMethod',
  'autoMerge',
  'semver',
  'domains',
  'packageManager',
  'runtime',
  'actionSourceMode',
  'actionVersion',
  'rebuild',
  'versioning'
] as const

/**
 * Every recognized key inside a single domain entry.
 * Kept in lockstep with {@link DomainConfig} and the schema's `definitions.DomainConfig`.
 */
export const KNOWN_DOMAIN_KEYS = [
  'paths',
  'description',
  'prefixes',
  'testable',
  'deployable',
  'remoteTestable'
] as const

// Compile-time guards: KNOWN_CONFIG_KEYS must exactly cover keyof PipecraftConfig, and
// KNOWN_DOMAIN_KEYS must exactly cover keyof DomainConfig. If these fail to compile, a
// key was added/removed from an interface without updating the constant above.
type AssertExact<TActual extends string, TExpected extends string> = [
  Exclude<TActual, TExpected>,
  Exclude<TExpected, TActual>
] extends [never, never]
  ? true
  : never

const _assertConfigKeys: AssertExact<(typeof KNOWN_CONFIG_KEYS)[number], keyof PipecraftConfig> =
  true
const _assertDomainKeys: AssertExact<(typeof KNOWN_DOMAIN_KEYS)[number], keyof DomainConfig> = true
void _assertConfigKeys
void _assertDomainKeys
