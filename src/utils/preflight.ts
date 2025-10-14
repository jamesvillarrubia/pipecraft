/**
 * Pre-flight checks for PipeCraft commands
 * Validates environment and prerequisites before executing commands
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { cosmiconfigSync } from 'cosmiconfig'

export interface PreflightResult {
  passed: boolean
  message: string
  suggestion?: string
}

export interface PreflightChecks {
  configExists: PreflightResult
  configValid: PreflightResult
  inGitRepo: PreflightResult
  hasGitRemote: PreflightResult
  canWriteGithubDir: PreflightResult
}

/**
 * Check if config file exists using cosmiconfig
 * Searches for .pipecraftrc.json, .pipecraftrc, or package.json pipecraft key
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
 * Check if config file is valid and has required fields
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
        suggestion: "Add at least one domain to your config file"
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
 * Check if current directory is a git repository
 */
export function checkInGitRepo(): PreflightResult {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'pipe',
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
 * Check if git remote is configured
 */
export function checkHasGitRemote(): PreflightResult {
  try {
    const remote = execSync('git remote get-url origin', {
      stdio: 'pipe',
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
 * Check if .github directory is writable
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
 * Check Node.js version
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
 * Run all pre-flight checks for generate command
 * Note: No longer needs configPath - uses cosmiconfig to search automatically
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
 * Format preflight results for display
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
  const nextSteps: string[] | undefined = allPassed ? [
    'Your environment is ready to generate workflows!',
    '',
    'Next steps:',
    '  1. Validate the pipeline: pipecraft validate:pipeline',
    '  2. Set up GitHub tokens: pipecraft setup-github --verify',
    '  3. Commit the generated workflows: git add .github && git commit -m "chore: add workflows"',
    '  4. Push to remote: git push origin ' + getCurrentBranch(),
    '',
    '⚠️  Important: Set up GitHub tokens (step 2) BEFORE pushing to ensure workflows run correctly!'
  ] : undefined

  return {
    allPassed,
    output: results.join('\n'),
    nextSteps
  }
}

/**
 * Get current git branch name
 */
function getCurrentBranch(): string {
  try {
    const branch = execSync('git branch --show-current', {
      stdio: 'pipe',
      encoding: 'utf8'
    }).trim()
    return branch || 'main'
  } catch (error) {
    return 'main'
  }
}
