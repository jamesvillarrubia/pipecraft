import { execSync } from 'child_process'
import { prompt } from '@featherscloud/pinion'
import { loadConfig } from './config.js'
import { FlowcraftConfig } from '../types/index.js'

interface WorkflowPermissions {
  default_workflow_permissions: 'read' | 'write'
  can_approve_pull_request_reviews: boolean
}

interface RepositoryInfo {
  owner: string
  repo: string
  remote: string
}

interface BranchProtectionRules {
  required_status_checks: null | {
    strict: boolean
    contexts: string[]
  }
  enforce_admins: boolean
  required_pull_request_reviews: null | {
    dismiss_stale_reviews: boolean
    require_code_owner_reviews: boolean
    required_approving_review_count: number
  }
  restrictions: null
  allow_force_pushes: boolean
  allow_deletions: boolean
  required_linear_history: boolean
  required_conversation_resolution: boolean
}

/**
 * Get repository information from git remote
 */
export function getRepositoryInfo(): RepositoryInfo {
  try {
    // Get the remote URL
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim()

    // Parse GitHub URL
    // Supports: https://github.com/owner/repo.git, git@github.com:owner/repo.git
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
 * Get GitHub token from environment or gh CLI
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
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
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
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(permissions)
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update workflow permissions: ${response.status} ${error}`)
  }
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
  console.log(`   Can create/approve PRs: ${currentPermissions.can_approve_pull_request_reviews ? 'Yes' : 'No'}`)

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
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
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
 * Update branch protection rules to enable auto-merge
 */
export async function updateBranchProtection(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<void> {
  // Minimal branch protection to enable auto-merge
  // GitHub requires at least ONE of the main protection types
  const protection: BranchProtectionRules = {
    required_status_checks: {
      strict: false,
      contexts: [] // No specific checks required, but enables the feature
    },
    enforce_admins: false,
    required_pull_request_reviews: null, // No required reviews for auto-merge branches
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    required_linear_history: true,
    required_conversation_resolution: false
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
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
  const checkResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (checkResponse.ok) {
    const repoData = await checkResponse.json()
    if (repoData.allow_auto_merge === true) {
      return false // Already enabled
    }
  }

  // Enable auto-merge
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        allow_auto_merge: true
      })
    }
  )

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

  // Load config to get autoMerge settings
  let config: FlowcraftConfig
  try {
    config = loadConfig('.pipecraftrc.json') as FlowcraftConfig
  } catch (error) {
    console.log('⚠️  Could not load .pipecraftrc.json - skipping auto-merge setup')
    return
  }

  if (!config.autoMerge || !config.branchFlow) {
    console.log('ℹ️  No autoMerge configuration found - skipping auto-merge setup')
    return
  }

  // Enable repository-level auto-merge feature
  try {
    const wasEnabled = await enableAutoMerge(repoInfo.owner, repoInfo.repo, token)
    if (wasEnabled) {
      console.log('✅ Enabled auto-merge for repository')
    } else {
      console.log('✅ Auto-merge already enabled for repository')
    }
  } catch (error: any) {
    console.error(`⚠️  Could not enable auto-merge: ${error.message}`)
    console.log('   You can enable it manually at:')
    console.log(`   https://github.com/${repoInfo.owner}/${repoInfo.repo}/settings`)
    return
  }

  // Determine which branches need auto-merge
  const autoMergeConfig = config.autoMerge
  const branchesNeedingProtection: string[] = []

  if (typeof autoMergeConfig === 'boolean') {
    // If true for all, protect all intermediate branches
    if (autoMergeConfig && config.branchFlow.length > 1) {
      branchesNeedingProtection.push(...config.branchFlow.slice(1, -1))
    }
  } else if (typeof autoMergeConfig === 'object') {
    // Check which branches have autoMerge enabled
    for (const [branch, enabled] of Object.entries(autoMergeConfig)) {
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
          await updateBranchProtection(repoInfo.owner, repoInfo.repo, branch, token)
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
            await updateBranchProtection(repoInfo.owner, repoInfo.repo, branch, token)
            console.log(`✅ Branch protection enabled for ${branch}`)
          } else {
            console.log(`⚠️  Skipped ${branch} - auto-merge will not work without branch protection`)
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
  const currentPermissions = await getWorkflowPermissions(
    repoInfo.owner,
    repoInfo.repo,
    token
  )

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
      console.log(`   Can create/approve PRs: ${currentPermissions.can_approve_pull_request_reviews ? 'Yes' : 'No'}`)
      console.log('\n🔧 Applying required changes:')
      if (changes.default_workflow_permissions) {
        console.log(`   • Setting default permissions to: ${changes.default_workflow_permissions}`)
      }
      if (changes.can_approve_pull_request_reviews !== undefined) {
        console.log(`   • Allowing PR creation/approval: ${changes.can_approve_pull_request_reviews}`)
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
      console.log('💡 You can run this command again anytime or update permissions manually at:')
      console.log(`   https://github.com/${repoInfo.owner}/${repoInfo.repo}/settings/actions`)
      // Still continue to check branch protection
      permissionsAlreadyCorrect = true
    }
  }

  // Apply permission changes if needed
  if (!permissionsAlreadyCorrect && changes && changes !== 'declined') {
    console.log('\n🔄 Updating repository settings...')
    await updateWorkflowPermissions(
      repoInfo.owner,
      repoInfo.repo,
      token,
      changes
    )

    console.log('✅ GitHub Actions permissions updated successfully!')
  }

  // Configure branch protection for auto-merge
  await configureBranchProtection(repoInfo, token, autoApply)

  console.log('\n✨ Setup complete!')
  console.log('\n💡 You can verify the changes at:')
  console.log(`   https://github.com/${repoInfo.owner}/${repoInfo.repo}/settings/actions`)
}
