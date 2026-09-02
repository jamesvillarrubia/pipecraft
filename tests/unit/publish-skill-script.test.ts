/**
 * scripts/publish-skill.sh
 *
 * Two releases in a row reported a red X for a CLI that had published correctly.
 *
 *   v0.46.1  a push that bumped nothing resolved to the released version and published a
 *            second time: "You cannot publish over the previously published versions: 0.46.1"
 *   v0.47.0  the skill package had never been published, and npm's OIDC cannot create one:
 *            "404 Not Found - PUT https://registry.npmjs.org/@thecraftlab%2fpipecraft-skill"
 *
 * Neither is a broken release. A genuine publish failure on a package that exists still is.
 *
 * These run the real script with `npm` stubbed on PATH, so the branch that runs is decided by
 * the script rather than by reading it.
 */
import { execFileSync } from 'child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = join(__dirname, '..', '..', 'scripts', 'publish-skill.sh')

describe('publish-skill.sh', () => {
  let dir: string
  let bin: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'publish-skill-'))
    bin = join(dir, 'bin')
    mkdirSync(bin)
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@thecraftlab/pipecraft-skill', version: '0.0.0' }),
      'utf-8'
    )
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  /**
   * Stub `npm`. `view <pkg>@<version>` and `view <pkg>` answer by exit code, which is what the
   * script branches on; `publish` answers with `publishExit`; `pkg set` always succeeds.
   */
  function stubNpm(opts: {
    versionOnRegistry: boolean
    packageExists: boolean
    publishExit: number
  }) {
    writeFileSync(
      join(bin, 'npm'),
      `#!/usr/bin/env bash
case "$1 $2" in
  "view @thecraftlab/pipecraft-skill@"*) exit ${opts.versionOnRegistry ? 0 : 1} ;;
esac
case "$1" in
  view)    exit ${opts.packageExists ? 0 : 1} ;;
  publish) echo "npm publish ran"; exit ${opts.publishExit} ;;
  pkg)     exit 0 ;;
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
    stubNpm({ versionOnRegistry: false, packageExists: true, publishExit: 0 })

    const { status, output } = run()

    expect(status).toBe(0)
    expect(output).toContain('npm publish ran')
    expect(output).toContain('Published @thecraftlab/pipecraft-skill@1.2.3')
  })

  it('skips a version already on the registry instead of failing the release', () => {
    stubNpm({ versionOnRegistry: true, packageExists: true, publishExit: 1 })

    const { status, output } = run()

    expect(status, 'a duplicate publish must not fail the job').toBe(0)
    expect(output).toContain('already on the registry')
    expect(output, 'publish must not even be attempted').not.toContain('npm publish ran')
  })

  it('warns rather than fails when the package has never been published', () => {
    stubNpm({ versionOnRegistry: false, packageExists: false, publishExit: 1 })

    const { status, output } = run()

    expect(status, 'OIDC cannot create a package; that is a setup step, not a failure').toBe(0)
    expect(output).toContain('::warning::')
    expect(output).toContain('npm publish --access public')
  })

  it('fails when publishing a package that exists goes wrong', () => {
    stubNpm({ versionOnRegistry: false, packageExists: true, publishExit: 1 })

    const { status, output } = run()

    expect(status, 'a real failure must still fail the job').toBe(1)
    expect(output).toContain('::error::')
  })
})
