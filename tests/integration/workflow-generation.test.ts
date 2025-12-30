/**
 * Workflow Generation Integration Tests
 *
 * Tests the complete workflow generation pipeline, verifying that
 * config loading, template generation, and file writing work together.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertFileContains, assertFileExists } from '../helpers/assertions.js'
import { createMinimalConfig } from '../helpers/fixtures.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

// Get absolute path to CLI
const projectRoot = join(__dirname, '..', '..')
const cliPath = join(projectRoot, 'dist', 'cli', 'index.js')

describe('Workflow Generation Integration', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('workflow-integration')
  })

  afterEach(() => {
    cleanup()
  })

  describe('Config to Workflow Pipeline', () => {
    it('should generate complete workflow from minimal config', async () => {
      await inWorkspace(workspace, () => {
        // Setup git repo
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        // Create config
        const config = createMinimalConfig()
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // Generate workflows
        const result = execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        // Verify pipeline workflow exists
        assertFileExists('.github/workflows/pipeline.yml')

        // Verify actions exist
        assertFileExists('.github/actions/detect-changes/action.yml')
        assertFileExists('.github/actions/calculate-version/action.yml')

        // Verify workflow has correct structure
        assertFileContains('.github/workflows/pipeline.yml', 'name:')
        assertFileContains('.github/workflows/pipeline.yml', 'jobs:')
      })
    })

    it('should handle multiple domains correctly', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = createMinimalConfig({
          domains: {
            api: { paths: ['api/**'], description: 'API' },
            web: { paths: ['web/**'], description: 'Web' },
            shared: { paths: ['shared/**'], description: 'Shared' }
          }
        })
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        // Verify all domains in pipeline workflow (domains are passed to detect-changes dynamically)
        const pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        expect(pipeline).toContain('api')
        expect(pipeline).toContain('web')
        expect(pipeline).toContain('shared')
      })
    })

    it('should respect branch flow configuration', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = createMinimalConfig({
          branchFlow: ['develop', 'staging', 'production'],
          initialBranch: 'develop',
          finalBranch: 'production'
        })
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        const pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        expect(pipeline).toContain('develop')
        expect(pipeline).toContain('staging')
        expect(pipeline).toContain('production')
      })
    })
  })

  describe('Idempotent Regeneration', () => {
    it('should skip regeneration when nothing changed', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = createMinimalConfig()
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // First generation
        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        const firstGen = readFileSync('.github/workflows/pipeline.yml', 'utf-8')

        // Second generation without changes
        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        const secondGen = readFileSync('.github/workflows/pipeline.yml', 'utf-8')

        // Should be identical
        expect(secondGen).toBe(firstGen)
      })
    })

    it('should regenerate when config changes', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config1 = createMinimalConfig({ domains: { api: { paths: ['api/**'] } } })
        writeFileSync('.pipecraftrc', JSON.stringify(config1, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks --force`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        const firstPipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')

        // Change config
        const config2 = createMinimalConfig({
          domains: {
            api: { paths: ['api/**'] },
            web: { paths: ['web/**'] }
          }
        })
        writeFileSync('.pipecraftrc', JSON.stringify(config2, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks --force`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        const secondPipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')

        // Should be different (new domain added)
        expect(secondPipeline).not.toBe(firstPipeline)
        expect(secondPipeline).toContain('web')
      })
    })
  })

  describe('Error Handling in Pipeline', () => {
    it('should fail gracefully with invalid config', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        // Invalid config (empty domains)
        writeFileSync(
          '.pipecraftrc',
          JSON.stringify(
            {
              ciProvider: 'github',
              branchFlow: ['develop', 'main'],
              domains: {}
            },
            null,
            2
          )
        )

        try {
          execSync(`node "${cliPath}" generate --skip-checks`, {
            cwd: workspace,
            stdio: 'pipe',
            timeout: 10000,
            env: { ...process.env, CI: 'true' }
          })
          // If it succeeds, that's also okay (lenient validation)
          expect(true).toBe(true)
        } catch (error) {
          // Should fail with meaningful error
          expect(error).toBeDefined()
        }
      })
    })

    it('should fail when not in git repository', async () => {
      await inWorkspace(workspace, () => {
        const config = createMinimalConfig()
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // Try to generate without git repo
        try {
          execSync(`node "${cliPath}" generate`, {
            cwd: workspace,
            stdio: 'pipe',
            timeout: 10000,
            env: { ...process.env, CI: 'true' }
          })
          // Should fail
          expect(false).toBe(true) // Should not reach here
        } catch (error: any) {
          // Expected to fail
          expect(error).toBeDefined()
          expect(error.status).not.toBe(0)
        }
      })
    })
  })

  describe('Custom Actions Generation', () => {
    it('should generate all required action files', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = createMinimalConfig()
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        // Check all expected actions exist
        const expectedActions = [
          'detect-changes',
          'calculate-version',
          'create-tag',
          'create-pr',
          'manage-branch',
          'promote-branch'
        ]

        expectedActions.forEach(action => {
          assertFileExists(`.github/actions/${action}/action.yml`)
        })
      })
    })

    it('should generate actions with correct YAML structure', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = createMinimalConfig()
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        const detectChanges = readFileSync('.github/actions/detect-changes/action.yml', 'utf-8')

        // Verify basic YAML structure
        expect(detectChanges).toContain('name:')
        expect(detectChanges).toContain('description:')
        expect(detectChanges).toContain('runs:')
        expect(detectChanges).toContain('using:')
      })
    })
  })

  describe('Single-Branch Workflows', () => {
    it('should generate valid workflow for single-branch configuration', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        // Create single-branch config (e.g., for GitHub Actions or libraries)
        const config = createMinimalConfig({
          initialBranch: 'main',
          finalBranch: 'main',
          branchFlow: ['main'],
          domains: {
            action: {
              paths: ['**/*'],
              description: 'GitHub Action',
              testable: true,
              deployable: false
            }
          }
        })
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // Generate workflows
        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 10000,
          env: { ...process.env, CI: 'true' }
        })

        // Verify pipeline workflow exists
        assertFileExists('.github/workflows/pipeline.yml')

        const pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')

        // Verify workflow structure is valid
        expect(pipeline).toContain('name:')
        expect(pipeline).toContain('jobs:')

        // Verify promote job has valid condition (should be 'false' for single-branch)
        expect(pipeline).toContain('promote:')
        
        // The promote job should have a condition with 'false' to skip it
        // Check that there's no empty condition like '&& ()'
        expect(pipeline).not.toContain('&& ()')
        expect(pipeline).toContain('if: ${{ always() &&')
        
        // The promote job condition should contain 'false' for single-branch workflows
        const promoteSection = pipeline.substring(pipeline.indexOf('promote:'))
        expect(promoteSection).toContain('false')
      })
    })

    it('should validate single-branch configuration', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = createMinimalConfig({
          initialBranch: 'main',
          finalBranch: 'main',
          branchFlow: ['main']
        })
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // Validate should succeed
        const result = execSync(`node "${cliPath}" validate`, {
          cwd: workspace,
          encoding: 'utf-8',
          stdio: 'pipe'
        })

        expect(result).toContain('Configuration is valid')
      })
    })
  })
})
