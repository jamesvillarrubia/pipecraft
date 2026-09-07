/**
 * Workflow Snapshot Tests
 *
 * Tests workflow generation against snapshots for core configuration scenarios.
 * These tests catch unexpected changes in generated YAML output.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { Document, parseDocument, stringify } from 'yaml'

import type { PipecraftConfig } from '../../src/types'
import { applyPathOperations, type PathOperationConfig } from '../../src/utils/ast-path-operations'
import { validateConfig } from '../../src/utils/config'
import { validateWorkflowSemantics } from '../../src/utils/workflow-semantics'
import {
  createChangesJobOperation,
  createHeaderOperations,
  createTagPromoteReleaseOperations,
  createVersionJobOperation
} from '../../src/templates/workflows/shared'
import { ensureGateJob } from '../../src/templates/workflows/shared/operations-gate'

const FIXTURES_DIR = join(__dirname, '../fixtures/snapshot-configs')

/**
 * Generate a workflow document from a Pipecraft config
 */
function generateWorkflowFromConfig(config: PipecraftConfig): string {
  const operations: PathOperationConfig[] = [
    // Header (name, triggers)
    ...createHeaderOperations({
      branchFlow: config.branchFlow
    }),

    // Changes detection
    createChangesJobOperation({
      domains: config.domains,
      useNx: false,
      baseRef: config.finalBranch,
      config
    }),

    // Version calculation
    createVersionJobOperation({
      testJobNames: [],
      nxEnabled: false,
      baseRef: config.finalBranch,
      config
    }),

    // Tag, promote, release
    ...createTagPromoteReleaseOperations({
      branchFlow: config.branchFlow,
      autoPromote: typeof config.autoPromote === 'object' ? config.autoPromote : {},
      config
    })
  ]

  // Create document and apply operations
  const doc = parseDocument('{}')
  applyPathOperations(doc.contents, operations)
  ensureGateJob(doc as Document.Parsed)

  return stringify(doc, {
    lineWidth: 0,
    indent: 2,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    minContentWidth: 0
  })
}

/**
 * Load and validate a config from fixtures
 */
function loadConfig(name: string): PipecraftConfig {
  const configPath = join(FIXTURES_DIR, `${name}.json`)
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  validateConfig(config)
  return config as PipecraftConfig
}

describe('Workflow Snapshots', () => {
  const scenarios = [
    'minimal',
    'multi-domain',
    'single-branch',
    'three-branch',
    'with-auto-merge',
    'remote-actions'
  ]

  describe.each(scenarios)('Config: %s', configName => {
    it('should generate valid YAML', () => {
      const config = loadConfig(configName)
      const yaml = generateWorkflowFromConfig(config)

      // Should be able to parse without errors
      expect(() => parseDocument(yaml)).not.toThrow()
    })

    it('should pass semantic validation', () => {
      const config = loadConfig(configName)
      const yaml = generateWorkflowFromConfig(config)

      const result = validateWorkflowSemantics(yaml)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should include required managed jobs', () => {
      const config = loadConfig(configName)
      const yaml = generateWorkflowFromConfig(config)
      const parsed = parseDocument(yaml).toJSON()

      // All workflows should have these core jobs
      expect(parsed.jobs).toHaveProperty('changes')
      expect(parsed.jobs).toHaveProperty('version')
      expect(parsed.jobs).toHaveProperty('gate')
      expect(parsed.jobs).toHaveProperty('tag')
      expect(parsed.jobs).toHaveProperty('release')

      // Single-branch workflows don't need promote job
      if (config.branchFlow.length > 1) {
        expect(parsed.jobs).toHaveProperty('promote')
      }
    })

    it('should match snapshot', () => {
      const config = loadConfig(configName)
      const yaml = generateWorkflowFromConfig(config)

      expect(yaml).toMatchSnapshot()
    })
  })

  describe('Specific Validations', () => {
    it('minimal: should have correct branch triggers', () => {
      const config = loadConfig('minimal')
      const yaml = generateWorkflowFromConfig(config)
      const parsed = parseDocument(yaml).toJSON()

      // Push triggers all branches in flow
      expect(parsed.on.push.branches).toContain('develop')
      expect(parsed.on.push.branches).toContain('main')
      // Pull request only triggers on initial branch (develop)
      expect(parsed.on.pull_request.branches).toContain('develop')
      expect(parsed.on.pull_request.branches).toHaveLength(1)
    })

    it('single-branch: should have promote job with false condition', () => {
      const config = loadConfig('single-branch')
      const yaml = generateWorkflowFromConfig(config)
      const parsed = parseDocument(yaml).toJSON()

      // Single-branch workflows have promote job but with 'false' condition
      expect(parsed.jobs.promote.if).toContain('false')
    })

    it('three-branch: should have staging in push branches', () => {
      const config = loadConfig('three-branch')
      const yaml = generateWorkflowFromConfig(config)
      const parsed = parseDocument(yaml).toJSON()

      // Push triggers all branches in flow (develop, staging, main)
      expect(parsed.on.push.branches).toContain('develop')
      expect(parsed.on.push.branches).toContain('staging')
      expect(parsed.on.push.branches).toContain('main')
      // Pull request only triggers on initial branch (develop)
      expect(parsed.on.pull_request.branches).toContain('develop')
      expect(parsed.on.pull_request.branches).toHaveLength(1)
    })

    it('with-auto-merge: should include autoPromote in promote job', () => {
      const config = loadConfig('with-auto-merge')
      const yaml = generateWorkflowFromConfig(config)
      const parsed = parseDocument(yaml).toJSON()

      // Check promote job has autoPromote configuration
      const promoteSteps = parsed.jobs.promote.steps
      const promoteAction = promoteSteps.find(
        (s: { with?: { autoPromote?: string } }) => s.with?.autoPromote
      )
      expect(promoteAction).toBeDefined()
    })

    it('remote-actions: should use remote action references', () => {
      const config = loadConfig('remote-actions')
      const yaml = generateWorkflowFromConfig(config)

      // Should use remote action paths, not local ./ paths
      expect(yaml).toContain('the-craftlab/')
      expect(yaml).not.toMatch(/uses:\s+\.\//m) // Should not have local action references
    })

    it('minimal: pipeline declares a workflow_dispatch version input for promotion threading', () => {
      const config = loadConfig('minimal')
      const yaml = generateWorkflowFromConfig(config)
      const parsed = parseDocument(yaml).toJSON()

      const versionInput = parsed.on.workflow_dispatch.inputs.version
      expect(versionInput).toBeDefined()
      expect(versionInput.type).toBe('string')
      expect(versionInput.required).toBe(false)
    })

    it('minimal: version job passes the dispatched version into calculate-version', () => {
      const config = loadConfig('minimal')
      const yaml = generateWorkflowFromConfig(config)
      const parsed = parseDocument(yaml).toJSON()

      const versionStep = parsed.jobs.version.steps.find((s: { id?: string }) => s.id === 'version')
      expect(versionStep).toBeDefined()
      expect(versionStep.with.version).toBe('${{ inputs.version }}')
    })

    it('promote-branch action dispatches the pipeline workflow with the resolved version', () => {
      // actions/promote-branch/action.yml is generated from
      // src/templates/actions/promote-branch.yml.tpl.ts via `pnpm sync-actions` and kept in
      // sync by `pnpm sync-actions:check` in CI, so reading the committed file here is
      // reading the same content the template renders (see promote-branch-guard.test.ts
      // for the same pattern).
      const actionPath = join(__dirname, '../../actions/promote-branch/action.yml')
      const raw = readFileSync(actionPath, 'utf-8')
      expect(raw).toContain('--field version="$VERSION"')
    })

    it('calculate-version action prefers the dispatched input version over the tag lookup', () => {
      // actions/calculate-version/action.yml is the synced output of
      // src/templates/actions/calculate-version.yml.tpl.ts (same sync mechanism as above).
      const actionPath = join(__dirname, '../../actions/calculate-version/action.yml')
      const raw = readFileSync(actionPath, 'utf-8')
      const action = parseDocument(raw).toJSON() as {
        runs: { steps: Array<{ id?: string; if?: string; run?: string }> }
      }
      const steps = action.runs.steps

      const checkInputStep = steps.find(s => s.id === 'check_input_version')
      expect(checkInputStep).toBeDefined()
      expect(checkInputStep?.run).toContain('${{ inputs.version }}')

      const tagLookupStep = steps.find(s => s.id === 'get_version_old')
      expect(tagLookupStep).toBeDefined()
      expect(tagLookupStep?.if).toBe("steps.check_input_version.outputs.version == ''")
    })
  })
})
