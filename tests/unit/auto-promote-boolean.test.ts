/**
 * autoPromote boolean form
 *
 * `autoPromote` may be a global boolean (true = auto-promote every hop) or a per-target
 * map ({ staging: true, main: false }). The map form worked, but the boolean form was
 * dead: buildAutoPromoteExpression did `autoPromote[targetBranch]`, and for the boolean
 * `true`, `true['main']` is `undefined` -> 'false'. So `autoPromote: true` silently
 * produced all-manual gates — the promote step received AUTO_PROMOTE="false" on every hop.
 */
import { describe, expect, it } from 'vitest'
import { createTagPromoteReleaseOperations } from '../../src/templates/workflows/shared/operations-tag-promote.js'

function autoPromoteExpr(autoPromote: unknown, branchFlow = ['develop', 'main']): string {
  const ops = createTagPromoteReleaseOperations({
    branchFlow,
    // cast: the config type allows boolean | map; the test exercises both at runtime
    autoPromote: autoPromote as never
  })
  const serialized = JSON.stringify(ops)
  return serialized
}

describe('autoPromote boolean form', () => {
  it('treats `autoPromote: true` as auto-promote on every hop', () => {
    const s = autoPromoteExpr(true)
    // The promotable source branch must map to 'true', not 'false'.
    expect(s).toContain("github.ref_name == 'develop' && 'true'")
    expect(s).not.toContain("github.ref_name == 'develop' && 'false'")
  })

  it('still honors a per-target map', () => {
    const s = autoPromoteExpr({ alpha: true, main: false }, ['develop', 'alpha', 'main'])
    expect(s).toContain("github.ref_name == 'develop' && 'true'") // -> alpha (true)
    expect(s).toContain("github.ref_name == 'alpha' && 'false'") // -> main (false)
  })

  it('treats `autoPromote: false`/absent as all-manual', () => {
    expect(autoPromoteExpr(false)).not.toContain("&& 'true'")
    expect(autoPromoteExpr(undefined)).not.toContain("&& 'true'")
  })
})
