/**
 * `pipecraft init --ci-provider gitlab` must reject rather than silently generate GitHub
 * Actions anyway.
 *
 * src/utils/config.ts validates the ciProvider enum as ['github', 'gitlab'], but nothing
 * under src/ branches on the value once it is set: src/generators/workflows.tpl.ts
 * hardcodes `ciProvider: 'github'`, so a config declaring "gitlab" still produces GitHub
 * Actions workflows. `init` should fail fast instead of writing a config that promises
 * something `generate` cannot deliver.
 *
 * Contract this test pins:
 *   - `--ci-provider gitlab` exits non-zero and names GitHub Actions in stderr.
 *   - `--ci-provider github` (the only supported value) still succeeds.
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

function initWith(workspace: string, args: string) {
  return spawnSync('node', [cliPath, 'init', ...args.split(' ').filter(Boolean)], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 30000,
    input: '',
    env: { ...process.env, CI: 'true' }
  })
}

describe('pipecraft init --ci-provider', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('init-ci-provider')
    spawnSync('git', ['init'], { cwd: workspace })
  })
  afterEach(() => cleanup())

  it('rejects --ci-provider gitlab with a non-zero exit and names GitHub Actions', async () => {
    await inWorkspace(workspace, () => {
      const result = initWith(workspace, '--yes --ci-provider gitlab')

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('GitHub Actions')
      expect(existsSync(join(workspace, '.pipecraftrc'))).toBe(false)
    })
  })

  it('still succeeds with --ci-provider github', async () => {
    await inWorkspace(workspace, () => {
      const result = initWith(workspace, '--yes --ci-provider github')

      expect(result.status).toBe(0)
      expect(existsSync(join(workspace, '.pipecraftrc'))).toBe(true)
    })
  })
})
