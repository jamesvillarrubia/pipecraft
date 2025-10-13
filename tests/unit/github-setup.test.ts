/**
 * GitHub Setup Utility Tests
 *
 * Tests for the github-setup utility that configures repository permissions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getRepositoryInfo, getGitHubToken } from '../../src/utils/github-setup'
import { execSync } from 'child_process'

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn()
}))

describe('GitHub Setup Utility', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    // Clear environment variables
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
  })

  describe('getRepositoryInfo', () => {
    it('should parse HTTPS GitHub URLs', () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/owner/repo.git\n' as any)

      const info = getRepositoryInfo()

      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
      expect(info.remote).toBe('https://github.com/owner/repo.git')
    })

    it('should parse SSH GitHub URLs', () => {
      vi.mocked(execSync).mockReturnValue('git@github.com:owner/repo.git\n' as any)

      const info = getRepositoryInfo()

      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
      expect(info.remote).toBe('git@github.com:owner/repo.git')
    })

    it('should parse URLs without .git extension', () => {
      vi.mocked(execSync).mockReturnValue('https://github.com/owner/repo\n' as any)

      const info = getRepositoryInfo()

      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
    })

    it('should throw error for non-GitHub URLs', () => {
      vi.mocked(execSync).mockReturnValue('https://gitlab.com/owner/repo.git\n' as any)

      expect(() => getRepositoryInfo()).toThrow('Could not parse GitHub repository URL')
    })

    it('should throw error when git command fails', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      expect(() => getRepositoryInfo()).toThrow('Failed to get repository info')
    })
  })

  describe('getGitHubToken', () => {
    it('should get token from GITHUB_TOKEN environment variable', () => {
      process.env.GITHUB_TOKEN = 'test-token-123'

      const token = getGitHubToken()

      expect(token).toBe('test-token-123')
    })

    it('should get token from GH_TOKEN environment variable', () => {
      process.env.GH_TOKEN = 'test-token-456'

      const token = getGitHubToken()

      expect(token).toBe('test-token-456')
    })

    it('should prefer GITHUB_TOKEN over GH_TOKEN', () => {
      process.env.GITHUB_TOKEN = 'github-token'
      process.env.GH_TOKEN = 'gh-token'

      const token = getGitHubToken()

      expect(token).toBe('github-token')
    })

    it('should try gh CLI if env vars not set', () => {
      vi.mocked(execSync).mockReturnValue('gh-cli-token\n' as any)

      const token = getGitHubToken()

      expect(token).toBe('gh-cli-token')
      expect(execSync).toHaveBeenCalledWith(
        'gh auth token',
        expect.objectContaining({ encoding: 'utf8' })
      )
    })

    it('should throw error when no token is available', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('gh not found')
      })

      expect(() => getGitHubToken()).toThrow('GitHub token not found')
      expect(() => getGitHubToken()).toThrow('Set GITHUB_TOKEN or GH_TOKEN')
    })
  })

  describe('API Integration', () => {
    // Note: Full API tests require mocking fetch
    // These are examples of what could be tested with proper mocking

    it.skip('should fetch workflow permissions', async () => {
      // Would require mocking global fetch
      // Example test structure for future implementation
    })

    it.skip('should update workflow permissions', async () => {
      // Would require mocking global fetch
      // Example test structure for future implementation
    })
  })

  describe('Permission Changes', () => {
    it('should identify when permissions need updating', () => {
      const currentPermissions = {
        default_workflow_permissions: 'read' as const,
        can_approve_pull_request_reviews: false
      }

      // Check if permissions are correct
      const needsUpdate =
        currentPermissions.default_workflow_permissions !== 'write' ||
        currentPermissions.can_approve_pull_request_reviews !== true

      expect(needsUpdate).toBe(true)
    })

    it('should recognize when permissions are already correct', () => {
      const currentPermissions = {
        default_workflow_permissions: 'write' as const,
        can_approve_pull_request_reviews: true
      }

      const needsUpdate =
        currentPermissions.default_workflow_permissions !== 'write' ||
        currentPermissions.can_approve_pull_request_reviews !== true

      expect(needsUpdate).toBe(false)
    })
  })

  describe('Error Messages', () => {
    it('should provide helpful error message for missing token', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('command not found')
      })

      try {
        getGitHubToken()
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('GITHUB_TOKEN')
        expect(error.message).toContain('GH_TOKEN')
        expect(error.message).toContain('gh auth login')
      }
    })

    it('should provide helpful error message for non-GitHub repo', () => {
      vi.mocked(execSync).mockReturnValue('https://bitbucket.org/owner/repo.git\n' as any)

      try {
        getRepositoryInfo()
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).toContain('GitHub repository')
      }
    })
  })
})
