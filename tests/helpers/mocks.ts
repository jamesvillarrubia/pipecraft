/**
 * Test Mocking Helpers
 *
 * Provides utilities for mocking common dependencies in tests.
 * Includes mocks for file system operations, git commands, and external APIs.
 *
 * @module tests/helpers/mocks
 */

import { vi } from 'vitest'

/**
 * Mock execSync to return predefined outputs.
 *
 * Useful for mocking git commands without requiring a real repository.
 *
 * @param commandMap - Map of commands to their outputs
 * @returns Mock function
 *
 * @example
 * ```typescript
 * const mockExec = mockExecSync({
 *   'git describe --tags': 'v1.2.3',
 *   'git log': 'feat: new feature'
 * })
 *
 * // Use in test
 * expect(mockExec).toHaveBeenCalledWith('git describe --tags', expect.any(Object))
 * ```
 */
export function mockExecSync(commandMap: Record<string, string | Buffer>) {
  return vi.fn((command: string) => {
    // Normalize command (remove extra whitespace)
    const normalizedCommand = command.trim().replace(/\s+/g, ' ')

    // Check for exact match
    if (commandMap[normalizedCommand]) {
      return commandMap[normalizedCommand]
    }

    // Check for partial match (command starts with key)
    for (const [key, value] of Object.entries(commandMap)) {
      if (normalizedCommand.startsWith(key)) {
        return value
      }
    }

    // Throw error for unmocked command
    throw new Error(`Unmocked command: ${command}`)
  })
}

/**
 * Mock logger to suppress output during tests.
 *
 * Returns a mock logger that doesn't print anything but tracks calls.
 *
 * @returns Mock logger object
 *
 * @example
 * ```typescript
 * const logger = mockLogger()
 * logger.info('test message')
 * expect(logger.info).toHaveBeenCalledWith('test message')
 * ```
 */
export function mockLogger() {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn(),
    getLevel: vi.fn(() => 'info')
  }
}

/**
 * Mock git repository for tests.
 *
 * Creates a set of mock git command responses that simulate a real repository.
 *
 * @param options - Configuration options
 * @returns Map of git commands to outputs
 *
 * @example
 * ```typescript
 * const gitMock = mockGitRepository({
 *   currentBranch: 'develop',
 *   hasRemote: true,
 *   latestTag: 'v1.0.0'
 * })
 *
 * const mockExec = mockExecSync(gitMock)
 * ```
 */
export function mockGitRepository(options: {
  currentBranch?: string
  hasRemote?: boolean
  remoteUrl?: string
  latestTag?: string
  hasCommits?: boolean
  commitMessages?: string[]
} = {}): Record<string, string> {
  const {
    currentBranch = 'main',
    hasRemote = true,
    remoteUrl = 'https://github.com/test/repo.git',
    latestTag = 'v0.1.0',
    hasCommits = true,
    commitMessages = ['feat: initial commit']
  } = options

  const commands: Record<string, string> = {
    'git rev-parse --abbrev-ref HEAD': currentBranch,
    'git symbolic-ref --short HEAD': currentBranch,
    'git branch --show-current': currentBranch,
    'git rev-parse --is-inside-work-tree': 'true'
  }

  if (hasRemote) {
    commands['git remote get-url origin'] = remoteUrl
    commands['git config --get remote.origin.url'] = remoteUrl
  } else {
    commands['git remote get-url origin'] = ''
    commands['git config --get remote.origin.url'] = ''
  }

  if (hasCommits) {
    commands['git describe --tags --abbrev=0'] = latestTag
    commands['git describe --tags'] = `${latestTag}-1-g1234567`
    commands['git log'] = commitMessages.join('\n')
    commands['git log --format=%B -n 1'] = commitMessages[0]
  }

  return commands
}

/**
 * Mock file system operations.
 *
 * Creates mock implementations of common fs functions for testing
 * without touching the real file system.
 *
 * @param fileContents - Map of file paths to their contents
 * @returns Mock fs module
 *
 * @example
 * ```typescript
 * const mockFs = mockFileSystem({
 *   '/path/to/config.json': JSON.stringify({ key: 'value' }),
 *   '/path/to/file.txt': 'content'
 * })
 *
 * expect(mockFs.existsSync('/path/to/config.json')).toBe(true)
 * expect(mockFs.readFileSync('/path/to/config.json', 'utf-8')).toContain('key')
 * ```
 */
export function mockFileSystem(fileContents: Record<string, string> = {}) {
  const files = new Map(Object.entries(fileContents))

  return {
    existsSync: vi.fn((path: string) => files.has(path)),
    readFileSync: vi.fn((path: string, encoding?: string) => {
      if (!files.has(path)) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`)
      }
      return files.get(path)!
    }),
    writeFileSync: vi.fn((path: string, content: string) => {
      files.set(path, content)
    }),
    mkdirSync: vi.fn(),
    rmSync: vi.fn((path: string) => {
      files.delete(path)
    }),
    readdirSync: vi.fn((path: string) => {
      const pathPrefix = path.endsWith('/') ? path : `${path}/`
      return Array.from(files.keys())
        .filter(key => key.startsWith(pathPrefix))
        .map(key => key.replace(pathPrefix, '').split('/')[0])
    })
  }
}

/**
 * Mock GitHub API client.
 *
 * Creates a mock implementation of GitHub API calls for testing
 * setup and permission configuration.
 *
 * @param responses - Map of API endpoints to their responses
 * @returns Mock API client
 *
 * @example
 * ```typescript
 * const mockGitHub = mockGitHubAPI({
 *   '/repos/owner/repo': { permissions: { admin: true } },
 *   '/repos/owner/repo/actions/permissions': { enabled: true }
 * })
 *
 * const result = await mockGitHub.get('/repos/owner/repo')
 * expect(result.permissions.admin).toBe(true)
 * ```
 */
export function mockGitHubAPI(responses: Record<string, any> = {}) {
  return {
    get: vi.fn(async (url: string) => {
      if (responses[url]) {
        return { data: responses[url] }
      }
      throw new Error(`API endpoint not mocked: ${url}`)
    }),
    post: vi.fn(async (url: string, data?: any) => {
      if (responses[url]) {
        return { data: responses[url] }
      }
      return { data: { success: true } }
    }),
    put: vi.fn(async (url: string, data?: any) => {
      if (responses[url]) {
        return { data: responses[url] }
      }
      return { data: { success: true } }
    }),
    patch: vi.fn(async (url: string, data?: any) => {
      if (responses[url]) {
        return { data: responses[url] }
      }
      return { data: { success: true } }
    })
  }
}

/**
 * Mock process.env for tests.
 *
 * Safely mocks environment variables without affecting other tests.
 * Automatically restores original values.
 *
 * @param env - Environment variables to set
 * @returns Restore function to call in afterEach
 *
 * @example
 * ```typescript
 * describe('My Test', () => {
 *   let restoreEnv: () => void
 *
 *   beforeEach(() => {
 *     restoreEnv = mockEnv({
 *       GITHUB_TOKEN: 'test-token',
 *       NODE_ENV: 'test'
 *     })
 *   })
 *
 *   afterEach(() => {
 *     restoreEnv()
 *   })
 * })
 * ```
 */
export function mockEnv(env: Record<string, string>): () => void {
  const originalEnv = { ...process.env }

  // Set new env vars
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value
  })

  // Return restore function
  return () => {
    // Restore original env
    process.env = originalEnv
  }
}

/**
 * Create a spy for console methods.
 *
 * Useful for testing code that logs to console.
 *
 * @param method - Console method to spy on ('log', 'error', 'warn', 'info')
 * @returns Spy function that can be restored
 *
 * @example
 * ```typescript
 * describe('My Test', () => {
 *   let consoleSpy: any
 *
 *   beforeEach(() => {
 *     consoleSpy = spyOnConsole('error')
 *   })
 *
 *   afterEach(() => {
 *     consoleSpy.mockRestore()
 *   })
 *
 *   it('should log error', () => {
 *     myFunction()
 *     expect(consoleSpy).toHaveBeenCalledWith('Error message')
 *   })
 * })
 * ```
 */
export function spyOnConsole(method: 'log' | 'error' | 'warn' | 'info' = 'log') {
  return vi.spyOn(console, method).mockImplementation(() => {})
}

