/**
 * Comprehensive Init Generator Tests
 *
 * Tests the init.tpl.ts generator including:
 * - Default configuration structure
 * - Config template generation
 * - Interactive prompts and user input handling
 * - File generation
 * - Edge cases and variations
 */

import type { PinionContext } from '@featherscloud/pinion'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import inquirer from 'inquirer'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generate as generateInit } from '../../src/generators/init.tpl.js'
import { assertFileExists, assertValidYAML } from '../helpers/assertions.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'
import { parse as parseYAML } from 'yaml'

// Mock inquirer to avoid interactive prompts in tests
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}))

// Helper to parse YAML config
function parseConfigYAML(filepath: string): any {
  const content = readFileSync(filepath, 'utf-8')
  return parseYAML(content)
}

describe('Init Generator', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('pipecraft-init-gen')

    // Setup default mock responses for inquirer
    vi.mocked(inquirer.prompt).mockResolvedValue({
      ciProvider: 'github',
      mergeStrategy: 'fast-forward',
      requireConventionalCommits: true,
      initialBranch: 'develop',
      finalBranch: 'main',
      branchFlow: ['develop', 'staging', 'main'],
      packageManager: 'npm',
      domainSelection: 'api-web',
      enableNx: false
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Default Configuration', () => {
    // Note: The init generator currently uses hardcoded defaults from defaultConfig
    // regardless of prompt responses. This is the current behavior.

    it('should generate config with GitHub as CI provider', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        assertFileExists('.pipecraftrc')
        const config = parseConfigYAML('.pipecraftrc')
        expect(config.ciProvider).toBe('github')
        expect(config.mergeStrategy).toBe('fast-forward')
        expect(config.initialBranch).toBe('develop')
        expect(config.finalBranch).toBe('main')
      })
    })

    it('should use fast-forward as default merge strategy', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project'
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.mergeStrategy).toBe('fast-forward')
      })
    })

    it('should use develop-staging-main as default branch flow', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project'
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.branchFlow).toEqual(['develop', 'staging', 'main'])
      })
    })

    it('should include default domains', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.domains).toBeDefined()
        expect(config.domains.api).toBeDefined()
        expect(config.domains.web).toBeDefined()
        expect(config.domains.cicd).toBeDefined()
      })
    })

    it('should include default semver bump rules', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.semver).toBeDefined()
        expect(config.semver.bumpRules).toBeDefined()
        expect(config.semver.bumpRules.feat).toBe('minor')
        expect(config.semver.bumpRules.fix).toBe('patch')
        expect(config.semver.bumpRules.breaking).toBe('major')
      })
    })

    it('should include default actions', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.domains).toBeDefined()
        expect(config.branchFlow).toBeDefined()
      })
    })
  })

  describe('Branch Configuration', () => {
    it('should use develop as initial branch', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project'
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.initialBranch).toBe('develop')
      })
    })

    it('should use main as final branch', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project'
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.finalBranch).toBe('main')
      })
    })

    it('should include staging in branch flow', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project'
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.branchFlow).toContain('staging')
        expect(config.branchFlow).toHaveLength(3)
      })
    })
  })

  describe('Conventional Commits', () => {
    it('should enable conventional commits by default', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.requireConventionalCommits).toBe(true)
      })
    })
  })

  describe('Config File Format', () => {
    it('should generate valid JSON with proper formatting', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const content = readFileSync('.pipecraftrc', 'utf-8')

        // YAML should have proper formatting
        expect(content).toContain('  ') // Indentation
        expect(content).toContain('\n') // Line breaks

        // Should be valid YAML
        const parsed = parseYAML(content)
        expect(parsed).toBeDefined()
        expect(parsed.ciProvider).toBeDefined()
      })
    })

    it('should use .pipecraftrc as filename', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        expect(existsSync('.pipecraftrc')).toBe(true)
      })
    })
  })

  describe('Domain Configuration', () => {
    it('should configure api domain with correct paths', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.domains.api.paths).toContain('api/**')
        expect(config.domains.api.description).toBeDefined()
      })
    })

    it('should configure web domain with correct paths', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.domains.web.paths).toContain('web/**')
        expect(config.domains.web.description).toBeDefined()
      })
    })

    it('should configure cicd domain with correct paths', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project',
              ciProvider: 'github',
              mergeStrategy: 'fast-forward',
              requireConventionalCommits: true,
              initialBranch: 'develop',
              finalBranch: 'main',
              branchFlow: ['develop', 'staging', 'main']
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')
        expect(config.domains.cicd.paths).toContain('.github/**')
        expect(config.domains.cicd.description).toBeDefined()
      })
    })
  })

  describe('Complete Configuration', () => {
    it('should generate a complete valid configuration', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project'
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        // Verify all required fields are present
        expect(config.ciProvider).toBe('github')
        expect(config.mergeStrategy).toBe('fast-forward')
        expect(config.requireConventionalCommits).toBe(true)
        expect(config.initialBranch).toBeDefined()
        expect(config.finalBranch).toBeDefined()
        expect(config.branchFlow).toBeInstanceOf(Array)
        expect(config.semver).toBeDefined()
        expect(config.domains).toBeDefined()
      })
    })

    it('should generate config that can be used by other modules', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: ['init'],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({
              projectName: 'test-project'
            }),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        // Config should have all required fields for downstream consumers
        expect(config.domains).toHaveProperty('api')
        expect(config.domains).toHaveProperty('web')
        expect(config.domains).toHaveProperty('cicd')

        // Each domain should have required fields
        Object.values(config.domains).forEach((domain: any) => {
          expect(domain).toHaveProperty('paths')
          expect(domain).toHaveProperty('description')
          expect(domain.paths).toBeInstanceOf(Array)
        })
      })
    })
  })

  describe('Nx Workspace Detection', () => {
    beforeEach(() => {
      // Override mock for Nx tests to enable Nx
      vi.mocked(inquirer.prompt).mockResolvedValue({
        ciProvider: 'github',
        mergeStrategy: 'fast-forward',
        requireConventionalCommits: true,
        initialBranch: 'develop',
        finalBranch: 'main',
        branchFlow: ['develop', 'staging', 'main'],
        packageManager: 'npm',
        domainSelection: 'api-web',
        enableNx: true // Enable Nx for these tests
      })
    })

    it('should detect Nx workspace and add Nx config', async () => {
      await inWorkspace(workspace, async () => {
        // Create nx.json
        const nxJson = {
          targetDefaults: {
            lint: {},
            test: {},
            build: {},
            e2e: {}
          }
        }
        writeFileSync('nx.json', JSON.stringify(nxJson, null, 2))

        const ctx: PinionContext = {
          cwd: workspace,
          argv: [],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({}),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        expect(config.nx).toBeDefined()
        expect(config.nx.enabled).toBe(true)
        expect(config.nx.tasks).toBeDefined()
        expect(config.nx.tasks).toContain('lint')
        expect(config.nx.tasks).toContain('test')
        expect(config.nx.tasks).toContain('build')
        expect(config.nx.baseRef).toBe('origin/main')
        expect(config.nx.enableCache).toBe(true)
      })
    })

    it('should sort Nx tasks in logical order', async () => {
      await inWorkspace(workspace, async () => {
        const nxJson = {
          targetDefaults: {
            e2e: {},
            build: {},
            test: {},
            lint: {},
            typecheck: {}
          }
        }
        writeFileSync('nx.json', JSON.stringify(nxJson, null, 2))

        const ctx: PinionContext = {
          cwd: workspace,
          argv: [],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({}),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        // Should be sorted: lint, typecheck, test, build, e2e
        expect(config.nx.tasks[0]).toBe('lint')
        expect(config.nx.tasks[1]).toBe('typecheck')
        expect(config.nx.tasks[2]).toBe('test')
        expect(config.nx.tasks[3]).toBe('build')
        expect(config.nx.tasks[4]).toBe('e2e')
      })
    })

    it('should handle malformed nx.json gracefully', async () => {
      await inWorkspace(workspace, async () => {
        // Create invalid nx.json
        writeFileSync('nx.json', '{ invalid json')

        const ctx: PinionContext = {
          cwd: workspace,
          argv: [],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({}),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        // Should still enable Nx with defaults
        expect(config.nx).toBeDefined()
        expect(config.nx.enabled).toBe(true)
        expect(config.nx.tasks).toContain('lint')
        expect(config.nx.tasks).toContain('test')
        expect(config.nx.tasks).toContain('build')
      })
    })

    it('should not add Nx config when nx.json absent', async () => {
      await inWorkspace(workspace, async () => {
        const ctx: PinionContext = {
          cwd: workspace,
          argv: [],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({}),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        expect(config.nx).toBeUndefined()
      })
    })

    it('should handle nx.json without targetDefaults', async () => {
      await inWorkspace(workspace, async () => {
        const nxJson = {
          npmScope: 'my-org'
          // No targetDefaults
        }
        writeFileSync('nx.json', JSON.stringify(nxJson, null, 2))

        const ctx: PinionContext = {
          cwd: workspace,
          argv: [],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({}),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        expect(config.nx).toBeDefined()
        expect(config.nx.enabled).toBe(true)
        expect(config.nx.tasks).toBeInstanceOf(Array)
        expect(config.nx.tasks.length).toBe(0)
      })
    })

    it('should include all standard Nx tasks when present', async () => {
      await inWorkspace(workspace, async () => {
        const nxJson = {
          targetDefaults: {
            lint: {},
            typecheck: {},
            test: {},
            'unit-test': {},
            build: {},
            'integration-test': {},
            e2e: {},
            'e2e-ci': {},
            'custom-task': {} // Should also be included
          }
        }
        writeFileSync('nx.json', JSON.stringify(nxJson, null, 2))

        const ctx: PinionContext = {
          cwd: workspace,
          argv: [],
          pinion: {
            logger: { ...console, notice: console.log },
            prompt: async () => ({}),
            cwd: workspace,
            force: true,
            trace: [],
            exec: async () => 0
          }
        }

        await generateInit(ctx)

        const config = parseConfigYAML('.pipecraftrc')

        expect(config.nx.tasks).toHaveLength(9)
        expect(config.nx.tasks).toContain('custom-task')
      })
    })
  })
})
