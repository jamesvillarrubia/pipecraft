/**
 * E2E flavor model
 *
 * Pure, testable logic that maps a flavor's committed `.pipecraftrc.json` to the outcome
 * its live example repo should exhibit. The harness (harness.ts) uses this to know what to
 * assert after pushing a feat, so the expectations come from the config itself rather than
 * being hand-maintained per flavor.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const ORG = 'the-craftlab'

/** The canonical flavors, mirrored by examples/<flavor>/ and the-craftlab/pipecraft-example-<flavor>. */
export const FLAVORS = ['minimal', 'library', 'basic', 'gated', 'mixed', 'remote'] as const
export type Flavor = (typeof FLAVORS)[number]

export const repoFor = (flavor: string): string => `${ORG}/pipecraft-example-${flavor}`

/** Absolute path to the canonical config for a flavor, in this repo. */
export const configPathFor = (flavor: string): string =>
  join(__dirname, '..', '..', 'examples', flavor, '.pipecraftrc.json')

export function readFlavorConfig(flavor: string): Record<string, any> {
  return JSON.parse(readFileSync(configPathFor(flavor), 'utf-8'))
}

/** Is the hop into `target` auto-promoted, given the config's autoPromote (boolean or map)? */
export function isAutoHop(autoPromote: unknown, target: string): boolean {
  if (autoPromote === true) return true
  if (autoPromote && typeof autoPromote === 'object') {
    return (autoPromote as Record<string, boolean>)[target] === true
  }
  return false
}

export interface ProofPlan {
  branchFlow: string[]
  initial: string
  final: string
  /** Single-branch flavor (e.g. library): release on the one branch, no promotion. */
  singleBranch: boolean
  /** The furthest branch the feat should reach via consecutive auto hops from `initial`. */
  autoReaches: string
  /** The first manual-gate target after `autoReaches`, if any — a promotion PR should open to it. */
  gateTarget: string | null
  /** Whether a GitHub release is expected (feat auto-reached the final branch, or single-branch). */
  expectRelease: boolean
  /** Remote action mode — the generated workflow references published marketplace actions. */
  remote: boolean
}

/** Derive the expected end-to-end proof for a flavor purely from its config. */
export function planFromConfig(config: Record<string, any>): ProofPlan {
  const branchFlow: string[] = config.branchFlow
  const initial = branchFlow[0]
  const final = branchFlow[branchFlow.length - 1]
  const singleBranch = branchFlow.length === 1

  // Walk hops from the initial branch; the feat auto-cascades through consecutive auto hops
  // and stops at the first manual gate (where a promotion PR should be opened instead).
  let autoReaches = initial
  let gateTarget: string | null = null
  for (let i = 0; i < branchFlow.length - 1; i += 1) {
    const target = branchFlow[i + 1]
    if (isAutoHop(config.autoPromote, target)) {
      autoReaches = target
    } else {
      gateTarget = target
      break
    }
  }

  return {
    branchFlow,
    initial,
    final,
    singleBranch,
    autoReaches,
    gateTarget,
    expectRelease: singleBranch || autoReaches === final,
    remote: config.actionSourceMode === 'remote'
  }
}

export function planForFlavor(flavor: string): ProofPlan {
  return planFromConfig(readFlavorConfig(flavor))
}
