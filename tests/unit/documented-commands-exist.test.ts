/**
 * Documentation may not invent commands or flags
 *
 * `pipecraft verify` was taught in every AI guidance file Pipecraft ships — the AI guide
 * (with a comparison table and a "when to use each" section), `.cursorrules`,
 * `copilot-instructions.md`, and both copies of the distributable skill — plus three docs
 * pages and a `package.json` script. It has never existed:
 *
 *   $ pipecraft verify
 *   error: unknown command 'verify'
 *
 * The command was renamed to `doctor` and the guidance never followed. So every tool
 * Pipecraft ships instructions for was telling an agent to run something that errors, and
 * an agent following the docs would conclude its setup was broken.
 *
 * `pipecraft setup --verify` and `pipecraft init --interactive` were the same: documented,
 * plausible, absent.
 *
 * This is the docs counterpart to config-key-coverage: it makes "documentation describes
 * something that does not exist" a build failure instead of a discovery.
 */
import { execSync } from 'child_process'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const cliPath = join(ROOT, 'dist', 'cli', 'index.js')

/** Files that instruct a human or an agent how to drive the CLI. */
function documentationFiles(): string[] {
  const files = [
    'README.md',
    'AGENTS.md',
    'PIPECRAFT_AI_GUIDE.md',
    '.cursorrules',
    join('.github', 'copilot-instructions.md'),
    join('skills', 'pipecraft-cli', 'SKILL.md'),
    join('.claude', 'skills', 'pipecraft-cli', 'SKILL.md')
  ].map(f => join(ROOT, f))

  const docsDir = join(ROOT, 'docs', 'docs')
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      // api/ is generated from source by typedoc, so it cannot drift from the source.
      if (statSync(path).isDirectory()) {
        if (entry !== 'api') walk(path)
      } else if (entry.endsWith('.md')) {
        files.push(path)
      }
    }
  }
  walk(docsDir)

  return files.filter(f => {
    try {
      statSync(f)
      return true
    } catch {
      return false
    }
  })
}

/** Commands the CLI actually registers. */
function realCommands(): Set<string> {
  const help = execSync(`node "${cliPath}" --help`, { encoding: 'utf-8' })
  const section = help.slice(help.indexOf('Commands:'))
  const names = [...section.matchAll(/^\s{2}([a-z][a-z-]*)\b/gm)].map(m => m[1])
  return new Set([...names, 'help'])
}

/** Flags a given command actually accepts, plus the global ones. */
function realFlags(command: string): Set<string> {
  const globals = [
    '--config',
    '--pipeline',
    '--output-pipeline',
    '--verbose',
    '--debug',
    '--force',
    '--dry-run',
    '--help',
    '--version'
  ]
  const help = execSync(`node "${cliPath}" ${command} --help`, { encoding: 'utf-8' })
  const flags = [...help.matchAll(/(--[a-z][a-z-]*)/g)].map(m => m[1])
  return new Set([...flags, ...globals])
}

const commands = realCommands()

/** Every `pipecraft <command> [--flags]` an instruction file claims. */
function claimedInvocations(): Array<{ file: string; command: string; flags: string[] }> {
  const claims: Array<{ file: string; command: string; flags: string[] }> = []
  for (const file of documentationFiles()) {
    const text = readFileSync(file, 'utf-8')
    for (const m of text.matchAll(/`?(?:npx )?pipecraft ([a-z][a-z-]*)((?:\s+--[a-z][a-z-]*)*)/g)) {
      const command = m[1]
      // Only check names that look like commands, not prose that happens to follow the word.
      if (!commands.has(command) && !/^[a-z][a-z-]*$/.test(command)) continue
      const flags = (m[2] ?? '').split(/\s+/).filter(f => f.startsWith('--'))
      claims.push({ file: file.replace(ROOT + '/', ''), command, flags })
    }
  }
  return claims
}

describe('documented commands exist', () => {
  const claims = claimedInvocations()

  it('finds invocations to check', () => {
    expect(claims.length).toBeGreaterThan(10)
  })

  it('every documented command is a real command', () => {
    const bad = claims
      .filter(c => !commands.has(c.command))
      // Prose false positives: "pipecraft in your repo", "pipecraft key concepts".
      .filter(
        c =>
          !['in', 'is', 'key', 'and', 'for', 'to', 'the', 'workflows', 'generates'].includes(
            c.command
          )
      )

    expect(
      bad.map(c => `${c.file}: pipecraft ${c.command}`).sort(),
      'documentation names a command the CLI does not register'
    ).toEqual([])
  })

  it('every documented flag is accepted by the command it is given to', () => {
    const bad: string[] = []
    for (const claim of claims) {
      if (!commands.has(claim.command) || claim.command === 'help') continue
      const accepted = realFlags(claim.command)
      for (const flag of claim.flags) {
        if (!accepted.has(flag)) {
          bad.push(`${claim.file}: pipecraft ${claim.command} ${flag}`)
        }
      }
    }

    expect([...new Set(bad)].sort(), 'documentation gives a flag the command rejects').toEqual([])
  })

  it('package.json scripts only invoke real commands', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const bad: string[] = []
    for (const [name, script] of Object.entries(pkg.scripts as Record<string, string>)) {
      for (const m of String(script).matchAll(/cli\/index\.ts ([a-z][a-z-]*)/g)) {
        if (!commands.has(m[1])) bad.push(`${name}: ${script}`)
      }
    }
    expect(bad, 'a package.json script runs a command that does not exist').toEqual([])
  })
})
