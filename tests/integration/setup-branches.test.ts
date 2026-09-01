/**
 * `pipecraft setup` must not move you
 *
 * setup created each missing branch with `git checkout -b`, which switches the working
 * tree, then tried to switch back at the end. Three problems followed: a failure anywhere
 * in the loop skipped the switch-back and left you on a branch you did not choose (the
 * restore sat outside any try/finally); uncommitted changes could block a checkout or come
 * along for the ride; and a command whose job is creating refs has no business touching
 * your working tree at all.
 *
 * `git branch <name>` creates the ref without switching, so there is nothing to restore.
 */
import { execSync } from 'child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const config = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'staging', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: { app: { paths: ['src/**'], description: 'App', prefixes: ['test'] } }
}

describe('pipecraft setup', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('setup-branches')
  })
  afterEach(() => cleanup())

  const git = (cmd: string, cwd = workspace): string =>
    execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim()

  /** A repo on `main` with one commit and a local bare remote. */
  const repoWithRemote = (): void => {
    const remote = join(workspace, 'remote.git')
    mkdirSync(remote, { recursive: true })
    execSync('git init --bare -q', { cwd: remote, stdio: 'pipe' })

    execSync('git init -q -b main', { cwd: workspace, stdio: 'pipe' })
    git('config user.email t@t.t')
    git('config user.name t')
    writeFileSync(join(workspace, 'README.md'), '# test\n')
    writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))
    git('add -A')
    git('commit -qm "chore: initial"')
    git(`remote add origin ${remote}`)
    git('push -qu origin main')
  }

  const setup = (): string =>
    execSync(`node "${cliPath}" setup 2>&1`, {
      cwd: workspace,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 30000,
      env: { ...process.env, CI: 'true' }
    })

  it('creates every branch in the flow', async () => {
    await inWorkspace(workspace, () => {
      repoWithRemote()
      setup()

      const branches = git('branch --format="%(refname:short)"').split('\n')
      expect(branches).toEqual(expect.arrayContaining(['develop', 'staging', 'main']))
    })
  })

  it('leaves you on the branch you started on', async () => {
    await inWorkspace(workspace, () => {
      repoWithRemote()
      expect(git('branch --show-current')).toBe('main')

      setup()

      expect(git('branch --show-current')).toBe('main')
    })
  })

  it('does not touch the working tree', async () => {
    await inWorkspace(workspace, () => {
      repoWithRemote()
      // An uncommitted edit must survive, and must not be carried onto another branch.
      writeFileSync(join(workspace, 'README.md'), '# edited, not committed\n')

      setup()

      expect(readFileSync(join(workspace, 'README.md'), 'utf-8')).toBe('# edited, not committed\n')
      expect(git('status --porcelain')).toContain('README.md')
    })
  })

  it('never runs git checkout', async () => {
    await inWorkspace(workspace, () => {
      repoWithRemote()
      const out = setup()

      // `stdio: inherit` means a checkout announces itself in the output.
      expect(out).not.toMatch(/Switched to( a new)? branch/)
    })
  })

  it('is idempotent', async () => {
    await inWorkspace(workspace, () => {
      repoWithRemote()
      setup()
      const out = setup()

      expect(git('branch --show-current')).toBe('main')
      expect(out).toMatch(/already exists/)
    })
  })
})
