/**
 * AI Skill Installer
 *
 * Installs the Pipecraft skill for AI coding assistants.
 *
 * Each tool reads a different file. Claude Code reads `.claude/skills/pipecraft/SKILL.md`,
 * a directory Pipecraft owns outright. The other five read a rules file at the project root
 * that the user writes and owns: `.cursorrules`, `.github/copilot-instructions.md`,
 * `.windsurfrules`, `.clinerules`, `AGENTS.md`. Pipecraft claims a marked block inside those
 * and never changes a byte outside it, so reinstalling updates the block and uninstalling
 * gives the file back.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Delimiters of the region Pipecraft maintains inside a file the user owns. */
export const BLOCK_START = '<!-- pipecraft:start -->'
export const BLOCK_END = '<!-- pipecraft:end -->'

export interface SkillTarget {
  name: string
  displayName: string
  /** Destination relative to the project root. */
  localPath: string
  /** Destination relative to the home directory, for tools that document a global location. */
  globalPath?: string
  /**
   * True when the destination is a directory Pipecraft owns and may rewrite whole.
   * False when the user owns the file, which means a marked block and nothing else.
   */
  ownsFile: boolean
  /** Project paths whose presence means the tool is in use here. */
  detect: string[]
}

export interface InstallResult {
  target: string
  path: string
  success: boolean
  error?: string
  skipped?: boolean
  reason?: string
  action?: 'created' | 'updated' | 'removed'
}

/**
 * Supported AI coding assistant targets.
 *
 * Only Claude Code gets a global entry. The other five formats are project files, and a copy
 * in the home directory is a file no tool loads.
 */
export const SKILL_TARGETS: SkillTarget[] = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    localPath: join('.claude', 'skills', 'pipecraft', 'SKILL.md'),
    globalPath: join('.claude', 'skills', 'pipecraft', 'SKILL.md'),
    ownsFile: true,
    detect: ['.claude', 'CLAUDE.md']
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    localPath: '.cursorrules',
    ownsFile: false,
    detect: ['.cursor', '.cursorrules']
  },
  {
    name: 'copilot',
    displayName: 'GitHub Copilot',
    localPath: join('.github', 'copilot-instructions.md'),
    ownsFile: false,
    detect: ['.github']
  },
  {
    name: 'windsurf',
    displayName: 'Windsurf',
    localPath: '.windsurfrules',
    ownsFile: false,
    detect: ['.windsurf', '.windsurfrules']
  },
  {
    name: 'cline',
    displayName: 'Cline / Roo Code',
    localPath: '.clinerules',
    ownsFile: false,
    detect: ['.clinerules']
  },
  {
    name: 'codex',
    displayName: 'OpenAI Codex',
    localPath: 'AGENTS.md',
    ownsFile: false,
    detect: ['AGENTS.md']
  }
]

/**
 * Get the SKILL.md content
 * First tries to read from the package, falls back to embedded content
 */
function getSkillContent(): string {
  // Try to read from the skills directory in the package
  const skillPaths = [
    join(__dirname, '../../skills/pipecraft-cli/SKILL.md'),
    join(__dirname, '../../../skills/pipecraft-cli/SKILL.md')
  ]

  for (const skillPath of skillPaths) {
    if (existsSync(skillPath)) {
      return readFileSync(skillPath, 'utf8')
    }
  }

  // Fallback to embedded minimal skill content
  return `---
name: pipecraft
description: Help users set up, configure, and use the Pipecraft CLI for GitHub Actions workflow generation.
---

# Pipecraft CLI Assistant

Help users with **Pipecraft** - a trunk-based CI/CD workflow generator for GitHub Actions.

**Documentation:** https://pipecraft.thecraftlab.dev

## Quick Commands

\`\`\`bash
pipecraft init              # Create config
pipecraft generate          # Generate workflows
pipecraft validate          # Check config syntax
pipecraft doctor            # Health check (exits 1 on errors)
pipecraft setup             # Create branches
pipecraft setup-github      # GitHub permissions
\`\`\`

## Key Behaviours

- \`autoPromote: false\` still opens the promotion PR; it only leaves the merge to a human.
- Only commits GitHub itself authored promote. A directly pushed commit never releases.
- Domain job bodies are yours. Pipecraft writes the placeholder and never fills it in.

For full documentation, see https://pipecraft.thecraftlab.dev
`
}

/**
 * The skill without its YAML frontmatter, which means nothing inside a rules file, and
 * without the Claude-only region.
 *
 * That region holds `!`-prefixed command substitution, which Claude Code runs when it loads
 * the skill. Every other tool reads the line as text, so a `.cursorrules` carrying it shows
 * the reader a literal backtick-quoted shell command that nothing ever runs.
 */
function skillBody(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n+/)
  const body = match ? content.slice(match[0].length) : content
  return body.replace(/<!-- claude-only:start -->[\s\S]*?<!-- claude-only:end -->\n*/g, '')
}

/** The block Pipecraft maintains, delimiters included. */
function skillBlock(content: string): string {
  return `${BLOCK_START}\n${skillBody(content).trim()}\n${BLOCK_END}`
}

/**
 * Write the block into a file the user owns.
 *
 * A file with no block gets one appended after its existing text. A file with a block keeps
 * everything around it and gets the block's contents replaced.
 */
function writeBlock(filePath: string, content: string): InstallResult['action'] {
  const block = skillBlock(content)
  mkdirSync(dirname(filePath), { recursive: true })

  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${block}\n`, 'utf8')
    return 'created'
  }

  const existing = readFileSync(filePath, 'utf8')
  const start = existing.indexOf(BLOCK_START)
  const end = existing.indexOf(BLOCK_END)

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start)
    const after = existing.slice(end + BLOCK_END.length)
    writeFileSync(filePath, `${before}${block}${after}`, 'utf8')
    return 'updated'
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n'
  writeFileSync(filePath, `${existing}${separator}${block}\n`, 'utf8')
  return 'updated'
}

/** Remove the block, and the file too when the block was all it held. */
function removeBlock(filePath: string): InstallResult['action'] | undefined {
  if (!existsSync(filePath)) return undefined

  const existing = readFileSync(filePath, 'utf8')
  const start = existing.indexOf(BLOCK_START)
  const end = existing.indexOf(BLOCK_END)
  if (start === -1 || end === -1 || end < start) return undefined

  const remainder = existing.slice(0, start) + existing.slice(end + BLOCK_END.length)
  if (remainder.trim() === '') {
    unlinkSync(filePath)
  } else {
    writeFileSync(filePath, remainder.replace(/\n{3,}$/, '\n'), 'utf8')
  }
  return 'removed'
}

export interface InstallOptions {
  global?: boolean
  local?: boolean
  targets?: string[]
  cwd?: string
  /** Home directory to install into. Tests pass a temporary one. */
  home?: string
}

/** Tools whose marker files are present in the project. */
export function detectTargets(cwd: string = process.cwd()): string[] {
  return SKILL_TARGETS.filter(target =>
    target.detect.some(marker => existsSync(join(cwd, marker)))
  ).map(target => target.name)
}

/** Targets to act on: an explicit list, else what the project shows, else every format. */
function resolveTargets(options: InstallOptions, cwd: string): SkillTarget[] {
  if (options.targets && options.targets.length > 0) {
    return SKILL_TARGETS.filter(t => options.targets!.includes(t.name))
  }

  const detected = detectTargets(cwd)
  if (detected.length === 0) return SKILL_TARGETS
  return SKILL_TARGETS.filter(t => detected.includes(t.name))
}

/**
 * Install the Pipecraft skill for AI coding assistants.
 *
 * Local is the default scope, because five of the six formats only exist inside a project.
 */
export function installSkills(options: InstallOptions = {}): InstallResult[] {
  const results: InstallResult[] = []
  const content = getSkillContent()
  const cwd = options.cwd || process.cwd()
  const home = options.home || homedir()
  const installGlobal = options.global ?? false
  const installLocal = options.local ?? !installGlobal

  for (const target of resolveTargets(options, cwd)) {
    if (installGlobal) {
      if (!target.globalPath) {
        results.push({
          target: target.displayName,
          path: target.localPath,
          success: false,
          skipped: true,
          reason: 'project-level only'
        })
      } else {
        const path = join(home, target.globalPath)
        results.push(write(target, path, content))
      }
    }

    if (installLocal) {
      results.push(write(target, join(cwd, target.localPath), content))
    }
  }

  return results
}

function write(target: SkillTarget, path: string, content: string): InstallResult {
  try {
    if (target.ownsFile) {
      const action = existsSync(path) ? 'updated' : 'created'
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content, 'utf8')
      return { target: target.displayName, path, success: true, action }
    }
    return { target: target.displayName, path, success: true, action: writeBlock(path, content) }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { target: target.displayName, path, success: false, error: message }
  }
}

export interface TargetStatus {
  name: string
  displayName: string
  localPath: string
  globalPath?: string
  /** The tool's marker files are present in this project. */
  detected: boolean
  /** Pipecraft's skill is already installed here. */
  hasSkill: boolean
}

/** List every target, whether the project uses it, and whether the skill is already there. */
export function listSkillTargets(options: { cwd?: string; home?: string } = {}): TargetStatus[] {
  const cwd = options.cwd || process.cwd()
  const home = options.home || homedir()
  const detected = detectTargets(cwd)

  return SKILL_TARGETS.map(target => {
    const localPath = join(cwd, target.localPath)
    const globalPath = target.globalPath ? join(home, target.globalPath) : undefined

    return {
      name: target.name,
      displayName: target.displayName,
      localPath,
      globalPath,
      detected: detected.includes(target.name),
      hasSkill: hasSkill(target, localPath) || (globalPath ? hasSkill(target, globalPath) : false)
    }
  })
}

function hasSkill(target: SkillTarget, path: string): boolean {
  if (!existsSync(path)) return false
  if (target.ownsFile) return true
  return readFileSync(path, 'utf8').includes(BLOCK_START)
}

/** Remove what `installSkills` wrote, and nothing else. */
export function uninstallSkills(
  options: { global?: boolean; local?: boolean; cwd?: string; home?: string } = {}
): InstallResult[] {
  const results: InstallResult[] = []
  const cwd = options.cwd || process.cwd()
  const home = options.home || homedir()
  const removeGlobal = options.global ?? false
  const removeLocal = options.local ?? !removeGlobal

  for (const target of SKILL_TARGETS) {
    if (removeGlobal && target.globalPath) {
      results.push(remove(target, join(home, target.globalPath)))
    }
    if (removeLocal) {
      results.push(remove(target, join(cwd, target.localPath)))
    }
  }

  return results
}

function remove(target: SkillTarget, path: string): InstallResult {
  try {
    if (target.ownsFile) {
      if (!existsSync(path)) {
        return {
          target: target.displayName,
          path,
          success: false,
          skipped: true,
          reason: 'not installed'
        }
      }
      // The whole directory belongs to Pipecraft, so it goes with the file.
      rmSync(dirname(path), { recursive: true, force: true })
      return { target: target.displayName, path, success: true, action: 'removed' }
    }

    const action = removeBlock(path)
    if (!action) {
      return {
        target: target.displayName,
        path,
        success: false,
        skipped: true,
        reason: 'not installed'
      }
    }
    return { target: target.displayName, path, success: true, action }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { target: target.displayName, path, success: false, error: message }
  }
}
