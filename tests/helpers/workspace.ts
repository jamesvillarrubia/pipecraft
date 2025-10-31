/**
 * Test Workspace Management Helpers
 *
 * Provides utilities for creating and managing isolated test workspaces.
 * Each test gets its own temporary directory to avoid race conditions
 * and interference between parallel tests.
 *
 * @module tests/helpers/workspace
 */

import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Create a unique isolated workspace for a test.
 *
 * Generates a unique temporary directory that won't conflict with other tests
 * running in parallel. The directory is guaranteed to be empty and writable.
 *
 * @param prefix - Optional prefix for the directory name (default: 'pipecraft-test')
 * @returns Absolute path to the created workspace directory
 *
 * @example
 * ```typescript
 * import { createTestWorkspace, cleanupTestWorkspace } from '../helpers/workspace'
 *
 * describe('My Test', () => {
 *   let workspace: string
 *
 *   beforeEach(() => {
 *     workspace = createTestWorkspace('my-test')
 *   })
 *
 *   afterEach(() => {
 *     cleanupTestWorkspace(workspace)
 *   })
 *
 *   it('should do something', () => {
 *     // Use workspace directory
 *     const configPath = join(workspace, '.pipecraftrc.json')
 *     writeFileSync(configPath, JSON.stringify(config))
 *   })
 * })
 * ```
 */
export function createTestWorkspace(prefix: string = 'pipecraft-test'): string {
  // Create unique directory using timestamp and random string
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  const workspacePath = join(tmpdir(), `${prefix}-${uniqueId}`)

  // Create the directory
  mkdirSync(workspacePath, { recursive: true })

  return workspacePath
}

/**
 * Clean up a test workspace directory.
 *
 * Recursively removes the workspace directory and all its contents.
 * Safe to call even if the directory doesn't exist.
 *
 * @param workspacePath - Path to the workspace directory to clean up
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   cleanupTestWorkspace(workspace)
 * })
 * ```
 */
export function cleanupTestWorkspace(workspacePath: string): void {
  if (existsSync(workspacePath)) {
    try {
      rmSync(workspacePath, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors - they're not critical
      console.warn(`Warning: Failed to cleanup workspace ${workspacePath}:`, error)
    }
  }
}

/**
 * Create a test workspace with common PipeCraft structure.
 *
 * Creates a workspace with typical directories and files that PipeCraft expects:
 * - .git directory (for git repository detection)
 * - .github/workflows directory (for workflow output)
 * - Optional .pipecraftrc.json if config provided
 *
 * @param prefix - Optional prefix for the directory name
 * @param options - Configuration options
 * @param options.initGit - Create .git directory (default: true)
 * @param options.config - Optional PipeCraft config to write
 * @returns Absolute path to the created workspace directory
 *
 * @example
 * ```typescript
 * const workspace = createPipecraftWorkspace('test', {
 *   initGit: true,
 *   config: {
 *     ciProvider: 'github',
 *     branchFlow: ['develop', 'main'],
 *     // ... other config
 *   }
 * })
 * ```
 */
export function createPipecraftWorkspace(
  prefix: string = 'pipecraft-test',
  options: {
    initGit?: boolean
    config?: any
  } = {}
): string {
  const { initGit = true, config } = options
  const workspace = createTestWorkspace(prefix)

  // Create .git directory for git detection
  if (initGit) {
    const gitDir = join(workspace, '.git')
    mkdirSync(gitDir, { recursive: true })
    // Create minimal git config so git commands work
    writeFileSync(join(gitDir, 'config'), '[core]\n\trepositoryformatversion = 0\n')
  }

  // Create .github/workflows directory
  const workflowsDir = join(workspace, '.github', 'workflows')
  mkdirSync(workflowsDir, { recursive: true })

  // Write config if provided
  if (config) {
    const configPath = join(workspace, '.pipecraftrc.json')
    writeFileSync(configPath, JSON.stringify(config, null, 2))
  }

  return workspace
}

/**
 * Execute a function in the context of a test workspace.
 *
 * Changes to the workspace directory, executes the function, then restores
 * the original directory. Ensures cleanup happens even if the function throws.
 *
 * @param workspacePath - Path to the workspace directory
 * @param fn - Function to execute in the workspace context
 * @returns The return value of the function
 *
 * @example
 * ```typescript
 * const workspace = createTestWorkspace()
 * try {
 *   const result = await inWorkspace(workspace, async () => {
 *     // This code runs with workspace as cwd
 *     const config = loadConfig()
 *     return config
 *   })
 *   expect(result).toBeDefined()
 * } finally {
 *   cleanupTestWorkspace(workspace)
 * }
 * ```
 */
export async function inWorkspace<T>(
  workspacePath: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const originalCwd = process.cwd()
  try {
    process.chdir(workspacePath)
    return await fn()
  } finally {
    // Restore original directory even if function throws
    if (existsSync(originalCwd)) {
      process.chdir(originalCwd)
    } else {
      // Fallback if original directory was deleted
      process.chdir(tmpdir())
    }
  }
}

/**
 * Create a test workspace and automatically clean it up.
 *
 * Returns a tuple of [workspace path, cleanup function].
 * The cleanup function can be called manually or in afterEach.
 *
 * @param prefix - Optional prefix for the directory name
 * @returns Tuple of [workspace path, cleanup function]
 *
 * @example
 * ```typescript
 * describe('My Test', () => {
 *   let workspace: string
 *   let cleanup: () => void
 *
 *   beforeEach(() => {
 *     [workspace, cleanup] = createWorkspaceWithCleanup('my-test')
 *   })
 *
 *   afterEach(() => {
 *     cleanup()
 *   })
 * })
 * ```
 */
export function createWorkspaceWithCleanup(
  prefix: string = 'pipecraft-test'
): [string, () => void] {
  const workspace = createTestWorkspace(prefix)
  const cleanup = () => cleanupTestWorkspace(workspace)
  return [workspace, cleanup]
}

/**
 * Activate a git repository by renaming .git.stored back to .git.
 * Used for example test repos that are tracked in the parent repo.
 *
 * @param repoPath - Path to the repository directory
 * @param remoteUrl - Optional remote URL to ensure is set
 * @throws Error if .git.stored doesn't exist
 */
export function activateGitRepo(repoPath: string, remoteUrl?: string): void {
  const storedGitPath = join(repoPath, '.git.stored')
  const activeGitPath = join(repoPath, '.git')

  if (!existsSync(storedGitPath)) {
    throw new Error(`Cannot activate git repo: .git.stored not found at ${repoPath}`)
  }

  // Remove active .git if it exists (shouldn't normally)
  if (existsSync(activeGitPath)) {
    rmSync(activeGitPath, { recursive: true, force: true })
  }

  // Rename .git.stored to .git
  const { renameSync } = require('fs')
  renameSync(storedGitPath, activeGitPath)

  // Ensure remote is set if provided
  if (remoteUrl) {
    const { execSync } = require('child_process')
    try {
      execSync(`git remote remove origin`, { cwd: repoPath, stdio: 'pipe' })
    } catch {
      // Remote might not exist, that's fine
    }
    execSync(`git remote add origin ${remoteUrl}`, { cwd: repoPath, stdio: 'pipe' })
  }
}

/**
 * Deactivate a git repository by renaming .git back to .git.stored.
 * Used to return example repos to their tracked state after tests.
 *
 * @param repoPath - Path to the repository directory
 * @param resetWorkingTree - If true, reset any uncommitted changes (default: true)
 */
export function deactivateGitRepo(repoPath: string, resetWorkingTree: boolean = true): void {
  const activeGitPath = join(repoPath, '.git')
  const storedGitPath = join(repoPath, '.git.stored')

  if (!existsSync(activeGitPath)) {
    // Already deactivated or never activated
    return
  }

  // Reset working tree to clean state if requested
  if (resetWorkingTree) {
    try {
      const { execSync } = require('child_process')
      // Reset to HEAD, discard all changes
      execSync('git reset --hard HEAD', { cwd: repoPath, stdio: 'pipe' })
      execSync('git clean -fd', { cwd: repoPath, stdio: 'pipe' })
    } catch (error) {
      // Ignore errors - repo might not have commits yet
    }
  }

  // Rename .git back to .git.stored
  if (existsSync(storedGitPath)) {
    rmSync(storedGitPath, { recursive: true, force: true })
  }
  const { renameSync } = require('fs')
  renameSync(activeGitPath, storedGitPath)
}

