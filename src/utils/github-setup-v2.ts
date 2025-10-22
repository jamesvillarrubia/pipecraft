/**
 * GitHub Repository Setup and Configuration (v2 - Clean Messaging)
 *
 * This module provides utilities for setting up and configuring GitHub repositories
 * for use with PipeCraft workflows. It uses a persona-aware messaging system to
 * provide clear, actionable feedback to users.
 *
 * @module utils/github-setup-v2
 */

import { execSync } from 'child_process'
import { prompt } from '@featherscloud/pinion'
import { loadConfig } from './config.js'
import { PipecraftConfig } from '../types/index.js'
import {
  detectPersona,
  formatMessage,
  formatSetupSummary,
  formatQuickSuccess,
  createSetupSummary,
  type MessageContext,
  type StatusItem,
  type SetupSummary
} from './messaging.js'

// Re-export all the existing interfaces and functions that don't need changes
export * from './github-setup.js'

/**
 * Enhanced setup function with clean messaging
 */
export async function setupGitHubPermissionsClean(autoApply: boolean = false, verbose: boolean = false): Promise<void> {
  // Detect user persona
  const context: MessageContext = {
    persona: detectPersona({
      hasConfig: true, // We'll check this properly
      hasWorkflows: false, // We'll check this properly  
      isFirstRun: true, // We'll detect this properly
      verbose
    }),
    verbose,
    autoApply
  }

  // Get repository info
  const repoInfo = getRepositoryInfo()
  
  // Get GitHub token
  let token: string
  try {
    token = getGitHubToken()
  } catch (error: any) {
    console.error(formatMessage(`GitHub token not found: ${error.message}`, 'critical', context))
    process.exit(1)
  }

  // Collect all status items
  const permissions: StatusItem[] = []
  const settings: StatusItem[] = []
  const autoMerge: StatusItem[] = []

  // Check workflow permissions
  try {
    const currentPermissions = await getWorkflowPermissions(repoInfo.owner, repoInfo.repo, token)
    
    permissions.push({
      category: 'Permissions',
      name: 'Workflow Permissions',
      current: currentPermissions.default_workflow_permissions,
      recommended: currentPermissions.default_workflow_permissions === 'write' ? null : 'write',
      status: currentPermissions.default_workflow_permissions === 'write' ? 'correct' : 'needs-change',
      explanation: 'Allows workflows to create tags and push changes',
      action: 'Update in repository settings'
    })

    permissions.push({
      category: 'Permissions', 
      name: 'PR Creation',
      current: currentPermissions.can_approve_pull_request_reviews ? 'Enabled' : 'Disabled',
      recommended: currentPermissions.can_approve_pull_request_reviews ? null : 'Enabled',
      status: currentPermissions.can_approve_pull_request_reviews ? 'correct' : 'needs-change',
      explanation: 'Allows workflows to create and manage pull requests',
      action: 'Update in repository settings'
    })

    // Apply permission changes if needed
    const changes = getRequiredPermissionChanges(currentPermissions)
    if (changes && autoApply) {
      await updateWorkflowPermissions(repoInfo.owner, repoInfo.repo, token, changes)
    }
  } catch (error: any) {
    permissions.push({
      category: 'Permissions',
      name: 'Workflow Permissions',
      current: 'Unknown',
      recommended: 'write',
      status: 'error',
      action: 'Check repository access'
    })
  }

  // Check repository settings
  try {
    const currentSettings = await getRepositorySettings(repoInfo.owner, repoInfo.repo, token)
    const recommendedSettings = getRecommendedRepositorySettings()
    const gaps = getSettingsGaps(currentSettings, recommendedSettings)

    // Convert gaps to status items
    Object.entries(gaps).forEach(([key, value]) => {
      const settingName = getSettingDisplayName(key)
      settings.push({
        category: 'Repository Settings',
        name: settingName,
        current: formatSettingValue(currentSettings[key as keyof typeof currentSettings]),
        recommended: formatSettingValue(value),
        status: 'needs-change',
        explanation: getSettingExplanation(key),
        action: 'Update in repository settings'
      })
    })

    // Add correct settings
    Object.entries(currentSettings).forEach(([key, value]) => {
      if (!(key in gaps)) {
        const settingName = getSettingDisplayName(key)
        settings.push({
          category: 'Repository Settings',
          name: settingName,
          current: formatSettingValue(value),
          recommended: null,
          status: 'correct'
        })
      }
    })

    // Apply settings changes if needed
    if (Object.keys(gaps).length > 0 && autoApply) {
      await updateRepositorySettings(repoInfo.owner, repoInfo.repo, token, gaps)
    }
  } catch (error: any) {
    settings.push({
      category: 'Repository Settings',
      name: 'Settings Access',
      current: 'Unknown',
      recommended: 'Configured',
      status: 'error',
      action: 'Check repository permissions'
    })
  }

  // Check auto-merge configuration
  try {
    const config = loadConfig('.pipecraftrc.json') as PipecraftConfig
    if (config.autoMerge && config.branchFlow) {
      const autoMergeConfig = config.autoMerge
      const branches = config.branchFlow

      branches.forEach(branch => {
        let enabled = false
        if (typeof autoMergeConfig === 'boolean') {
          enabled = autoMergeConfig
        } else if (typeof autoMergeConfig === 'object') {
          enabled = autoMergeConfig[branch] === true
        }

        autoMerge.push({
          category: 'Auto-Merge',
          name: `Branch: ${branch}`,
          current: enabled ? 'Enabled' : 'Manual Review',
          recommended: enabled ? null : 'Enabled',
          status: enabled ? 'correct' : 'needs-change',
          explanation: enabled ? 'PRs will auto-merge when checks pass' : 'Requires manual approval',
          action: 'Configure in .pipecraftrc.json'
        })
      })
    }
  } catch (error) {
    autoMerge.push({
      category: 'Auto-Merge',
      name: 'Configuration',
      current: 'Not configured',
      recommended: 'Configure branches',
      status: 'missing',
      action: 'Add autoMerge to .pipecraftrc.json'
    })
  }

  // Create and display summary
  const summary = createSetupSummary(
    `${repoInfo.owner}/${repoInfo.repo}`,
    permissions,
    settings,
    autoMerge,
    context
  )

  // Quick success for already configured repos
  if (summary.overallStatus === 'ready') {
    console.log(formatQuickSuccess(summary.repository, context))
    return
  }

  // Display full summary
  console.log(formatSetupSummary(summary, context))

  // Show next steps based on status
  if (summary.overallStatus === 'error') {
    console.log(formatMessage('Setup failed - please fix the errors above', 'critical', context))
  } else if (summary.overallStatus === 'needs-setup') {
    console.log(formatMessage('Run setup to configure your repository', 'warning', context))
  } else if (summary.overallStatus === 'partial') {
    console.log(formatMessage('Some optimizations available - run with --apply to auto-configure', 'info', context))
  }
}

// Helper functions for the new messaging system

function getSettingDisplayName(key: string): string {
  const names: Record<string, string> = {
    allow_auto_merge: 'Auto-merge',
    allow_update_branch: 'Update PR branches',
    allow_merge_commit: 'Merge commits',
    allow_rebase_merge: 'Rebase merging',
    allow_squash_merge: 'Squash merging',
    squash_merge_commit_title: 'Squash commit title',
    squash_merge_commit_message: 'Squash commit message'
  }
  return names[key] || key
}

function formatSettingValue(value: any): string {
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF'
  if (value === undefined || value === null) return 'Not set'
  return String(value)
}

function getSettingExplanation(key: string): string {
  const explanations: Record<string, string> = {
    allow_auto_merge: 'Allows PRs to merge automatically when checks pass',
    allow_update_branch: 'Keeps PR branches up to date with base branch',
    allow_merge_commit: 'Creates merge commits (not recommended for trunk flow)',
    allow_rebase_merge: 'Rebases commits (not recommended for trunk flow)',
    allow_squash_merge: 'Squashes all commits into one (recommended)',
    squash_merge_commit_title: 'Uses PR title for commit message (recommended)',
    squash_merge_commit_message: 'Includes commit details in message (recommended)'
  }
  return explanations[key] || ''
}

// Import the original functions we need
import {
  getRepositoryInfo,
  getGitHubToken,
  getWorkflowPermissions,
  updateWorkflowPermissions,
  getRequiredPermissionChanges,
  getRepositorySettings,
  updateRepositorySettings,
  getSettingsGaps,
  getRecommendedRepositorySettings
} from './github-setup.js'
