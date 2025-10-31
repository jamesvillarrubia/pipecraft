import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { activateGitRepo, deactivateGitRepo } from './helpers/workspace.js'

// Test utilities
export const TEST_DIR = join(process.cwd(), 'test-temp')
export const FIXTURES_DIR = join(__dirname, 'fixtures')

// Setup test environment
beforeAll(() => {
  // Activate example git repos for testing
  const examplesRoot = join(process.cwd(), 'examples')
  const exampleRepos = [
    'pipecraft-example-basic',
    'pipecraft-example-gated',
    'pipecraft-example-minimal'
  ]

  for (const repo of exampleRepos) {
    const repoPath = join(examplesRoot, repo)
    if (existsSync(join(repoPath, '.git.stored'))) {
      try {
        activateGitRepo(repoPath)
      } catch (error) {
        // Repo might not have .git.stored yet, that's okay
      }
    }
  }

  // Create test directory
  if (existsSync(TEST_DIR)) {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true })
    } catch (error) {
      // If directory is not empty, try to remove contents first
      if (error.code === 'ENOTEMPTY') {
        rmSync(TEST_DIR, { recursive: true, force: true, maxRetries: 3 })
      }
    }
  }
  mkdirSync(TEST_DIR, { recursive: true })
})

afterAll(() => {
  // Deactivate example git repos after all tests complete
  const examplesRoot = join(process.cwd(), 'examples')
  const exampleRepos = [
    'pipecraft-example-basic',
    'pipecraft-example-gated',
    'pipecraft-example-minimal'
  ]

  for (const repo of exampleRepos) {
    const repoPath = join(examplesRoot, repo)
    if (existsSync(join(repoPath, '.git'))) {
      try {
        deactivateGitRepo(repoPath)
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }

  // Don't delete TEST_DIR as other test files may still need it
  // The directory will be cleaned up at the start of the next test run by beforeAll
})

beforeEach(() => {
  // Reset test environment before each test
  // Ensure TEST_DIR exists but DON'T chdir to it globally
  // Individual tests should manage their own working directories
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true })
  }
})

afterEach(() => {
  // Clean up after each test
  if (existsSync(join(TEST_DIR, '.pipecraft-cache.json'))) {
    rmSync(join(TEST_DIR, '.pipecraft-cache.json'))
  }
})

// Mock console methods to avoid noise in tests
const originalConsole = { ...console }
beforeEach(() => {
  console.log = vi.fn()
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  Object.assign(console, originalConsole)
})
