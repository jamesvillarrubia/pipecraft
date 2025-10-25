/**
 * Tests for messaging system
 */

import { describe, it, expect } from 'vitest'
import {
  detectPersona,
  formatMessage,
  formatStatusTable,
  formatNextSteps,
  formatQuickSuccess,
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
      const steps = [
        'Run git commit',
        'Push to remote',
        'Create pull request'
      ]

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
})
