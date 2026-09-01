#!/usr/bin/env tsx
/**
 * sync-examples — keep the live example repos in sync with the current generator.
 *
 *   tsx scripts/sync-examples.ts [--version <tag>] [--push] <flavor|all>
 *
 * For each flavor it clones the-craftlab/pipecraft-example-<flavor>, writes the canonical
 * examples/<flavor> config (bumping `actionVersion` to <tag> for the remote flavor),
 * regenerates the workflow/actions with the repo's freshly built CLI, and — if anything
 * changed — opens a PR (`pipecraft-sync/<tag>`) into the repo's initial branch. Repos with
 * no drift are skipped.
 *
 * Without `--push` it reports drift only (dry run). Designed to run from CI on each release
 * (see .github/workflows/sync-examples.yml) but also runnable locally.
 *
 * Requires `gh` authenticated with write + PR access to the example repos, and `pnpm build`
 * (the script invokes dist/cli/index.js).
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLAVORS, configPathFor, readFlavorConfig, repoFor } from './e2e/flavors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI = join(__dirname, '..', 'dist', 'cli', 'index.js')

function sh(cmd: string, cwd?: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], cwd }).trim()
}
function shq(cmd: string, cwd?: string): string {
  try {
    return sh(cmd, cwd)
  } catch {
    return ''
  }
}

type Outcome = 'unchanged' | 'pr-opened' | 'pr-updated' | 'dry-run-drift'

async function syncFlavor(flavor: string, version: string, push: boolean): Promise<Outcome> {
  const repo = repoFor(flavor)
  const config = readFlavorConfig(flavor)
  if (config.actionSourceMode === 'remote' && version) config.actionVersion = version
  const initial: string = config.branchFlow[0]
  const branch = `pipecraft-sync/${version || 'latest'}`

  const dir = mkdtempSync(join(tmpdir(), 'pc-sync-'))
  try {
    sh(`gh repo clone ${repo} ${dir} -- -q`)
    sh('git config user.email "ci@thecraftlab.dev"', dir)
    sh('git config user.name "pipecraft-ci"', dir)
    sh(`git checkout ${initial}`, dir)

    writeFileSync(join(dir, '.pipecraftrc.json'), `${JSON.stringify(config, null, 2)}\n`)
    sh(`node "${CLI}" generate --skip-checks --force`, dir)

    if (!sh('git status --porcelain', dir)) {
      console.log(`   ${flavor}: in sync, nothing to do`)
      return 'unchanged'
    }
    if (!push) {
      console.log(`   ${flavor}: DRIFT (run with --push to open a PR)`)
      console.log(sh('git --no-pager diff --stat', dir))
      return 'dry-run-drift'
    }

    sh(`git checkout -B ${branch}`, dir)
    sh('git add -A', dir)
    sh(`git commit -qm "chore: sync generated workflow to pipecraft ${version || 'latest'}"`, dir)
    sh(`git push -f origin ${branch}`, dir)

    const existing = shq(
      `gh pr list --repo ${repo} --head ${branch} --base ${initial} --state open --json number --jq '.[0].number'`
    )
    if (existing) {
      console.log(`   ${flavor}: updated existing PR #${existing}`)
      return 'pr-updated'
    }
    const url = sh(
      `gh pr create --repo ${repo} --base ${initial} --head ${branch} ` +
        `--title "chore: sync generated workflow to pipecraft ${version || 'latest'}" ` +
        `--body "Automated by pipecraft sync-examples on release ${
          version || 'latest'
        }. Regenerates the workflow/actions from the current generator.${
          config.actionSourceMode === 'remote' ? ` Pins \\\`actionVersion\\\` to ${version}.` : ''
        }"`,
      dir
    )
    console.log(`   ${flavor}: opened ${url}`)
    return 'pr-opened'
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const push = args.includes('--push')
  const vIdx = args.indexOf('--version')
  let version = vIdx >= 0 ? args[vIdx + 1] : ''
  const positional = args.filter((a, i) => !a.startsWith('--') && !(vIdx >= 0 && i === vIdx + 1))
  const target = positional[0] || 'all'

  if (!existsSync(CLI)) {
    console.error(`CLI not built at ${CLI} — run \`pnpm build\` first.`)
    process.exit(2)
  }
  // Default to the latest published pipecraft release tag (matters for the remote flavor).
  if (!version) {
    version = shq(
      "gh release list --repo the-craftlab/pipecraft --limit 1 --json tagName --jq '.[0].tagName'"
    )
  }
  const flavors = target === 'all' ? [...FLAVORS] : target.split(',').map(f => f.trim())
  for (const f of flavors) {
    if (!existsSync(configPathFor(f))) {
      console.error(`unknown flavor "${f}"`)
      process.exit(2)
    }
  }

  console.log(`🔄 sync-examples (version=${version || 'latest'}, push=${push})`)
  const results: Record<string, Outcome> = {}
  const failures: string[] = []
  for (const flavor of flavors) {
    try {
      results[flavor] = await syncFlavor(flavor, version, push)
    } catch (err) {
      console.error(`❌ ${flavor}: ${(err as Error).message}`)
      failures.push(flavor)
    }
  }

  console.log(
    `\nsummary: ${Object.entries(results)
      .map(([f, o]) => `${f}=${o}`)
      .join(', ')}`
  )
  if (failures.length) {
    console.error(`❌ failed: ${failures.join(', ')}`)
    process.exit(1)
  }
}

void main()
