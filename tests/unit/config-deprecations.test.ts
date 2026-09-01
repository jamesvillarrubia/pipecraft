/**
 * config deprecation / no-op warnings (P1.6)
 *
 * mergeMethod is declared but consumed nowhere; autoMerge is a deprecated alias for
 * autoPromote. Rather than break existing configs that set them, surface them as warnings
 * so the dead surface is visible. (mergeStrategy: 'merge' IS implemented — merge-commit
 * promotion — so it must NOT warn.)
 */
import { describe, expect, it } from 'vitest'
import { getConfigWarnings, validateConfig } from '../../src/utils/config.js'
import { createMinimalConfig } from '../helpers/fixtures.js'

describe('config deprecation warnings', () => {
  it('warns that mergeMethod has no effect', () => {
    const warnings = getConfigWarnings(createMinimalConfig({ mergeMethod: 'squash' }))
    expect(warnings.join(' ')).toMatch(/mergeMethod/)
  })

  it("does NOT warn for mergeStrategy 'merge' (it is implemented)", () => {
    const warnings = getConfigWarnings(createMinimalConfig({ mergeStrategy: 'merge' }))
    expect(warnings.join(' ')).not.toMatch(/mergeStrategy/)
  })

  it('warns that autoMerge is deprecated in favor of autoPromote', () => {
    const warnings = getConfigWarnings(createMinimalConfig({ autoMerge: true }))
    expect(warnings.join(' ')).toMatch(/autoMerge/)
  })

  it('does not throw on these deprecated-but-known keys', () => {
    expect(() =>
      validateConfig(createMinimalConfig({ mergeMethod: 'squash', autoMerge: true }))
    ).not.toThrow()
  })

  it('emits no warnings for a clean fast-forward config', () => {
    expect(getConfigWarnings(createMinimalConfig())).toEqual([])
  })
})
