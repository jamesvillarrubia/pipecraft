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

  /**
   * The idempotent branch above stopped the release step failing, and the publish dispatch
   * below it went out regardless. v0.46.1 released and published, and the next push to main
   * resolved to the same version, took that branch, and dispatched publish a second time.
   * npm answered "You cannot publish over the previously published versions: 0.46.1" and
   * main showed a failed Publish run for a release that had succeeded three minutes earlier.
   */
  it('dispatches publish only for a release this run created', () => {
    expect(yaml, 'the created branch must record that it created the release').toContain(
      'release_created=true'
    )
    expect(yaml, 'the idempotent branch must record that it did not').toContain(
      'release_created=false'
    )

    const dispatch = yaml.indexOf('- name: Trigger Publish Workflow')
    expect(dispatch).toBeGreaterThan(-1)
    const step = yaml.slice(dispatch, yaml.indexOf('run: |', dispatch))
    expect(step, 'the dispatch step must be gated on the release being new').toContain(
      "if: steps.create.outputs.release_created == 'true'"
    )
  })
})
