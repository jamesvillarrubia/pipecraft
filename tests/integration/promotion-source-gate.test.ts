/**
 * Only GitHub-authored commits promote
 *
 * Any push to a branch in the flow started the release: version, tag, promote. A direct
 * push to `develop` — a hotfix typed on the wrong branch, a script, a rebase pushed by
 * hand — cut a release nobody asked for.
 *
 * Code that arrives through a merged pull request carries `noreply@github.com` as its
 * committer, because GitHub creates that commit. A fast-forward promotion preserves it, so
 * the marker survives the whole chain: pipecraft's own `develop` and `main` both show
 * `noreply@github.com`. A commit pushed by a human keeps their address and is not promoted.
 *
 * `workflow_dispatch` stays open so a maintainer can promote deliberately.
 *
 * This gates `tag` and `promote` only. `version` still runs, so the workflow reports the
 * version it would have used, and the domain jobs still test the push.
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
  branchFlow: ['develop', 'staging', 'main'],
  autoPromote: { staging: true, main: true },
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: { app: { paths: ['src/**'], description: 'App', prefixes: ['test'] } }
}

describe('promotion source gate', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('promotion-source-gate')
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

  it.each(['tag', 'promote'])('gates %s on a GitHub-authored commit', async job => {
    await inWorkspace(workspace, () => {
      const condition = String(pipeline().jobs[job].if)

      expect(condition).toContain(
        "github.event.head_commit.committer.email == 'noreply@github.com'"
      )
    })
  })

  it.each(['tag', 'promote'])('still allows %s via workflow_dispatch', async job => {
    await inWorkspace(workspace, () => {
      const condition = String(pipeline().jobs[job].if)

      // A maintainer must be able to promote deliberately even from a hand-pushed commit.
      expect(condition).toContain("github.event_name == 'workflow_dispatch'")
    })
  })

  it('leaves version ungated so the push still reports a version', async () => {
    await inWorkspace(workspace, () => {
      const condition = String(pipeline().jobs.version.if)

      expect(condition).not.toContain('committer.email')
    })
  })

  it('leaves domain jobs ungated so a direct push is still tested', async () => {
    await inWorkspace(workspace, () => {
      const condition = String(pipeline().jobs['test-app'].if)

      expect(condition).not.toContain('committer.email')
    })
  })

  it('keeps the existing branch and dependency conditions on tag', async () => {
    await inWorkspace(workspace, () => {
      const condition = String(pipeline().jobs.tag.if)

      // The new clause must be added to the guard, not replace it.
      expect(condition).toContain('github.ref_name')
      expect(condition).toContain('needs.version.result')
    })
  })
})
