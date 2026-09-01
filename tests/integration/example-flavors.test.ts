/**
 * Example flavor matrix — CI guard
 *
 * The canonical configs under `examples/<flavor>/.pipecraftrc.json` mirror the public
 * `the-craftlab/pipecraft-example-*` repositories. This suite generates each flavor through
 * the REAL CLI (not a test reimplementation) and asserts the flavor-defining invariants, so
 * a generator change can't silently break a published example flavor.
 *
 * Flavors:
 * - minimal: develop → main, auto-promote to main
 * - library: single-branch (main only), no promotion
 * - basic:   develop → staging → main, all auto-promote, merge commits
 * - gated:   5 branches, every hop a manual gate
 * - mixed:   develop → staging → main, auto to staging, manual gate to main
 * - remote:  references published marketplace actions (no local action files)
 */
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validateConfig } from '../../src/utils/config.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const projectRoot = join(__dirname, '..', '..')
const cliPath = join(projectRoot, 'dist', 'cli', 'index.js')
const examplesDir = join(projectRoot, 'examples')

const FLAVORS = ['minimal', 'library', 'basic', 'gated', 'mixed', 'remote'] as const

function readFlavorConfig(flavor: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(examplesDir, flavor, '.pipecraftrc.json'), 'utf-8'))
}

/** Generate the flavor in an isolated workspace and return the pipeline.yml contents. */
async function generateFlavor(workspace: string, flavor: string): Promise<string> {
  return inWorkspace(workspace, () => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    execSync('git config user.email "test@test.com"', { cwd: workspace, stdio: 'pipe' })
    execSync('git config user.name "Test"', { cwd: workspace, stdio: 'pipe' })
    execSync('git remote add origin https://github.com/test/test.git', {
      cwd: workspace,
      stdio: 'pipe'
    })
    writeFileSync(
      join(workspace, '.pipecraftrc.json'),
      JSON.stringify(readFlavorConfig(flavor), null, 2)
    )
    execSync(`node "${cliPath}" generate --skip-checks`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 15000,
      env: { ...process.env, CI: 'true' }
    })
    return readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')
  })
}

describe('example flavor matrix', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('example-flavors')
  })
  afterEach(() => cleanup())

  // Every flavor config must validate and produce the core managed jobs.
  it.each(FLAVORS)('flavor "%s" validates and generates the core jobs', async flavor => {
    expect(() => validateConfig(readFlavorConfig(flavor))).not.toThrow()
    const yaml = await generateFlavor(workspace, flavor)
    for (const job of ['changes:', 'version:', 'gate:']) {
      expect(yaml).toContain(job)
    }
  })

  it('library (single-branch) has no active promotion', async () => {
    const yaml = await generateFlavor(workspace, 'library')
    // Single-branch: the promote job is emitted but hard-guarded off, and there is no
    // target branch to promote to.
    expect(yaml).toMatch(/&&\s*\(false\)/)
    expect(yaml).toContain("targetBranch: ${{ '' }}")
  })

  it('minimal auto-promotes develop → main', async () => {
    const yaml = await generateFlavor(workspace, 'minimal')
    expect(yaml).toContain("github.ref_name == 'develop' && 'true'")
  })

  it('basic auto-promotes every hop (develop and staging)', async () => {
    const yaml = await generateFlavor(workspace, 'basic')
    expect(yaml).toContain("github.ref_name == 'develop' && 'true'")
    expect(yaml).toContain("github.ref_name == 'staging' && 'true'")
  })

  it('gated makes every hop a manual gate (no auto-promote)', async () => {
    const yaml = await generateFlavor(workspace, 'gated')
    expect(yaml).not.toMatch(/github\.ref_name == '[a-z]+' && 'true'/)
  })

  it('mixed auto-promotes to staging but gates main', async () => {
    const yaml = await generateFlavor(workspace, 'mixed')
    expect(yaml).toContain("github.ref_name == 'develop' && 'true'") // -> staging (auto)
    expect(yaml).toContain("github.ref_name == 'staging' && 'false'") // -> main (gate)
  })

  it('remote references published marketplace actions and emits no local action files', async () => {
    const yaml = await generateFlavor(workspace, 'remote')
    expect(yaml).toMatch(/uses: the-craftlab\/pipecraft\/actions\/[a-z-]+@v[0-9]/)
    expect(yaml).not.toContain('uses: ./.github/actions/')
    expect(existsSync(join(workspace, '.github/actions'))).toBe(false)
    // boolean autoPromote: true must still auto-promote the hop
    expect(yaml).toContain("github.ref_name == 'develop' && 'true'")
  })
})
