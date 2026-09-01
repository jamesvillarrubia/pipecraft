/**
 * Managed auxiliary workflows pick up config changes on regeneration
 *
 * `enforce-pr-target.yml` and `pr-title-check.yml` are rendered whole from config — unlike
 * `pipeline.yml`, they have no user-editable regions to preserve. Pinion skips writing any
 * file that already exists, so without `force` these two were written once and then never
 * updated again. `generate` reported "Skipped file" and exited 0, so nothing looked wrong.
 *
 * The consequences were silent and lasting:
 *   - Renaming `finalBranch` left enforce-pr-target still enforcing the old branch name.
 *   - Adding a commit type to `semver.bumpRules` left pr-title-check rejecting PR titles
 *     that used it.
 *   - Collapsing to a single-branch flow left the self-contradictory version in place,
 *     failing every PR.
 *
 * This bit Pipecraft itself: its own committed enforce-pr-target.yml never picked up the
 * trigger scoping and promote-branch guard added to the template in #480.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { createMinimalConfig } from '../helpers/fixtures.js'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

describe('managed auxiliary workflows regenerate', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('regen-managed')
  })
  afterEach(() => cleanup())

  const write = (config: unknown) => writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

  const generate = () =>
    execSync(`node "${cliPath}" generate --skip-checks`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    })

  it('propagates a finalBranch rename into enforce-pr-target', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      write(createMinimalConfig({ requireConventionalCommits: true }))
      generate()

      const path = join(workspace, '.github/workflows/enforce-pr-target.yml')
      expect(readFileSync(path, 'utf-8')).toContain('main')

      write(
        createMinimalConfig({
          requireConventionalCommits: true,
          finalBranch: 'production',
          branchFlow: ['develop', 'production']
        })
      )
      generate()

      const yaml = readFileSync(path, 'utf-8')
      expect(yaml).toContain('production')
      // The old branch name must be gone, or the check enforces a branch that no longer
      // exists in the flow.
      expect(yaml).not.toMatch(/not 'main'/)
    })
  })

  it('propagates a new commit type into pr-title-check', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      write(createMinimalConfig({ requireConventionalCommits: true }))
      generate()

      const path = join(workspace, '.github/workflows/pr-title-check.yml')
      expect(readFileSync(path, 'utf-8')).not.toContain('infra')

      write(
        createMinimalConfig({
          requireConventionalCommits: true,
          semver: { bumpRules: { feat: 'minor', fix: 'patch', infra: 'patch' } }
        })
      )
      generate()

      // A contributor using `infra:` would otherwise have a valid title rejected.
      expect(readFileSync(path, 'utf-8')).toContain('infra')
    })
  })

  it('marks both files as fully managed so hand-editing is not silently invited', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      write(createMinimalConfig({ requireConventionalCommits: true }))
      generate()

      for (const file of ['enforce-pr-target.yml', 'pr-title-check.yml']) {
        const yaml = readFileSync(join(workspace, '.github/workflows', file), 'utf-8')

        // pipeline.yml announces itself as managed; an unlabelled file reads as the user's.
        expect(yaml).toContain('PIPECRAFT MANAGED WORKFLOW')
        // These have no preserved regions, unlike pipeline.yml — say so.
        expect(yaml).toContain('THIS ENTIRE FILE IS GENERATED')
        // The header must precede the workflow itself.
        expect(yaml.indexOf('PIPECRAFT MANAGED WORKFLOW')).toBeLessThan(yaml.indexOf('name:'))
        // And it must still be valid YAML with the job intact.
        expect(parse(yaml).jobs).toBeTruthy()
      }
    })
  })

  it('is idempotent — regenerating an unchanged config leaves both files alone', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      write(createMinimalConfig({ requireConventionalCommits: true }))
      generate()

      const paths = [
        join(workspace, '.github/workflows/enforce-pr-target.yml'),
        join(workspace, '.github/workflows/pr-title-check.yml')
      ]
      const before = paths.map(p => readFileSync(p, 'utf-8'))

      generate()

      // force rewrites the files, but the content must be byte-identical.
      expect(paths.map(p => readFileSync(p, 'utf-8'))).toEqual(before)
    })
  })
})
