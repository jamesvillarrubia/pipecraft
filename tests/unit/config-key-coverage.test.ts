/**
 * Every config key must be read by something
 *
 * The most common defect in this repo is a key that validates, gets documented, and is read
 * by nothing. `generate` exits 0, the user sees success, and the thing they configured
 * silently does not happen:
 *
 *   #483  semver.bumpRules read from the wrong key
 *   #287  Infinity bump level from a path nothing called
 *   #499  testable / deployable generated no jobs at all
 *   #506  init's five flags ignored entirely
 *   #290  packageManager read by nothing, while docs promised install commands
 *
 * Five separate fixes for one shape. This test makes the shape a build failure: a key in
 * KNOWN_CONFIG_KEYS that no generator or template mentions either needs wiring up or needs
 * removing.
 *
 * It greps rather than traces. A mention is weak evidence that a key is honoured — #499's
 * `testable` was mentioned in `getDomainJobNames()` while the code that built jobs ignored
 * it — so this catches "nothing reads this at all", not "this is read correctly". The
 * behavioural tests do the latter.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { KNOWN_CONFIG_KEYS, KNOWN_DOMAIN_KEYS } from '../../src/types/index.js'

const SRC = join(__dirname, '..', '..', 'src')

/**
 * Keys deliberately not read by any generator, each with the reason.
 *
 * Adding to this list is a decision, not a formality: it asserts the key is inert on
 * purpose and that a user setting it should not expect an effect.
 */
const EXEMPT: Record<string, string> = {
  // Deprecated aliases. `getConfigWarnings()` surfaces them at load; validation translates
  // or ignores them, and no generator should read them directly.
  autoMerge: 'deprecated alias for autoPromote; warned about at config load',
  mergeMethod: 'declared but inert; warned about at config load',
  versioning: 'deprecated spelling of semver.bumpRules; resolved during validation',
  testable: 'deprecated; validateConfig translates it into prefixes (#499)',
  deployable: 'deprecated; validateConfig translates it into prefixes (#499)',
  remoteTestable: 'deprecated; validateConfig translates it into prefixes (#499)'
}

/** Every .ts file under src/, excluding the type declarations that merely name the keys. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      sourceFiles(path, acc)
    } else if (entry.endsWith('.ts') && !path.endsWith(join('types', 'index.ts'))) {
      acc.push(path)
    }
  }
  return acc
}

const corpus = sourceFiles(SRC)
  .map(f => readFileSync(f, 'utf-8'))
  .join('\n')

describe('config key coverage', () => {
  it.each(KNOWN_CONFIG_KEYS.filter(k => !(k in EXEMPT)))(
    'top-level key "%s" is read somewhere outside the type declarations',
    key => {
      expect(
        corpus.includes(key),
        `"${key}" is accepted by validation and documented, but no file under src/ ` +
          `mentions it. Either wire it up, remove it, or add it to EXEMPT with a reason.`
      ).toBe(true)
    }
  )

  it.each(KNOWN_DOMAIN_KEYS.filter(k => !(k in EXEMPT)))(
    'domain key "%s" is read somewhere outside the type declarations',
    key => {
      expect(
        corpus.includes(key),
        `domain key "${key}" is accepted but nothing under src/ reads it.`
      ).toBe(true)
    }
  )

  it('exempts only keys that are still declared', () => {
    // A stale exemption hides the fact that a key was removed, and would keep passing.
    const declared = new Set<string>([...KNOWN_CONFIG_KEYS, ...KNOWN_DOMAIN_KEYS])
    for (const key of Object.keys(EXEMPT)) {
      expect(declared.has(key), `EXEMPT lists "${key}", which is no longer a config key`).toBe(true)
    }
  })

  it('gives a reason for every exemption', () => {
    for (const [key, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, `EXEMPT["${key}"] needs a reason`).toBeGreaterThan(20)
    }
  })
})
