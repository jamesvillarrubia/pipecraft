/**
 * `pipecraft generate` on a config with `ciProvider: "gitlab"` must reject rather than
 * silently generate GitHub Actions anyway.
 *
 * src/utils/config.ts validates the ciProvider enum as ['github', 'gitlab'], but nothing
 * under src/ branches on the value once it is set: src/generators/workflows.tpl.ts
 * hardcodes `ciProvider: 'github'`. `init --ci-provider gitlab` already rejects this
 * (tests/integration/init-ci-provider.test.ts, src/cli/index.ts:213-217), but a config file
 * written by hand, or by an older Pipecraft version, still reached `generate` unchecked.
 *
 * Contract this test pins:
 *   - a `.pipecraftrc` with `ciProvider: "gitlab"` makes `generate` exit non-zero and name
 *     GitHub Actions in stderr, writing nothing.
 *   - `ciProvider: "github"` (the only supported value) still succeeds.
 */
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const baseConfig = {
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: {
    api: { paths: ['src/api/**'], description: 'API', prefixes: ['test', 'deploy'] }
  }
}

function generateIn(workspace: string) {
  return spawnSync('node', [cliPath, 'generate', '--skip-checks'], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 30000,
    env: { ...process.env, CI: 'true' }
  })
}

describe('generate with ciProvider: gitlab', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('generate-ci-provider')
    spawnSync('git', ['init'], { cwd: workspace })
  })
  afterEach(() => cleanup())

  it('rejects with a non-zero exit and names GitHub Actions', async () => {
    await inWorkspace(workspace, () => {
      writeFileSync(
        join(workspace, '.pipecraftrc'),
        JSON.stringify({ ciProvider: 'gitlab', ...baseConfig }, null, 2)
      )

      const result = generateIn(workspace)

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('GitHub Actions')
      expect(existsSync(join(workspace, '.github/workflows/pipeline.yml'))).toBe(false)
    })
  })

  it('still succeeds with ciProvider: github', async () => {
    await inWorkspace(workspace, () => {
      writeFileSync(
        join(workspace, '.pipecraftrc'),
        JSON.stringify({ ciProvider: 'github', ...baseConfig }, null, 2)
      )

      const result = generateIn(workspace)

      expect(result.status).toBe(0)
      expect(existsSync(join(workspace, '.github/workflows/pipeline.yml'))).toBe(true)
    })
  })
})
