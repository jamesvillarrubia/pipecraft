/**
 * VersionManager.generateReleaseItConfig honours semver.bumpRules
 *
 * Two defects sat in this method:
 *
 * 1. It read bump rules from `versioning.bumpRules` only. The schema requires
 *    `semver.bumpRules`, and every other consumer (the release-it template, the
 *    pr-title-check template) reads semver first with versioning as a deprecated
 *    fallback. A project configured the way the schema demands got none of its rules.
 *
 * 2. The config object was serialised with JSON.stringify, which silently drops function
 *    values. The custom `whatBump` — the only thing that consumes bumpRules — vanished
 *    from the output entirely, so the rules were inert even when they were read.
 *
 * The existing test only asserted that the plugin key was present, which both defects
 * survive. These assert on the emitted rules themselves.
 */
import { describe, expect, it } from 'vitest'
import { PipecraftConfig } from '../../src/types/index.js'
import { VersionManager } from '../../src/utils/versioning.js'

const baseConfig = (overrides: Partial<PipecraftConfig> = {}): PipecraftConfig =>
  ({
    ciProvider: 'github',
    mergeStrategy: 'fast-forward',
    requireConventionalCommits: true,
    initialBranch: 'develop',
    finalBranch: 'main',
    branchFlow: ['develop', 'main'],
    semver: { bumpRules: { feat: 'minor', fix: 'patch', breaking: 'major' } },
    domains: { app: { paths: ['src/**'], description: 'App' } },
    ...overrides
  } as PipecraftConfig)

describe('generateReleaseItConfig bump rules', () => {
  it('emits the whatBump function rather than dropping it during serialisation', () => {
    const out = new VersionManager(baseConfig()).generateReleaseItConfig()

    // JSON.stringify would have removed this entirely.
    expect(out).toContain('whatBump')
    // And the plugin object must not be empty.
    expect(out).not.toMatch(/"@release-it\/conventional-changelog":\s*\{\s*\}/)
  })

  it('includes custom commit types declared under semver.bumpRules', () => {
    const config = baseConfig({
      semver: {
        bumpRules: { feat: 'minor', fix: 'patch', infra: 'patch', data: 'minor' }
      }
    } as Partial<PipecraftConfig>)

    const out = new VersionManager(config).generateReleaseItConfig()

    expect(out).toContain('infra')
    expect(out).toContain('data')
  })

  it('prefers semver.bumpRules over the deprecated versioning.bumpRules', () => {
    const config = baseConfig({
      semver: { bumpRules: { feat: 'major' } },
      versioning: {
        enabled: true,
        releaseItConfig: '.release-it.cjs',
        bumpRules: { feat: 'patch' }
      }
    } as Partial<PipecraftConfig>)

    const out = new VersionManager(config).generateReleaseItConfig()

    // semver wins, so feat must map to major.
    expect(out).toMatch(/feat["']?\s*:\s*["']major["']/)
    expect(out).not.toMatch(/feat["']?\s*:\s*["']patch["']/)
  })

  it('still falls back to versioning.bumpRules when semver.bumpRules is absent', () => {
    const config = baseConfig({
      versioning: {
        enabled: true,
        releaseItConfig: '.release-it.cjs',
        bumpRules: { legacy: 'minor' }
      }
    } as Partial<PipecraftConfig>)
    delete (config as { semver?: unknown }).semver

    const out = new VersionManager(config).generateReleaseItConfig()

    expect(out).toContain('legacy')
  })

  it('produces a module that evaluates to a usable config', () => {
    const out = new VersionManager(baseConfig()).generateReleaseItConfig()

    // The emitted file must be valid JS, not just a string that looks right.
    const module = { exports: {} as Record<string, unknown> }
    const fn = new Function('module', 'exports', 'require', out)
    fn(module, module.exports, () => ({ DEFAULT_PREFIXES: {} }))

    expect(module.exports).toHaveProperty('plugins')
    const plugins = module.exports.plugins as Record<string, { whatBump?: unknown }>
    expect(typeof plugins['@release-it/conventional-changelog']?.whatBump).toBe('function')
  })
})
