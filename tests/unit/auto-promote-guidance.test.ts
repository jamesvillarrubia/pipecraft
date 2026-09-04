import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..')

/**
 * `autoPromote: false` still opens the promotion PR; it only leaves the merge to a person.
 * The name reads as "no promotion", and an assistant that has only the key's name will tell
 * a user to set it to false to stop a PR being opened. Every file that documents the key
 * has to say what false does, next to the key.
 */
const GUIDANCE_FILES = [
  'skills/pipecraft-cli/SKILL.md',
  'PIPECRAFT_AI_GUIDE.md',
  'README.md',
  'docs/docs/flows/trunk-flow.md'
]

const STATES_THE_MERGE_ONLY_RULE =
  /still opens|controls how the promotion PR is \*\*merged\*\*|which wait for a person|opened either way|a person merges/i

describe('autoPromote guidance', () => {
  for (const file of GUIDANCE_FILES) {
    it(`${file} says that false still opens the promotion PR`, () => {
      const text = readFileSync(join(root, file), 'utf-8')
      expect(text, `${file} no longer documents autoPromote`).toMatch(/autoPromote/)
      expect(text, `${file} names autoPromote without saying what false does`).toMatch(
        STATES_THE_MERGE_ONLY_RULE
      )
    })
  }
})
