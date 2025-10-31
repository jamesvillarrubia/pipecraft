/**
 * Tests for messaging system
 */

import { describe, expect, it } from 'vitest'
import {
  createSetupSummary,
  detectPersona,
  formatMessage,
  formatNextSteps,
  formatQuickSuccess,
  formatSetupSummary,
  formatStatusTable,
  type MessageContext,
  type StatusItem
} from '../../src/utils/messaging.js'

describe('Messaging System', () => {
  describe('detectPersona', () => {
    it('should detect platform engineer with verbose and workflows', () => {
      const result = detectPersona({
        hasConfig: true,
        hasWorkflows: true,
        isFirstRun: false,
        verbose: true
      })
      expect(result).toBe('platform-engineer')
    })

    it('should detect team lead with config but not first run', () => {
      const result = detectPersona({
        hasConfig: true,
        hasWorkflows: false,
        isFirstRun: false,
        verbose: false
      })
      expect(result).toBe('team-lead')
    })

    it('should default to startup for first-time users', () => {
      const result = detectPersona({
        hasConfig: false,
        hasWorkflows: false,
        isFirstRun: true,
        verbose: false
      })
      expect(result).toBe('startup')
    })

    it('should default to startup when no clear signals', () => {
      const result = detectPersona({
        hasConfig: false,
        hasWorkflows: false,
        isFirstRun: false,
        verbose: false
      })
      expect(result).toBe('startup')
    })
  })

  describe('formatMessage', () => {
    it('should add icon for startup persona', () => {
      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }
      const result = formatMessage('Test message', 'info', context)
      expect(result).toContain('🔵')
      expect(result).toContain('Test message')
    })

    it('should add critical icon', () => {
      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }
      const result = formatMessage('Error occurred', 'critical', context)
      expect(result).toContain('🔴')
    })

    it('should add success icon', () => {
      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'setup'
      }
      const result = formatMessage('Setup complete', 'success', context)
      expect(result).toContain('🟢')
    })

    it('should add warning icon', () => {
      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'update'
      }
      const result = formatMessage('Consider updating', 'warning', context)
      expect(result).toContain('🟡')
    })

    it('should use minimal formatting for platform engineers', () => {
      const context: MessageContext = {
        persona: 'platform-engineer',
        operation: 'setup'
      }
      const result = formatMessage('Status update', 'info', context)
      expect(result).toBe('Status update')
    })

    it('should show icons for platform engineers on critical', () => {
      const context: MessageContext = {
        persona: 'platform-engineer',
        operation: 'setup'
      }
      const result = formatMessage('Critical error', 'critical', context)
      expect(result).toContain('🔴')
    })
  })

  describe('formatStatusTable', () => {
    it('should format status items as table', () => {
      const items: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Workflow Permissions',
          current: 'read',
          recommended: 'write',
          status: 'needs-change',
          explanation: 'Allows workflows to create tags',
          action: 'Update in settings'
        },
        {
          category: 'Settings',
          name: 'Auto-merge',
          current: 'disabled',
          recommended: 'enabled',
          status: 'missing',
          action: 'Enable in settings'
        }
      ]

      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const result = formatStatusTable(items, context)

      expect(result).toContain('Permissions')
      expect(result).toContain('Workflow Permissions')
      expect(result).toContain('read')
      expect(result).toContain('write')
    })

    it('should handle empty items array', () => {
      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const result = formatStatusTable([], context)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should show correct status indicators', () => {
      const items: StatusItem[] = [
        {
          category: 'Test',
          name: 'Correct Item',
          current: 'good',
          status: 'correct',
          action: 'None'
        },
        {
          category: 'Test',
          name: 'Needs Change Item',
          current: 'bad',
          recommended: 'good',
          status: 'needs-change',
          action: 'Fix it'
        }
      ]

      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'setup'
      }

      const result = formatStatusTable(items, context)

      expect(result).toContain('Correct Item')
      expect(result).toContain('Needs Change Item')
    })
  })

  describe('formatNextSteps', () => {
    it('should format next steps list', () => {
      const steps = ['Run git commit', 'Push to remote', 'Create pull request']

      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const result = formatNextSteps(steps, context)

      expect(result).toContain('Run git commit')
      expect(result).toContain('Push to remote')
      expect(result).toContain('Create pull request')
    })

    it('should handle empty steps', () => {
      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const result = formatNextSteps([], context)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should use numbering for multiple steps', () => {
      const steps = ['Step 1', 'Step 2', 'Step 3']

      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'setup'
      }

      const result = formatNextSteps(steps, context)

      expect(result).toContain('Step 1')
      expect(result).toContain('Step 2')
      expect(result).toContain('Step 3')
    })
  })

  describe('formatQuickSuccess', () => {
    it('should format quick success message for startup', () => {
      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const result = formatQuickSuccess('my-org/my-repo', context)

      expect(result).toContain('my-org/my-repo')
      expect(result).toBeDefined()
    })

    it('should format quick success message for team lead', () => {
      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'setup'
      }

      const result = formatQuickSuccess('my-org/my-repo', context)

      expect(result).toContain('my-org/my-repo')
      expect(result).toBeDefined()
    })

    it('should format quick success message for platform engineer', () => {
      const context: MessageContext = {
        persona: 'platform-engineer',
        operation: 'setup'
      }

      const result = formatQuickSuccess('my-org/my-repo', context)

      expect(result).toContain('my-org/my-repo')
      expect(result).toBeDefined()
    })
  })

  describe('createSetupSummary', () => {
    it('should create summary with ready status when all correct', () => {
      const permissions: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Workflow Permissions',
          current: 'write',
          status: 'correct',
          action: 'None'
        }
      ]

      const settings: StatusItem[] = [
        {
          category: 'Settings',
          name: 'Auto-merge',
          current: 'enabled',
          status: 'correct',
          action: 'None'
        }
      ]

      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', permissions, settings, [], context)

      expect(summary.overallStatus).toBe('ready')
      expect(summary.repository).toBe('my-org/my-repo')
      expect(summary.permissions).toEqual(permissions)
      expect(summary.settings).toEqual(settings)
      expect(summary.nextSteps[0]).toContain('pipecraft generate')
    })

    it('should detect error status when items have errors', () => {
      const permissions: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Workflow Permissions',
          current: 'unknown',
          recommended: 'write',
          status: 'error',
          action: 'Check access'
        }
      ]

      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', permissions, [], [], context)

      expect(summary.overallStatus).toBe('error')
      expect(summary.errors).toHaveLength(1)
      expect(summary.errors[0]).toContain('Workflow Permissions')
      expect(summary.nextSteps[0]).toContain('Fix the errors')
    })

    it('should detect needs-setup status when items are missing', () => {
      const settings: StatusItem[] = [
        {
          category: 'Settings',
          name: 'Branch Protection',
          current: 'not configured',
          recommended: 'enabled',
          status: 'missing',
          action: 'Configure in settings'
        }
      ]

      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', [], settings, [], context)

      expect(summary.overallStatus).toBe('needs-setup')
      expect(summary.nextSteps[0]).toContain('Run setup')
    })

    it('should detect partial status when items need changes', () => {
      const permissions: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Workflow Permissions',
          current: 'read',
          recommended: 'write',
          status: 'needs-change',
          action: 'Update in settings'
        }
      ]

      const context: MessageContext = {
        persona: 'platform-engineer',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', permissions, [], [], context)

      expect(summary.overallStatus).toBe('partial')
      expect(summary.warnings).toHaveLength(1)
      expect(summary.warnings[0]).toContain('1 setting can be optimized')
      expect(summary.nextSteps[0]).toContain('Apply recommended changes')
    })

    it('should handle multiple items with warnings', () => {
      const permissions: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Workflow Permissions',
          current: 'read',
          recommended: 'write',
          status: 'needs-change',
          action: 'Update'
        },
        {
          category: 'Permissions',
          name: 'PR Creation',
          current: 'disabled',
          recommended: 'enabled',
          status: 'needs-change',
          action: 'Enable'
        }
      ]

      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', permissions, [], [], context)

      expect(summary.warnings[0]).toContain('2 settings can be optimized')
    })

    it('should combine all items from permissions, settings, and autoMerge', () => {
      const permissions: StatusItem[] = [
        { category: 'Permissions', name: 'P1', current: 'ok', status: 'correct', action: 'None' }
      ]
      const settings: StatusItem[] = [
        { category: 'Settings', name: 'S1', current: 'ok', status: 'correct', action: 'None' }
      ]
      const autoMerge: StatusItem[] = [
        { category: 'Auto-merge', name: 'A1', current: 'ok', status: 'correct', action: 'None' }
      ]

      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'setup'
      }

      const summary = createSetupSummary(
        'my-org/my-repo',
        permissions,
        settings,
        autoMerge,
        context
      )

      expect(summary.permissions).toHaveLength(1)
      expect(summary.settings).toHaveLength(1)
      expect(summary.autoMerge).toHaveLength(1)
    })
  })

  describe('formatSetupSummary', () => {
    it('should format complete summary with all sections', () => {
      const permissions: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Workflow Permissions',
          current: 'write',
          status: 'correct',
          action: 'None'
        }
      ]

      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', permissions, [], [], context)
      const formatted = formatSetupSummary(summary, context)

      expect(formatted).toContain('my-org/my-repo')
      expect(formatted).toContain('All settings configured correctly')
      expect(formatted).toContain('🟢')
    })

    it('should show error status in summary', () => {
      const permissions: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Workflow Permissions',
          current: 'error',
          status: 'error',
          action: 'Fix'
        }
      ]

      const context: MessageContext = {
        persona: 'team-lead',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', permissions, [], [], context)
      const formatted = formatSetupSummary(summary, context)

      expect(formatted).toContain('🔴')
      expect(formatted).toContain('Setup failed')
      expect(formatted).toContain('Errors:')
    })

    it('should show warnings section when present', () => {
      const permissions: StatusItem[] = [
        {
          category: 'Permissions',
          name: 'Setting',
          current: 'suboptimal',
          recommended: 'optimal',
          status: 'needs-change',
          action: 'Update'
        }
      ]

      const context: MessageContext = {
        persona: 'platform-engineer',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', permissions, [], [], context)
      const formatted = formatSetupSummary(summary, context)

      expect(formatted).toContain('Recommendations:')
      expect(formatted).toContain('can be optimized')
    })

    it('should include next steps', () => {
      const context: MessageContext = {
        persona: 'startup',
        operation: 'setup'
      }

      const summary = createSetupSummary('my-org/my-repo', [], [], [], context)
      const formatted = formatSetupSummary(summary, context)

      expect(formatted).toContain('pipecraft generate')
    })
  })
})
