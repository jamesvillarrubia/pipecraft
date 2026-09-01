/**
 * branch protection vs merge strategy
 *
 * setup-github protects auto-promote target branches. It used to hardcode
 * `required_linear_history: true`, but with `mergeStrategy: merge` the auto-promote pushes
 * a MERGE COMMIT to the target — and a branch that requires linear history rejects merge
 * commits (GH006 "Protected branch update failed"), silently breaking the auto-promote the
 * protection is meant to enable. Linear history may only be required for fast-forward
 * promotions (which are linear by construction).
 */
import { describe, expect, it } from 'vitest'
import { buildBranchProtectionRules } from '../../src/utils/github-setup.js'

describe('branch protection vs merge strategy', () => {
  it('does NOT require linear history for merge-strategy promotions', () => {
    expect(buildBranchProtectionRules('merge').required_linear_history).toBe(false)
  })

  it('requires linear history for fast-forward promotions', () => {
    expect(buildBranchProtectionRules('fast-forward').required_linear_history).toBe(true)
  })

  it('defaults to requiring linear history when strategy is unspecified', () => {
    // Fast-forward is the default strategy, so the default protection matches it.
    expect(buildBranchProtectionRules(undefined).required_linear_history).toBe(true)
  })

  it('keeps the rest of the protection minimal regardless of strategy', () => {
    for (const s of ['merge', 'fast-forward'] as const) {
      const p = buildBranchProtectionRules(s)
      expect(p.required_pull_request_reviews).toBeNull()
      expect(p.enforce_admins).toBe(false)
      expect(p.required_status_checks).toEqual({ strict: false, contexts: [] })
    }
  })
})
