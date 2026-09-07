/**
 * GitHub Repository Setup and Configuration
 *
 * This module provides utilities for setting up and configuring GitHub repositories
 * for use with PipeCraft workflows. It handles:
 * - Repository information extraction from git remotes
 * - GitHub authentication token management
 * - Workflow permissions configuration
 * - Repository merge settings (strategies, auto-merge, PR updates)
 * - Merge commit message format settings
 * - Branch protection rules setup
 * - Auto-merge enablement (two-layer system)
 *
 * These setup utilities ensure that GitHub repositories have the correct permissions
 * and settings for PipeCraft workflows to function properly, including:
 * - Workflows can create pull requests
 * - Merge commits always use PR titles (not individual commit messages)
 * - Auto-merge is enabled based on .pipecraftrc config
 * - Branch protection is configured appropriately
 * - Required status checks are enforced
 *
 * ## Auto-Merge Two-Layer System
 *
 * Auto-merge in GitHub works with two layers:
 *
 * 1. **Repository-Level Setting** (`allow_auto_merge`):
 *    - Must be ON for auto-merge to be available at all
 *    - Controls whether the "Enable auto-merge" button appears on PRs
 *    - Configured by this module based on .pipecraftrc
 *
 * 2. **Per-PR Activation**:
 *    - Must be explicitly enabled on each PR (via button, CLI, or API)
 *    - Pipecraft workflows automatically enable it for configured branches
 *    - Configured per-branch in .pipecraftrc autoPromote setting
 *
 * Example config:
 * ```json
 * {
 *   "branchFlow": ["develop", "staging", "main"],
 *   "autoPromote": {
 *     "staging": true,  // Auto-merge PRs to staging
 *     "main": true      // Auto-merge PRs to main
 *   }
 * }
 * ```
 * Result: develop requires manual review, staging and main auto-merge when checks pass
 *
 * @module utils/github-setup
 */

import { prompt } from '@featherscloud/pinion'
import { execSync } from 'child_process'
import type { PipecraftConfig } from '../types/index.js'
import { loadConfig } from './config.js'

/**
 * GitHub Actions workflow permissions configuration.
 *
 * Controls what permissions workflows have when executing in the repository.
 * PipeCraft workflows need 'write' permissions to create PRs and manage branches.
 */
interface WorkflowPermissions {
  /**
   * Default permissions for GITHUB_TOKEN in workflow runs.
   * - 'read': Read-only access (insufficient for PipeCraft)
   * - 'write': Read-write access (required for PipeCraft)
   */
  default_workflow_permissions: 'read' | 'write'

  /**
   * Whether workflows can approve pull request reviews.
   * Should be false to require human approval.
   */
  can_approve_pull_request_reviews: boolean
}

/**
 * Repository identification information extracted from git remote.
 *
 * Used for GitHub API calls and workflow configuration.
 */
interface RepositoryInfo {
  /** GitHub organization or user name */
  owner: string

  /** Repository name */
  repo: string

  /** Full git remote URL */
  remote: string
}

/**
 * GitHub repository merge and PR settings.
 *
 * Controls merge strategies, auto-merge, PR branch updates, and commit message formats.
 * These settings determine how PRs can be merged and what commit messages are created.
 */
interface RepositorySettings {
  /**
   * Allow auto-merge feature (let PRs auto-merge when checks pass)
   */
  allow_auto_merge?: boolean

  /**
   * Always suggest updating pull request branches (keep PRs up to date with base)
   */
  allow_update_branch?: boolean

  /**
   * Allow merge commits (creates a merge commit)
   */
  allow_merge_commit?: boolean

  /**
   * Allow rebase merging (rebases and fast-forwards)
   */
  allow_rebase_merge?: boolean

  /**
   * Allow squash merging (squashes all commits into one)
   */
  allow_squash_merge?: boolean

  /**
   * Default title format for squash merge commits.
   * - 'PR_TITLE': Use the pull request title
   * - 'COMMIT_OR_PR_TITLE': Use commit message if single commit, PR title otherwise
   */
  squash_merge_commit_title?: 'PR_TITLE' | 'COMMIT_OR_PR_TITLE'

  /**
   * Default message format for squash merge commits.
   * - 'PR_BODY': Use the pull request body
   * - 'COMMIT_MESSAGES': Use all commit messages
   * - 'BLANK': Leave message blank
   */
  squash_merge_commit_message?: 'PR_BODY' | 'COMMIT_MESSAGES' | 'BLANK'

  /**
   * Default title format for merge commits.
   * - 'PR_TITLE': Use the pull request title
   * - 'MERGE_MESSAGE': Use default merge message
   */
  merge_commit_title?: 'PR_TITLE' | 'MERGE_MESSAGE'

  /**
   * Default message format for merge commits.
   * - 'PR_BODY': Use the pull request body
   * - 'PR_TITLE': Use the pull request title
   * - 'BLANK': Leave message blank
   */
  merge_commit_message?: 'PR_BODY' | 'PR_TITLE' | 'BLANK'
}

/**
 * Type alias for backwards compatibility with existing functions.
 * @deprecated Use RepositorySettings instead
 */
type MergeCommitSettings = RepositorySettings

/**
 * GitHub branch protection rule configuration.
 *
 * Defines protection requirements for a branch including status checks,
 * review requirements, and restrictions on force pushes/deletions.
 * PipeCraft recommends specific settings for trunk-based workflows.
 */
interface BranchProtectionRules {
  /**
   * Required status checks that must pass before merging.
   * PipeCraft sets this to enforce test jobs.
   */
  required_status_checks: null | {
    /** Whether branch must be up to date before merging */
    strict: boolean

    /** Names of required status checks (job names from workflow) */
    contexts: string[]
  }

  /** Whether administrators are subject to branch protection rules */
  enforce_admins: boolean

  /**
   * Pull request review requirements.
   * PipeCraft typically disables this for automated promotions.
   */
  required_pull_request_reviews: null | {
    /** Dismiss stale reviews when new commits are pushed */
    dismiss_stale_reviews: boolean

    /** Require review from code owners */
    require_code_owner_reviews: boolean

    /** Number of approving reviews required */
    required_approving_review_count: number
  }

  /** User/team restrictions for who can push (null = no restrictions) */
  restrictions: null

  /** Allow force pushes to the branch */
  allow_force_pushes: boolean

  /** Allow branch deletion */
  allow_deletions: boolean

  /** Require linear commit history (no merge commits) */
  required_linear_history: boolean

  /** Require all conversations to be resolved before merging */
  required_conversation_resolution: boolean
}

/**
 * Extract GitHub repository information from git remote configuration.
 *
 * Parses the git remote URL for the 'origin' remote to extract owner and
 * repository name. Supports both HTTPS and SSH GitHub URLs:
 * - HTTPS: https://github.com/owner/repo.git
 * - SSH: git@github.com:owner/repo.git
 *
 * This information is required for GitHub API calls to configure repository
 * settings and permissions.
 *
 * @returns Repository information object
 * @throws {Error} If origin remote is not configured
 * @throws {Error} If remote URL is not a valid GitHub URL
 *
 * @example
 * ```typescript
 * const info = getRepositoryInfo()
 * console.log(`Owner: ${info.owner}, Repo: ${info.repo}`)
 * // Owner: jamesvillarrubia, Repo: pipecraft
 * ```
 */
export function getRepositoryInfo(): RepositoryInfo {
  try {
    // Get the remote URL from git configuration
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    }).trim()

    // Parse GitHub URL - supports both HTTPS and SSH formats
    // HTTPS: https://github.com/owner/repo.git
    // SSH: git@github.com:owner/repo.git
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/)

    if (!match) {
      throw new Error('Could not parse GitHub repository URL from git remote')
    }

    return {
      owner: match[1],
      repo: match[2],
      remote: remoteUrl
    }
  } catch (error: any) {
    throw new Error(`Failed to get repository info: ${error.message}`)
  }
}

/**
 * Get GitHub authentication token from environment or GitHub CLI.
 *
 * Attempts to retrieve a GitHub personal access token from multiple sources
 * in this order:
 * 1. GITHUB_TOKEN environment variable
 * 2. GH_TOKEN environment variable
 * 3. GitHub CLI (`gh auth token`) if authenticated
 *
 * The token is required for GitHub API calls to configure repository settings.
 * Token must have 'repo' and 'workflow' scopes.
 *
 * @returns GitHub personal access token
 * @throws {Error} If no token is found in any source
 *
 * @example
 * ```typescript
 * // Set token via environment
 * process.env.GITHUB_TOKEN = 'ghp_xxxxxxxxxxxx'
 * const token = getGitHubToken()
 *
 * // Or authenticate with GitHub CLI first
 * // $ gh auth login
 * const token = getGitHubToken() // Uses gh CLI token
 * ```
 */
export function getGitHubToken(): string {
  // Check environment variables
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN

  if (token) {
    return token
  }

  // Try to get from gh CLI
  try {
    const ghToken = execSync('gh auth token', { encoding: 'utf8', stdio: 'pipe' }).trim()
    if (ghToken) {
      return ghToken
    }
  } catch (error) {
    // gh CLI not available or not authenticated
  }

  throw new Error(
    'GitHub token not found. Please:\n' +
      '  1. Set GITHUB_TOKEN or GH_TOKEN environment variable, or\n' +
      '  2. Authenticate with gh CLI: gh auth login'
  )
}

/**
 * Get current workflow permissions
 */
export async function getWorkflowPermissions(
  owner: string,
  repo: string,
  token: string
): Promise<WorkflowPermissions> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/permissions/workflow`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get workflow permissions: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Update workflow permissions
 */
export async function updateWorkflowPermissions(
  owner: string,
  repo: string,
  token: string,
  permissions: Partial<WorkflowPermissions>
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/permissions/workflow`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(permissions)
    }
  )

  if (!response.ok) {
    const errorText = await response.text()

    // Check if this is an organization-level policy conflict
    if (isOrgActionsPermissionLock(response.status)) {
      throw new Error(formatOrgActionsLockMessage(owner, errorText))
    }

    throw new Error(`Failed to update workflow permissions: ${response.status} ${errorText}`)
  }
}

/**
 * Whether an HTTP status from the Actions workflow-permissions API indicates an
 * organization-level policy lock.
 *
 * GitHub returns 409 Conflict when a repository tries to enable a workflow
 * permission (e.g. "Allow GitHub Actions to create and approve pull requests")
 * that the parent organization has disabled. The repo-level setting cannot be
 * changed until an org admin enables it at the organization level.
 *
 * @param status - HTTP status code from the GitHub Actions permissions API
 * @returns true if the status is the org-policy conflict (409)
 */
export function isOrgActionsPermissionLock(status: number): boolean {
  return status === 409
}

/**
 * Build an actionable, human-readable message explaining that an organization
 * policy is blocking the repository's workflow permissions, and exactly how an
 * org admin can unblock it. Used both by `setup-github` (on a 409 write) and by
 * `doctor` (when it detects the org-level lock proactively).
 *
 * @param owner - Repository owner (the organization name)
 * @param apiError - Optional raw API error text to append for debugging
 * @returns A multi-line actionable message
 */
export function formatOrgActionsLockMessage(owner: string, apiError?: string): string {
  const base =
    `Organization-level policy prevents changing workflow permissions.\n\n` +
    `⚠️  This repository's organization has restricted workflow permissions.\n` +
    `    The organization administrator must:\n\n` +
    `    1. Visit: https://github.com/organizations/${owner}/settings/actions\n` +
    `    2. Under "Workflow permissions":\n` +
    `       - Enable "Read and write permissions"\n` +
    `       - Check "Allow GitHub Actions to create and approve pull requests"\n` +
    `    3. Save changes\n\n` +
    `    Then run 'pipecraft setup-github' again to configure this repository.`

  return apiError ? `${base}\n\nAPI Error: ${apiError}` : base
}

/**
 * Get organization-level workflow permissions.
 *
 * Used to proactively detect an org-level lock from a read-only context (e.g.
 * `doctor`) without attempting a write that would 409. Returns `null` when the
 * org endpoint is not accessible — which is the expected case for personal
 * accounts (404) or tokens lacking org-admin scope (403). Callers should treat
 * `null` as "indeterminate" and fall back to their default behavior.
 *
 * @param org - Organization (owner) name
 * @param token - GitHub token
 * @returns The org workflow permissions, or null if not determinable
 */
export async function getOrgWorkflowPermissions(
  org: string,
  token: string
): Promise<WorkflowPermissions | null> {
  const response = await fetch(`https://api.github.com/orgs/${org}/actions/permissions/workflow`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (!response.ok) {
    // 404 (personal account / no such org) or 403 (no admin scope) -> indeterminate
    return null
  }

  return response.json()
}

/**
 * Determine required permission changes without prompting
 * Returns: changes object if changes needed, null if already correct
 */
export function getRequiredPermissionChanges(
  currentPermissions: WorkflowPermissions
): Partial<WorkflowPermissions> | null {
  // Check if permissions are already correct
  if (
    currentPermissions.default_workflow_permissions === 'write' &&
    currentPermissions.can_approve_pull_request_reviews === true
  ) {
    return null
  }

  const changes: Partial<WorkflowPermissions> = {}

  if (currentPermissions.default_workflow_permissions !== 'write') {
    changes.default_workflow_permissions = 'write'
  }

  if (!currentPermissions.can_approve_pull_request_reviews) {
    changes.can_approve_pull_request_reviews = true
  }

  return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Display current permissions and prompt for changes
 * Returns: changes object if user accepted changes, 'declined' if user declined, null if already correct
 */
export async function promptPermissionChanges(
  currentPermissions: WorkflowPermissions
): Promise<Partial<WorkflowPermissions> | null | 'declined'> {
  console.log('\n📋 Current GitHub Actions Workflow Permissions:')
  console.log(`   Default permissions: ${currentPermissions.default_workflow_permissions}`)
  console.log(
    `   Can create/approve PRs: ${
      currentPermissions.can_approve_pull_request_reviews ? 'Yes' : 'No'
    }`
  )

  // Check if permissions are already correct
  if (
    currentPermissions.default_workflow_permissions === 'write' &&
    currentPermissions.can_approve_pull_request_reviews === true
  ) {
    console.log('\n✅ Permissions are already configured correctly for PipeCraft!')
    return null
  }

  console.log('\n⚠️  PipeCraft requires the following permissions:')
  console.log('   • Default permissions: write (for creating tags and pushing)')
  console.log('   • Can create/approve PRs: Yes (for automated PR creation)')

  const changes: Partial<WorkflowPermissions> = {}
  let userDeclinedAnyChanges = false

  // Ask about default permissions
  if (currentPermissions.default_workflow_permissions !== 'write') {
    const response: any = await prompt({
      type: 'confirm',
      name: 'updatePermissions',
      message: 'Change default workflow permissions from "read" to "write"?',
      default: true
    } as any)

    if (response.updatePermissions) {
      changes.default_workflow_permissions = 'write'
    } else {
      console.log('⚠️  Warning: PipeCraft may not work correctly without write permissions')
      userDeclinedAnyChanges = true
    }
  }

  // Ask about PR creation
  if (!currentPermissions.can_approve_pull_request_reviews) {
    const response: any = await prompt({
      type: 'confirm',
      name: 'allowPRs',
      message: 'Allow GitHub Actions to create and approve pull requests?',
      default: true
    } as any)

    if (response.allowPRs) {
      changes.can_approve_pull_request_reviews = true
    } else {
      console.log('⚠️  Warning: PipeCraft cannot create PRs without this permission')
      userDeclinedAnyChanges = true
    }
  }

  // If user declined all changes, return 'declined'
  if (userDeclinedAnyChanges && Object.keys(changes).length === 0) {
    return 'declined'
  }

  return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Get current merge commit message settings for the repository.
 *
 * Retrieves the default formats for merge and squash commit messages.
 * These settings control how GitHub formats commit messages when PRs are merged.
 *
 * @param owner - Repository owner (organization or user)
 * @param repo - Repository name
 * @param token - GitHub authentication token
 * @returns Current merge commit settings
 * @throws {Error} If the API call fails
 *
 * @example
 * ```typescript
 * const settings = await getMergeCommitSettings('owner', 'repo', token)
 * console.log(settings.squash_merge_commit_title) // 'PR_TITLE' or 'COMMIT_OR_PR_TITLE'
 * ```
 */
export async function getMergeCommitSettings(
  owner: string,
  repo: string,
  token: string
): Promise<MergeCommitSettings> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get merge commit settings: ${response.status} ${error}`)
  }

  const data = await response.json()
  return {
    squash_merge_commit_title: data.squash_merge_commit_title,
    squash_merge_commit_message: data.squash_merge_commit_message,
    merge_commit_title: data.merge_commit_title,
    merge_commit_message: data.merge_commit_message,
    allow_squash_merge: data.allow_squash_merge,
    allow_merge_commit: data.allow_merge_commit,
    allow_rebase_merge: data.allow_rebase_merge
  }
}

/**
 * Update merge commit message settings for the repository.
 *
 * Configures how GitHub formats commit messages when PRs are merged.
 * PipeCraft recommends using PR_TITLE to ensure consistent commit messages
 * regardless of whether a PR has one or multiple commits.
 *
 * @param owner - Repository owner (organization or user)
 * @param repo - Repository name
 * @param token - GitHub authentication token
 * @param settings - Merge commit settings to apply
 * @throws {Error} If the API call fails
 *
 * @example
 * ```typescript
 * await updateMergeCommitSettings('owner', 'repo', token, {
 *   squash_merge_commit_title: 'PR_TITLE',
 *   merge_commit_title: 'PR_TITLE'
 * })
 * ```
 */
export async function updateMergeCommitSettings(
  owner: string,
  repo: string,
  token: string,
  settings: MergeCommitSettings
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update merge commit settings: ${response.status} ${error}`)
  }
}

/**
 * Determine required merge commit setting changes without prompting.
 *
 * Checks if merge commit settings match PipeCraft's recommended configuration:
 * - Always use PR title for squash and merge commits
 * - This ensures consistent commit messages regardless of commit count
 * - Only configures settings for enabled merge strategies
 *
 * @param currentSettings - Current merge commit settings
 * @returns Changes object if changes needed, null if already correct
 *
 * @example
 * ```typescript
 * const settings = await getMergeCommitSettings(owner, repo, token)
 * const changes = getRequiredMergeCommitChanges(settings)
 * if (changes) {
 *   await updateMergeCommitSettings(owner, repo, token, changes)
 * }
 * ```
 */
export function getRequiredMergeCommitChanges(
  currentSettings: MergeCommitSettings
): MergeCommitSettings | null {
  const changes: MergeCommitSettings = {}

  // For squash merges, always use PR title (not commit message)
  // Only configure if squash merge is enabled
  if (
    currentSettings.allow_squash_merge &&
    currentSettings.squash_merge_commit_title !== 'PR_TITLE'
  ) {
    changes.squash_merge_commit_title = 'PR_TITLE'
  }

  // For merge commits, always use PR title
  // Only configure if merge commit is enabled
  if (currentSettings.allow_merge_commit && currentSettings.merge_commit_title !== 'PR_TITLE') {
    changes.merge_commit_title = 'PR_TITLE'
  }

  return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Display current merge commit settings and prompt for changes.
 *
 * Shows the user their current merge commit message format settings and
 * asks if they want to change them to PipeCraft's recommended configuration.
 * Only prompts for settings that are relevant to enabled merge strategies.
 *
 * @param currentSettings - Current merge commit settings
 * @returns Changes object if user accepted, 'declined' if declined, null if already correct
 *
 * @example
 * ```typescript
 * const settings = await getMergeCommitSettings(owner, repo, token)
 * const changes = await promptMergeCommitChanges(settings)
 * if (changes && changes !== 'declined') {
 *   await updateMergeCommitSettings(owner, repo, token, changes)
 * }
 * ```
 */
export async function promptMergeCommitChanges(
  currentSettings: MergeCommitSettings
): Promise<MergeCommitSettings | null | 'declined'> {
  console.log('\n📋 Current Merge Commit Message Settings:')

  // Only show settings for enabled merge strategies
  if (currentSettings.allow_squash_merge) {
    console.log(`   Squash merge title: ${currentSettings.squash_merge_commit_title || 'not set'}`)
  }
  if (currentSettings.allow_merge_commit) {
    console.log(`   Merge commit title: ${currentSettings.merge_commit_title || 'not set'}`)
  }

  if (!currentSettings.allow_squash_merge && !currentSettings.allow_merge_commit) {
    console.log('   No merge strategies enabled - skipping configuration')
    return null
  }

  // Check if settings are already correct for enabled strategies
  const squashCorrect =
    !currentSettings.allow_squash_merge || currentSettings.squash_merge_commit_title === 'PR_TITLE'
  const mergeCorrect =
    !currentSettings.allow_merge_commit || currentSettings.merge_commit_title === 'PR_TITLE'

  if (squashCorrect && mergeCorrect) {
    console.log('\n✅ Merge commit settings are already configured correctly!')
    return null
  }

  console.log('\n⚠️  PipeCraft recommends the following settings:')
  if (currentSettings.allow_squash_merge && !squashCorrect) {
    console.log('   • Squash merge title: PR_TITLE (always use PR title, not commit message)')
  }
  if (currentSettings.allow_merge_commit && !mergeCorrect) {
    console.log('   • Merge commit title: PR_TITLE (always use PR title)')
  }
  console.log(
    '\n   This ensures consistent commit messages when PRs have single or multiple commits.'
  )

  const response: any = await prompt({
    type: 'confirm',
    name: 'updateSettings',
    message: 'Update merge commit message settings to use PR titles?',
    default: true
  } as any)

  if (!response.updateSettings) {
    return 'declined'
  }

  const changes: MergeCommitSettings = {}

  // Only include changes for enabled strategies
  if (
    currentSettings.allow_squash_merge &&
    currentSettings.squash_merge_commit_title !== 'PR_TITLE'
  ) {
    changes.squash_merge_commit_title = 'PR_TITLE'
  }

  if (currentSettings.allow_merge_commit && currentSettings.merge_commit_title !== 'PR_TITLE') {
    changes.merge_commit_title = 'PR_TITLE'
  }

  return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Check if auto-merge should be enabled based on .pipecraftrc config.
 *
 * Auto-merge should be enabled at the repository level if ANY branch
 * has autoPromote configured in the config file.
 */
export function shouldEnableAutoMerge(): boolean {
  try {
    const config = loadConfig() as PipecraftConfig

    if (!config.autoPromote) {
      return false
    }

    if (typeof config.autoPromote === 'boolean') {
      return config.autoPromote
    }

    if (typeof config.autoPromote === 'object') {
      // Check if any branch has auto-merge enabled
      return Object.values(config.autoPromote).some(enabled => enabled === true)
    }

    return false
  } catch (error) {
    // No config file or autoPromote not configured
    return false
  }
}

/**
 * Get Pipecraft's recommended repository settings.
 *
 * These are the settings that work best with Pipecraft workflows:
 * - Allow auto-merge: ON if any branch has autoPromote in config, OFF otherwise
 * - Always suggest updating PR branches: ON
 * - Allow merge commits: ON if config.mergeStrategy is 'merge', OFF otherwise
 * - Allow rebase merging: OFF
 * - Allow squash merging: ON
 * - Squash merge commit title: PR_TITLE
 * - Squash merge commit message: COMMIT_MESSAGES (PR title + commit details)
 */
export function getRecommendedRepositorySettings(): RepositorySettings {
  let mergeStrategy: PipecraftConfig['mergeStrategy'] | undefined
  try {
    mergeStrategy = (loadConfig() as PipecraftConfig).mergeStrategy
  } catch (error) {
    // No config file or mergeStrategy not configured
    mergeStrategy = undefined
  }

  const allowMergeCommit = mergeStrategy === 'merge'

  return {
    allow_auto_merge: shouldEnableAutoMerge(),
    allow_update_branch: true,
    allow_merge_commit: allowMergeCommit,
    allow_rebase_merge: false,
    allow_squash_merge: true,
    squash_merge_commit_title: 'PR_TITLE',
    squash_merge_commit_message: 'COMMIT_MESSAGES',
    // GitHub only accepts specific title/message pairings for merge commits
    // (PR_TITLE+PR_BODY, PR_TITLE+BLANK, or MERGE_MESSAGE+PR_TITLE) — a lone
    // merge_commit_title without its paired message 422s with
    // invalid_merge_commit_setting_combo.
    ...(allowMergeCommit
      ? { merge_commit_title: 'PR_TITLE' as const, merge_commit_message: 'PR_BODY' as const }
      : {})
  }
}

/**
 * Get current repository settings from GitHub API.
 */
export async function getRepositorySettings(
  owner: string,
  repo: string,
  token: string
): Promise<RepositorySettings> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get repository settings: ${response.status} ${error}`)
  }

  const data = await response.json()
  return {
    allow_auto_merge: data.allow_auto_merge,
    allow_update_branch: data.allow_update_branch,
    allow_merge_commit: data.allow_merge_commit,
    allow_rebase_merge: data.allow_rebase_merge,
    allow_squash_merge: data.allow_squash_merge,
    squash_merge_commit_title: data.squash_merge_commit_title,
    squash_merge_commit_message: data.squash_merge_commit_message,
    merge_commit_title: data.merge_commit_title,
    merge_commit_message: data.merge_commit_message
  }
}

/**
 * Update repository settings via GitHub API.
 */
export async function updateRepositorySettings(
  owner: string,
  repo: string,
  token: string,
  settings: Partial<RepositorySettings>
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settings)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update repository settings: ${response.status} ${error}`)
  }
}

/**
 * Compare current settings with recommended settings and return differences.
 */
export function getSettingsGaps(
  current: RepositorySettings,
  recommended: RepositorySettings
): Partial<RepositorySettings> {
  const gaps: Partial<RepositorySettings> = {}

  // Check each setting
  if (current.allow_auto_merge !== recommended.allow_auto_merge) {
    gaps.allow_auto_merge = recommended.allow_auto_merge
  }
  if (current.allow_update_branch !== recommended.allow_update_branch) {
    gaps.allow_update_branch = recommended.allow_update_branch
  }
  if (current.allow_merge_commit !== recommended.allow_merge_commit) {
    gaps.allow_merge_commit = recommended.allow_merge_commit
  }
  if (current.allow_rebase_merge !== recommended.allow_rebase_merge) {
    gaps.allow_rebase_merge = recommended.allow_rebase_merge
  }
  if (current.allow_squash_merge !== recommended.allow_squash_merge) {
    gaps.allow_squash_merge = recommended.allow_squash_merge
  }

  // Only check squash merge settings if squash merge will be enabled
  const squashWillBeEnabled = gaps.allow_squash_merge ?? current.allow_squash_merge
  if (squashWillBeEnabled) {
    if (current.squash_merge_commit_title !== recommended.squash_merge_commit_title) {
      gaps.squash_merge_commit_title = recommended.squash_merge_commit_title
    }
    if (current.squash_merge_commit_message !== recommended.squash_merge_commit_message) {
      gaps.squash_merge_commit_message = recommended.squash_merge_commit_message
    }
  }

  // Only check merge commit title/message if merge commits will be enabled. Both must be
  // patched together — GitHub rejects a lone merge_commit_title change that doesn't pair
  // with an allowed merge_commit_message (invalid_merge_commit_setting_combo).
  const mergeWillBeEnabled = gaps.allow_merge_commit ?? current.allow_merge_commit
  if (mergeWillBeEnabled) {
    if (current.merge_commit_title !== recommended.merge_commit_title) {
      gaps.merge_commit_title = recommended.merge_commit_title
    }
    if (current.merge_commit_message !== recommended.merge_commit_message) {
      gaps.merge_commit_message = recommended.merge_commit_message
    }
  }

  return gaps
}

/**
 * Display a comparison table of current vs recommended settings.
 */
export function displaySettingsComparison(
  current: RepositorySettings,
  recommended: RepositorySettings,
  gaps: Partial<RepositorySettings>
): void {
  console.log('\n📊 Repository Settings Comparison:\n')

  const formatValue = (value: any): string => {
    if (typeof value === 'boolean') return value ? 'ON' : 'OFF'
    if (value === undefined || value === null) return 'not set'
    return String(value)
  }

  const hasGap = (key: keyof RepositorySettings): boolean => key in gaps

  const settings: Array<{ key: keyof RepositorySettings; label: string }> = [
    { key: 'allow_auto_merge', label: 'Allow auto-merge' },
    { key: 'allow_update_branch', label: 'Always suggest updating PR branches' },
    { key: 'allow_merge_commit', label: 'Allow merge commits' },
    { key: 'allow_rebase_merge', label: 'Allow rebase merging' },
    { key: 'allow_squash_merge', label: 'Allow squash merging' },
    { key: 'squash_merge_commit_title', label: 'Squash merge commit title' },
    { key: 'squash_merge_commit_message', label: 'Squash merge commit message' },
    { key: 'merge_commit_title', label: 'Merge commit title' },
    { key: 'merge_commit_message', label: 'Merge commit message' }
  ]

  settings.forEach(({ key, label }) => {
    const currentVal = formatValue(current[key])
    const recommendedVal = formatValue(recommended[key])
    const gap = hasGap(key)

    if (gap) {
      console.log(`   • ${label}`)
      console.log(`       Current:     ${currentVal}`)
      console.log(`       Recommended: ${recommendedVal} ⚠️`)
    } else {
      console.log(`   • ${label}: ${currentVal} ✅`)
    }
  })

  const gapCount = Object.keys(gaps).length
  if (gapCount > 0) {
    console.log(
      `\n⚠️  Found ${gapCount} setting${gapCount > 1 ? 's' : ''} that differ from recommendations`
    )
  } else {
    console.log('\n✅ All settings match Pipecraft recommendations!')
  }

  // Show auto-merge branch configuration if auto-merge is enabled
  if (current.allow_auto_merge || recommended.allow_auto_merge) {
    try {
      const config = loadConfig() as PipecraftConfig
      if (config.autoPromote) {
        console.log('\n📋 Auto-Merge Branch Configuration:')
        console.log('   ℹ️  Repository-level allow_auto_merge must be ON for these to work\n')

        if (typeof config.autoPromote === 'boolean') {
          if (config.autoPromote) {
            console.log('   • All branches: Auto-merge ENABLED ✅')
          } else {
            console.log('   • All branches: Auto-merge DISABLED')
          }
        } else if (typeof config.autoPromote === 'object') {
          const branches = config.branchFlow || []
          const autoPromoteConfig = config.autoPromote as Record<string, boolean>
          branches.forEach(branch => {
            const enabled = autoPromoteConfig[branch]
            if (enabled === true) {
              console.log(`   • ${branch}:`)
              console.log(`       Status: Auto-merge ENABLED ✅`)
            } else if (enabled === false) {
              console.log(`   • ${branch}:`)
              console.log(`       Status: Auto-merge DISABLED (manual review required)`)
            } else {
              console.log(`   • ${branch}:`)
              console.log(`       Status: Not configured (manual review required)`)
            }
          })
        }

        console.log('\n   ℹ️  Auto-merge means PRs will automatically merge when all checks pass')
        console.log('   ℹ️  Branches without auto-merge require manual approval and merge')
      }
    } catch (error) {
      // Config file not found or invalid - skip branch config display
    }
  }
}

/**
 * Prompt user whether to apply recommended settings.
 */
export async function promptApplySettings(
  gaps: Partial<RepositorySettings>
): Promise<'apply' | 'declined'> {
  const gapCount = Object.keys(gaps).length

  if (gapCount === 0) {
    return 'declined' // Nothing to apply
  }

  const response: any = await prompt({
    type: 'confirm',
    name: 'applySettings',
    message: `Apply ${gapCount} recommended setting${gapCount > 1 ? 's' : ''}?`,
    default: true
  } as any)

  return response.applySettings ? 'apply' : 'declined'
}

/**
 * Get branch protection rules
 */
export async function getBranchProtection(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<BranchProtectionRules | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (response.status === 404) {
    // Branch protection not configured
    return null
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get branch protection for ${branch}: ${response.status} ${error}`)
  }

  return response.json()
}

/**
 * Build the branch-protection rules used for auto-promote target branches.
 *
 * `required_linear_history` MUST follow the merge strategy: with `mergeStrategy: merge`
 * the auto-promote pushes a MERGE COMMIT to the target, and a branch that requires linear
 * history rejects merge commits (GH006 "Protected branch update failed"), silently breaking
 * the very auto-promote this protection is meant to support. Only fast-forward promotions
 * produce linear history, so only they may require it.
 */
export function buildBranchProtectionRules(
  mergeStrategy?: 'fast-forward' | 'merge'
): BranchProtectionRules {
  return {
    required_status_checks: {
      strict: false,
      contexts: [] // No specific checks required, but enables the feature
    },
    enforce_admins: false,
    required_pull_request_reviews: null, // No required reviews for auto-merge branches
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    required_linear_history: mergeStrategy !== 'merge',
    required_conversation_resolution: false
  }
}

/**
 * Update branch protection rules to enable auto-merge
 */
export async function updateBranchProtection(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  mergeStrategy?: 'fast-forward' | 'merge'
): Promise<void> {
  // Minimal branch protection to enable auto-merge.
  // GitHub requires at least ONE of the main protection types.
  const protection: BranchProtectionRules = buildBranchProtectionRules(mergeStrategy)

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(protection)
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update branch protection for ${branch}: ${response.status} ${error}`)
  }
}

/**
 * Enable auto-merge feature for the repository
 */
export async function enableAutoMerge(
  owner: string,
  repo: string,
  token: string
): Promise<boolean> {
  // First check if auto-merge is already enabled
  const checkResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })

  if (checkResponse.ok) {
    const repoData = await checkResponse.json()
    if (repoData.allow_auto_merge === true) {
      return false // Already enabled
    }
  }

  // Enable auto-merge
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      allow_auto_merge: true
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to enable auto-merge: ${response.status} ${error}`)
  }

  return true // Was enabled
}

/**
 * Configure branch protection for branches that need auto-merge
 */
export async function configureBranchProtection(
  repoInfo: RepositoryInfo,
  token: string,
  autoApply: boolean
): Promise<void> {
  console.log('\n🔍 Checking auto-merge configuration...')

  // Load config to get autoPromote settings
  let config: PipecraftConfig
  try {
    config = loadConfig() as PipecraftConfig
  } catch (error) {
    console.log('⚠️  Could not load .pipecraftrc - skipping auto-merge setup')
    return
  }

  if (!config.autoPromote || !config.branchFlow) {
    console.log('ℹ️  No autoPromote configuration found - skipping branch protection setup')
    return
  }

  // Note: Repository-level auto-merge is now handled by repository settings configuration
  // This function only configures branch protection for the branches that need it

  // Determine which branches need auto-merge
  const autoPromoteConfig = config.autoPromote
  const branchesNeedingProtection: string[] = []

  if (typeof autoPromoteConfig === 'boolean') {
    // If true for all, protect all intermediate branches
    if (autoPromoteConfig && config.branchFlow.length > 1) {
      branchesNeedingProtection.push(...config.branchFlow.slice(1, -1))
    }
  } else if (typeof autoPromoteConfig === 'object') {
    // Check which branches have autoPromote enabled
    for (const [branch, enabled] of Object.entries(autoPromoteConfig)) {
      if (enabled === true) {
        branchesNeedingProtection.push(branch)
      }
    }
  }

  if (branchesNeedingProtection.length === 0) {
    console.log('ℹ️  No branches configured for auto-merge - skipping branch protection setup')
    return
  }

  console.log(`📋 Branches with auto-merge enabled: ${branchesNeedingProtection.join(', ')}`)

  // Check each branch
  for (const branch of branchesNeedingProtection) {
    try {
      const protection = await getBranchProtection(repoInfo.owner, repoInfo.repo, branch, token)

      if (protection === null) {
        // Branch protection not configured
        if (autoApply) {
          console.log(`🔧 Configuring branch protection for ${branch}...`)
          await updateBranchProtection(
            repoInfo.owner,
            repoInfo.repo,
            branch,
            token,
            config.mergeStrategy
          )
          console.log(`✅ Branch protection enabled for ${branch}`)
        } else {
          const response: any = await prompt({
            type: 'confirm',
            name: 'enableProtection',
            message: `Enable branch protection for '${branch}' to support auto-merge?`,
            default: true
          } as any)

          if (response.enableProtection) {
            console.log(`🔧 Configuring branch protection for ${branch}...`)
            await updateBranchProtection(
              repoInfo.owner,
              repoInfo.repo,
              branch,
              token,
              config.mergeStrategy
            )
            console.log(`✅ Branch protection enabled for ${branch}`)
          } else {
            console.log(`⚠️  Skipped ${branch}:`)
            console.log(`     • Auto-merge will not work without branch protection`)
            console.log(`     • Run 'pipecraft setup-github --apply' to enable it`)
          }
        }
      } else {
        console.log(`✅ Branch protection already configured for ${branch}`)
      }
    } catch (error: any) {
      console.error(`⚠️  Could not configure protection for ${branch}: ${error.message}`)
    }
  }
}

/**
 * Main setup function
 */
export async function setupGitHubPermissions(autoApply: boolean = false): Promise<void> {
  console.log('🔍 Checking GitHub repository configuration...\n')

  // Get repository info
  const repoInfo = getRepositoryInfo()
  console.log(`📦 Repository: ${repoInfo.owner}/${repoInfo.repo}`)

  // Get GitHub token
  let token: string
  try {
    token = getGitHubToken()
    console.log('✅ GitHub token found')
  } catch (error: any) {
    console.error(`\n❌ ${error.message}`)
    process.exit(1)
  }

  // Get current permissions
  console.log('🔍 Fetching current workflow permissions...')
  const currentPermissions = await getWorkflowPermissions(repoInfo.owner, repoInfo.repo, token)

  let changes: Partial<WorkflowPermissions> | null | 'declined'
  let permissionsAlreadyCorrect = false

  if (autoApply) {
    // Auto-apply mode: determine changes without prompting
    changes = getRequiredPermissionChanges(currentPermissions)

    if (changes === null) {
      console.log('\n✅ Workflow permissions are already configured correctly!')
      permissionsAlreadyCorrect = true
    } else {
      // Show what will be applied
      console.log('\n📋 Current GitHub Actions Workflow Permissions:')
      console.log(`   Default permissions: ${currentPermissions.default_workflow_permissions}`)
      console.log(
        `   Can create/approve PRs: ${
          currentPermissions.can_approve_pull_request_reviews ? 'Yes' : 'No'
        }`
      )
      console.log('\n🔧 Applying required changes:')
      if (changes.default_workflow_permissions) {
        console.log(`   • Setting default permissions to: ${changes.default_workflow_permissions}`)
      }
      if (changes.can_approve_pull_request_reviews !== undefined) {
        console.log(
          `   • Allowing PR creation/approval: ${changes.can_approve_pull_request_reviews}`
        )
      }
    }
  } else {
    // Interactive mode: prompt for changes
    changes = await promptPermissionChanges(currentPermissions)

    if (changes === null) {
      console.log('\n✅ Workflow permissions are already configured correctly!')
      permissionsAlreadyCorrect = true
    } else if (changes === 'declined') {
      console.log('\n⚠️  Setup incomplete - permissions were not updated')
      console.log('\n📍 To update manually:')
      console.log(`   1. Visit: ${repoInfo.owner}/${repoInfo.repo}/settings/actions`)
      console.log(`   2. Enable write permissions and PR creation`)
      console.log(`   3. Or run 'pipecraft setup-github --apply' to auto-apply`)
      // Still continue to check branch protection
      permissionsAlreadyCorrect = true
    }
  }

  // Apply permission changes if needed
  if (!permissionsAlreadyCorrect && changes && changes !== 'declined') {
    console.log('\n🔄 Updating workflow permissions...')
    try {
      await updateWorkflowPermissions(repoInfo.owner, repoInfo.repo, token, changes)
      console.log('✅ GitHub Actions permissions updated successfully!')
    } catch (error: any) {
      console.error(`\n❌ ${error.message}`)
      // Continue with rest of setup even if permissions can't be updated
    }
  }

  // Check and configure repository settings (merge strategies, auto-merge, etc.)
  console.log('\n🔍 Checking repository settings...')
  try {
    const currentSettings = await getRepositorySettings(repoInfo.owner, repoInfo.repo, token)
    const recommendedSettings = getRecommendedRepositorySettings()
    const gaps = getSettingsGaps(currentSettings, recommendedSettings)

    // Display current vs recommended comparison
    displaySettingsComparison(currentSettings, recommendedSettings, gaps)

    if (Object.keys(gaps).length === 0) {
      // No changes needed
      console.log('')
    } else {
      // Changes needed
      let shouldApply = false

      if (autoApply) {
        // Auto-apply mode
        shouldApply = true
        console.log('\n🔧 Auto-applying recommended settings...')
      } else {
        // Interactive mode: prompt user
        const decision = await promptApplySettings(gaps)
        shouldApply = decision === 'apply'
      }

      if (shouldApply) {
        console.log('\n🔄 Updating repository settings...')
        await updateRepositorySettings(repoInfo.owner, repoInfo.repo, token, gaps)
        console.log('✅ Repository settings updated successfully!')
      } else {
        console.log('\n⚠️  Repository settings were not updated')
        console.log('\n📍 To update manually:')
        console.log(`   1. Visit: ${repoInfo.owner}/${repoInfo.repo}/settings`)
        console.log(`   2. Apply the recommended changes listed above`)
        console.log(`   3. Or run 'pipecraft setup-github --apply' to auto-apply`)
      }
    }
  } catch (error: any) {
    console.error(`⚠️  Could not configure repository settings: ${error.message}`)
    console.log('\n📍 To update manually:')
    console.log(`   • Visit: ${repoInfo.owner}/${repoInfo.repo}/settings`)
    console.log(`   • Check the documentation for recommended settings`)
  }

  // Configure branch protection for auto-merge
  await configureBranchProtection(repoInfo, token, autoApply)

  console.log('\n✨ Setup complete!')
  console.log('\n📍 Next Steps:')
  console.log(`   1. Verify workflow permissions:`)
  console.log(`      ${repoInfo.owner}/${repoInfo.repo}/settings/actions`)
  console.log(`   2. Verify repository settings:`)
  console.log(`      ${repoInfo.owner}/${repoInfo.repo}/settings`)
  console.log(`   3. Run 'pipecraft doctor' to check the setup`)
  console.log(
    `   4. Push a conventional commit to your initial branch — the pipeline versions, tags and releases from there`
  )
}
