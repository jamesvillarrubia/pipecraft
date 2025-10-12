import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

// Test utilities
export const TEST_DIR = join(process.cwd(), 'test-temp')
export const FIXTURES_DIR = join(__dirname, 'fixtures')

// Setup test environment
beforeAll(() => {
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
  // Don't delete TEST_DIR as other test files may still need it
  // The directory will be cleaned up at the start of the next test run by beforeAll
})

beforeEach(() => {
  // Reset test environment before each test
  // Ensure TEST_DIR exists before trying to chdir
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true })
  }
  process.chdir(TEST_DIR)
})

afterEach(() => {
  // Clean up after each test
  if (existsSync(join(TEST_DIR, '.flowcraft-cache.json'))) {
    rmSync(join(TEST_DIR, '.flowcraft-cache.json'))
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
