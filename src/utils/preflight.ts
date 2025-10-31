/**
 * Pre-Flight Validation Checks
 *
 * This module implements comprehensive environment validation before workflow generation.
 * Pre-flight checks prevent common failures by validating:
 * - PipeCraft configuration exists and is valid
 * - Git repository is properly initialized
 * - Git remote is configured
 * - Workflow directories are writable
 * - Node.js version meets minimum requirements
 *
 * All checks return structured results with actionable error messages and suggestions.
 * This provides a better user experience by catching issues early with clear guidance
 * on how to resolve them.
 *
 * @module utils/preflight
 */

import { execSync } from 'child_process'
import { cosmiconfigSync } from 'cosmiconfig'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Result of a single pre-flight check.
 *
 * Contains pass/fail status, descriptive message, and optional suggestion
 * for resolving failures.
 */
export interface PreflightResult {
  /** Whether the check passed */
  passed: boolean

  /** Human-readable description of the check result */
  message: string

  /** Optional suggestion for resolving failures */
  suggestion?: string
}

/**
 * Collection of all pre-flight check results.
 *
 * Each field represents a specific environment check that must pass
 * before workflows can be generated.
 */
export interface PreflightChecks {
  /** Configuration file exists and is discoverable */
  configExists: PreflightResult

  /** Configuration file is valid and has required fields */
  configValid: PreflightResult

  /** Current directory is a git repository */
  inGitRepo: PreflightResult

  /** Git remote (origin) is configured */
  hasGitRemote: PreflightResult

  /** .github/workflows directory is writable */
  canWriteGithubDir: PreflightResult
}

/**
 * Check if PipeCraft configuration file exists.
 *
 * Uses cosmiconfig to search for configuration files in standard locations:
 * - .pipecraftrc (YAML or JSON, recommended)
 * - .pipecraftrc.json (legacy, still supported)
 * - pipecraft.config.js
 * - package.json (pipecraft key)
 *
 * Searches current directory and all parent directories.
 *
 * @returns Check result with pass/fail status and file location if found
 *
 * @example
 * ```typescript
 * const result = checkConfigExists()
 * if (!result.passed) {
 *   console.error(result.message)
 *   console.log(result.suggestion) // "Run 'pipecraft init' to create..."
 * }
 * ```
 */
export function checkConfigExists(): PreflightResult {
  const explorer = cosmiconfigSync('pipecraft')
  const result = explorer.search()

  if (!result) {
    return {
      passed: false,
      message: 'No PipeCraft configuration found',
      suggestion: "Run 'pipecraft init' to create a configuration file"
    }
  }

  return {
    passed: true,
    message: `Configuration found: ${result.filepath}`
  }
}

/**
 * Check if configuration file is valid and contains required fields.
 *
 * Validates:
 * - File can be parsed (valid JSON/YAML)
 * - Required fields are present (ciProvider, branchFlow, domains)
 * - At least one domain is configured
 *
 * @returns Check result with validation status and specific error if invalid
 *
 * @example
 * ```typescript
 * const result = checkConfigValid()
 * if (!result.passed) {
 *   if (result.message.includes('missing required fields')) {
 *     // Config exists but incomplete
 *   } else if (result.message.includes('Invalid JSON')) {
 *     // Syntax error in config file
 *   }
 * }
 * ```
 */
export function checkConfigValid(): PreflightResult {
  const explorer = cosmiconfigSync('pipecraft')
  const result = explorer.search()

  if (!result) {
    return {
      passed: false,
      message: 'No configuration file found',
      suggestion: "Run 'pipecraft init' first"
    }
  }

  try {
    const config = result.config

    // Check for required fields
    const requiredFields = ['ciProvider', 'branchFlow', 'domains']
    const missingFields = requiredFields.filter(field => !(field in config))

    if (missingFields.length > 0) {
      return {
        passed: false,
        message: `Config is missing required fields: ${missingFields.join(', ')}`,
        suggestion: "Run 'pipecraft init --force' to recreate config"
      }
    }

    // Check domains is not empty
    if (!config.domains || Object.keys(config.domains).length === 0) {
      return {
        passed: false,
        message: 'Config has no domains configured',
        suggestion: 'Add at least one domain to your config file'
      }
    }

    return {
      passed: true,
      message: 'Configuration is valid'
    }
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return {
        passed: false,
        message: `Invalid JSON in config file: ${error.message}`,
        suggestion: 'Fix JSON syntax in your config file'
      }
    }

    return {
      passed: false,
      message: `Error reading config: ${error.message}`,
      suggestion: 'Check file permissions for your config file'
    }
  }
}

/**
 * Check if current directory is inside a git repository.
 *
 * PipeCraft requires a git repository to:
 * - Generate GitHub Actions workflows
 * - Track version history
 * - Enable version management features
 *
 * Uses `git rev-parse --is-inside-work-tree` to detect git repository.
 * Suppresses stderr to avoid noise when git is not initialized.
 *
 * @returns Check result indicating if directory is in a git repository
 *
 * @example
 * ```typescript
 * const result = checkInGitRepo()
 * if (!result.passed) {
 *   console.log('Please initialize git first')
 *   execSync('git init')
 * }
 * ```
 */
export function checkInGitRepo(): PreflightResult {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr to avoid "not a git repository" errors
      encoding: 'utf8'
    })

    return {
      passed: true,
      message: 'Current directory is a git repository'
    }
  } catch (error) {
    return {
      passed: false,
      message: 'Not in a git repository',
      suggestion: "Initialize git: 'git init' or clone an existing repository"
    }
  }
}

/**
 * Check if git remote named 'origin' is configured.
 *
 * A git remote is required for:
 * - Pushing generated workflows to GitHub
 * - Repository information extraction
 * - GitHub API integration
 *
 * Checks specifically for the 'origin' remote, which is the standard
 * default remote name. Also detects if the remote is GitHub vs. GitLab
 * and provides appropriate messaging.
 *
 * @returns Check result with remote URL if configured
 *
 * @example
 * ```typescript
 * const result = checkHasGitRemote()
 * if (!result.passed) {
 *   console.log('No git remote found')
 *   execSync('git remote add origin https://github.com/user/repo.git')
 * } else if (result.suggestion) {
 *   // GitLab detected - show warning about experimental support
 *   console.warn(result.suggestion)
 * }
 * ```
 */
export function checkHasGitRemote(): PreflightResult {
  try {
    const remote = execSync('git remote get-url origin', {
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
      encoding: 'utf8'
    }).trim()

    if (!remote) {
      return {
        passed: false,
        message: 'No git remote configured',
        suggestion: "Add remote: 'git remote add origin <url>'"
      }
    }

    // Check if it's a GitHub remote
    const isGitHub = remote.includes('github.com')

    return {
      passed: true,
      message: `Git remote configured: ${remote}`,
      suggestion: !isGitHub
        ? 'Note: PipeCraft is optimized for GitHub. GitLab support is experimental.'
        : undefined
    }
  } catch (error) {
    return {
      passed: false,
      message: 'No git remote named "origin"',
      suggestion: "Add remote: 'git remote add origin <url>'"
    }
  }
}

/**
 * Check if .github/workflows directory exists and is writable.
 *
 * Workflows are written to .github/workflows/, so this directory must:
 * - Exist or be creatable
 * - Be writable by the current user
 *
 * This check attempts to:
 * 1. Create .github/workflows/ if it doesn't exist
 * 2. Write a test file to verify write permissions
 * 3. Clean up the test file
 *
 * @returns Check result indicating if directory is writable
 *
 * @example
 * ```typescript
 * const result = checkCanWriteGithubDir()
 * if (!result.passed) {
 *   if (result.message.includes('permission')) {
 *     // Fix permissions
 *     execSync('chmod +w .github/workflows/')
 *   }
 * }
 * ```
 */
export function checkCanWriteGithubDir(): PreflightResult {
  const githubDir = '.github'
  const workflowsDir = join(githubDir, 'workflows')

  try {
    if (!existsSync(githubDir)) {
      // Try to create it
      mkdirSync(githubDir, { recursive: true })
      mkdirSync(workflowsDir, { recursive: true })

      return {
        passed: true,
        message: 'Created .github/workflows directory'
      }
    }

    // Directory exists, check if writable
    if (existsSync(workflowsDir)) {
      // Try to write a test file
      const testFile = join(workflowsDir, '.pipecraft-test')
      writeFileSync(testFile, 'test')
      unlinkSync(testFile)

      return {
        passed: true,
        message: '.github/workflows directory is writable'
      }
    } else {
      mkdirSync(workflowsDir, { recursive: true })
      return {
        passed: true,
        message: 'Created .github/workflows directory'
      }
    }
  } catch (error: any) {
    return {
      passed: false,
      message: `Cannot write to .github directory: ${error.message}`,
      suggestion: 'Check directory permissions'
    }
  }
}

/**
 * Check if Node.js version meets minimum requirement.
 *
 * PipeCraft requires Node.js 18.0.0 or higher because it uses:
 * - Modern ES modules
 * - Latest TypeScript features
 * - Current GitHub Actions syntax
 *
 * Only checks major version for simplicity. Minor/patch versions
 * within the same major release are considered compatible.
 *
 * @param minVersion - Minimum required version (default: '18.0.0')
 * @returns Check result with current and minimum versions
 *
 * @example
 * ```typescript
 * const result = checkNodeVersion('18.0.0')
 * if (!result.passed) {
 *   console.error('Please upgrade Node.js')
 *   console.log('Current:', process.version)
 *   console.log('Required: >= 18.0.0')
 * }
 * ```
 */
export function checkNodeVersion(minVersion: string = '18.0.0'): PreflightResult {
  const currentVersion = process.version.slice(1) // Remove 'v' prefix

  const [currentMajor] = currentVersion.split('.').map(Number)
  const [minMajor] = minVersion.split('.').map(Number)

  if (currentMajor < minMajor) {
    return {
      passed: false,
      message: `Node.js ${currentVersion} is too old (minimum: ${minVersion})`,
      suggestion: 'Update Node.js: https://nodejs.org'
    }
  }

  return {
    passed: true,
    message: `Node.js ${currentVersion} (>= ${minVersion})`
  }
}

/**
 * Run all pre-flight checks for workflow generation.
 *
 * Executes comprehensive environment validation to ensure all prerequisites
 * are met before attempting to generate workflows. This prevents partial
 * failures and provides clear error messages upfront.
 *
 * Checks performed:
 * - Configuration file exists
 * - Configuration is valid
 * - Inside git repository
 * - Git remote configured
 * - Workflow directory writable
 *
 * Note: Node version check is optional and not included by default since
 * if Node is too old, the code wouldn't run at all.
 *
 * @returns Collection of all check results
 *
 * @example
 * ```typescript
 * const checks = runPreflightChecks()
 * const { allPassed, output } = formatPreflightResults(checks)
 *
 * if (!allPassed) {
 *   console.error('Pre-flight checks failed:')
 *   console.log(output)
 *   process.exit(1)
 * }
 *
 * // Proceed with workflow generation
 * await generateWorkflows()
 * ```
 */
export function runPreflightChecks(): PreflightChecks {
  return {
    configExists: checkConfigExists(),
    configValid: checkConfigValid(),
    inGitRepo: checkInGitRepo(),
    hasGitRemote: checkHasGitRemote(),
    canWriteGithubDir: checkCanWriteGithubDir()
  }
}

/**
 * Format pre-flight check results for human-readable display.
 *
 * Converts structured check results into formatted output with:
 * - ✅/❌ icons for visual scanning
 * - Error messages and suggestions
 * - Next steps if all checks passed
 * - Helpful guidance for getting started
 *
 * The output is designed to be printed directly to the console.
 *
 * @param checks - Collection of check results from runPreflightChecks()
 * @returns Formatted output object with overall status and display string
 *
 * @example
 * ```typescript
 * const checks = runPreflightChecks()
 * const { allPassed, output, nextSteps } = formatPreflightResults(checks)
 *
 * console.log(output)
 *
 * if (allPassed && nextSteps) {
 *   console.log('\n' + nextSteps.join('\n'))
 * } else {
 *   console.error('\n⚠ Fix the above issues and try again')
 *   process.exit(1)
 * }
 * ```
 */
export function formatPreflightResults(checks: PreflightChecks): {
  allPassed: boolean
  output: string
  nextSteps?: string[]
} {
  const results: string[] = []
  let allPassed = true

  for (const [key, result] of Object.entries(checks)) {
    const icon = result.passed ? '✅' : '❌'
    results.push(`${icon} ${result.message}`)

    if (!result.passed) {
      allPassed = false
      if (result.suggestion) {
        results.push(`   💡 ${result.suggestion}`)
      }
    }
  }

  // Provide next steps if all checks passed
  const nextSteps: string[] | undefined = allPassed
    ? [
        'Your environment is ready to generate workflows!',
        '',
        '📋 Next steps:',
        '',
        '1. Review and customize the generated workflows:',
        '   - Add test commands to test-* jobs',
        '   - Add deployment logic to deploy-* jobs (if deployable: true)',
        '   - Add remote tests to remote-test-* jobs (if remoteTestable: true)',
        '',
        '2. Validate the workflow syntax:',
        '   npm run validate:pipeline        # Check YAML is valid',
        '',
        '3. Configure GitHub permissions for auto-merge:',
        '   pipecraft setup-github           # Interactive setup',
        '   pipecraft setup-github --apply   # Auto-apply (no prompts)',
        '',
        '4. Commit and push:',
        '   git add .github/workflows/ .pipecraftrc',
        '   git commit -m "feat: add pipecraft workflows"',
        '   git push',
        '',
        '5. Watch your first pipeline run at:',
        `   https://github.com/${getRepoInfo()}/actions`,
        '',
        '⚠️  Important: Set up GitHub permissions (step 3) BEFORE pushing to ensure workflows run correctly!'
      ]
    : undefined

  return {
    allPassed,
    output: results.join('\n'),
    nextSteps
  }
}

/**
 * Get current git branch name.
 *
 * Uses `git branch --show-current` to get the active branch.
 * Falls back to 'main' if:
 * - Not in a git repository
 * - In detached HEAD state
 * - Git command fails
 *
 * @returns Current branch name or 'main' as fallback
 * @private
 */
function getCurrentBranch(): string {
  try {
    const branch = execSync('git branch --show-current', {
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
      encoding: 'utf8'
    }).trim()
    return branch || 'main'
  } catch (error) {
    return 'main'
  }
}

/**
 * Get repository information for GitHub Actions URL.
 *
 * Extracts owner and repository name from git remote URL.
 * Falls back to placeholder if not a GitHub repository.
 *
 * @returns Repository info in format "owner/repo" or placeholder
 * @private
 */
function getRepoInfo(): string {
  try {
    const remote = execSync('git remote get-url origin', {
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
      encoding: 'utf8'
    }).trim()

    // Extract owner/repo from GitHub URL
    const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (match) {
      return `${match[1]}/${match[2]}`
    }

    return 'your-username/your-repo'
  } catch (error) {
    return 'your-username/your-repo'
  }
}
