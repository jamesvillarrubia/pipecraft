/**
 * Skill installer
 *
 * `pipecraft skill` used to write the same `SKILL.md` into four `skills/` directories, one
 * per tool. Only Claude Code reads a file at that kind of path; this project's own repo puts
 * its Cursor guidance in `.cursorrules` and its Copilot guidance in
 * `.github/copilot-instructions.md`, and the installer wrote neither. The `configFile` field
 * on `SkillTarget` named both of those paths and nothing read it.
 *
 * Each tool now gets the file it reads. Five of the six destinations are files the user
 * writes and owns, so Pipecraft claims a marked block inside them and never touches a byte
 * outside it.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BLOCK_END,
  BLOCK_START,
  SKILL_TARGETS,
  detectTargets,
  installSkills,
  listSkillTargets,
  uninstallSkills
} from '../../src/utils/skill-installer.js'

describe('skill-installer', () => {
  let project: string
  let home: string

  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), 'pipecraft-skill-'))
    project = join(root, 'project')
    home = join(root, 'home')
    mkdirSync(project, { recursive: true })
    mkdirSync(home, { recursive: true })
  })

  afterEach(() => {
    rmSync(dirname(project), { recursive: true, force: true })
  })

  const read = (rel: string): string => readFileSync(join(project, rel), 'utf-8')
  const touch = (rel: string, body = ''): void => {
    const path = join(project, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, body, 'utf-8')
  }

  describe('targets', () => {
    it('covers every tool at the path that tool reads', () => {
      const paths = Object.fromEntries(SKILL_TARGETS.map(t => [t.name, t.localPath]))

      expect(paths).toEqual({
        'claude-code': join('.claude', 'skills', 'pipecraft', 'SKILL.md'),
        cursor: '.cursorrules',
        copilot: join('.github', 'copilot-instructions.md'),
        windsurf: '.windsurfrules',
        cline: '.clinerules',
        codex: 'AGENTS.md'
      })
    })

    it('only claims whole files under a directory of its own', () => {
      const owned = SKILL_TARGETS.filter(t => t.ownsFile).map(t => t.name)
      expect(owned, 'a file the user writes must take a block, never a whole-file write').toEqual([
        'claude-code'
      ])
    })

    it('only claude-code has a global destination', () => {
      const global = SKILL_TARGETS.filter(t => t.globalPath).map(t => t.name)
      expect(
        global,
        'the other five formats are project files and have no home-directory form'
      ).toEqual(['claude-code'])
    })
  })

  /**
   * SKILL.md is one file for six tools. Claude Code runs `!`-prefixed lines when it loads a
   * skill and reads `argument-hint` / `allowed-tools` from the frontmatter; the other five
   * render both as text. A `.cursorrules` carrying "!`pipecraft --version`" shows its reader
   * a backtick-quoted shell command that nothing runs.
   */
  describe('the Claude-only region', () => {
    it('reaches Claude Code', () => {
      installSkills({ local: true, targets: ['claude-code'], cwd: project, home })

      const content = read(join('.claude', 'skills', 'pipecraft', 'SKILL.md'))
      expect(content).toContain('## Current Project State')
      expect(content).toContain('!`pipecraft --version')
      expect(content).toContain('allowed-tools:')
    })

    it('reaches no one else', () => {
      installSkills({ local: true, targets: ['cursor', 'codex'], cwd: project, home })

      for (const file of ['.cursorrules', 'AGENTS.md']) {
        const content = read(file)
        expect(content, `${file} must not carry command substitution`).not.toContain('!`')
        expect(content, `${file} must not carry the Claude-only heading`).not.toContain(
          'Current Project State'
        )
        expect(content, `${file} must not carry the markers themselves`).not.toContain(
          'claude-only'
        )
        // The rest of the document still arrives.
        expect(content).toContain('Pipecraft')
      }
    })
  })

  describe('files Pipecraft owns', () => {
    it('writes the skill with its frontmatter intact', () => {
      installSkills({ local: true, targets: ['claude-code'], cwd: project, home })

      const content = read(join('.claude', 'skills', 'pipecraft', 'SKILL.md'))
      expect(content.startsWith('---\n')).toBe(true)
      expect(content).toContain('name: pipecraft')
      expect(content).toContain('pipecraft doctor')
    })

    it('writes the global copy under the home directory, not the project', () => {
      installSkills({ global: true, local: false, targets: ['claude-code'], cwd: project, home })

      expect(existsSync(join(home, '.claude', 'skills', 'pipecraft', 'SKILL.md'))).toBe(true)
      expect(existsSync(join(project, '.claude'))).toBe(false)
    })

    it('reports the other targets as project-level when asked to install globally', () => {
      const results = installSkills({ global: true, local: false, cwd: project, home })

      const cursor = results.find(r => r.target === 'Cursor')
      expect(cursor?.skipped).toBe(true)
      expect(cursor?.reason).toBe('project-level only')
      expect(existsSync(join(home, '.cursorrules'))).toBe(false)
    })
  })

  describe('files the user owns', () => {
    it('appends a marked block and leaves the existing text alone', () => {
      touch('.cursorrules', 'Always use tabs.\nNever mock the database.\n')

      installSkills({ local: true, targets: ['cursor'], cwd: project, home })

      const content = read('.cursorrules')
      expect(content).toContain('Always use tabs.')
      expect(content).toContain('Never mock the database.')
      expect(content).toContain(BLOCK_START)
      expect(content).toContain(BLOCK_END)
      expect(content.indexOf('Never mock the database.')).toBeLessThan(content.indexOf(BLOCK_START))
    })

    it('strips the frontmatter, which means nothing to a rules file', () => {
      installSkills({ local: true, targets: ['cursor'], cwd: project, home })

      const block = read('.cursorrules')
      expect(block).not.toContain('name: pipecraft')
      expect(block).toContain('Pipecraft')
    })

    it('replaces only the block on reinstall', () => {
      touch('.cursorrules', 'Always use tabs.\n')
      installSkills({ local: true, targets: ['cursor'], cwd: project, home })

      // The user edits their own half between installs.
      const edited = read('.cursorrules').replace('Always use tabs.', 'Always use spaces.')
      writeFileSync(join(project, '.cursorrules'), edited, 'utf-8')

      installSkills({ local: true, targets: ['cursor'], cwd: project, home })

      const content = read('.cursorrules')
      expect(content).toContain('Always use spaces.')
      expect(content).not.toContain('Always use tabs.')
      expect(content.split(BLOCK_START)).toHaveLength(2)
      expect(content.split(BLOCK_END)).toHaveLength(2)
    })

    it('creates the file when the tool is selected and the file is absent', () => {
      installSkills({ local: true, targets: ['codex'], cwd: project, home })

      expect(read('AGENTS.md')).toContain(BLOCK_START)
    })
  })

  describe('detection', () => {
    it('finds the tools a project actually uses', () => {
      touch('.clinerules', 'my rules\n')
      touch(join('.github', 'workflows', 'ci.yml'), 'on: push\n')

      expect(detectTargets(project).sort()).toEqual(['cline', 'copilot'])
    })

    it('installs only what it detected', () => {
      touch('.clinerules', 'my rules\n')

      installSkills({ local: true, cwd: project, home })

      expect(read('.clinerules')).toContain(BLOCK_START)
      expect(existsSync(join(project, 'AGENTS.md'))).toBe(false)
      expect(existsSync(join(project, '.cursorrules'))).toBe(false)
    })

    it('installs every format when it detects nothing', () => {
      installSkills({ local: true, cwd: project, home })

      for (const target of SKILL_TARGETS) {
        expect(existsSync(join(project, target.localPath)), target.localPath).toBe(true)
      }
    })

    it('honours an explicit target list over detection', () => {
      touch('.clinerules', 'my rules\n')

      installSkills({ local: true, targets: ['codex'], cwd: project, home })

      expect(existsSync(join(project, 'AGENTS.md'))).toBe(true)
      expect(read('.clinerules')).not.toContain(BLOCK_START)
    })
  })

  describe('uninstall', () => {
    it('removes the block and leaves the rest of the file', () => {
      touch('.cursorrules', 'Always use tabs.\n')
      installSkills({ local: true, targets: ['cursor'], cwd: project, home })

      uninstallSkills({ local: true, cwd: project, home })

      const content = read('.cursorrules')
      expect(content).toContain('Always use tabs.')
      expect(content).not.toContain(BLOCK_START)
      expect(content).not.toContain('Pipecraft')
    })

    it('deletes a file that held nothing but the block', () => {
      installSkills({ local: true, targets: ['codex'], cwd: project, home })
      expect(existsSync(join(project, 'AGENTS.md'))).toBe(true)

      uninstallSkills({ local: true, cwd: project, home })

      expect(existsSync(join(project, 'AGENTS.md'))).toBe(false)
    })

    it('leaves a file it never wrote to', () => {
      touch('.cursorrules', 'Always use tabs.\n')

      const results = uninstallSkills({ local: true, cwd: project, home })

      expect(read('.cursorrules')).toBe('Always use tabs.\n')
      expect(results.every(r => r.skipped || r.success)).toBe(true)
    })

    it('removes the whole directory for a file Pipecraft owns', () => {
      installSkills({ local: true, targets: ['claude-code'], cwd: project, home })

      uninstallSkills({ local: true, cwd: project, home })

      expect(existsSync(join(project, '.claude', 'skills', 'pipecraft'))).toBe(false)
    })

    it('removes only the requested target, leaving the others installed', () => {
      installSkills({ local: true, targets: ['claude-code', 'codex'], cwd: project, home })

      uninstallSkills({ local: true, targets: ['codex'], cwd: project, home })

      expect(existsSync(join(project, 'AGENTS.md'))).toBe(false)
      expect(read(join('.claude', 'skills', 'pipecraft', 'SKILL.md'))).toContain('pipecraft')
    })
  })

  describe('listSkillTargets', () => {
    it('reports each target and whether the project already carries it', () => {
      touch('.clinerules', 'my rules\n')
      installSkills({ local: true, targets: ['cline'], cwd: project, home })

      const listed = listSkillTargets({ cwd: project, home })
      const cline = listed.find(t => t.name === 'cline')
      const codex = listed.find(t => t.name === 'codex')

      expect(cline?.detected).toBe(true)
      expect(cline?.hasSkill).toBe(true)
      expect(codex?.detected).toBe(false)
      expect(codex?.hasSkill).toBe(false)
    })

    it('distinguishes a global-only install from a project install', () => {
      installSkills({ global: true, local: false, targets: ['claude-code'], cwd: project, home })

      const listed = listSkillTargets({ cwd: project, home })
      const claudeCode = listed.find(t => t.name === 'claude-code')

      expect(claudeCode?.hasGlobalSkill).toBe(true)
      expect(claudeCode?.hasLocalSkill).toBe(false)
      expect(claudeCode?.hasSkill).toBe(true)
    })
  })
})
