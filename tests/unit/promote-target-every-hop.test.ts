/**
 * promote targets the next hop, for every hop
 *
 * buildTargetBranchExpression mapped the first source branch to the second and sent every
 * other source straight to the final branch:
 *
 *   github.ref_name == 'develop' && 'alpha' || 'production'
 *
 * Three-branch flows never showed it, because their one intermediate branch is branchFlow[1].
 * The gated flavor is develop → alpha → beta → release → production, and a push to alpha
 * opened "Release vX to production". beta and release never received the version, nothing
 * errored, and the wrong PR simply appeared. buildAutoPromoteExpression, six lines below,
 * already iterates each hop; the two inputs disagreed on the same step.
 */
import { describe, expect, it } from 'vitest'
import { createTagPromoteReleaseOperations } from '../../src/templates/workflows/shared/operations-tag-promote.js'

function targetBranchExpr(branchFlow: string[]): string {
  const ops = createTagPromoteReleaseOperations({ branchFlow, autoPromote: false as never })
  const line = JSON.stringify(ops).match(/"targetBranch":"\$\{\{ (.*?) \}\}"/)
  expect(line, 'promote job must carry a targetBranch expression').not.toBeNull()
  return line![1]
}

describe('promote target branch', () => {
  it('maps every hop of a five-branch flow to the next branch', () => {
    const expr = targetBranchExpr(['develop', 'alpha', 'beta', 'release', 'production'])

    expect(expr).toContain("github.ref_name == 'develop' && 'alpha'")
    expect(expr).toContain("github.ref_name == 'alpha' && 'beta'")
    expect(expr).toContain("github.ref_name == 'beta' && 'release'")
    expect(expr).toContain("github.ref_name == 'release' && 'production'")
    // The old shape: anything that is not the first hop falls through to the final branch.
    expect(expr).not.toMatch(/'alpha' \|\| 'production'/)
  })

  it('keeps a three-branch flow on the same hops it had', () => {
    const expr = targetBranchExpr(['develop', 'staging', 'main'])

    expect(expr).toContain("github.ref_name == 'develop' && 'staging'")
    expect(expr).toContain("github.ref_name == 'staging' && 'main'")
  })

  it('names the only target directly in a two-branch flow', () => {
    expect(targetBranchExpr(['develop', 'main'])).toBe("'main'")
  })

  it('has nowhere to promote in a single-branch flow', () => {
    expect(targetBranchExpr(['main'])).toBe("''")
  })
})
