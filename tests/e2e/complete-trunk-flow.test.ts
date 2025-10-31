/**
 * Complete Trunk Flow End-to-End Tests
 *
 * These tests verify the complete workflow from project initialization
 * through workflow generation and execution. They test the system as a
 * whole, simulating real user workflows.
 *
 * Note: These tests require Node.js 16+ and git to be installed.
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertFileContains, assertFileExists } from '../helpers/assertions.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

// Get absolute path to CLI
const projectRoot = join(__dirname, '..', '..')
const cliPath = join(projectRoot, 'dist', 'cli', 'index.js')

describe('Complete Trunk Flow E2E', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('e2e-trunk-flow')
  })

  afterEach(() => {
    cleanup()
  })

  describe('Project Initialization Workflow', () => {
    it('should initialize a new project from scratch', async () => {
      await inWorkspace(workspace, () => {
        // Step 1: Initialize git repository
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test User"', { cwd: workspace, stdio: 'pipe' })

        // Step 2: Add remote
        execSync('git remote add origin https://github.com/test/pipecraft-test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        // Step 3: Create initial commit
        writeFileSync('README.md', '# Test Project')
        execSync('git add .', { cwd: workspace, stdio: 'pipe' })
        execSync('git commit -m "Initial commit"', { cwd: workspace, stdio: 'pipe' })

        // Step 4: Initialize PipeCraft config
        const config = {
          ciProvider: 'github',
          mergeStrategy: 'fast-forward',
          requireConventionalCommits: true,
          initialBranch: 'develop',
          finalBranch: 'main',
          branchFlow: ['develop', 'main'],
          domains: {
            api: {
              paths: ['api/**'],
              description: 'Backend API'
            },
            web: {
              paths: ['web/**'],
              description: 'Frontend Web App'
            }
          }
        }
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // Step 5: Generate workflows
        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })

        // Verify complete setup
        assertFileExists('.pipecraftrc')
        assertFileExists('.github/workflows/pipeline.yml')
        assertFileExists('.github/actions/detect-changes/action.yml')
        assertFileExists('.github/actions/calculate-version/action.yml')
        assertFileExists('.github/actions/create-tag/action.yml')
        assertFileExists('.github/actions/create-pr/action.yml')
        assertFileExists('.github/actions/manage-branch/action.yml')
        assertFileExists('.github/actions/promote-branch/action.yml')

        // Verify workflow content
        const pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        expect(pipeline).toContain('name:')
        expect(pipeline).toContain('jobs:')
        expect(pipeline).toContain('develop')
        expect(pipeline).toContain('main')
      })
    }, 30000)
  })

  describe('Monorepo Domain Detection', () => {
    it('should detect changes in correct domains', async () => {
      await inWorkspace(workspace, () => {
        // Initialize project
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = {
          ciProvider: 'github',
          mergeStrategy: 'fast-forward',
          branchFlow: ['develop', 'main'],
          domains: {
            api: { paths: ['apps/api/**'] },
            web: { paths: ['apps/web/**'] },
            shared: { paths: ['libs/**'] }
          }
        }
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // Generate workflows
        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })

        // Verify detect-changes action includes all domains
        const detectChanges = readFileSync('.github/actions/detect-changes/action.yml', 'utf-8')
        expect(detectChanges).toContain('api')
        expect(detectChanges).toContain('web')
        expect(detectChanges).toContain('shared')

        // Verify paths are correctly configured
        expect(detectChanges).toContain('apps/api/**')
        expect(detectChanges).toContain('apps/web/**')
        expect(detectChanges).toContain('libs/**')
      })
    }, 30000)
  })

  describe('Branch Flow Configuration', () => {
    it('should handle 2-stage flow (develop → main)', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = {
          ciProvider: 'github',
          mergeStrategy: 'fast-forward',
          branchFlow: ['develop', 'main'],
          initialBranch: 'develop',
          finalBranch: 'main',
          domains: { api: { paths: ['src/**'] } }
        }
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })

        const pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        expect(pipeline).toContain('develop')
        expect(pipeline).toContain('main')

        // Should have jobs for both branches
        expect(pipeline.match(/develop/g)?.length).toBeGreaterThan(0)
        expect(pipeline.match(/main/g)?.length).toBeGreaterThan(0)
      })
    }, 30000)

    it('should handle 3-stage flow (develop → staging → main)', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = {
          ciProvider: 'github',
          mergeStrategy: 'fast-forward',
          branchFlow: ['develop', 'staging', 'main'],
          initialBranch: 'develop',
          finalBranch: 'main',
          domains: { api: { paths: ['src/**'] } }
        }
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })

        const pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        expect(pipeline).toContain('develop')
        expect(pipeline).toContain('staging')
        expect(pipeline).toContain('main')
      })
    }, 30000)
  })

  describe('Regeneration and Updates', () => {
    it('should preserve user comments when regenerating', async () => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        const config = {
          ciProvider: 'github',
          mergeStrategy: 'fast-forward',
          branchFlow: ['develop', 'main'],
          domains: { api: { paths: ['src/**'] } }
        }
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // First generation
        execSync(`node "${cliPath}" generate --skip-checks --force`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })

        // Add a custom job with a comment (job-level comments should be preserved)
        let pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        // Find the custom jobs section and add a job with a comment
        const customJobInsertion = `  # <--START CUSTOM JOBS-->\n\n  # Custom security scan job\n  security-scan:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo "Running security scan"\n\n  # <--END CUSTOM JOBS-->`
        pipeline = pipeline.replace(
          /# <--START CUSTOM JOBS-->[\s\S]*?# <--END CUSTOM JOBS-->/,
          customJobInsertion
        )
        writeFileSync('.github/workflows/pipeline.yml', pipeline)

        // Regenerate
        execSync(`node "${cliPath}" generate --skip-checks --force`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })

        // Check if job-level comment and custom job are preserved
        const newPipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        expect(newPipeline).toContain('Custom security scan job')
        expect(newPipeline).toContain('security-scan:')
        expect(newPipeline).toContain('Running security scan')
      })
    }, 30000)
  })

  describe('Real-World Scenarios', () => {
    it('should support a full-stack monorepo setup', async () => {
      await inWorkspace(workspace, () => {
        // Initialize git
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
        execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/acme/monorepo.git', {
          cwd: workspace,
          stdio: 'pipe'
        })

        // Create directory structure
        mkdirSync('apps/api', { recursive: true })
        mkdirSync('apps/web', { recursive: true })
        mkdirSync('apps/mobile', { recursive: true })
        mkdirSync('libs/shared', { recursive: true })
        mkdirSync('libs/ui', { recursive: true })

        // Create files
        writeFileSync('apps/api/index.ts', 'console.log("api")')
        writeFileSync('apps/web/index.tsx', 'console.log("web")')
        writeFileSync('apps/mobile/index.tsx', 'console.log("mobile")')
        writeFileSync('libs/shared/utils.ts', 'export const util = () => {}')
        writeFileSync('libs/ui/Button.tsx', 'export const Button = () => null')
        writeFileSync('README.md', '# Monorepo')

        // Commit initial state
        execSync('git add .', { cwd: workspace, stdio: 'pipe' })
        execSync('git commit -m "Initial commit"', { cwd: workspace, stdio: 'pipe' })

        // Configure PipeCraft
        const config = {
          ciProvider: 'github',
          mergeStrategy: 'fast-forward',
          requireConventionalCommits: true,
          initialBranch: 'develop',
          finalBranch: 'main',
          branchFlow: ['develop', 'staging', 'main'],
          domains: {
            api: {
              paths: ['apps/api/**'],
              description: 'Backend API Services'
            },
            web: {
              paths: ['apps/web/**'],
              description: 'Web Application'
            },
            mobile: {
              paths: ['apps/mobile/**'],
              description: 'Mobile Application'
            },
            shared: {
              paths: ['libs/shared/**'],
              description: 'Shared Libraries'
            },
            ui: {
              paths: ['libs/ui/**'],
              description: 'UI Components'
            }
          },
          semver: {
            bumpRules: {
              feat: 'minor',
              fix: 'patch',
              breaking: 'major'
            }
          }
        }
        writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

        // Generate workflows
        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })

        // Verify all workflows and actions generated
        assertFileExists('.github/workflows/pipeline.yml')
        assertFileExists('.github/actions/detect-changes/action.yml')
        assertFileExists('.github/actions/calculate-version/action.yml')
        assertFileExists('.github/actions/create-tag/action.yml')
        assertFileExists('.github/actions/create-pr/action.yml')
        assertFileExists('.github/actions/manage-branch/action.yml')
        assertFileExists('.github/actions/promote-branch/action.yml')

        // Verify pipeline contains all domains
        const pipeline = readFileSync('.github/workflows/pipeline.yml', 'utf-8')
        expect(pipeline).toContain('api')
        expect(pipeline).toContain('web')
        expect(pipeline).toContain('mobile')
        expect(pipeline).toContain('shared')
        expect(pipeline).toContain('ui')

        // Verify all branches in flow
        expect(pipeline).toContain('develop')
        expect(pipeline).toContain('staging')
        expect(pipeline).toContain('main')

        // Verify detect-changes has all paths
        const detectChanges = readFileSync('.github/actions/detect-changes/action.yml', 'utf-8')
        expect(detectChanges).toContain('apps/api/**')
        expect(detectChanges).toContain('apps/web/**')
        expect(detectChanges).toContain('apps/mobile/**')
        expect(detectChanges).toContain('libs/shared/**')
        expect(detectChanges).toContain('libs/ui/**')
      })
    }, 30000)
  })
})
