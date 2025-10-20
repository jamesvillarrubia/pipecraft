/**
 * Test Fixture Generation Helpers
 *
 * Provides utilities for generating test fixtures programmatically instead of
 * relying on static fixture files. This makes tests more maintainable and easier
 * to understand as the test data is defined alongside the test logic.
 *
 * @module tests/helpers/fixtures
 */

import { PipecraftConfig } from '../../src/types/index.js'

/**
 * Create a minimal valid PipeCraft configuration.
 *
 * Provides the minimum required fields for a valid configuration.
 * Can be extended with additional options.
 *
 * @param overrides - Optional fields to override defaults
 * @returns Valid PipeCraft configuration object
 *
 * @example
 * ```typescript
 * const config = createMinimalConfig({
 *   initialBranch: 'develop',
 *   finalBranch: 'production'
 * })
 * ```
 */
export function createMinimalConfig(overrides: Partial<PipecraftConfig> = {}): PipecraftConfig {
  return {
    ciProvider: 'github',
    mergeStrategy: 'fast-forward',
    requireConventionalCommits: false,
    initialBranch: 'develop',
    finalBranch: 'main',
    branchFlow: ['develop', 'main'],
    semver: {
      bumpRules: {
        feat: 'minor',
        fix: 'patch',
        breaking: 'major'
      }
    },
    actions: {
      onDevelopMerge: [],
      onStagingMerge: []
    },
    domains: {
      app: {
        paths: ['src/**'],
        description: 'Application code',
        testable: true,
        deployable: true
      }
    },
    ...overrides
  }
}

/**
 * Create a complete configuration with typical trunk-based flow.
 *
 * Includes develop → staging → main flow with typical settings.
 *
 * @param overrides - Optional fields to override defaults
 * @returns Complete PipeCraft configuration
 *
 * @example
 * ```typescript
 * const config = createTrunkFlowConfig({
 *   requireConventionalCommits: true
 * })
 * ```
 */
export function createTrunkFlowConfig(overrides: Partial<PipecraftConfig> = {}): PipecraftConfig {
  return {
    ciProvider: 'github',
    mergeStrategy: 'fast-forward',
    requireConventionalCommits: true,
    initialBranch: 'develop',
    finalBranch: 'main',
    branchFlow: ['develop', 'staging', 'main'],
    autoMerge: {
      staging: true,
      main: false
    },
    mergeMethod: {
      staging: 'squash',
      main: 'merge'
    },
    semver: {
      bumpRules: {
        feat: 'minor',
        fix: 'patch',
        breaking: 'major',
        chore: 'patch'
      }
    },
    actions: {
      onDevelopMerge: ['runTests', 'createPRToStaging'],
      onStagingMerge: ['runTests', 'calculateVersion', 'createPRToMain']
    },
    domains: {
      api: {
        paths: ['packages/api/**', 'libs/shared/**'],
        description: 'Backend API services',
        testable: true,
        deployable: true
      },
      web: {
        paths: ['packages/web/**', 'libs/shared/**'],
        description: 'Frontend web application',
        testable: true,
        deployable: true
      }
    },
    versioning: {
      enabled: true,
      releaseItConfig: '.release-it.cjs',
      conventionalCommits: true,
      autoTag: true,
      autoPush: false,
      changelog: true,
      bumpRules: {
        feat: 'minor',
        fix: 'patch',
        breaking: 'major'
      }
    },
    ...overrides
  }
}

/**
 * Create a monorepo configuration with multiple domains.
 *
 * Useful for testing domain-based change detection.
 *
 * @param domainCount - Number of domains to create (default: 3)
 * @param overrides - Optional fields to override defaults
 * @returns Monorepo configuration
 *
 * @example
 * ```typescript
 * const config = createMonorepoConfig(5)
 * expect(Object.keys(config.domains)).toHaveLength(5)
 * ```
 */
export function createMonorepoConfig(
  domainCount: number = 3,
  overrides: Partial<PipecraftConfig> = {}
): PipecraftConfig {
  const domains: Record<string, any> = {}

  for (let i = 0; i < domainCount; i++) {
    const domainName = `domain-${i + 1}`
    domains[domainName] = {
      paths: [`packages/${domainName}/**`, `libs/shared/**`],
      description: `Domain ${i + 1}`,
      testable: true,
      deployable: true
    }
  }

  return {
    ...createTrunkFlowConfig(),
    domains,
    ...overrides
  }
}

/**
 * Create an invalid configuration for error testing.
 *
 * Returns a configuration missing required fields or with invalid values.
 *
 * @param invalidationType - Type of invalid configuration to create
 * @returns Invalid configuration object
 *
 * @example
 * ```typescript
 * const config = createInvalidConfig('missing-fields')
 * expect(() => validateConfig(config)).toThrow()
 * ```
 */
export function createInvalidConfig(
  invalidationType: 'missing-fields' | 'invalid-provider' | 'invalid-strategy' | 'empty-domains' | 'no-branches'
): any {
  const base = createMinimalConfig()

  switch (invalidationType) {
    case 'missing-fields':
      // Missing required fields
      return {
        ciProvider: 'github',
        // Missing everything else
      }

    case 'invalid-provider':
      return {
        ...base,
        ciProvider: 'invalid-provider'
      }

    case 'invalid-strategy':
      return {
        ...base,
        mergeStrategy: 'invalid-strategy'
      }

    case 'empty-domains':
      return {
        ...base,
        domains: {}
      }

    case 'no-branches':
      return {
        ...base,
        branchFlow: []
      }

    default:
      return base
  }
}

/**
 * Create a basic workflow YAML string for testing.
 *
 * Generates a simple but valid GitHub Actions workflow YAML.
 *
 * @param name - Workflow name (default: 'Test Workflow')
 * @returns YAML string
 *
 * @example
 * ```typescript
 * const yaml = createBasicWorkflowYAML('My Pipeline')
 * writeFileSync('workflow.yml', yaml)
 * ```
 */
export function createBasicWorkflowYAML(name: string = 'Test Workflow'): string {
  return `name: ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
`
}

/**
 * Create a complete pipeline workflow YAML with jobs.
 *
 * Generates a more complex workflow with multiple jobs for testing.
 *
 * @param options - Workflow options
 * @returns YAML string
 *
 * @example
 * ```typescript
 * const yaml = createPipelineWorkflowYAML({
 *   name: 'Pipeline',
 *   jobs: ['test-api', 'test-web', 'deploy']
 * })
 * ```
 */
export function createPipelineWorkflowYAML(options: {
  name?: string
  branches?: string[]
  jobs?: string[]
} = {}): string {
  const {
    name = 'Pipeline',
    branches = ['develop', 'staging', 'main'],
    jobs = ['test']
  } = options

  const jobsYaml = jobs.map(jobName => `  ${jobName}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run ${jobName}
        run: echo "Running ${jobName}"`).join('\n\n')

  return `name: ${name}

on:
  push:
    branches: [${branches.join(', ')}]
  pull_request:
    branches: [${branches.join(', ')}]

jobs:
${jobsYaml}
`
}

/**
 * Create a package.json content for testing.
 *
 * Generates a minimal package.json with optional overrides.
 *
 * @param overrides - Fields to override
 * @returns package.json object
 *
 * @example
 * ```typescript
 * const pkg = createPackageJSON({
 *   name: 'my-project',
 *   version: '1.0.0'
 * })
 * writeFileSync('package.json', JSON.stringify(pkg, null, 2))
 * ```
 */
export function createPackageJSON(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    name: 'test-project',
    version: '0.1.0',
    description: 'Test project',
    scripts: {
      test: 'vitest'
    },
    ...overrides
  }
}

