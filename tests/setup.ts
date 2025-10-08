import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

// Test utilities
export const TEST_DIR = join(process.cwd(), 'test-temp')
export const FIXTURES_DIR = join(__dirname, '__fixtures__')

// Setup test environment
beforeAll(() => {
  // Create test directory
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
  mkdirSync(TEST_DIR, { recursive: true })
})

afterAll(() => {
  // Clean up test directory
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
})

beforeEach(() => {
  // Reset test environment before each test
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
