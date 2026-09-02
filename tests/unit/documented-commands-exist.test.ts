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

  /**
   * The markdown scan above cannot see the guidance the CLI prints or embeds. Two
   * invocations hid there: `setup-github` closed with "Run 'pipecraft edit' to create your
   * first release", and `getSkillContent()`'s embedded fallback listed `pipecraft verify`.
   * Neither command exists.
   *
   * `pipecraft` only ever starts a string in this codebase when it is an invocation —
   * prose puts a word in front of it ("Unknown pipecraft key", "/pipecraft or ask") — so
   * anchoring the match to a quote or a line start needs no allowlist.
   */
  it('strings in src only name real commands', () => {
    const bad: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path)
        else if (entry.endsWith('.ts')) {
          readFileSync(path, 'utf-8')
            .split('\n')
            .forEach((line, i) => {
              for (const m of line.matchAll(/(?:^|['"`])pipecraft ([a-z][a-z-]*)/g)) {
                if (!commands.has(m[1])) {
                  bad.push(`${path.replace(ROOT + '/', '')}:${i + 1} pipecraft ${m[1]}`)
                }
              }
            })
        }
      }
    }
    walk(join(ROOT, 'src'))

    expect(bad.sort(), 'the CLI prints or embeds a command that does not exist').toEqual([])
  })

  /**
   * Both SKILL.md files open with a "Commands Reference" table. The shipped copy writes
   * `pipecraft doctor` in its first column and the repo's own copy writes a bare `doctor`,
   * so the scan above reads one and not the other. A `verify` row survived in the bare one
   * for that reason, through the release that removed the name everywhere else.
   */
  it('every command named in a Commands Reference table is real', () => {
    const bad: string[] = []
    for (const file of documentationFiles()) {
      const text = readFileSync(file, 'utf-8')
      const heading = text.indexOf('## Commands Reference')
      if (heading === -1) continue

      const table = text.slice(heading).split(/\n## /)[0]
      for (const line of table.split('\n')) {
        const cell = line.match(/^\|\s*`([^`]+)`/)
        if (!cell) continue
        // "pipecraft get-config <key>" and "get-config <key>" both name get-config.
        const command = cell[1].replace(/^pipecraft\s+/, '').split(/\s+/)[0]
        if (!commands.has(command)) {
          bad.push(`${file.replace(ROOT + '/', '')}: ${cell[1]}`)
        }
      }
    }

    expect(bad.sort(), 'a Commands Reference row names a command the CLI does not have').toEqual([])
  })

  /**
   * The repo used to carry the skill twice: `skills/pipecraft-cli/SKILL.md` for users and
   * `.claude/skills/pipecraft-cli/SKILL.md` for its own agents, both declaring
   * `name: pipecraft`. They drifted, and a stranger saw the result:
   *
   *   $ npx openskills install the-craftlab/pipecraft
   *   Found 2 skill(s)
   *   ❯ ◉ pipecraft-cli             12.0KB
   *     ◉ pipecraft-cli             14.4KB
   *
   * Two entries, one name, and no way to tell them apart. One copy is the fix; the installed
   * `.claude/skills/pipecraft/` is gitignored so it cannot become the second again.
   */
  it('the repo carries exactly one SKILL.md', () => {
    const found: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.git' || entry === '.worktrees') continue
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) walk(path)
        else if (entry === 'SKILL.md') found.push(path.replace(ROOT + '/', ''))
      }
    }
    walk(ROOT)

    expect(found, 'a second SKILL.md gives skill installers two skills to choose between').toEqual([
      'skills/pipecraft-cli/SKILL.md'
    ])
  })

  /**
   * The skill package is published from the same file the repo holds, so the two cannot
   * disagree. It must also be able to install: `files` omitted the very script `postinstall`
   * invoked, which made `npm i @pipecraft/claude-skill` fail on a missing module.
   */
  it('the skill package can install what it ships', () => {
    const dir = join(ROOT, 'skills', 'pipecraft-cli')
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))

    const referenced = [
      ...Object.values((pkg.bin ?? {}) as Record<string, string>),
      ...Object.values((pkg.scripts ?? {}) as Record<string, string>).flatMap(s =>
        [...String(s).matchAll(/([\w./-]+\.js)/g)].map(m => m[1])
      )
    ].map(p => String(p).replace(/^\.\//, ''))

    for (const path of referenced) {
      expect(pkg.files, `${path} runs on install but is not published`).toContain(path)
      expect(statSync(join(dir, path)).isFile(), `${path} does not exist`).toBe(true)
    }

    // npm normalises `bin` at publish time and drops an entry whose path starts with "./":
    //   npm warn publish "bin[pipecraft-skill]" script name bin.js was invalid and removed
    // `npm pack` keeps the entry, and installing that tarball works, so the first sign of it
    // is a published package with no bin at all and an `npx` that does nothing.
    for (const [name, path] of Object.entries((pkg.bin ?? {}) as Record<string, string>)) {
      expect(path, `bin.${name} must not start with "./"; npm drops the entry`).not.toMatch(/^\.\//)
    }
  })

  /**
   * `getSkillContent()` prefers `skills/pipecraft-cli/SKILL.md` and falls back to an
   * embedded string. `files` did not list `skills`, so the tarball carried no such file and
   * every npm user got the fallback — which is how the fallback's `pipecraft verify`
   * outlived the correction to the file.
   */
  it('the skill file the installer prefers is published', () => {
    // dist/utils/skill-installer.js resolves '../../skills/pipecraft-cli/SKILL.md'.
    const wanted = 'skills/pipecraft-cli/SKILL.md'
    const packed = JSON.parse(
      execSync('npm pack --dry-run --json', {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      })
    )[0].files.map((f: { path: string }) => f.path)

    expect(packed, 'the tarball must carry the skill or every user gets the fallback').toContain(
      wanted
    )
    // skills/pipecraft-cli is its own publishable package (@pipecraft/claude-skill), so
    // listing the directory would nest a second package.json and its install scripts inside
    // this tarball. (npm adds the directory's README.md on its own; that is harmless.)
    expect(
      packed.filter((p: string) => p.startsWith('skills/') && !p.endsWith('.md')),
      'only the skill markdown belongs in this tarball'
    ).toEqual([])
  })
})
