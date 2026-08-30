/**
 * promote-branch action guards an empty targetBranch
 *
 * targetBranch is declared required, but GitHub Actions does not enforce `required: true`
 * on composite inputs — an expression that evaluates to empty (as it does in a
 * single-branch flow, where the generated job passes `${{ '' }}`) is silently accepted.
 *
 * Without a guard the empty value is substituted straight into the temp-branch name and
 * into `gh pr create --base`, so the action fails deep in a git/gh command with a message
 * about a malformed ref rather than about the actual misconfiguration. The generated
 * promote job is unreachable in a single-branch flow, but the action is public and callable
 * by anyone composing a workflow by hand, so it must fail fast with a clear message.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const actionPath = join(__dirname, '..', '..', 'actions', 'promote-branch', 'action.yml')

describe('promote-branch action input validation', () => {
  const raw = readFileSync(actionPath, 'utf-8')
  const action = parse(raw) as {
    runs: { steps: Array<{ name?: string; run?: string; uses?: string }> }
  }
  const steps = action.runs.steps

  it('validates inputs before any step consumes targetBranch', () => {
    const guardIndex = steps.findIndex(s => /validate/i.test(s.name ?? ''))
    expect(guardIndex).toBeGreaterThanOrEqual(0)

    // The guard reads the input itself, so look for the first step *after* it that does.
    const firstConsumer = steps.findIndex(
      (s, i) => i !== guardIndex && (s.run ?? '').includes('inputs.targetBranch')
    )
    expect(firstConsumer).toBeGreaterThanOrEqual(0)
    // The guard must run before anything else uses the value.
    expect(guardIndex).toBeLessThan(firstConsumer)
  })

  it('fails with an actionable error when targetBranch is empty', () => {
    const guard = steps.find(s => /validate/i.test(s.name ?? ''))
    const run = guard?.run ?? ''

    // Emptiness is what we are checking for.
    expect(run).toMatch(/-z\s+"\$TARGET"/)
    // It must be a hard failure, not a silent success that hides the misconfiguration.
    expect(run).toContain('exit 1')
    // The message must name the input so the cause is obvious in the log.
    expect(run).toMatch(/::error::.*targetBranch/)
  })

  it('also rejects a whitespace-only targetBranch', () => {
    const guard = steps.find(s => /validate/i.test(s.name ?? ''))
    const run = guard?.run ?? ''
    // Trimming before the emptiness check catches `${{ '  ' }}` style expressions.
    expect(run).toMatch(/xargs|tr -d|\$\{TARGET\/\/ \/\}|sed/)
  })
})
