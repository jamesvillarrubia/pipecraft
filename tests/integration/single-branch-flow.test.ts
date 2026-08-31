/**
 * Single-branch flow generates a working pipeline
 *
 * A single-branch flow (initialBranch === finalBranch, branchFlow of length 1) is a
 * legitimate configuration: you still want change detection, versioning, tagging,
 * releases and domain build/deploy jobs — you just don't want promotion.
 *
 * The defect: enforce-pr-target.yml derives its reject condition from finalBranch and
 * its confirm condition from initialBranch. When those are the same branch, both steps
 * carry the identical `if`, the reject step runs first and exits 1, and EVERY pull
 * request to the only branch in the flow fails. There is nothing to enforce when there
 * is only one branch, so the workflow must not be generated at all.
 *
 * The rest of the pipeline must keep working — that is what these tests pin down.
 */
import type { PinionContext } from '@featherscloud/pinion'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generate as generateWorkflows } from '../../src/generators/workflows.tpl.js'
import type { PipecraftConfig } from '../../src/types/index.js'
import { createMinimalConfig } from '../helpers/fixtures.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

/** Minimal Pinion context for calling the generator in-process. */
function generatorContext(
  workspace: string,
  config: PipecraftConfig
): PinionContext & { config: PipecraftConfig } {
  return {
    cwd: workspace,
    argv: ['generate'],
    pinion: {
      logger: { ...console, notice: console.log },
      prompt: async () => ({}),
      cwd: workspace,
      force: true,
      trace: [],
      exec: async () => 0
    },
    config
  } as PinionContext & { config: PipecraftConfig }
}

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const singleBranchConfig = () =>
  createMinimalConfig({
    initialBranch: 'develop',
    finalBranch: 'develop',
    branchFlow: ['develop']
  })

function generateInto(workspace: string, config: unknown) {
  execSync('git init', { cwd: workspace, stdio: 'pipe' })
  execSync('git remote add origin https://github.com/test/test.git', {
    cwd: workspace,
    stdio: 'pipe'
  })
  writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
  execSync(`node "${cliPath}" generate --skip-checks`, {
    cwd: workspace,
    stdio: 'pipe',
    timeout: 20000,
    env: { ...process.env, CI: 'true' }
  })
}

describe('single-branch flow', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('single-branch')
  })
  afterEach(() => cleanup())

  it('does not generate enforce-pr-target.yml when the flow has one branch', async () => {
    await inWorkspace(workspace, () => {
      generateInto(workspace, singleBranchConfig())

      expect(existsSync(join(workspace, '.github/workflows/enforce-pr-target.yml'))).toBe(false)
    })
  })

  it('removes a stale enforce-pr-target.yml when regenerating into a single-branch flow', async () => {
    await inWorkspace(workspace, () => {
      // First generate a normal two-branch flow, which writes enforce-pr-target.yml.
      generateInto(workspace, createMinimalConfig())
      const enforcePath = join(workspace, '.github/workflows/enforce-pr-target.yml')
      expect(existsSync(enforcePath)).toBe(true)

      // Now collapse to a single-branch flow and regenerate.
      writeFileSync('.pipecraftrc', JSON.stringify(singleBranchConfig(), null, 2))
      execSync(`node "${cliPath}" generate --skip-checks`, {
        cwd: workspace,
        stdio: 'pipe',
        timeout: 20000,
        env: { ...process.env, CI: 'true' }
      })

      // A leftover file would reject every PR, so regeneration must clear it.
      expect(existsSync(enforcePath)).toBe(false)
    })
  })

  it('never emits a self-contradictory enforce rule for any flow it does generate', async () => {
    await inWorkspace(workspace, () => {
      generateInto(workspace, createMinimalConfig())
      const yaml = readFileSync(join(workspace, '.github/workflows/enforce-pr-target.yml'), 'utf-8')

      // The tell for the bug: the message names the same branch on both sides.
      expect(yaml).not.toMatch(/must target '(\w+)' branch, not '\1'/)
    })
  })

  it('still generates the full pipeline: changes, version, gate, tag and release', async () => {
    await inWorkspace(workspace, () => {
      generateInto(workspace, singleBranchConfig())
      const yaml = readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')

      for (const job of ['changes:', 'version:', 'gate:', 'tag:', 'release:']) {
        expect(yaml).toContain(job)
      }
      // tag and release must still be gated on the one branch in the flow, not disabled.
      expect(yaml).toMatch(/github\.ref_name == 'develop'/)
    })
  })

  it('keeps domain jobs so generation and deployment steps still run', async () => {
    await inWorkspace(workspace, () => {
      mkdirSync(join(workspace, 'src'), { recursive: true })
      generateInto(workspace, singleBranchConfig())
      const yaml = readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')

      // createMinimalConfig defines an 'app' domain that is testable and deployable.
      expect(yaml).toMatch(/app/)
    })
  })

  it('disables promote rather than emitting an empty targetBranch that would run', async () => {
    await inWorkspace(workspace, () => {
      generateInto(workspace, singleBranchConfig())
      const yaml = readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')

      // promote is kept in the graph but must be unreachable in a single-branch flow.
      expect(yaml).toContain('(false)')
    })
  })

  // The tests above drive dist/cli/index.js as a subprocess, which is the closest thing to
  // how a consumer runs it — but coverage instrumentation cannot see into that process.
  // These call the generator directly so the branch is exercised in-process too.
  describe('called in-process', () => {
    const enforceRel = '.github/workflows/enforce-pr-target.yml'

    it('skips enforce-pr-target for a single-branch flow', async () => {
      mkdirSync(join(workspace, '.github', 'workflows'), { recursive: true })

      await generateWorkflows(generatorContext(workspace, singleBranchConfig()))

      expect(existsSync(join(workspace, enforceRel))).toBe(false)
      // The pipeline itself must still be produced.
      expect(existsSync(join(workspace, '.github/workflows/pipeline.yml'))).toBe(true)
    })

    it('deletes a stale enforce-pr-target left by a multi-branch config', async () => {
      const enforceAbs = join(workspace, enforceRel)
      mkdirSync(join(workspace, '.github', 'workflows'), { recursive: true })
      writeFileSync(enforceAbs, 'name: stale\n')

      await generateWorkflows(generatorContext(workspace, singleBranchConfig()))

      expect(existsSync(enforceAbs)).toBe(false)
    })

    it('still writes enforce-pr-target for a multi-branch flow', async () => {
      mkdirSync(join(workspace, '.github', 'workflows'), { recursive: true })

      await generateWorkflows(generatorContext(workspace, createMinimalConfig()))

      expect(existsSync(join(workspace, enforceRel))).toBe(true)
    })
  })

  it('passes validate for a single-branch flow', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      writeFileSync('.pipecraftrc', JSON.stringify(singleBranchConfig(), null, 2))

      // Should not throw — single-branch is a supported configuration.
      const out = execSync(`node "${cliPath}" validate`, {
        cwd: workspace,
        stdio: 'pipe',
        timeout: 20000,
        env: { ...process.env, CI: 'true' }
      }).toString()
      expect(out).toBeTruthy()
    })
  })
})
