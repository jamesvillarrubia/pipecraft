/**
 * `pipecraft init --with-skill`
 *
 * The flag installs the agent skill as part of init. Nothing tested it, and its behaviour
 * changed twice without anything noticing: #551 rewrote the installer to write each tool's
 * native file instead of four copies of SKILL.md, and switched the flag from a global
 * install to a project one, because five of the six formats only exist inside a project.
 * A home-directory install during `init` also writes outside the repo the user is setting
 * up, which is not what the flag reads as.
 *
 * These tests pin the observable half: which files appear in the project, that the flag is
 * what causes them, and that a rules file the user already owns survives.
 */
import { execSync } from 'child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

/**
 * Run init with stdin closed, so any prompt is fatal rather than hanging.
 *
 * `home` points HOME at a scratch directory. `os.homedir()` reads it, so a global install
 * lands there and can be asserted on instead of touching the real home directory.
 */
function initWith(workspace: string, args: string, home?: string): string {
  execSync('git init', { cwd: workspace, stdio: 'pipe' })
  return execSync(`node "${cliPath}" init ${args} < /dev/null 2>&1`, {
    cwd: workspace,
    stdio: 'pipe',
    timeout: 30000,
    env: { ...process.env, CI: 'true', ...(home ? { HOME: home } : {}) }
  }).toString()
}

const SKILL_FILES = [
  join('.claude', 'skills', 'pipecraft', 'SKILL.md'),
  '.cursorrules',
  join('.github', 'copilot-instructions.md'),
  '.windsurfrules',
  '.clinerules',
  'AGENTS.md'
]

describe('pipecraft init --with-skill', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('init-with-skill')
  })
  afterEach(() => cleanup())

  it('installs the skill into the project being set up', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes --with-skill')

      // A fresh project shows no AI tool, so every format is written.
      for (const file of SKILL_FILES) {
        expect(existsSync(join(workspace, file)), file).toBe(true)
      }
    })
  })

  it('writes nothing into the home directory', async () => {
    await inWorkspace(workspace, () => {
      const home = mkdtempSync(join(tmpdir(), 'pipecraft-home-'))
      try {
        initWith(workspace, '--yes --with-skill', home)

        // A global install would land at ~/.claude/skills/pipecraft/SKILL.md. `init` sets up
        // the project in front of it, so writing outside that project is not what the flag
        // reads as, and the five other formats have no home-directory form at all.
        expect(readdirSync(home), 'init --with-skill wrote outside the project').toEqual([])
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    })
  })

  it('leaves the project alone without the flag', async () => {
    await inWorkspace(workspace, () => {
      initWith(workspace, '--yes')

      for (const file of SKILL_FILES) {
        expect(existsSync(join(workspace, file)), file).toBe(false)
      }
    })
  })

  it('keeps a rules file the user already had', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })
      writeFileSync(join(workspace, '.cursorrules'), 'Always use tabs.\n', 'utf-8')

      initWith(workspace, '--yes --with-skill')

      const content = readFileSync(join(workspace, '.cursorrules'), 'utf-8')
      expect(content).toContain('Always use tabs.')
      expect(content).toContain('<!-- pipecraft:start -->')
      expect(content.indexOf('Always use tabs.')).toBeLessThan(
        content.indexOf('<!-- pipecraft:start -->')
      )
    })
  })
})
