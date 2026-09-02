/**
 * Auxiliary workflows skip PipeCraft promotion PRs
 *
 * enforce-pr-target and pr-title-check trigger on every pull_request. PipeCraft's own
 * promotion PRs (head branch pipecraft-promote/*) legitimately target downstream/final
 * branches and carry release-style titles — so without a guard, enforce-pr-target FAILS
 * promote PRs to the final branch and pr-title-check FAILS their non-conventional titles,
 * producing spurious red checks and noise on every promotion. Both jobs must be guarded to
 * skip pipecraft-promote head branches.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMinimalConfig } from '../helpers/fixtures.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')
const GUARD = "!startsWith(github.head_ref, 'pipecraft-promote/')"

describe('auxiliary workflows skip promotion PRs', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('aux-workflows')
  })
  afterEach(() => cleanup())

  it.each(['enforce-pr-target.yml', 'pr-title-check.yml'])(
    '%s skips pipecraft-promote head branches',
    async file => {
      await inWorkspace(workspace, () => {
        execSync('git init', { cwd: workspace, stdio: 'pipe' })
        execSync('git remote add origin https://github.com/test/test.git', {
          cwd: workspace,
          stdio: 'pipe'
        })
        // requireConventionalCommits enables pr-title-check.yml generation.
        writeFileSync(
          '.pipecraftrc',
          JSON.stringify(createMinimalConfig({ requireConventionalCommits: true }), null, 2)
        )
        execSync(`node "${cliPath}" generate --skip-checks`, {
          cwd: workspace,
          stdio: 'pipe',
          timeout: 15000,
          env: { ...process.env, CI: 'true' }
        })
        const yaml = readFileSync(join(workspace, '.github/workflows', file), 'utf-8')
        // Defense-in-depth guard: skip pipecraft-promote head branches.
        expect(yaml).toContain(GUARD)
        // Trigger scoping: promote PRs target downstream branches, so neither check fires.
        // pr-title-check is scoped to the initial branch; enforce-pr-target to the final.
        const expectedBranch = file === 'pr-title-check.yml' ? 'develop' : 'main'
        expect(yaml).toMatch(new RegExp(`branches:\\s*\\n\\s*-\\s*${expectedBranch}`))
      })
    }
  )

  /**
   * Scoping the trigger to the final branch stopped the intermediate hops, and the last hop
   * still matched: develop → staging → main ends at main, which is exactly what
   * enforce-pr-target listens for. `github-actions[bot]` opens that PR, GitHub counts a bot
   * as a first-time contributor, and this repo's approval policy is `first_time_contributors`,
   * so the run waited for an approval nobody gives:
   *
   *   This workflow run required approval but was not approved before it expired.
   *
   * It expired into a failure on every release since v0.45.5, with zero jobs, which
   * `gh run view` reports as "likely failed because of a workflow file issue". The job-level
   * guard never ran, because approval is evaluated before a job's `if`.
   *
   * pull_request_target runs in the base repository's context and carries no approval gate.
   * The job checks out nothing and `permissions: {}` leaves it no token, so the trigger's
   * usual hazard has nothing to act on.
   */
  it('enforce-pr-target runs without waiting for an approval no one gives', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      writeFileSync('.pipecraftrc', JSON.stringify(createMinimalConfig(), null, 2))
      execSync(`node "${cliPath}" generate --skip-checks`, {
        cwd: workspace,
        stdio: 'pipe',
        timeout: 15000,
        env: { ...process.env, CI: 'true' }
      })

      const yaml = readFileSync(join(workspace, '.github/workflows/enforce-pr-target.yml'), 'utf-8')

      expect(yaml, 'pull_request is approval-gated for bot-authored PRs').toMatch(
        /^on:\n\s+pull_request_target:/m
      )
      expect(yaml, 'the trigger must not also fire the gated form').not.toMatch(
        /^\s+pull_request:/m
      )
      // pull_request_target hands the job a write token by default. Nothing here needs one.
      expect(yaml, 'pull_request_target without permissions: {} is the dangerous shape').toMatch(
        /^permissions: \{\}$/m
      )
      // Nothing from the pull request may be checked out under this trigger.
      expect(yaml).not.toContain('actions/checkout')
    })
  })
})
