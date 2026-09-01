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
})
