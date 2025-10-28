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
 *   testable: true,
 *   deployable: true
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
   * Whether this domain has tests that should be run.
   * If true, generates test jobs for this domain.
   * @default false
   */
  testable?: boolean

  /**
   * Whether this domain should be deployed.
   * If true, generates deployment jobs for this domain.
   * @default false
   */
  deployable?: boolean

  /**
   * Whether this domain should be tested remotely after deployment.
   * If true, generates remote test jobs for this domain.
   * @default false
   */
  remoteTestable?: boolean
}

/**
 * Complete PipeCraft configuration schema.
 *
 * This is the main configuration interface loaded from `.pipecraftrc.json` or
 * the `pipecraft` key in `package.json`. It defines the entire CI/CD pipeline
 * behavior including branch flow, merge strategies, domain configuration,
 * versioning, and automated actions.
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
 *   autoMerge: { staging: true },
 *   semver: {
 *     bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' }
 *   },
 *   actions: {
 *     onDevelopMerge: ['runTests'],
 *     onStagingMerge: ['runTests', 'calculateVersion']
 *   },
 *   domains: {
 *     api: { paths: ['packages/api/**'], description: 'API', testable: true }
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
   * Auto-merge configuration for branch promotions.
   * - boolean: Enable/disable auto-merge for all branches
   * - Record: Per-branch auto-merge settings (e.g., `{ staging: true, main: false }`)
   *
   * When enabled, PRs are automatically merged after checks pass.
   * @default false
   */
  autoMerge?: boolean | Record<string, boolean>

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
  mergeMethod?: 'auto' | 'merge' | 'squash' | 'rebase' | Record<string, 'auto' | 'merge' | 'squash' | 'rebase'>

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
   * Auto-detected during init based on lockfile presence.
   *
   * - 'npm': Uses npm (with package-lock.json)
   * - 'yarn': Uses yarn (with yarn.lock)
   * - 'pnpm': Uses pnpm (with pnpm-lock.yaml)
   *
   * @default 'npm'
   */
  packageManager?: 'npm' | 'yarn' | 'pnpm'

  /**
   * Nx monorepo integration configuration.
   * When enabled, PipeCraft generates workflows that leverage Nx's dependency graph
   * and affected detection for intelligent change-based testing.
   *
   * @example
   * ```typescript
   * nx: {
   *   enabled: true,
   *   tasks: ['lint', 'test', 'build', 'integration-test'],
   *   baseRef: 'origin/main'
   * }
   * ```
   */
  nx?: {
    /**
     * Whether Nx integration is enabled for this project.
     * Auto-detected if nx.json exists in project root.
     */
    enabled: boolean

    /**
     * Ordered list of Nx tasks to run sequentially.
     * Tasks are executed using `nx affected --target=<task>`.
     *
     * @example ['lint', 'test', 'build', 'e2e']
     */
    tasks: string[]

    /**
     * Base git reference for affected detection.
     * Used in `nx affected --base=<baseRef>`.
     *
     * @default 'origin/main'
     */
    baseRef?: string

    /**
     * Whether to include Nx cache management in workflows.
     * Speeds up subsequent runs by caching build outputs.
     *
     * @default true
     */
    enableCache?: boolean
  }

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
     */
    bumpRules: Record<string, string>
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
  domains: Record<string, { paths: string[], description: string, testable?: boolean, deployable?: boolean, remoteTestable?: boolean }>

  /**
   * Semantic versioning rules.
   */
  semver: {
    bumpRules: Record<string, string>
  }

}
