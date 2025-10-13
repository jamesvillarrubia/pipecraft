import { execSync } from 'child_process'
import { prompt } from '@featherscloud/pinion'

interface WorkflowPermissions {
  default_workflow_permissions: 'read' | 'write'
  can_approve_pull_request_reviews: boolean
}

interface RepositoryInfo {
  owner: string
  repo: string
  remote: string
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
 * Display current permissions and prompt for changes
 */
export async function promptPermissionChanges(
  currentPermissions: WorkflowPermissions
): Promise<Partial<WorkflowPermissions> | null> {
  console.log('\n📋 Current GitHub Actions Workflow Permissions:')
  console.log(`   Default permissions: ${currentPermissions.default_workflow_permissions}`)
  console.log(`   Can create/approve PRs: ${currentPermissions.can_approve_pull_request_reviews ? 'Yes' : 'No'}`)

  // Check if permissions are already correct
  if (
    currentPermissions.default_workflow_permissions === 'write' &&
    currentPermissions.can_approve_pull_request_reviews === true
  ) {
    console.log('\n✅ Permissions are already configured correctly for FlowCraft!')
    return null
  }

  console.log('\n⚠️  FlowCraft requires the following permissions:')
  console.log('   • Default permissions: write (for creating tags and pushing)')
  console.log('   • Can create/approve PRs: Yes (for automated PR creation)')

  const changes: Partial<WorkflowPermissions> = {}

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
      console.log('⚠️  Warning: FlowCraft may not work correctly without write permissions')
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
      console.log('⚠️  Warning: FlowCraft cannot create PRs without this permission')
    }
  }

  return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Main setup function
 */
export async function setupGitHubPermissions(): Promise<void> {
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

  // Prompt for changes
  const changes = await promptPermissionChanges(currentPermissions)

  if (!changes) {
    console.log('\n✨ No changes needed!')
    return
  }

  // Apply changes
  console.log('\n🔄 Updating repository settings...')
  await updateWorkflowPermissions(
    repoInfo.owner,
    repoInfo.repo,
    token,
    changes
  )

  console.log('✅ GitHub Actions permissions updated successfully!')
  console.log('\n💡 You can verify the changes at:')
  console.log(`   https://github.com/${repoInfo.owner}/${repoInfo.repo}/settings/actions`)
}
