/**
 * AI Skill Installer
 *
 * Installs Pipecraft skills for AI coding assistants (Claude Code, Cursor, etc.)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface SkillTarget {
  name: string
  displayName: string
  globalPath: string
  localPath: string
  configFile?: string // Optional config file at project root (e.g., .cursorrules)
}

export interface InstallResult {
  target: string
  path: string
  success: boolean
  error?: string
  skipped?: boolean
  reason?: string
}

/**
 * Supported AI coding assistant targets
 */
export const SKILL_TARGETS: SkillTarget[] = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    globalPath: join(homedir(), '.claude', 'skills', 'pipecraft'),
    localPath: join('.claude', 'skills', 'pipecraft')
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    globalPath: join(homedir(), '.cursor', 'skills', 'pipecraft'),
    localPath: join('.cursor', 'skills', 'pipecraft'),
    configFile: '.cursorrules'
  },
  {
    name: 'copilot',
    displayName: 'GitHub Copilot',
    globalPath: join(homedir(), '.copilot', 'skills', 'pipecraft'),
    localPath: join('.github', 'skills', 'pipecraft'),
    configFile: '.github/copilot-instructions.md'
  },
  {
    name: 'windsurf',
    displayName: 'Windsurf',
    globalPath: join(homedir(), '.codeium', 'windsurf', 'skills', 'pipecraft'),
    localPath: join('.windsurf', 'skills', 'pipecraft')
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

## Configuration

Required fields in \`.pipecraftrc\`:

\`\`\`yaml
ciProvider: github
mergeStrategy: fast-forward
requireConventionalCommits: true
initialBranch: develop        # Must be FIRST in branchFlow
finalBranch: main             # Must be LAST in branchFlow
branchFlow: [develop, main]
semver:
  bumpRules:
    feat: minor
    fix: patch
    breaking: major
domains:
  app:
    paths: ["src/**"]
    description: "App code"
\`\`\`

## Reserved Domain Names

Cannot use: \`version\`, \`changes\`, \`gate\`, \`tag\`, \`promote\`, \`release\`

For full documentation, see https://pipecraft.thecraftlab.dev
`
}

/**
 * Install skill to a specific path
 */
function installToPath(targetPath: string, content: string): { success: boolean; error?: string } {
  try {
    // Create the full target directory (e.g., ~/.claude/skills/pipecraft)
    mkdirSync(targetPath, { recursive: true })
    writeFileSync(join(targetPath, 'SKILL.md'), content, 'utf8')
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

/**
 * Check if a target appears to be installed/used
 */
function isTargetInstalled(target: SkillTarget): boolean {
  // Check if the global skills directory exists (indicates the tool is used)
  const parentDir = dirname(target.globalPath)
  return existsSync(parentDir)
}

export interface InstallOptions {
  global?: boolean
  local?: boolean
  targets?: string[]
  force?: boolean
  cwd?: string
}

/**
 * Install Pipecraft skills for AI coding assistants
 */
export function installSkills(options: InstallOptions = {}): InstallResult[] {
  const results: InstallResult[] = []
  const content = getSkillContent()
  const cwd = options.cwd || process.cwd()

  // Filter targets if specific ones requested
  let targets = SKILL_TARGETS
  if (options.targets && options.targets.length > 0) {
    targets = SKILL_TARGETS.filter(t => options.targets!.includes(t.name))
  }

  for (const target of targets) {
    // Determine installation scope
    const installGlobal = options.global ?? true
    const installLocal = options.local ?? false

    // Global installation
    if (installGlobal) {
      // Skip if target tool doesn't appear to be installed (unless forced)
      if (!options.force && !isTargetInstalled(target)) {
        results.push({
          target: target.displayName,
          path: target.globalPath,
          success: false,
          skipped: true,
          reason: `${target.displayName} not detected`
        })
      } else {
        const result = installToPath(target.globalPath, content)
        results.push({
          target: target.displayName,
          path: target.globalPath,
          success: result.success,
          error: result.error
        })
      }
    }

    // Local installation (project-level)
    if (installLocal) {
      const localPath = join(cwd, target.localPath)
      const result = installToPath(localPath, content)
      results.push({
        target: `${target.displayName} (project)`,
        path: localPath,
        success: result.success,
        error: result.error
      })
    }
  }

  return results
}

/**
 * List available skill targets and their status
 */
export function listSkillTargets(): Array<{
  name: string
  displayName: string
  installed: boolean
  globalPath: string
  hasSkill: boolean
}> {
  return SKILL_TARGETS.map(target => ({
    name: target.name,
    displayName: target.displayName,
    installed: isTargetInstalled(target),
    globalPath: target.globalPath,
    hasSkill: existsSync(join(target.globalPath, 'SKILL.md'))
  }))
}

/**
 * Uninstall skills from all targets
 */
export function uninstallSkills(
  options: { global?: boolean; local?: boolean; cwd?: string } = {}
): InstallResult[] {
  const results: InstallResult[] = []
  const cwd = options.cwd || process.cwd()
  const { rmSync } = require('fs')

  for (const target of SKILL_TARGETS) {
    if (options.global !== false) {
      const skillFile = join(target.globalPath, 'SKILL.md')
      if (existsSync(skillFile)) {
        try {
          rmSync(target.globalPath, { recursive: true, force: true })
          results.push({
            target: target.displayName,
            path: target.globalPath,
            success: true
          })
        } catch (error: any) {
          results.push({
            target: target.displayName,
            path: target.globalPath,
            success: false,
            error: error.message
          })
        }
      }
    }

    if (options.local) {
      const localPath = join(cwd, target.localPath)
      const skillFile = join(localPath, 'SKILL.md')
      if (existsSync(skillFile)) {
        try {
          rmSync(localPath, { recursive: true, force: true })
          results.push({
            target: `${target.displayName} (project)`,
            path: localPath,
            success: true
          })
        } catch (error: any) {
          results.push({
            target: `${target.displayName} (project)`,
            path: localPath,
            success: false,
            error: error.message
          })
        }
      }
    }
  }

  return results
}
