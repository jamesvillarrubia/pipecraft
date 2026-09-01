/**
 * `pipecraft init` must be runnable without a human
 *
 * init declared five flags — --interactive, --ci-provider, --merge-strategy,
 * --initial-branch, --final-branch — and honoured none of them. `src/cli/index.ts` passed
 * only `argv` and `force` into the generator, and `init.tpl.ts` prompted for every value
 * regardless. With stdin closed it died on "User force closed the prompt" and wrote
 * nothing.
 *
 * That blocks scripted setup, CI, and any AI coding agent, which is the on-ramp Pipecraft
 * most wants to work. Same silent-failure family as #499 and #314: declared, documented,
 * inert.
 *
 * Contract these tests pin:
 *   - `--yes` never prompts.
 *   - No TTY behaves like `--yes`, and says so.
 *   - Supplied flags are used verbatim, not overwritten by defaults or prompts.
 */
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse as parseYAML } from 'yaml'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

/** Run init with stdin closed, so any prompt is fatal rather than hanging. */
function initWith(workspace: string, args: string): string {
  execSync('git init', { cwd: workspace, stdio: 'pipe' })
  return execSync(`node "${cliPath}" init ${args} < /dev/null 2>&1`, {
    cwd: workspace,
    stdio: 'pipe',
    timeout: 30000,
    env: { ...process.env, CI: 'true' }
  }).toString()
}

/** The written config, whichever supported filename init chose. */
function readConfig(workspace: string): Record<string, any> {
  for (const name of ['.pipecraftrc', '.pipecraftrc.json', '.pipecraftrc.yml']) {
    const path = join(workspace, name)
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf-8')
      return name.endsWith('.json') ? JSON.parse(raw) : parseYAML(raw)
    }
  }
  throw new Error('init wrote no config file')
}

describe('pipecraft init, non-interactive', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('init-non-interactive')
  })
  afterEach(() => cleanup())

  it('writes a config with --yes and no TTY', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes')

      const config = readConfig(workspace)
      expect(config.ciProvider).toBe('github')
      expect(config.initialBranch).toBeTruthy()
      expect(config.finalBranch).toBeTruthy()
      expect(Array.isArray(config.branchFlow)).toBe(true)
    })
  })

  it('honours the branch flags instead of prompting or defaulting', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes --initial-branch trunk --final-branch production')

      const config = readConfig(workspace)
      expect(config.initialBranch).toBe('trunk')
      expect(config.finalBranch).toBe('production')
      // The flow must actually reflect the branches, not the develop/main defaults.
      expect(config.branchFlow[0]).toBe('trunk')
      expect(config.branchFlow[config.branchFlow.length - 1]).toBe('production')
    })
  })

  it('honours --merge-strategy and --ci-provider', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes --merge-strategy merge --ci-provider github')

      const config = readConfig(workspace)
      expect(config.mergeStrategy).toBe('merge')
      expect(config.ciProvider).toBe('github')
    })
  })

  it('falls back to non-interactive when stdin is not a TTY, and says so', async () => {
    await inWorkspace(workspace, () => {
      // No --yes. Piping /dev/null means no TTY, so it must proceed rather than die.
      const out = initWith(workspace, '')

      expect(existsSync(join(workspace, '.pipecraftrc'))).toBe(true)
      expect(out).toMatch(/non-interactive|no tty|defaults/i)
    })
  })

  it('writes a config that passes pipecraft validate', async () => {
    await inWorkspace(workspace, () => {
      // branchFlow used to come from the defaults regardless of the chosen branches, so
      // `--initial-branch trunk` produced a config that failed Pipecraft's own validation:
      //   initialBranch "trunk" must be the first branch in branchFlow
      // This hits interactive mode too, whenever someone picks a non-default branch.
      initWith(workspace, '--yes --initial-branch trunk --final-branch production')

      const out = execSync(`node "${cliPath}" validate 2>&1`, {
        cwd: workspace,
        stdio: 'pipe',
        timeout: 30000,
        env: { ...process.env, CI: 'true' }
      }).toString()

      expect(out).not.toMatch(/validation failed/i)
    })
  })

  it('collapses to a single-branch flow when both branches are the same', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes --initial-branch main --final-branch main')

      const config = readConfig(workspace)
      expect(config.branchFlow).toEqual(['main'])
    })
  })

  it('keeps develop → staging → main when the defaults are used', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes')

      const config = readConfig(workspace)
      expect(config.branchFlow).toEqual(['develop', 'staging', 'main'])
    })
  })

  it('produces a config that generate accepts', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes --initial-branch dev --final-branch release')

      // The point of init is a config you can immediately generate from.
      execSync(`node "${cliPath}" generate --skip-checks 2>&1`, {
        cwd: workspace,
        stdio: 'pipe',
        timeout: 30000,
        env: { ...process.env, CI: 'true' }
      })

      const yaml = readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')
      expect(yaml).toContain('dev')
      expect(yaml).toContain('release')
    })
  })
})
