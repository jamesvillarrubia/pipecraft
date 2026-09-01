/**
 * E2E flavor proof-plan derivation
 *
 * Pins the outcome the harness derives from each flavor's committed config. If a config
 * changes (e.g. a flavor's promotion shape), this test surfaces the new expectation.
 */
import { describe, expect, it } from 'vitest'
import { FLAVORS, planForFlavor } from '../../scripts/e2e/flavors.js'

describe('e2e flavor proof plans', () => {
  it.each(FLAVORS)('derives a coherent plan for "%s"', flavor => {
    const p = planForFlavor(flavor)
    expect(p.branchFlow.length).toBeGreaterThan(0)
    expect(p.initial).toBe(p.branchFlow[0])
    expect(p.final).toBe(p.branchFlow[p.branchFlow.length - 1])
    // autoReaches is always within the flow, at or after the initial branch.
    expect(p.branchFlow).toContain(p.autoReaches)
  })

  it('library: single-branch, release only, no promotion', () => {
    const p = planForFlavor('library')
    expect(p.singleBranch).toBe(true)
    expect(p.autoReaches).toBe('main')
    expect(p.gateTarget).toBeNull()
    expect(p.expectRelease).toBe(true)
  })

  it('minimal: auto-reaches main, release, no gate', () => {
    const p = planForFlavor('minimal')
    expect(p.autoReaches).toBe('main')
    expect(p.gateTarget).toBeNull()
    expect(p.expectRelease).toBe(true)
  })

  it('basic: auto-cascades all the way to main', () => {
    const p = planForFlavor('basic')
    expect(p.autoReaches).toBe('main')
    expect(p.gateTarget).toBeNull()
    expect(p.expectRelease).toBe(true)
  })

  it('mixed: auto to staging, manual gate to main', () => {
    const p = planForFlavor('mixed')
    expect(p.autoReaches).toBe('staging')
    expect(p.gateTarget).toBe('main')
    expect(p.expectRelease).toBe(false)
  })

  it('gated: no auto hops — gate opens at the first promotion target', () => {
    const p = planForFlavor('gated')
    expect(p.autoReaches).toBe('develop')
    expect(p.gateTarget).toBe('alpha')
    expect(p.expectRelease).toBe(false)
  })

  it('remote: auto-reaches main via remote actions', () => {
    const p = planForFlavor('remote')
    expect(p.autoReaches).toBe('main')
    expect(p.remote).toBe(true)
    expect(p.expectRelease).toBe(true)
  })
})
