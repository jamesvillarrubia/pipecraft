/**
 * `packageManager` reaches the one place it should, and no further
 *
 * The key was accepted by the schema, written into `.pipecraftrc` by `init`, and read by
 * nothing: `packageManager: pnpm` produced a pipeline containing no mention of pnpm. The
 * configuration reference meanwhile promised generated install commands with fallback
 * (`pnpm install --frozen-lockfile || pnpm install`), which no template has ever emitted.
 *
 * Domain job bodies are the user's, so Pipecraft does not write setup or install steps into
 * them. The one thing it does own is the placeholder it generates before the user replaces
 * it, and the example command in that placeholder should echo the manager they configured
 * rather than hardcoding npm.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const base = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: { api: { paths: ['src/**'], description: 'API', prefixes: ['test'] } }
}

describe('packageManager', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('package-manager')
  })
  afterEach(() => cleanup())

  const pipelineFor = (packageManager?: string): string => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    writeFileSync(
      '.pipecraftrc',
      JSON.stringify(packageManager ? { ...base, packageManager } : base, null, 2)
    )
    execSync(`node "${cliPath}" generate --skip-checks`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    })
    return readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')
  }

  it('uses the configured manager in the placeholder example', async () => {
    await inWorkspace(workspace, () => {
      expect(pipelineFor('pnpm')).toContain('pnpm run test:api')
    })
  })

  it('defaults the example to npm when unset', async () => {
    await inWorkspace(workspace, () => {
      expect(pipelineFor()).toContain('npm run test:api')
    })
  })

  it('writes no install or toolchain steps into domain jobs', async () => {
    await inWorkspace(workspace, () => {
      const yaml = pipelineFor('pnpm')
      const job = yaml.slice(yaml.indexOf('  test-api:'), yaml.indexOf('# <--END CUSTOM JOBS-->'))

      // Domain job bodies are the user's. Pipecraft must not decide how they install.
      expect(job).not.toMatch(/pnpm install|npm ci|yarn install/)
      expect(job).not.toContain('pnpm/action-setup')
      expect(job).not.toContain('actions/setup-node')
    })
  })

  it('does not leak the manager into managed jobs', async () => {
    await inWorkspace(workspace, () => {
      const yaml = pipelineFor('yarn')

      // The custom-jobs block sits between `version` and `gate`, so cut it out rather than
      // slicing to end-of-file — otherwise this passes on the placeholder's own example.
      // Match the indented markers: the file's header comment quotes both marker strings,
      // so an unindented indexOf finds the documentation rather than the block.
      const start = yaml.indexOf('\n  # <--START CUSTOM JOBS-->')
      const end = yaml.indexOf('\n  # <--END CUSTOM JOBS-->')
      expect(start, 'custom jobs block not found').toBeGreaterThan(0)
      const managed = yaml.slice(0, start) + yaml.slice(end)

      expect(managed).not.toMatch(/yarn/)
    })
  })
})
