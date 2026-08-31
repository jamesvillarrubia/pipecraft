/**
 * Deprecated domain flags must still produce jobs, or say why not
 *
 * `testable` / `deployable` / `remoteTestable` are marked deprecated in favour of
 * `prefixes`, but the schema still accepts them and the docs still describe them. Job
 * bodies are emitted by `generatePrefixedJobsText()` in pipeline.yml.tpl.ts, which reads
 * only `prefixes`. So a config using the documented legacy flags validated, generated,
 * exited 0, and produced no test or deploy jobs at all. Nothing warned.
 *
 * Same failure as #483 and #287: a configured value passes validation and is dropped
 * before it reaches the consumer.
 *
 * The blast-radius constraint is the interesting half. `validateConfig` defaults both
 * flags to `true` when absent, so translating them unconditionally would invent
 * `test-*` and `deploy-*` jobs for every config that never mentioned them. Only flags the
 * user actually wrote may produce jobs.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const base = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } }
}

describe('deprecated domain flags', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('legacy-domain-flags')
  })
  afterEach(() => cleanup())

  /** Generate with the given domains and return [pipeline yaml, generate stdout]. */
  const generate = (domains: Record<string, unknown>): [string, string] => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    writeFileSync('.pipecraftrc', JSON.stringify({ ...base, domains }, null, 2))
    // Warnings go to stderr via logger.warn, so merge the streams.
    const out = execSync(`node "${cliPath}" generate --skip-checks 2>&1`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    }).toString()
    return [readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8'), out]
  }

  const jobNames = (yaml: string): string[] =>
    [...yaml.matchAll(/^ {2}([a-z][a-z0-9-]*):/gm)].map(m => m[1])

  it('generates test and deploy jobs from explicit testable/deployable', async () => {
    await inWorkspace(workspace, () => {
      const [yaml] = generate({
        app: { paths: ['src/**'], description: 'App', testable: true, deployable: true }
      })

      expect(jobNames(yaml)).toEqual(expect.arrayContaining(['test-app', 'deploy-app']))
    })
  })

  it('matches what the equivalent prefixes config produces', async () => {
    const domainJobs = async (domains: Record<string, unknown>): Promise<string[]> => {
      const [ws, done] = createWorkspaceWithCleanup('legacy-flag-parity')
      try {
        let jobs: string[] = []
        await inWorkspace(ws, () => {
          execSync('git init', { cwd: ws, stdio: 'pipe' })
          writeFileSync('.pipecraftrc', JSON.stringify({ ...base, domains }, null, 2))
          execSync(`node "${cliPath}" generate --skip-checks 2>&1`, {
            cwd: ws,
            stdio: 'pipe',
            timeout: 20000,
            env: { ...process.env, CI: 'true' }
          })
          const yaml = readFileSync(join(ws, '.github/workflows/pipeline.yml'), 'utf-8')
          jobs = jobNames(yaml).filter(j => /^(test|deploy)-/.test(j))
        })
        return jobs
      } finally {
        // Outside inWorkspace, so cwd is restored before the directory is removed.
        done()
      }
    }

    const legacy = await domainJobs({
      app: { paths: ['src/**'], description: 'App', testable: true, deployable: true }
    })
    const prefixed = await domainJobs({
      app: { paths: ['src/**'], description: 'App', prefixes: ['test', 'deploy'] }
    })

    expect(legacy).toEqual(prefixed)
    expect(legacy.length).toBeGreaterThan(0)
  })

  it('honours testable:false by not generating a test job', async () => {
    await inWorkspace(workspace, () => {
      const [yaml] = generate({
        app: { paths: ['src/**'], description: 'App', testable: false, deployable: true }
      })

      expect(jobNames(yaml)).toContain('deploy-app')
      expect(jobNames(yaml)).not.toContain('test-app')
    })
  })

  it('does not invent jobs for a domain that declares neither flags nor prefixes', async () => {
    await inWorkspace(workspace, () => {
      // validateConfig defaults testable/deployable to true. Those defaults must not
      // become jobs, or every existing config grows new jobs on its next regenerate.
      const [yaml] = generate({ app: { paths: ['src/**'], description: 'App' } })

      expect(jobNames(yaml).filter(j => /^(test|deploy)-/.test(j))).toEqual([])
    })
  })

  it('warns that the flags are deprecated', async () => {
    await inWorkspace(workspace, () => {
      const [, out] = generate({
        app: { paths: ['src/**'], description: 'App', testable: true, deployable: true }
      })

      // Accepted-and-inert was the bug. Accepted-and-silent is still a trap, so say it.
      expect(out).toMatch(/deprecat/i)
      expect(out).toMatch(/prefixes/i)
    })
  })

  it('prefers prefixes when both are present', async () => {
    await inWorkspace(workspace, () => {
      const [yaml] = generate({
        app: {
          paths: ['src/**'],
          description: 'App',
          prefixes: ['test'],
          deployable: true // ignored: prefixes wins
        }
      })

      expect(jobNames(yaml)).toContain('test-app')
      expect(jobNames(yaml)).not.toContain('deploy-app')
    })
  })
})
