/**
 * The two release-it generators must agree
 *
 * Pipecraft builds `.release-it.cjs` from two places:
 *   - `src/templates/release-it.cjs.tpl.ts`, used by `pipecraft generate`
 *   - `VersionManager.generateReleaseItConfig()`, used by `setupVersionManagement()`,
 *     which `pipecraft init --with-versioning` calls (src/cli/index.ts:171)
 *
 * Both write to the same filename in a user's repo, so a user's config depends on which
 * command they ran last. Every divergence between them has been a bug: #483 was the bump
 * rules reading different config keys, #287 is the empty-commit bump level.
 *
 * These tests pin the behaviours a `.release-it.cjs` must have regardless of which
 * generator produced it. Assert on the evaluated module, not on the text — the Infinity
 * bug hid behind `JSON.stringify(Infinity) === 'null'` and looked like a working guard.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PipecraftConfig } from '../../src/types/index.js'
import { VersionManager } from '../../src/utils/versioning.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const config = (): PipecraftConfig =>
  ({
    ciProvider: 'github',
    mergeStrategy: 'fast-forward',
    requireConventionalCommits: true,
    initialBranch: 'develop',
    finalBranch: 'main',
    branchFlow: ['develop', 'main'],
    semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
    domains: { app: { paths: ['src/**'], description: 'App' } }
  } as PipecraftConfig)

/** Evaluate an emitted .release-it.cjs and return its whatBump. */
function whatBumpOf(source: string): (commits: unknown) => { level: unknown; reason: string } {
  const mod = { exports: {} as Record<string, any> }
  new Function('module', 'exports', 'require', source)(mod, mod.exports, () => ({}))
  return mod.exports.plugins['@release-it/conventional-changelog'].whatBump
}

describe('release-it config, both generators', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('release-it-parity')
  })
  afterEach(() => cleanup())

  /** The config `pipecraft generate` writes. */
  const fromTemplate = (): string => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    writeFileSync('.pipecraftrc', JSON.stringify(config(), null, 2))
    execSync(`node "${cliPath}" generate --skip-checks`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    })
    return readFileSync(join(workspace, '.release-it.cjs'), 'utf-8')
  }

  /** The config `init --with-versioning` writes. */
  const fromVersionManager = (): string => new VersionManager(config()).generateReleaseItConfig()

  it('never yields a non-finite bump level for an empty commit list', async () => {
    await inWorkspace(workspace, () => {
      for (const [name, source] of [
        ['template', fromTemplate()],
        ['VersionManager', fromVersionManager()]
      ] as const) {
        const { level } = whatBumpOf(source)([])

        // Infinity is what bare Math.min() returns with no arguments. release-it cannot
        // use it as a bump level. JSON.stringify would render it as `null`, so compare
        // the raw value.
        expect(level, `${name} returned a non-finite level`).not.toBe(Infinity)
        expect(level === null || Number.isFinite(level), `${name} level=${level}`).toBe(true)
      }
    })
  })

  it('treats a missing or empty commit list as "no release"', async () => {
    await inWorkspace(workspace, () => {
      for (const [name, source] of [
        ['template', fromTemplate()],
        ['VersionManager', fromVersionManager()]
      ] as const) {
        const wb = whatBumpOf(source)
        for (const empty of [[], null, undefined]) {
          const { level } = wb(empty)
          expect(level, `${name} with ${JSON.stringify(empty)}`).toBeNull()
        }
      }
    })
  })

  it('agrees between the two generators on the same commits', async () => {
    await inWorkspace(workspace, () => {
      const a = whatBumpOf(fromTemplate())
      const b = whatBumpOf(fromVersionManager())

      const cases: Array<Array<{ type: string; notes: unknown[] }>> = [
        [],
        [{ type: 'feat', notes: [] }],
        [{ type: 'fix', notes: [] }],
        [{ type: 'unrecognised', notes: [] }]
      ]

      for (const commits of cases) {
        expect(b(commits).level, `commits=${JSON.stringify(commits)}`).toBe(a(commits).level)
      }
    })
  })

  it('lets .pipecraftrc bump rules win over a release-it preset', async () => {
    await inWorkspace(workspace, () => {
      // The preset that ships with conventional-changelog maps some types differently to
      // Pipecraft's defaults. Config is the user's stated intent, so config wins and the
      // preset only fills types the user has not spoken about. Merging the other way round
      // silently discards configured rules, which is what #483 was.
      const preset = { preset: { types: [{ type: 'docs', release: 'minor' }] } }
      const levelSet = ['major', 'minor', 'patch', 'ignore']

      for (const [name, source] of [
        ['template', fromTemplate()],
        ['VersionManager', fromVersionManager()]
      ] as const) {
        const wb = whatBumpOf(source)
        const { level } = wb([{ type: 'docs', notes: [] }], preset)

        // docs is 'patch' in the generated DEFAULT_PREFIXES; the preset must not raise it.
        expect(levelSet[level as number], `${name} honoured the preset over config`).toBe('patch')
      }
    })
  })

  it('still falls back to the preset for a type the config never mentions', async () => {
    await inWorkspace(workspace, () => {
      // 'minor', not 'ignore', so this cannot pass by coinciding with the unknown-type
      // fallback (which is 'ignore').
      const preset = { preset: { types: [{ type: 'wip', release: 'minor' }] } }
      const levelSet = ['major', 'minor', 'patch', 'ignore']

      // Template only. VersionManager ignores `options` entirely, so it has no preset to
      // fall back to and treats 'wip' as unknown. That divergence is tracked separately;
      // asserting it here would pass for the wrong reason.
      const { level } = whatBumpOf(fromTemplate())([{ type: 'wip', notes: [] }], preset)
      expect(levelSet[level as number], 'template dropped the preset fallback').toBe('minor')
    })
  })

  it('quotes the after:release hook key so the module parses', async () => {
    await inWorkspace(workspace, () => {
      // Issue #287's other half. An unquoted `after:release` would be a label, not a key.
      // Already correct in both; this pins it.
      for (const [name, source] of [
        ['template', fromTemplate()],
        ['VersionManager', fromVersionManager()]
      ] as const) {
        expect(source, name).toMatch(/['"]after:release['"]\s*:/)
        expect(() => whatBumpOf(source), name).not.toThrow()
      }
    })
  })
})
