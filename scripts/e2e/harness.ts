#!/usr/bin/env tsx
/**
 * E2E flavor harness — programmatic reset + proof for the example repos.
 *
 *   tsx scripts/e2e/harness.ts reset  <flavor|all>   # wipe a repo to a pristine baseline
 *   tsx scripts/e2e/harness.ts prove  <flavor|all>   # push a feat and assert the flavor's outcome
 *   tsx scripts/e2e/harness.ts run    <flavor|all>   # reset, then prove
 *
 * Operates on the live the-craftlab/pipecraft-example-<flavor> repos via `git` and `gh`
 * (the GitHub CLI must be authenticated). It exercises the REAL pipeline — the proof waits
 * on actual GitHub Actions runs — so each `prove`/`run` takes a few minutes per flavor.
 *
 * The per-flavor expectations are derived from each committed examples/<flavor> config
 * (see flavors.ts), not hand-maintained here.
 *
 * Uses the repo's freshly built CLI (dist/cli/index.js); run `pnpm build` first.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLAVORS, configPathFor, planForFlavor, readFlavorConfig, repoFor } from './flavors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI = join(__dirname, '..', '..', 'dist', 'cli', 'index.js')
const POLL_INTERVAL_MS = 20_000
const DEFAULT_TIMEOUT_MS = 12 * 60_000

function sh(cmd: string, cwd?: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], cwd }).trim()
}
/** Run a command, returning '' instead of throwing (for best-effort cleanup steps). */
function shq(cmd: string, cwd?: string): string {
  try {
    return sh(cmd, cwd)
  } catch {
    return ''
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_')
/** Strip a domain glob ("src/frontend/**") down to a directory ("src/frontend"). */
const globDir = (glob: string) => glob.replace(/\/?\*.*$/, '') || '.'

function cloneRepo(repo: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pc-e2e-'))
  sh(`gh repo clone ${repo} ${dir} -- -q`)
  sh('git config user.email "ci@thecraftlab.dev"', dir)
  sh('git config user.name "pipecraft-ci"', dir)
  return dir
}

function setWorkflowWritePerms(repo: string): void {
  shq(
    `gh api -X PUT repos/${repo}/actions/permissions/workflow ` +
      `-f default_workflow_permissions=write -F can_approve_pull_request_reviews=true`
  )
}

/** Remove branch protection on the given branches so a baseline can be force-pushed. */
function clearBranchProtection(repo: string, branches: string[]): void {
  for (const b of branches) {
    shq(`gh api -X DELETE repos/${repo}/branches/${b}/protection`)
  }
}

function deleteAllReleasesAndTags(repo: string, dir: string): void {
  for (const tag of shq(`gh release list --repo ${repo} --json tagName --jq '.[].tagName'`)
    .split('\n')
    .filter(Boolean)) {
    shq(`gh release delete ${tag} --repo ${repo} --yes --cleanup-tag`)
  }
  for (const ref of shq('git ls-remote --tags origin', dir)
    .split('\n')
    .map(l => l.split('\t')[1])
    .filter((r): r is string => Boolean(r) && !r.endsWith('^{}'))) {
    shq(`git push origin :${ref}`, dir)
  }
}

/** Wipe a flavor's live repo to a single pristine baseline commit on every branch. */
async function reset(flavor: string): Promise<void> {
  const repo = repoFor(flavor)
  const config = readFlavorConfig(flavor)
  const plan = planForFlavor(flavor)
  console.log(`\n🧹 reset ${flavor} → ${repo}`)
  const dir = cloneRepo(repo)
  try {
    // Canonical config (keep the live repo in lockstep with examples/<flavor>).
    writeFileSync(join(dir, '.pipecraftrc.json'), `${JSON.stringify(config, null, 2)}\n`)

    // A source file per domain so change detection has something to touch.
    for (const [name, d] of Object.entries<any>(config.domains)) {
      const ddir = join(dir, globDir(d.paths[0]))
      mkdirSync(ddir, { recursive: true })
      const f = join(ddir, 'index.js')
      if (!existsSync(f)) writeFileSync(f, `export const ${slug(name)} = () => '${name}'\n`)
    }

    // A minimal package.json so the repo's test job has something to run.
    const pkg = join(dir, 'package.json')
    if (!existsSync(pkg)) {
      writeFileSync(
        pkg,
        `${JSON.stringify(
          {
            name: `pipecraft-example-${flavor}`,
            version: '0.1.0',
            private: true,
            scripts: {
              test: 'node -e "console.log(\'ok\')"',
              build: 'node -e "console.log(\'built\')"'
            }
          },
          null,
          2
        )}\n`
      )
    }

    // Generate the workflow with the repo's freshly built CLI.
    sh(`node "${CLI}" generate --skip-checks --force`, dir)

    // Single pristine baseline commit, force-pushed to every branch in the flow.
    sh('git checkout --orphan _pc_baseline', dir)
    sh('git add -A', dir)
    sh('git commit -qm "chore: pipecraft example baseline"', dir)
    const base = sh('git rev-parse HEAD', dir)
    // Drop any existing protection first — a prior setup-github protects auto-promote
    // targets with allow_force_pushes:false, which would decline the baseline force-push.
    // setup-github below re-applies protection afterward.
    clearBranchProtection(repo, plan.branchFlow)
    for (const b of plan.branchFlow) {
      sh(`git push -f origin _pc_baseline:refs/heads/${b}`, dir)
      console.log(`   ${b} → ${base.slice(0, 8)}`)
    }

    // Clean version history, then re-apply repo settings/protection (uses the fixed CLI).
    deleteAllReleasesAndTags(repo, dir)
    shq(`node "${CLI}" setup-github --apply`, dir)
    setWorkflowWritePerms(repo)
    console.log(`✅ reset ${flavor} (baseline ${base.slice(0, 8)})`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Push a unique feat and wait for the flavor's expected outcome. Throws on failure/timeout. */
async function prove(flavor: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const repo = repoFor(flavor)
  const config = readFlavorConfig(flavor)
  const plan = planForFlavor(flavor)
  console.log(`\n🔬 prove ${flavor} → ${repo}`)
  console.log(
    `   plan: autoReaches=${plan.autoReaches}` +
      `${plan.gateTarget ? ` gate→${plan.gateTarget}` : ''}` +
      `${plan.expectRelease ? ' +release' : ''}${plan.remote ? ' (remote actions)' : ''}`
  )
  const dir = cloneRepo(repo)
  try {
    const releasesBefore = new Set(
      shq(`gh release list --repo ${repo} --json tagName --jq '.[].tagName'`)
        .split('\n')
        .filter(Boolean)
    )

    // Touch the first domain so the cascade fires.
    const d0 = Object.values<any>(config.domains)[0]
    const ddir = join(dir, globDir(d0.paths[0]))
    mkdirSync(ddir, { recursive: true })
    sh(`git checkout ${plan.initial}`, dir)
    const marker = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    writeFileSync(join(ddir, `${marker}.js`), `export const m = '${marker}'\n`)
    sh('git add -A', dir)
    // Commit as GitHub. tag/promote only run for commits whose committer is
    // noreply@github.com — the marker GitHub puts on a merged pull request — or for a
    // workflow_dispatch. A plain `git push` from this harness is exactly the direct push
    // that gate exists to stop, so the proof has to look like a merged PR to reach
    // promotion at all. See src/templates/workflows/shared/operations-tag-promote.ts.
    sh(
      `git -c user.name="GitHub" -c user.email="noreply@github.com" ` +
        `commit -qm "feat: e2e proof ${marker}"`,
      dir
    )
    sh(`git push origin ${plan.initial}`, dir)
    const feat = sh('git rev-parse HEAD', dir)
    console.log(`   pushed feat ${feat.slice(0, 8)} to ${plan.initial}`)

    const deadline = Date.now() + timeoutMs
    const isAncestor = (branch: string): boolean => {
      shq(`git fetch -q origin ${branch}`, dir)
      return shq(`git merge-base --is-ancestor ${feat} origin/${branch} && echo yes`, dir) === 'yes'
    }
    const gatePROpen = (): boolean => {
      const n = shq(
        `gh pr list --repo ${repo} --base ${plan.gateTarget} --state open ` +
          `--json headRefName --jq '[.[]|select(.headRefName|startswith("pipecraft-promote/"))]|length'`
      )
      return n !== '' && n !== '0'
    }
    const newRelease = (): boolean =>
      shq(`gh release list --repo ${repo} --json tagName --jq '.[].tagName'`)
        .split('\n')
        .filter(Boolean)
        .some(t => !releasesBefore.has(t))

    let okAuto = plan.autoReaches === plan.initial
    let okGate = !plan.gateTarget
    let okRelease = !plan.expectRelease

    while (Date.now() < deadline) {
      if (!okAuto && isAncestor(plan.autoReaches)) {
        okAuto = true
        console.log(`   ✓ reached ${plan.autoReaches}`)
      }
      if (!okGate && gatePROpen()) {
        okGate = true
        console.log(`   ✓ gate PR opened to ${plan.gateTarget}`)
      }
      if (!okRelease && newRelease()) {
        okRelease = true
        console.log('   ✓ release created')
      }
      // Fail fast on a failed pipeline run for this push.
      const failed = shq(
        `gh run list --repo ${repo} --limit 8 --json conclusion,headSha ` +
          `--jq '[.[]|select(.conclusion=="failure")]|length'`
      )
      if (okAuto && okGate && okRelease) {
        console.log(`✅ prove ${flavor}: all expectations met`)
        return
      }
      const t = Math.round((Date.now() - (deadline - timeoutMs)) / 1000)
      console.log(
        `   …t+${t}s auto=${okAuto} gate=${okGate} release=${okRelease} (failed runs seen: ${failed})`
      )
      await sleep(POLL_INTERVAL_MS)
    }
    throw new Error(`prove ${flavor} timed out: auto=${okAuto} gate=${okGate} release=${okRelease}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  const [cmd, target] = process.argv.slice(2)
  if (!cmd || !['reset', 'prove', 'run'].includes(cmd)) {
    console.error('usage: tsx scripts/e2e/harness.ts <reset|prove|run> <flavor|all>')
    process.exit(2)
  }
  if (!existsSync(CLI)) {
    console.error(`CLI not built at ${CLI} — run \`pnpm build\` first.`)
    process.exit(2)
  }
  const flavors = !target || target === 'all' ? [...FLAVORS] : target.split(',').map(f => f.trim())
  for (const f of flavors) {
    if (!existsSync(configPathFor(f))) {
      console.error(`unknown flavor "${f}" (no examples/${f}/.pipecraftrc.json)`)
      process.exit(2)
    }
  }

  const failures: string[] = []
  for (const flavor of flavors) {
    try {
      if (cmd === 'reset' || cmd === 'run') await reset(flavor)
      if (cmd === 'prove' || cmd === 'run') await prove(flavor)
    } catch (err) {
      console.error(`❌ ${flavor}: ${(err as Error).message}`)
      failures.push(flavor)
    }
  }

  if (failures.length) {
    console.error(`\n❌ ${failures.length} flavor(s) failed: ${failures.join(', ')}`)
    process.exit(1)
  }
  console.log(`\n✅ ${cmd} succeeded for: ${flavors.join(', ')}`)
}

void main()
