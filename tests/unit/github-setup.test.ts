/**
 * Comprehensive GitHub Setup Tests
 *
 * Tests GitHub repository setup and configuration including:
 * - Repository information extraction
 * - GitHub token management
 * - Workflow permissions configuration
 * - API interactions with GitHub
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execSync } from 'child_process'
import {
  getRepositoryInfo,
  getGitHubToken,
  getWorkflowPermissions,
  updateWorkflowPermissions,
  getRequiredPermissionChanges,
  shouldEnableAutoMerge,
  getRecommendedRepositorySettings,
  getRepositorySettings,
  updateRepositorySettings,
  getSettingsGaps
} from '../../src/utils/github-setup.js'

// Mock child_process at module level
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    execSync: vi.fn()
  }
})

// Mock config loader
vi.mock('../../src/utils/config.js', () => ({
  loadConfig: vi.fn()
}))

const mockExecSync = execSync as unknown as ReturnType<typeof vi.fn>

// Mock global fetch
global.fetch = vi.fn()

// Import after mocking
import { loadConfig } from '../../src/utils/config.js'
const mockLoadConfig = loadConfig as unknown as ReturnType<typeof vi.fn>

describe('GitHub Setup', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }
    
    // Reset mocks
    mockExecSync.mockReset()
    vi.mocked(global.fetch).mockReset()
  })

  afterEach(() => {
    // Restore environment
    process.env = originalEnv
  })

  describe('getRepositoryInfo()', () => {
    it('should parse HTTPS GitHub URL', () => {
      mockExecSync.mockReturnValue('https://github.com/owner/repo.git\n')

      const info = getRepositoryInfo()
      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
      expect(info.remote).toBe('https://github.com/owner/repo.git')
    })

    it('should parse HTTPS GitHub URL without .git', () => {
      mockExecSync.mockReturnValue('https://github.com/owner/repo\n')

      const info = getRepositoryInfo()
      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
      expect(info.remote).toBe('https://github.com/owner/repo')
    })

    it('should parse SSH GitHub URL', () => {
      mockExecSync.mockReturnValue('git@github.com:owner/repo.git\n')

      const info = getRepositoryInfo()
      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
      expect(info.remote).toBe('git@github.com:owner/repo.git')
    })

    it('should parse SSH GitHub URL without .git', () => {
      mockExecSync.mockReturnValue('git@github.com:owner/repo\n')

      const info = getRepositoryInfo()
      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
    })

    it('should handle organization names with hyphens', () => {
      mockExecSync.mockReturnValue('https://github.com/my-org/my-repo.git\n')

      const info = getRepositoryInfo()
      expect(info.owner).toBe('my-org')
      expect(info.repo).toBe('my-repo')
    })

    it('should fail on repo names with dots (current limitation)', () => {
      mockExecSync.mockReturnValue('https://github.com/owner/repo.name.git\n')

      // Current regex doesn't support dots in repo names
      // Pattern [^/.] stops at first dot
      expect(() => getRepositoryInfo()).toThrow('Could not parse GitHub repository URL')
    })

    it('should throw when git remote fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository')
      })

      expect(() => getRepositoryInfo()).toThrow('Failed to get repository info')
    })

    it('should throw when URL is not GitHub', () => {
      mockExecSync.mockReturnValue('https://gitlab.com/owner/repo.git\n')

      expect(() => getRepositoryInfo()).toThrow('Could not parse GitHub repository URL')
    })

    it('should throw when URL format is invalid', () => {
      mockExecSync.mockReturnValue('invalid-url\n')

      expect(() => getRepositoryInfo()).toThrow('Could not parse GitHub repository URL')
    })
  })

  describe('getGitHubToken()', () => {
    it('should get token from GITHUB_TOKEN env var', () => {
      process.env.GITHUB_TOKEN = 'ghp_test_token_123'

      const token = getGitHubToken()
      expect(token).toBe('ghp_test_token_123')
    })

    it('should get token from GH_TOKEN env var', () => {
      process.env.GH_TOKEN = 'ghp_test_token_456'

      const token = getGitHubToken()
      expect(token).toBe('ghp_test_token_456')
    })

    it('should prefer GITHUB_TOKEN over GH_TOKEN', () => {
      process.env.GITHUB_TOKEN = 'ghp_github_token'
      process.env.GH_TOKEN = 'ghp_gh_token'

      const token = getGitHubToken()
      expect(token).toBe('ghp_github_token')
    })

    it('should get token from gh CLI when env vars not set', () => {
      delete process.env.GITHUB_TOKEN
      delete process.env.GH_TOKEN
      mockExecSync.mockReturnValue('ghp_gh_cli_token\n')

      const token = getGitHubToken()
      expect(token).toBe('ghp_gh_cli_token')
      expect(mockExecSync).toHaveBeenCalledWith('gh auth token', expect.any(Object))
    })

    it('should throw when no token available', () => {
      delete process.env.GITHUB_TOKEN
      delete process.env.GH_TOKEN
      mockExecSync.mockImplementation(() => {
        throw new Error('gh not found')
      })

      expect(() => getGitHubToken()).toThrow('GitHub token not found')
      expect(() => getGitHubToken()).toThrow('Set GITHUB_TOKEN')
      expect(() => getGitHubToken()).toThrow('gh auth login')
    })

    it('should handle empty token from gh CLI', () => {
      delete process.env.GITHUB_TOKEN
      delete process.env.GH_TOKEN
      mockExecSync.mockReturnValue('')

      expect(() => getGitHubToken()).toThrow('GitHub token not found')
    })
  })

  describe('getWorkflowPermissions()', () => {
    it('should fetch workflow permissions successfully', async () => {
      const mockPermissions = {
        default_workflow_permissions: 'read' as const,
        can_approve_pull_request_reviews: false
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockPermissions
      } as Response)

      const result = await getWorkflowPermissions('owner', 'repo', 'token123')
      
      expect(result).toEqual(mockPermissions)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/actions/permissions/workflow',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'Accept': 'application/vnd.github+json'
          })
        })
      )
    })

    it('should throw on API error', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      } as Response)

      await expect(
        getWorkflowPermissions('owner', 'repo', 'token123')
      ).rejects.toThrow('Failed to get workflow permissions: 404')
    })

    it('should throw on network error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      await expect(
        getWorkflowPermissions('owner', 'repo', 'token123')
      ).rejects.toThrow('Network error')
    })
  })

  describe('updateWorkflowPermissions()', () => {
    it('should update workflow permissions successfully', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true
      } as Response)

      const permissions = {
        default_workflow_permissions: 'write' as const,
        can_approve_pull_request_reviews: true
      }

      await updateWorkflowPermissions('owner', 'repo', 'token123', permissions)
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/actions/permissions/workflow',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(permissions)
        })
      )
    })

    it('should throw on API error', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      } as Response)

      await expect(
        updateWorkflowPermissions('owner', 'repo', 'token123', {
          default_workflow_permissions: 'write'
        })
      ).rejects.toThrow('Failed to update workflow permissions: 403')
    })

    it('should handle partial permission updates', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true
      } as Response)

      await updateWorkflowPermissions('owner', 'repo', 'token123', {
        default_workflow_permissions: 'write'
        // can_approve_pull_request_reviews not included
      })
      
      const callArgs = vi.mocked(global.fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string)
      
      expect(body).toHaveProperty('default_workflow_permissions', 'write')
      expect(body).not.toHaveProperty('can_approve_pull_request_reviews')
    })
  })

  describe('getRequiredPermissionChanges()', () => {
    it('should return null when permissions are already correct', () => {
      const currentPermissions = {
        default_workflow_permissions: 'write' as const,
        can_approve_pull_request_reviews: true
      }

      const changes = getRequiredPermissionChanges(currentPermissions)
      expect(changes).toBeNull()
    })

    it('should detect needed change to default_workflow_permissions', () => {
      const currentPermissions = {
        default_workflow_permissions: 'read' as const,
        can_approve_pull_request_reviews: true
      }

      const changes = getRequiredPermissionChanges(currentPermissions)
      expect(changes).toEqual({
        default_workflow_permissions: 'write'
      })
    })

    it('should detect needed change to can_approve_pull_request_reviews', () => {
      const currentPermissions = {
        default_workflow_permissions: 'write' as const,
        can_approve_pull_request_reviews: false
      }

      const changes = getRequiredPermissionChanges(currentPermissions)
      expect(changes).toEqual({
        can_approve_pull_request_reviews: true
      })
    })

    it('should detect multiple needed changes', () => {
      const currentPermissions = {
        default_workflow_permissions: 'read' as const,
        can_approve_pull_request_reviews: false
      }

      const changes = getRequiredPermissionChanges(currentPermissions)
      expect(changes).toEqual({
        default_workflow_permissions: 'write',
        can_approve_pull_request_reviews: true
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle repository names with special characters', () => {
      mockExecSync.mockReturnValue('https://github.com/owner/repo_name-v2.git\n')

      const info = getRepositoryInfo()
      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo_name-v2')
    })

    it('should handle whitespace in git remote output', () => {
      mockExecSync.mockReturnValue('  https://github.com/owner/repo.git  \n')

      const info = getRepositoryInfo()
      expect(info.owner).toBe('owner')
      expect(info.repo).toBe('repo')
    })

    it('should handle token with whitespace', () => {
      process.env.GITHUB_TOKEN = '  ghp_token_with_spaces  '

      const token = getGitHubToken()
      // Token should be returned as-is (trimming happens at usage)
      expect(token).toBe('  ghp_token_with_spaces  ')
    })

    it('should handle API rate limiting', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      } as Response)

      await expect(
        getWorkflowPermissions('owner', 'repo', 'token123')
      ).rejects.toThrow('429')
    })

    it('should handle unauthorized API access', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response)

      await expect(
        getWorkflowPermissions('owner', 'repo', 'invalid_token')
      ).rejects.toThrow('401')
    })
  })

  describe('Real-World Scenarios', () => {
    it('should handle typical fresh repository setup', async () => {
      // Fresh repo has read-only permissions
      const currentPermissions = {
        default_workflow_permissions: 'read' as const,
        can_approve_pull_request_reviews: false
      }

      const changes = getRequiredPermissionChanges(currentPermissions)
      expect(changes).not.toBeNull()
      expect(changes?.default_workflow_permissions).toBe('write')
      expect(changes?.can_approve_pull_request_reviews).toBe(true)
    })

    it('should handle repository already configured', async () => {
      // Already configured
      const currentPermissions = {
        default_workflow_permissions: 'write' as const,
        can_approve_pull_request_reviews: true
      }

      const changes = getRequiredPermissionChanges(currentPermissions)
      expect(changes).toBeNull()
    })

    it('should handle complete setup workflow', async () => {
      // 1. Get repository info
      mockExecSync.mockReturnValue('https://github.com/test-org/test-repo.git\n')
      const repoInfo = getRepositoryInfo()
      expect(repoInfo.owner).toBe('test-org')
      expect(repoInfo.repo).toBe('test-repo')

      // 2. Get token
      process.env.GITHUB_TOKEN = 'ghp_test_token'
      const token = getGitHubToken()
      expect(token).toBe('ghp_test_token')

      // 3. Check current permissions
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          default_workflow_permissions: 'read',
          can_approve_pull_request_reviews: false
        })
      } as Response)

      const currentPerms = await getWorkflowPermissions(
        repoInfo.owner,
        repoInfo.repo,
        token
      )
      expect(currentPerms.default_workflow_permissions).toBe('read')

      // 4. Determine needed changes
      const changes = getRequiredPermissionChanges(currentPerms)
      expect(changes).not.toBeNull()

      // 5. Apply changes
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true
      } as Response)

      await updateWorkflowPermissions(
        repoInfo.owner,
        repoInfo.repo,
        token,
        changes!
      )

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('test-org/test-repo'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  describe('Repository Settings', () => {
    describe('shouldEnableAutoMerge()', () => {
      it('should return true when autoMerge is boolean true', () => {
        mockLoadConfig.mockReturnValue({
          autoMerge: true
        })

        expect(shouldEnableAutoMerge()).toBe(true)
      })

      it('should return false when autoMerge is boolean false', () => {
        mockLoadConfig.mockReturnValue({
          autoMerge: false
        })

        expect(shouldEnableAutoMerge()).toBe(false)
      })

      it('should return true when any branch has autoMerge enabled', () => {
        mockLoadConfig.mockReturnValue({
          autoMerge: {
            staging: true,
            main: false
          }
        })

        expect(shouldEnableAutoMerge()).toBe(true)
      })

      it('should return false when no branches have autoMerge enabled', () => {
        mockLoadConfig.mockReturnValue({
          autoMerge: {
            staging: false,
            main: false
          }
        })

        expect(shouldEnableAutoMerge()).toBe(false)
      })

      it('should return false when autoMerge is not configured', () => {
        mockLoadConfig.mockReturnValue({
          branchFlow: ['develop', 'main']
        })

        expect(shouldEnableAutoMerge()).toBe(false)
      })

      it('should return false when config file cannot be loaded', () => {
        mockLoadConfig.mockImplementation(() => {
          throw new Error('Config file not found')
        })

        expect(shouldEnableAutoMerge()).toBe(false)
      })
    })

    describe('getRecommendedRepositorySettings()', () => {
      it('should return recommended settings with auto-merge enabled when configured', () => {
        mockLoadConfig.mockReturnValue({
          autoMerge: {
            staging: true,
            main: true
          }
        })

        const settings = getRecommendedRepositorySettings()

        expect(settings).toEqual({
          allow_auto_merge: true,
          allow_update_branch: true,
          allow_merge_commit: false,
          allow_rebase_merge: false,
          allow_squash_merge: true,
          squash_merge_commit_title: 'PR_TITLE',
          squash_merge_commit_message: 'COMMIT_MESSAGES'
        })
      })

      it('should return recommended settings with auto-merge disabled when not configured', () => {
        mockLoadConfig.mockReturnValue({
          branchFlow: ['develop', 'main']
        })

        const settings = getRecommendedRepositorySettings()

        expect(settings.allow_auto_merge).toBe(false)
        expect(settings.allow_squash_merge).toBe(true)
        expect(settings.allow_merge_commit).toBe(false)
        expect(settings.allow_rebase_merge).toBe(false)
      })
    })

    describe('getRepositorySettings()', () => {
      it('should fetch repository settings successfully', async () => {
        const mockSettings = {
          allow_auto_merge: true,
          allow_update_branch: false,
          allow_merge_commit: false,
          allow_rebase_merge: false,
          allow_squash_merge: true,
          squash_merge_commit_title: 'COMMIT_OR_PR_TITLE',
          squash_merge_commit_message: 'COMMIT_MESSAGES',
          merge_commit_title: 'MERGE_MESSAGE',
          merge_commit_message: 'PR_TITLE'
        }

        vi.mocked(global.fetch).mockResolvedValue({
          ok: true,
          json: async () => mockSettings
        } as Response)

        const result = await getRepositorySettings('owner', 'repo', 'token123')

        expect(result).toEqual(mockSettings)
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/owner/repo',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer token123',
              'Accept': 'application/vnd.github+json'
            })
          })
        )
      })

      it('should throw on API error', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: false,
          status: 404,
          text: async () => 'Not Found'
        } as Response)

        await expect(
          getRepositorySettings('owner', 'repo', 'token123')
        ).rejects.toThrow('Failed to get repository settings: 404')
      })
    })

    describe('updateRepositorySettings()', () => {
      it('should update repository settings successfully', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: true
        } as Response)

        const settings = {
          allow_auto_merge: true,
          allow_update_branch: true,
          squash_merge_commit_title: 'PR_TITLE' as const
        }

        await updateRepositorySettings('owner', 'repo', 'token123', settings)

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/repos/owner/repo',
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({
              'Authorization': 'Bearer token123',
              'Content-Type': 'application/json'
            }),
            body: JSON.stringify(settings)
          })
        )
      })

      it('should throw on API error', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => 'Forbidden'
        } as Response)

        await expect(
          updateRepositorySettings('owner', 'repo', 'token123', {
            allow_auto_merge: true
          })
        ).rejects.toThrow('Failed to update repository settings: 403')
      })
    })

    describe('getSettingsGaps()', () => {
      it('should return empty object when all settings match', () => {
        const current = {
          allow_auto_merge: true,
          allow_update_branch: true,
          allow_merge_commit: false,
          allow_rebase_merge: false,
          allow_squash_merge: true,
          squash_merge_commit_title: 'PR_TITLE' as const,
          squash_merge_commit_message: 'COMMIT_MESSAGES' as const
        }

        const recommended = { ...current }

        const gaps = getSettingsGaps(current, recommended)
        expect(gaps).toEqual({})
      })

      it('should detect auto-merge gap', () => {
        const current = {
          allow_auto_merge: false,
          allow_update_branch: true,
          allow_squash_merge: true
        }

        const recommended = {
          allow_auto_merge: true,
          allow_update_branch: true,
          allow_squash_merge: true
        }

        const gaps = getSettingsGaps(current, recommended)
        expect(gaps).toEqual({
          allow_auto_merge: true
        })
      })

      it('should detect multiple gaps', () => {
        const current = {
          allow_auto_merge: false,
          allow_update_branch: false,
          allow_merge_commit: true,
          allow_rebase_merge: true,
          allow_squash_merge: false,
          squash_merge_commit_title: 'COMMIT_OR_PR_TITLE' as const
        }

        const recommended = {
          allow_auto_merge: true,
          allow_update_branch: true,
          allow_merge_commit: false,
          allow_rebase_merge: false,
          allow_squash_merge: true,
          squash_merge_commit_title: 'PR_TITLE' as const,
          squash_merge_commit_message: 'COMMIT_MESSAGES' as const
        }

        const gaps = getSettingsGaps(current, recommended)
        expect(gaps).toEqual({
          allow_auto_merge: true,
          allow_update_branch: true,
          allow_merge_commit: false,
          allow_rebase_merge: false,
          allow_squash_merge: true,
          squash_merge_commit_title: 'PR_TITLE',
          squash_merge_commit_message: 'COMMIT_MESSAGES'
        })
      })

      it('should only check squash merge settings if squash merge will be enabled', () => {
        const current = {
          allow_squash_merge: false,
          squash_merge_commit_title: 'COMMIT_OR_PR_TITLE' as const
        }

        const recommended = {
          allow_squash_merge: true,
          squash_merge_commit_title: 'PR_TITLE' as const
        }

        const gaps = getSettingsGaps(current, recommended)
        // Should include both squash_merge and its settings
        expect(gaps.allow_squash_merge).toBe(true)
        expect(gaps.squash_merge_commit_title).toBe('PR_TITLE')
      })

      it('should not check squash merge settings if squash merge stays disabled', () => {
        const current = {
          allow_squash_merge: false,
          squash_merge_commit_title: 'COMMIT_OR_PR_TITLE' as const
        }

        const recommended = {
          allow_squash_merge: false,
          squash_merge_commit_title: 'PR_TITLE' as const
        }

        const gaps = getSettingsGaps(current, recommended)
        // Should not include squash settings if squash merge is disabled
        expect(gaps).not.toHaveProperty('squash_merge_commit_title')
      })
    })
  })

  describe('Repository Settings Integration Scenarios', () => {
    beforeEach(() => {
      mockLoadConfig.mockReset()
      vi.mocked(global.fetch).mockReset()
    })

    it('should handle complete repository setup for fresh repo', async () => {
      // Mock config with auto-merge for staging and main
      mockLoadConfig.mockReturnValue({
        branchFlow: ['develop', 'staging', 'main'],
        autoMerge: {
          staging: true,
          main: true
        }
      })

      // Get recommended settings
      const recommended = getRecommendedRepositorySettings()
      expect(recommended.allow_auto_merge).toBe(true)
      expect(recommended.allow_squash_merge).toBe(true)
      expect(recommended.allow_merge_commit).toBe(false)

      // Mock current settings (fresh repo)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          allow_auto_merge: false,
          allow_update_branch: false,
          allow_merge_commit: true,
          allow_rebase_merge: true,
          allow_squash_merge: true,
          squash_merge_commit_title: 'COMMIT_OR_PR_TITLE',
          squash_merge_commit_message: 'COMMIT_MESSAGES'
        })
      } as Response)

      const current = await getRepositorySettings('owner', 'repo', 'token')

      // Detect gaps
      const gaps = getSettingsGaps(current, recommended)
      expect(Object.keys(gaps).length).toBeGreaterThan(0)
      expect(gaps.allow_auto_merge).toBe(true)
      expect(gaps.allow_update_branch).toBe(true)
      expect(gaps.allow_merge_commit).toBe(false)
      expect(gaps.squash_merge_commit_title).toBe('PR_TITLE')

      // Apply changes
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true
      } as Response)

      await updateRepositorySettings('owner', 'repo', 'token', gaps)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    it('should handle repo without auto-merge config', async () => {
      // Mock config without auto-merge
      mockLoadConfig.mockReturnValue({
        branchFlow: ['develop', 'main']
        // No autoMerge field
      })

      const recommended = getRecommendedRepositorySettings()
      expect(recommended.allow_auto_merge).toBe(false)

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          allow_auto_merge: true,
          allow_update_branch: true,
          allow_squash_merge: true,
          squash_merge_commit_title: 'PR_TITLE'
        })
      } as Response)

      const current = await getRepositorySettings('owner', 'repo', 'token')
      const gaps = getSettingsGaps(current, recommended)

      // Should want to disable auto-merge
      expect(gaps.allow_auto_merge).toBe(false)
    })

    it('should handle already configured repository', async () => {
      mockLoadConfig.mockReturnValue({
        autoMerge: { staging: true, main: true }
      })

      const recommended = getRecommendedRepositorySettings()

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => recommended
      } as Response)

      const current = await getRepositorySettings('owner', 'repo', 'token')
      const gaps = getSettingsGaps(current, recommended)

      // No changes needed
      expect(Object.keys(gaps).length).toBe(0)
    })
  })
})

