/**
 * `generate --dry-run` must show what it would do
 *
 * It printed "Dry run mode - would generate workflows" and returned before doing any
 * analysis, so it answered a question nobody asked. The point of a dry run is to see the
 * decision before it is made: which files get written, which already exist, and which
 * domain jobs the config produces.
 *
 * It must also still write nothing, which is the one thing the old version got right.
 */
import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const config = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: {
    api: { paths: ['src/api/**'], description: 'API', prefixes: ['test', 'deploy'] },
    web: { paths: ['src/web/**'], description: 'Web', prefixes: ['test'] }
  }
}

describe('generate --dry-run', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('generate-dry-run')
  })
  afterEach(() => cleanup())

  const dryRun = (): string => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
    return execSync(`node "${cliPath}" generate --dry-run --skip-checks 2>&1`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    }).toString()
  }

  it('lists the files it would write', async () => {
    await inWorkspace(workspace, () => {
      const out = dryRun()

      for (const file of [
        '.github/workflows/pipeline.yml',
        '.github/workflows/enforce-pr-target.yml',
        '.github/workflows/pr-title-check.yml',
        '.release-it.cjs'
      ]) {
        expect(out, `dry run never mentioned ${file}`).toContain(file)
      }
    })
  })

  it('lists the composite actions it would write', async () => {
    await inWorkspace(workspace, () => {
      const out = dryRun()

      expect(out).toContain('detect-changes')
      expect(out).toContain('calculate-version')
      expect(out).toContain('promote-branch')
    })
  })

  it('names the domain jobs the config produces', async () => {
    await inWorkspace(workspace, () => {
      const out = dryRun()

      // The most common config mistake is domain jobs that never appear (#499).
      // A dry run is where that should become visible.
      expect(out).toContain('test-api')
      expect(out).toContain('deploy-api')
      expect(out).toContain('test-web')
      expect(out).not.toContain('deploy-web')
    })
  })

  it('distinguishes files that already exist from new ones', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
      mkdirSync(join(workspace, '.github', 'workflows'), { recursive: true })
      writeFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'name: existing\n')

      const out = execSync(`node "${cliPath}" generate --dry-run --skip-checks 2>&1`, {
        cwd: workspace,
        stdio: 'pipe',
        timeout: 20000,
        env: { ...process.env, CI: 'true' }
      }).toString()

      // pipeline.yml exists and would be merged; the others do not exist yet.
      expect(out).toMatch(/update|exists|merge/i)
      expect(out).toMatch(/create|new/i)
    })
  })

  it('writes nothing', async () => {
    await inWorkspace(workspace, () => {
      dryRun()

      expect(existsSync(join(workspace, '.github/workflows/pipeline.yml'))).toBe(false)
      expect(existsSync(join(workspace, '.release-it.cjs'))).toBe(false)
    })
  })
})
