/**
 * create-release idempotency under set -e
 *
 * Composite action steps run with `bash -e -o pipefail`. The release step captured the
 * gh output with `RELEASE_OUTPUT=$(gh release create ...)` and then inspected `$?` — but
 * under `set -e` a failed command substitution in an assignment exits the script
 * IMMEDIATELY, before `RELEASE_EXIT_CODE=$?` or the "already exists" idempotency branch
 * could run. So a re-run for an existing version failed hard instead of no-opping.
 *
 * The fix wraps the gh call in `set +e` / `set -e` (the same guard the promote action uses
 * for `gh pr create`) so the exit code is captured and the idempotency handler is reached.
 */
import { describe, expect, it } from 'vitest'
import { releaseActionTemplate } from '../../src/templates/actions/create-release.yml.tpl.js'

describe('create-release idempotency', () => {
  const yaml = releaseActionTemplate({})

  it('disables errexit around the gh release create call so its exit code is captured', () => {
    const createIdx = yaml.indexOf('gh release create')
    expect(createIdx).toBeGreaterThan(-1)
    // `set +e` must appear before the create call, and `set -e` be restored after it.
    const before = yaml.slice(Math.max(0, createIdx - 200), createIdx)
    expect(before).toMatch(/set \+e/)
    const after = yaml.slice(createIdx, createIdx + 300)
    expect(after).toMatch(/RELEASE_EXIT_CODE=\$\?/)
    expect(after).toMatch(/set -e/)
  })

  it('still treats an already-existing release as an idempotent success', () => {
    expect(yaml).toMatch(/grep -qiE 'already exists'/)
    expect(yaml).toContain('treating as success (idempotent)')
  })
})
