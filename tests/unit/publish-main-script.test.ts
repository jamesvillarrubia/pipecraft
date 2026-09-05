/**
 * scripts/publish-main.sh
 *
 * A re-run of a Publish workflow (run 33968003142, v0.47.16) hit
 * "cannot publish over the previously published versions" on the main `pipecraft` publish
 * step, which fails the job before the skill package step below it ever runs. The skill
 * script already treats a version already on the registry as success rather than failure;
 * this script gives the main package the same idempotence so a re-run can still reach the
 * skill step.
 *
 * These run the real script with `npm` stubbed on PATH, so the branch that runs is decided by
 * the script rather than by reading it.
 */
import { execFileSync } from 'child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = join(__dirname, '..', '..', 'scripts', 'publish-main.sh')

describe('publish-main.sh', () => {
  let dir: string
  let bin: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'publish-main-'))
    bin = join(dir, 'bin')
    mkdirSync(bin)
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  /** Stub `npm`. `view pipecraft@<version>` answers by exit code; `publish` answers with `publishExit`. */
  function stubNpm(opts: { versionOnRegistry: boolean; publishExit: number }) {
    writeFileSync(
      join(bin, 'npm'),
      `#!/usr/bin/env bash
case "$1 $2" in
  "view pipecraft@"*) exit ${opts.versionOnRegistry ? 0 : 1} ;;
esac
case "$1" in
  publish) echo "npm publish ran: $@"; exit ${opts.publishExit} ;;
esac
exit 0
`,
      'utf-8'
    )
    chmodSync(join(bin, 'npm'), 0o755)
  }

  function run(version = '1.2.3'): { status: number; output: string } {
    try {
      const output = execFileSync('bash', [script, version], {
        cwd: dir,
        encoding: 'utf-8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }
      })
      return { status: 0, output }
    } catch (error: any) {
      return { status: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }
    }
  }

  it('publishes a version the registry does not have', () => {
    stubNpm({ versionOnRegistry: false, publishExit: 0 })

    const { status, output } = run()

    expect(status).toBe(0)
    expect(output).toContain('npm publish ran')
  })

  it('exits 0 without publishing when the registry already has the version', () => {
    stubNpm({ versionOnRegistry: true, publishExit: 1 })

    const { status, output } = run()

    expect(status, 'a duplicate publish must not fail the job').toBe(0)
    expect(output).toContain('already on the registry')
    expect(output, 'publish must not even be attempted').not.toContain('npm publish ran')
  })

  it('propagates a non-zero exit from npm publish', () => {
    stubNpm({ versionOnRegistry: false, publishExit: 1 })

    const { status, output } = run()

    expect(status).toBe(1)
    expect(output).toContain('npm publish ran')
  })
})
