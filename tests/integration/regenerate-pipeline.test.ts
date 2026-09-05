/**
 * `pipeline.yml` regenerates on every `generate`, without `--force`
 *
 * Modelled on tests/integration/regenerate-managed-workflows.test.ts, which covers the two
 * fully-generated auxiliary workflows. `pipeline.yml` is different: it has a user-editable
 * custom-jobs section between `<--START/END CUSTOM JOBS-->` markers, so it cannot simply be
 * force-rewritten from scratch on every run without losing hand-written jobs.
 *
 * The no-force branch of the generator (src/templates/workflows/pipeline.yml.tpl.ts) parsed
 * the existing file, patched only the managed jobs, and stringified — but the custom-jobs
 * section (and its markers) survive that round trip intact. The code then spliced the
 * previously-extracted custom section back in as text, so every custom job and both markers
 * appeared twice, `warnOnDuplicateKeys` fired, and the final `renderTemplate` had no
 * `{ force: true }`, so Pinion skipped writing the file outright: config changes never
 * reached disk. See reqts/goal-regenerate-pipeline.md.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')
const minimalConfigPath = join(__dirname, '..', '..', 'examples', 'minimal', '.pipecraftrc.json')

describe('pipeline.yml regenerates on every generate', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('regen-pipeline')
  })
  afterEach(() => cleanup())

  const write = (config: unknown) => writeFileSync('.pipecraftrc', JSON.stringify(config, null, 2))

  const pipelinePath = () => join(workspace, '.github', 'workflows', 'pipeline.yml')

  // Combines stdout+stderr (logger.warn/logger.notice both matter here) into one string
  // returned instead of thrown, since generate --skip-checks is expected to exit 0.
  const generate = (): string =>
    execSync(`node "${cliPath}" generate --skip-checks 2>&1`, {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    })

  const loadMinimalConfig = (): any => JSON.parse(readFileSync(minimalConfigPath, 'utf8'))

  it('picks up a changed domain glob and a new domain, without duplicating markers', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })

      const config = loadMinimalConfig()
      write(config)
      generate()

      const first = readFileSync(pipelinePath(), 'utf8')
      expect(first).toContain("- 'src/**'")
      expect(first).not.toContain('test-docs:')

      config.domains.app.paths = ['app/**']
      config.domains.docs = { paths: ['docs/**'], description: 'Docs', prefixes: ['test'] }
      write(config)
      const output = generate()

      const second = readFileSync(pipelinePath(), 'utf8')
      expect(second).toContain("- 'app/**'")
      expect(second).toContain('test-docs:')
      expect(second).not.toContain("- 'src/**'")
      expect(output).not.toContain('Skipped file .github/workflows/pipeline.yml')
      expect(output).not.toContain('duplicate keys')

      // Removing a domain from the config removes it from the changes job's own
      // outputs/filters (managed), but the placeholder job generated for it earlier is a
      // custom job the user may have edited by now, so it stays (user-owned).
      delete config.domains.docs
      write(config)
      generate()

      const third = readFileSync(pipelinePath(), 'utf8')
      expect(third).toMatch(/^ {2}test-docs:/m)
      expect(third).not.toMatch(/fromJSON\(steps\.detect\.outputs\.changes\)\.docs\b/)
      expect(third).not.toMatch(/^ {8}docs:\n {10}paths:/m)
    })
  })

  it('preserves hand edits to a managed placeholder job and a hand-added custom job', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })

      write(loadMinimalConfig())
      generate()

      let yaml = readFileSync(pipelinePath(), 'utf8')
      // Add a customizable field under the generated test-app placeholder job, and a
      // hand-written custom job, both inside the CUSTOM JOBS markers.
      yaml = yaml.replace(/^( {2}test-app:\n)/m, '$1    environment: production\n')
      yaml = yaml.replace(
        /^( {2}# <--END CUSTOM JOBS-->)/m,
        '  smoke:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo smoke\n\n$1'
      )
      // A user comment placed directly above the first job (`changes`) is not part of the
      // managed section and must survive regeneration, unlike the CHANGES DETECTION banner
      // the parser attaches to the same map (see pipeline.yml.tpl.ts jobsNodeBeforeOps).
      yaml = yaml.replace(/^jobs:\n/m, 'jobs:\n  # ops note: keep me\n')
      // Cosmetic gate fields (runs-on) are preserved across regeneration; the correctness
      // -critical `if` is re-asserted to its always() form regardless of hand edits.
      yaml = yaml.replace(/^( {2}gate:\n {4}runs-on: )ubuntu-latest$/m, '$1ubuntu-22.04')
      yaml = yaml.replace('    if: "${{ always() }}"', '    if: "${{ success() }}"')
      writeFileSync(pipelinePath(), yaml)

      const outputSecond = generate()
      const afterSecond = readFileSync(pipelinePath(), 'utf8')

      const outputThird = generate()
      const afterThird = readFileSync(pipelinePath(), 'utf8')

      expect(afterSecond).toContain('    environment: production')
      expect(afterSecond.match(/^ {2}test-app:/gm)?.length).toBe(1)
      expect(afterSecond.match(/^ {2}smoke:/gm)?.length).toBe(1)
      // Anchored to an actual marker line (leading `#`, nothing after but whitespace) so
      // this doesn't also count the marker names as they're mentioned in the file's header
      // comment, which documents the syntax without being a marker itself.
      expect(afterSecond.match(/^.*#+\s*<--START CUSTOM JOBS-->\s*$/gm)?.length).toBe(1)
      expect(afterSecond.match(/^.*#+\s*<--END CUSTOM JOBS-->\s*$/gm)?.length).toBe(1)

      expect(afterThird).toBe(afterSecond)

      // Neither run rewriting the file skipped the write or produced duplicate keys.
      const combinedOutput = outputSecond + outputThird
      expect(combinedOutput).not.toContain('Skipped file .github/workflows/pipeline.yml')
      expect(combinedOutput).not.toContain('duplicate keys')

      // The user's own comment above `changes` survives, and the managed CHANGES DETECTION
      // banner (whose distinctive line lives in operations-changes.ts) is not duplicated.
      expect(afterThird.match(/^ {2}# ops note: keep me$/gm)?.length).toBe(1)
      expect(afterThird.match(/^ {2}# CHANGES DETECTION \(/gm)?.length).toBe(1)

      // Gate's cosmetic runs-on stays as hand-edited; its correctness-critical `if` is
      // reset to the always() form the managed-section contract requires (see
      // tests/unit/managed-section-contract.test.ts).
      expect(afterThird).toContain('runs-on: ubuntu-22.04')
      expect(afterThird).toContain('if: "${{ always() }}"')
    })
  })

  it('placeholder does not duplicate a job moved outside the markers', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })

      write(loadMinimalConfig())
      generate()

      let yaml = readFileSync(pipelinePath(), 'utf8')
      // Move the whole test-app block from inside the markers to after the END marker,
      // still under jobs. The markers stay in the file, now with nothing between them.
      const jobMatch = yaml.match(/^ {2}test-app:\n(?:.*\n)*?\n(?= {2}# <--END CUSTOM JOBS-->)/m)
      expect(jobMatch).toBeTruthy()
      const jobBlock = jobMatch![0]
      yaml = yaml.replace(jobBlock, '')
      yaml = yaml.replace(/^( {2}# <--END CUSTOM JOBS-->\n)/m, `$1\n${jobBlock}`)
      writeFileSync(pipelinePath(), yaml)

      const output = generate()
      const second = readFileSync(pipelinePath(), 'utf8')

      expect(second.match(/^ {2}test-app:/gm)?.length).toBe(1)
      expect(output).not.toContain('duplicate keys')
      expect(output).not.toContain('Skipped file .github/workflows/pipeline.yml')
    })
  })

  it('regenerates a file whose markers were deleted', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })

      write(loadMinimalConfig())
      generate()

      let yaml = readFileSync(pipelinePath(), 'utf8')
      yaml = yaml
        .split('\n')
        .filter(line => !/<--START CUSTOM JOBS-->|<--END CUSTOM JOBS-->/.test(line))
        .join('\n')
      writeFileSync(pipelinePath(), yaml)

      let output = ''
      let status = 0
      try {
        output = execSync(`node "${cliPath}" generate --skip-checks 2>&1`, {
          cwd: workspace,
          encoding: 'utf8',
          timeout: 20000,
          env: { ...process.env, CI: 'true' }
        })
      } catch (error: any) {
        status = error.status ?? 1
        output = error.stdout ?? ''
      }
      const second = readFileSync(pipelinePath(), 'utf8')

      expect(status).toBe(0)
      expect(second.match(/^ {2}test-app:/gm)?.length).toBe(1)
      expect(output).not.toContain('duplicate keys')
      expect(output).not.toContain('Skipped file .github/workflows/pipeline.yml')
    })
  })

  it('is idempotent when nothing changes', async () => {
    await inWorkspace(workspace, () => {
      execSync('git init', { cwd: workspace, stdio: 'pipe' })

      write(loadMinimalConfig())
      generate()
      const before = readFileSync(pipelinePath(), 'utf8')

      const output = generate()
      const after = readFileSync(pipelinePath(), 'utf8')

      expect(after).toBe(before)
      expect(output).not.toContain('duplicate keys')
      expect(output).not.toContain('Skipped file .github/workflows/pipeline.yml')
    })
  })
})
