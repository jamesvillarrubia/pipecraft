/**
 * Checkouts should fetch what they need and no more
 *
 * The `version` job resolves a semantic version from tags and commit messages. It reads no
 * file contents, but checked out with `fetch-depth: 0` and no filter, so it downloaded every
 * blob in the repository's history to read commit subjects. On a large repo that dominates
 * the job's runtime.
 *
 * `filter: blob:none` keeps every commit and tag, which versioning needs, and skips the file
 * contents, which it does not. Blobs are still fetched on demand if something asks for one,
 * so the filter cannot break a step that turns out to need a file.
 *
 * Change detection is a separate case and already bounded: FETCH_DEPTH_AFFECTED defaults to
 * 100 rather than 0.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse as parseYAML } from 'yaml'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const config = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: { app: { paths: ['src/**'], description: 'App', prefixes: ['test'] } }
}

describe('checkout efficiency', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('checkout-efficiency')
  })
  afterEach(() => cleanup())

  const pipeline = (): any => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
    execSync(`node "${cliPath}" generate --skip-checks`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    })
    return parseYAML(readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8'))
  }

  /** The `with:` block of the actions/checkout step in a given job. */
  const checkoutWith = (doc: any, job: string): Record<string, unknown> => {
    const step = doc.jobs[job].steps.find((s: any) => String(s.uses ?? '').includes('checkout'))
    return step?.with ?? {}
  }

  it('fetches commits and tags but not blobs for versioning', async () => {
    await inWorkspace(workspace, () => {
      const doc = pipeline()
      const withBlock = checkoutWith(doc, 'version')

      expect(withBlock.filter, 'version checkout fetches every blob in history').toBe('blob:none')
      // Depth must stay 0: semver needs the full tag history.
      expect(String(withBlock['fetch-depth'])).toContain('FETCH_DEPTH_VERSIONING')
    })
  })

  it('keeps change detection shallow rather than fetching all history', async () => {
    await inWorkspace(workspace, () => {
      const doc = pipeline()

      // FETCH_DEPTH_AFFECTED is the knob; 0 would mean full history for a diff.
      expect(doc.env.FETCH_DEPTH_AFFECTED).not.toBe(0)
      expect(doc.env.FETCH_DEPTH_AFFECTED).not.toBe('0')
    })
  })

  it('leaves branch-manipulating jobs unfiltered', async () => {
    await inWorkspace(workspace, () => {
      const doc = pipeline()

      // tag and promote move refs and can merge, so they may need file contents.
      // Filtering those is a separate decision and is deliberately not made here.
      for (const job of ['tag', 'promote']) {
        expect(checkoutWith(doc, job).filter, `${job} should not be blob-filtered`).toBeUndefined()
      }
    })
  })
})
