/**
 * Deploy jobs must depend on the domain's test job, not just skip past it
 *
 * `generatePrefixedJobsText()` in pipeline.yml.tpl.ts emitted one generic job shape for
 * every prefix: `needs: changes` / `if: needs.changes.outputs.<domain> == 'true'`. A
 * `deploy-<domain>` job built that way runs the moment change detection says the domain
 * changed, whether or not `test-<domain>` passed, or even ran at all in the same
 * workflow (skipped jobs still satisfy a bare `needs`).
 *
 * A deploy job for a testable domain (prefixes include 'test') must instead need
 * `changes`, `version`, and `test-<domain>`, and its `if` must require the test job's
 * success (`needs.test-<domain>.result == 'success'`), not merely that it didn't fail.
 * A deploy job for a non-testable domain (no 'test' in prefixes) has no test job to
 * depend on, so it needs only `changes` and `version`.
 *
 * `if:` conditions over 80 characters get reflowed across multiple lines by
 * `formatIfConditions` (src/templates/yaml-format-utils.ts), so assertions here compare
 * against a whitespace-normalized copy of the job block rather than an exact multi-line
 * string.
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceWithCleanup, inWorkspace } from '../helpers/workspace.js'

const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

const base = {
  ciProvider: 'github',
  mergeStrategy: 'fast-forward',
  requireConventionalCommits: true,
  initialBranch: 'develop',
  finalBranch: 'main',
  branchFlow: ['develop', 'main'],
  semver: { bumpRules: { feat: 'minor', fix: 'patch' } },
  domains: {
    api: {
      paths: ['apps/api/**'],
      description: 'API (testable)',
      prefixes: ['test', 'deploy']
    },
    docs: {
      paths: ['docs/**'],
      description: 'Docs (not testable)',
      prefixes: ['deploy']
    }
  }
}

/** Raw YAML lines making up one top-level job block: from its name through the line
 * before the next top-level (2-space-indented) key. */
function jobBlockLines(yaml: string, jobName: string): string[] {
  const lines = yaml.split('\n')
  const startIndex = lines.findIndex(line => new RegExp(`^  ${jobName}:\\s*$`).test(line))
  if (startIndex === -1) throw new Error(`job "${jobName}" not found in generated pipeline.yml`)
  const rest = lines.slice(startIndex + 1)
  const endOffset = rest.findIndex(line => /^ {2}[a-zA-Z0-9_-]+:\s*$/.test(line))
  const body = endOffset === -1 ? rest : rest.slice(0, endOffset)
  return [lines[startIndex], ...body]
}

/** Collapse a multi-line job block to single-line whitespace so a reflowed `if:`
 * condition can still be matched with a plain substring check. */
function normalize(block: string): string {
  return block.replace(/\s+/g, ' ').trim()
}

describe('deploy job needs/if for testable vs. non-testable domains', () => {
  let workspace: string
  let cleanup: () => void

  beforeEach(() => {
    ;[workspace, cleanup] = createWorkspaceWithCleanup('deploy-job-deps')
  })
  afterEach(() => cleanup())

  const generate = (): string => {
    execSync('git init', { cwd: workspace, stdio: 'pipe' })
    writeFileSync(join(workspace, '.pipecraftrc'), JSON.stringify(base, null, 2))
    execSync(`node "${cliPath}" generate --skip-checks 2>&1`, {
      cwd: workspace,
      stdio: 'pipe',
      timeout: 20000,
      env: { ...process.env, CI: 'true' }
    })
    return readFileSync(join(workspace, '.github/workflows/pipeline.yml'), 'utf-8')
  }

  it('deploy job for a testable domain needs version and the test job, gated on its success', async () => {
    await inWorkspace(workspace, () => {
      const yaml = generate()
      const block = normalize(jobBlockLines(yaml, 'deploy-api').join('\n'))

      expect(block).toContain('needs: [ changes, version, test-api ]')
      expect(block).toContain("needs.version.result == 'success'")
      expect(block).toContain("needs.changes.outputs.api == 'true'")
      expect(block).toContain("needs.test-api.result == 'success'")
    })
  })

  it('deploy job for a non-testable domain needs only changes and version', async () => {
    await inWorkspace(workspace, () => {
      const yaml = generate()
      const block = normalize(jobBlockLines(yaml, 'deploy-docs').join('\n'))

      expect(block).toContain('needs: [ changes, version ]')
      expect(block).toContain("needs.version.result == 'success'")
      expect(block).toContain("needs.changes.outputs.docs == 'true'")
      expect(block).not.toContain('test-docs')
    })
  })
})
