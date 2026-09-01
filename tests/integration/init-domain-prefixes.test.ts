/**
 * `init` must produce a config that generates jobs
 *
 * `init` wrote domains with no `prefixes` and no legacy flags, so the two commands the
 * README gives a newcomer produced a pipeline with no domain jobs:
 *
 *   $ pipecraft init --yes && pipecraft generate --dry-run
 *   Domain jobs:
 *     (none — no domain declares `prefixes`, so only the managed jobs generate)
 *
 * That is #499's failure reached through the front door, and it is the first thing an
 * agent does when asked to set up CI. `init` owns the config it writes, so the config it
 * writes has to work.
 *
 * `['test']` is the conservative default: a test job per domain, with deploy left as a
 * decision the user makes rather than one Pipecraft makes for them.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse as parseYAML } from 'yaml'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

describe('init writes domains that generate jobs', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('init-domain-prefixes')
  })
  afterEach(() => cleanup())

  const init = (): Record<string, any> => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    execSync(`node "${cliPath}" init --yes < /dev/null 2>&1`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 30000,
      env: { ...process.env, CI: 'true' }
    })
    return parseYAML(readFileSync(join(workspace, '.pipecraftrc'), 'utf-8'))
  }

  const generateJobs = (): string[] => {
    execSync(`node "${cliPath}" generate --skip-checks`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 30000,
      env: { ...process.env, CI: 'true' }
    })
    const yaml = readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')
    return [...yaml.matchAll(/^ {2}([a-z][a-z0-9-]*):/gm)].map(m => m[1])
  }

  it('gives every domain a prefixes array', async () => {
    await inWorkspace(workspace, () => {
      const config = init()

      const domains = Object.entries(config.domains ?? {})
      expect(domains.length).toBeGreaterThan(0)
      for (const [name, domain] of domains as Array<[string, any]>) {
        expect(Array.isArray(domain.prefixes), `domain "${name}" has no prefixes`).toBe(true)
        expect(domain.prefixes.length, `domain "${name}" has empty prefixes`).toBeGreaterThan(0)
      }
    })
  })

  it('produces a pipeline with a test job per domain', async () => {
    await inWorkspace(workspace, () => {
      const config = init()
      const jobs = generateJobs()

      for (const name of Object.keys(config.domains)) {
        expect(jobs, `no test-${name} job was generated`).toContain(`test-${name}`)
      }
    })
  })

  it('does not decide deployment for the user', async () => {
    await inWorkspace(workspace, () => {
      init()
      const jobs = generateJobs()

      // Deploy is a choice; test is near-universal. Writing deploy placeholders into every
      // domain would be Pipecraft deciding something it has no basis to decide.
      expect(jobs.filter(j => j.startsWith('deploy-'))).toEqual([])
    })
  })

  it('writes no legacy flags', async () => {
    await inWorkspace(workspace, () => {
      const config = init()

      for (const domain of Object.values(config.domains) as any[]) {
        expect(domain.testable).toBeUndefined()
        expect(domain.deployable).toBeUndefined()
      }
    })
  })
})
