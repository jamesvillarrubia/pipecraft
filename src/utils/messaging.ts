/**
 * Persona-Aware Messaging System for PipeCraft
 *
 * This module provides a messaging system that adapts to different user personas
 * and provides clear, actionable feedback during GitHub setup.
 *
 * ## Personas
 *
 * ### Startup Developer ("Just Make It Work")
 * - Needs simple language and clear actions
 * - Wants to know "what this means for me"
 * - Prefers step-by-step guidance
 *
 * ### Team Lead ("Safe and Consistent")
 * - Needs rationale for recommendations
 * - Wants to understand what's being changed
 * - Balances detail with clarity
 *
 * ### Platform Engineer ("I Know What I'm Doing")
 * - Wants concise status reports
 * - Prefers technical accuracy
 * - Minimal hand-holding
 *
 * ## Message Severity Levels
 *
 * - **🔴 Critical**: Setup will fail without action
 * - **🟡 Warning**: Recommended changes for optimal experience
 * - **🔵 Info**: Status updates and explanations
 * - **🟢 Success**: Completed actions and confirmations
 *
 * @module utils/messaging
 */

export type UserPersona = 'startup' | 'team-lead' | 'platform-engineer'

export type MessageSeverity = 'critical' | 'warning' | 'info' | 'success'

export interface MessageContext {
  persona: UserPersona
  verbose: boolean
  autoApply: boolean
}

export interface StatusItem {
  category: string
  name: string
  current: string
  recommended: string | null
  status: 'correct' | 'needs-change' | 'missing' | 'error'
  explanation?: string
  action?: string
}

export interface SetupSummary {
  repository: string
  overallStatus: 'ready' | 'needs-setup' | 'partial' | 'error'
  permissions: StatusItem[]
  settings: StatusItem[]
  autoMerge: StatusItem[]
  nextSteps: string[]
  warnings: string[]
  errors: string[]
}

/**
 * Detect user persona based on context clues
 */
export function detectPersona(context: {
  hasConfig: boolean
  hasWorkflows: boolean
  isFirstRun: boolean
  verbose: boolean
}): UserPersona {
  // Platform engineers typically run with verbose flags and have existing workflows
  if (context.verbose && context.hasWorkflows) {
    return 'platform-engineer'
  }

  // Team leads usually have configs but may be setting up workflows
  if (context.hasConfig && !context.isFirstRun) {
    return 'team-lead'
  }

  // Default to startup developer for first-time users
  return 'startup'
}

/**
 * Format message based on persona and severity
 */
export function formatMessage(
  message: string,
  severity: MessageSeverity,
  context: MessageContext
): string {
  const icons = {
    critical: '🔴',
    warning: '🟡',
    info: '🔵',
    success: '🟢'
  }

  const icon = icons[severity]

  // Platform engineers get minimal formatting
  if (context.persona === 'platform-engineer' && severity !== 'critical') {
    return message
  }

  // Startup developers get more explanation
  if (context.persona === 'startup' && severity === 'warning') {
    return `${icon} ${message}\n   💡 This helps PipeCraft work better with your repository`
  }

  return `${icon} ${message}`
}

/**
 * Create a clean status table
 */
export function formatStatusTable(items: StatusItem[], context: MessageContext): string {
  if (items.length === 0) return ''

  const lines: string[] = []

  // Group by category
  const categories = [...new Set(items.map(item => item.category))]

  categories.forEach(category => {
    const categoryItems = items.filter(item => item.category === category)

    lines.push(`\n📋 ${category}:`)

    categoryItems.forEach(item => {
      const statusIcon =
        item.status === 'correct'
          ? '✅'
          : item.status === 'needs-change'
          ? '⚠️'
          : item.status === 'missing'
          ? '❌'
          : '🔴'

      if (context.persona === 'platform-engineer') {
        // Concise format for platform engineers
        lines.push(`   ${statusIcon} ${item.name}: ${item.current}`)
        if (item.recommended && item.status !== 'correct') {
          lines.push(`      → ${item.recommended}`)
        }
      } else {
        // Detailed format for others
        lines.push(`   ${statusIcon} ${item.name}`)
        lines.push(`      Current: ${item.current}`)
        if (item.recommended && item.status !== 'correct') {
          lines.push(`      Recommended: ${item.recommended}`)
        }
        if (item.explanation && context.persona === 'startup') {
          lines.push(`      💡 ${item.explanation}`)
        }
      }
    })
  })

  return lines.join('\n')
}

/**
 * Format next steps based on persona
 */
export function formatNextSteps(steps: string[], context: MessageContext): string {
  if (steps.length === 0) return ''

  const lines: string[] = ['\n📍 Next Steps:']

  steps.forEach((step, index) => {
    if (context.persona === 'platform-engineer') {
      lines.push(`   ${index + 1}. ${step}`)
    } else {
      lines.push(`   ${index + 1}. ${step}`)
      // Add explanations for startup developers
      if (context.persona === 'startup' && step.includes('settings')) {
        lines.push(`      (This opens your repository settings in GitHub)`)
      }
    }
  })

  return lines.join('\n')
}

/**
 * Create setup summary
 */
export function createSetupSummary(
  repository: string,
  permissions: StatusItem[],
  settings: StatusItem[],
  autoMerge: StatusItem[],
  context: MessageContext
): SetupSummary {
  const allItems = [...permissions, ...settings, ...autoMerge]
  const needsChange = allItems.filter(item => item.status === 'needs-change')
  const missing = allItems.filter(item => item.status === 'missing')
  const errors = allItems.filter(item => item.status === 'error')

  let overallStatus: SetupSummary['overallStatus'] = 'ready'
  if (errors.length > 0) {
    overallStatus = 'error'
  } else if (missing.length > 0) {
    overallStatus = 'needs-setup'
  } else if (needsChange.length > 0) {
    overallStatus = 'partial'
  }

  const nextSteps: string[] = []
  const warnings: string[] = []

  if (overallStatus === 'error') {
    nextSteps.push('Fix the errors above and run setup again')
  } else if (overallStatus === 'needs-setup') {
    nextSteps.push('Run setup to configure missing components')
  } else if (overallStatus === 'partial') {
    nextSteps.push('Apply recommended changes for optimal experience')
  } else {
    nextSteps.push('Run "pipecraft generate" to create your workflows')
  }

  if (needsChange.length > 0) {
    warnings.push(
      `${needsChange.length} setting${needsChange.length > 1 ? 's' : ''} can be optimized`
    )
  }

  return {
    repository,
    overallStatus,
    permissions,
    settings,
    autoMerge,
    nextSteps,
    warnings,
    errors: errors.map(item => `${item.name}: ${item.current}`)
  }
}

/**
 * Format the complete setup summary
 */
export function formatSetupSummary(summary: SetupSummary, context: MessageContext): string {
  const lines: string[] = []

  // Header
  lines.push(`\n🔍 GitHub Setup Summary for ${summary.repository}`)

  // Overall status
  const statusIcons: Record<string, string> = {
    ready: '🟢',
    'needs-setup': '🟡',
    partial: '🟡',
    error: '🔴'
  }

  const statusMessages: Record<string, string> = {
    ready: 'All settings configured correctly',
    'needs-setup': 'Setup required',
    partial: 'Some optimizations available',
    error: 'Setup failed - fix errors above'
  }

  lines.push(`\n${statusIcons[summary.overallStatus]} ${statusMessages[summary.overallStatus]}`)

  // Status tables
  if (summary.permissions.length > 0) {
    lines.push(formatStatusTable(summary.permissions, context))
  }

  if (summary.settings.length > 0) {
    lines.push(formatStatusTable(summary.settings, context))
  }

  if (summary.autoMerge.length > 0) {
    lines.push(formatStatusTable(summary.autoMerge, context))
  }

  // Warnings
  if (summary.warnings.length > 0) {
    lines.push('\n⚠️  Recommendations:')
    summary.warnings.forEach(warning => {
      lines.push(`   • ${warning}`)
    })
  }

  // Errors
  if (summary.errors.length > 0) {
    lines.push('\n🔴 Errors:')
    summary.errors.forEach(error => {
      lines.push(`   • ${error}`)
    })
  }

  // Next steps
  lines.push(formatNextSteps(summary.nextSteps, context))

  return lines.join('\n')
}

/**
 * Simple success message for when everything is already configured
 */
export function formatQuickSuccess(repository: string, context: MessageContext): string {
  if (context.persona === 'platform-engineer') {
    return `✅ ${repository} is ready for PipeCraft`
  }

  return `\n🟢 GitHub setup complete for ${repository}!\n\n📍 Next: Run "pipecraft generate" to create your workflows`
}
