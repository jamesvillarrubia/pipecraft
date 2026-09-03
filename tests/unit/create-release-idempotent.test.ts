/**
 * create-release idempotency under set -e
 *
 * Composite action steps run with `bash -e -o pipefail`. The release step captured the
 * gh output with `RELEASE_OUTPUT=$(gh release create ...)` and then inspected `$?` — but
 * under `set -e` a failed command substitution in an assignment exits the script
 * IMMEDIATELY, before `RELEASE_EXIT_CODE=$?` or the "already exists" idempotency branch
 * could run. So a re-run for an existing version failed hard instead of no-opping.
 *
 * The fix wraps the gh call in `set +e` / `set -e` (the same guard the promote action uses
 * for `gh pr create`) so the exit code is captured and the idempotency handler is reached.
 */
import { spawnSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { releaseActionTemplate } from '../../src/templates/actions/create-release.yml.tpl.js'

describe('create-release idempotency', () => {
  const yaml = releaseActionTemplate({})

  it('disables errexit around the gh release create call so its exit code is captured', () => {
    const createIdx = yaml.indexOf('gh release create')
    expect(createIdx).toBeGreaterThan(-1)
    // `set +e` must appear before the create call, and `set -e` be restored after it.
    const before = yaml.slice(Math.max(0, createIdx - 200), createIdx)
    expect(before).toMatch(/set \+e/)
    const after = yaml.slice(createIdx, createIdx + 300)
    expect(after).toMatch(/RELEASE_EXIT_CODE=\$\?/)
    expect(after).toMatch(/set -e/)
  })

  it('still treats an already-existing release as an idempotent success', () => {
    expect(yaml).toMatch(/grep -qiE 'already exists'/)
    expect(yaml).toContain('treating as success (idempotent)')
  })

  /**
   * The idempotent branch above stopped the release step failing, and the publish dispatch
   * below it went out regardless. v0.46.1 released and published, and the next push to main
   * resolved to the same version, took that branch, and dispatched publish a second time.
   * npm answered "You cannot publish over the previously published versions: 0.46.1" and
   * main showed a failed Publish run for a release that had succeeded three minutes earlier.
   */
  it('dispatches publish only for a release this run created', () => {
    expect(yaml, 'the created branch must record that it created the release').toContain(
      'release_created=true'
    )
    expect(yaml, 'the idempotent branch must record that it did not').toContain(
      'release_created=false'
    )

    const dispatch = yaml.indexOf('- name: Trigger Publish Workflow')
    expect(dispatch).toBeGreaterThan(-1)
    const step = yaml.slice(dispatch, yaml.indexOf('run: |', dispatch))
    expect(step, 'the dispatch step must be gated on the release being new').toContain(
      "if: steps.create.outputs.release_created == 'true'"
    )
  })
})

/**
 * Fix A — the publish dispatch hardcoded `--ref main`.
 *
 * `releaseActionTemplate` ignored its context, so every generated create-release action
 * dispatched the publish workflow against `main`. A repo whose finalBranch is `production`
 * (examples/gated) has no `main`, so `gh workflow run --ref main` answers "could not find
 * any ref" — and the dispatch's `else` branch swallows that as a warning. Nothing publishes
 * and nothing turns red.
 */
describe('create-release publish dispatch ref', () => {
  const dispatchLine = (ctx: any) => {
    const line = releaseActionTemplate(ctx)
      .split('\n')
      .find(l => l.includes('gh workflow run'))
    expect(line, 'the template must dispatch the publish workflow').toBeDefined()
    return line as string
  }

  it('dispatches against the configured final branch', () => {
    const line = dispatchLine({ config: { finalBranch: 'production' } })
    expect(line).toContain('--ref production')
    expect(line).not.toContain('--ref main')
  })

  it('reads a flattened context too (the generator spreads config to the top level)', () => {
    expect(dispatchLine({ finalBranch: 'production' })).toContain('--ref production')
  })

  it('falls back to main when the context carries no final branch', () => {
    expect(dispatchLine({})).toContain('--ref main')
  })
})

/**
 * Fix B — an unguarded grep on the success path aborts the step.
 *
 * Composite steps run under `bash -eo pipefail`. `RELEASE_URL=$(echo "$RELEASE_OUTPUT" |
 * grep -oE 'https://github.com/...')` fails when the URL does not match that host (GitHub
 * Enterprise), and the assignment's failure exits the step before `release_created=true` is
 * written. Every later re-run then takes the "already exists" branch, which writes
 * `release_created=false`, so that version never dispatches publish.
 */
describe('create-release survives a non-matching release URL', () => {
  const createStepScript = () => {
    const action = parse(releaseActionTemplate({})) as any
    const step = action.runs.steps.find((s: any) => s.name === 'Create GitHub Release')
    expect(step, 'the Create GitHub Release step must exist').toBeDefined()
    return (step.run as string)
      .replace(/\$\{\{ inputs\.version \}\}/g, 'v1.2.3')
      .replace(/\$\{\{ github\.repository \}\}/g, 'acme/app')
  }

  it('guards the URL extraction on the success path', () => {
    const script = createStepScript()
    const grepLine = script.split('\n').find(l => l.includes("grep -oE 'https://github.com"))
    expect(grepLine, 'the success path must extract a URL').toBeDefined()
    expect(grepLine, 'an unmatched URL must not abort the step under set -e').toMatch(
      /\|\|\s*(echo ""|true)/
    )
  })

  it('still records release_created=true when the release URL does not match', () => {
    const dir = mkdtempSync(join(tmpdir(), 'create-release-'))
    try {
      const outputFile = join(dir, 'github_output')
      writeFileSync(outputFile, '')
      // gh prints a GitHub Enterprise URL; git is stubbed so the notes block is a no-op.
      const stubs = [
        'gh() {',
        '  if [ "$1" = "release" ] && [ "$2" = "create" ]; then',
        '    echo "https://github.example.com/acme/app/releases/tag/v1.2.3"; return 0',
        '  fi',
        '  if [ "$1" = "api" ]; then echo "12345"; return 0; fi',
        '  return 0',
        '}',
        'git() { return 0; }',
        ''
      ].join('\n')
      const scriptFile = join(dir, 'step.sh')
      writeFileSync(scriptFile, stubs + createStepScript())

      const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', scriptFile], {
        cwd: dir,
        env: { ...process.env, GITHUB_OUTPUT: outputFile },
        encoding: 'utf-8'
      })
      const output = readFileSync(outputFile, 'utf-8')
      expect(
        output,
        `step exited ${result.status}; GITHUB_OUTPUT was:\n${output}\nstdout:\n${result.stdout}`
      ).toContain('release_created=true')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
