/**
 * One release-it config, two callers
 *
 * `.release-it.cjs` was built in two places that disagreed. `generate` renders
 * `src/templates/release-it.cjs.tpl.ts`; `pipecraft init --with-versioning` calls
 * `setupVersionManagement()`, which calls `VersionManager.generateReleaseItConfig()`. Both
 * write the same filename, so a user's config depended on which command they ran last.
 *
 * Every divergence has been a bug: #483 (each read bump rules from a different config key)
 * and #287 (one returned `Infinity` for an empty commit list). Two remained:
 *
 *   github          template {release: true, releaseName} | VersionManager {release: false}
 *   preset fallback template honours options.preset.types | VersionManager ignores options
 *
 * Both now come from one builder, and the template's behaviour won.
 *
 * The golden fixture pins the `generate` output captured before the extraction. If that
 * file and this suite disagree, the refactor changed what existing users get — which is the
 * one thing it must not do.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PipecraftConfig } from '../../src/types/index.js'
import { VersionManager } from '../../src/utils/versioning.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')
const goldenPath = join(__dirname, '..', 'fixtures', 'release-it-golden.cjs')

/** The exact config the golden fixture was generated from. Do not change casually. */
const goldenConfig = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: { app: { paths: ['src/**'], description: 'App', prefixes: ['test'] } }
} as unknown as PipecraftConfig

function evaluate(source: string): Record<string, any> {
  const mod = { exports: {} as Record<string, any> }
  new Function('module', 'exports', 'require', source)(mod, mod.exports, () => ({}))
  return mod.exports
}

describe('release-it config, one builder', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('release-it-unified')
  })
  afterEach(() => cleanup())

  const fromTemplate = (): string => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    writeFileSync('.pipecraftrc', JSON.stringify(goldenConfig, null, 2))
    execSync(`node "${cliPath}" generate --skip-checks`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    })
    return readFileSync(join(workspace, '.release-it.cjs'), 'utf-8')
  }

  const fromVersionManager = (): string =>
    new VersionManager(goldenConfig).generateReleaseItConfig()

  it('leaves the generate output byte-identical to the golden fixture', async () => {
    await inWorkspace(workspace, () => {
      // The whole point of the extraction: existing users see no change.
      expect(fromTemplate()).toBe(readFileSync(goldenPath, 'utf-8'))
    })
  })

  it('produces the same file from both callers', async () => {
    await inWorkspace(workspace, () => {
      expect(fromVersionManager()).toBe(fromTemplate())
    })
  })

  it('agrees on github release settings', async () => {
    await inWorkspace(workspace, () => {
      const t = evaluate(fromTemplate()).github
      const v = evaluate(fromVersionManager()).github

      expect(v).toEqual(t)
      // The template's behaviour is the one that wins.
      expect(v.release).toBe(true)
      expect(v.releaseName).toBe('Release ${version}')
    })
  })

  it('agrees on preset handling for a type the config never mentions', async () => {
    await inWorkspace(workspace, () => {
      const preset = { preset: { types: [{ type: 'wip', release: 'minor' }] } }
      const levelSet = ['major', 'minor', 'patch', 'ignore']
      const bump = (src: string) =>
        levelSet[
          evaluate(src).plugins['@release-it/conventional-changelog'].whatBump(
            [{ type: 'wip', notes: [] }],
            preset
          ).level as number
        ]

      expect(bump(fromVersionManager())).toBe(bump(fromTemplate()))
      expect(bump(fromTemplate())).toBe('minor')
    })
  })

  it('still lets config beat the preset', async () => {
    await inWorkspace(workspace, () => {
      const preset = { preset: { types: [{ type: 'fix', release: 'major' }] } }
      const levelSet = ['major', 'minor', 'patch', 'ignore']
      const bump = (src: string) =>
        levelSet[
          evaluate(src).plugins['@release-it/conventional-changelog'].whatBump(
            [{ type: 'fix', notes: [] }],
            preset
          ).level as number
        ]

      // fix is 'patch' in the config; the preset must not raise it. (#483's shape.)
      expect(bump(fromTemplate())).toBe('patch')
      expect(bump(fromVersionManager())).toBe('patch')
    })
  })
})
