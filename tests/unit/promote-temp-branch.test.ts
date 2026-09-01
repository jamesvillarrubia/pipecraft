/**
 * promote-branch temp-branch handling
 *
 * The promote action stages a promotion on a temporary branch
 * (pipecraft-promote/{source}-to-{target}-{version}) and opens a PR into the target.
 *
 * Bug this guards against: when a temp branch of the same name lingered from an earlier
 * no-op promotion (manual-gate path never cleaned it up), a later promotion at the SAME
 * version reused that stale branch AT ITS OLD COMMIT. `gh pr create` then saw "No commits
 * between" and silently no-opped — so a real promotion produced no gate PR. The temp
 * branch must ALWAYS reflect the current source tip, and a no-op must not leave an orphan.
 */
import { describe, expect, it } from 'vitest'
import { promoteBranchActionTemplate } from '../../src/templates/actions/promote-branch.yml.tpl.js'

describe('promote-branch temp-branch handling', () => {
  const yaml = promoteBranchActionTemplate({})

  it('force-syncs the temp branch to the current source tip', () => {
    // Always point the temp branch at SOURCE's current commit (idempotent for both the
    // fresh and the stale-existing case), then force-push so the remote matches.
    expect(yaml).toMatch(/git branch -f "\$TEMP_BRANCH" "\$SOURCE"/)
    expect(yaml).toMatch(/git push --force origin "\$TEMP_BRANCH"/)
  })

  it('does not blindly reuse an existing temp branch at its old commit', () => {
    expect(yaml).not.toContain('already exists, using existing branch')
  })

  it('cleans up the orphan temp branch when there is nothing to promote', () => {
    // On the "No commits between" no-op path the temp branch has no PR attached, so it
    // must be deleted — otherwise a later same-version promotion collides with the orphan.
    const noopIdx = yaml.indexOf('already up to date with')
    expect(noopIdx).toBeGreaterThan(-1)
    const noopBlock = yaml.slice(noopIdx, noopIdx + 400)
    expect(noopBlock).toMatch(/git push origin --delete "\$TEMP_BRANCH"/)
  })
})
