export interface DomainConfig {
  paths: string[]
  description: string
  testable?: boolean
  deployable?: boolean
}


export interface FlowcraftConfig {
  ciProvider: 'github' | 'gitlab'
  mergeStrategy: 'fast-forward' | 'merge'
  requireConventionalCommits: boolean
  initialBranch: string
  finalBranch: string
  branchFlow: string[]
  autoMerge?: boolean | Record<string, boolean>  // Auto-merge per target branch (default: false)
  semver: {
    bumpRules: Record<string, string>
  }
  actions: {
    onDevelopMerge: string[]
    onStagingMerge: string[]
  }
  domains: Record<string, DomainConfig>
  // Idempotency and rebuild configuration
  rebuild?: {
    enabled: boolean
    skipIfUnchanged: boolean
    forceRegenerate: boolean
    watchMode: boolean
    hashAlgorithm: 'md5' | 'sha1' | 'sha256'
    cacheFile: string
    ignorePatterns: string[]
  }
  // Version management with release-it
  versioning?: {
    enabled: boolean
    releaseItConfig: string
    conventionalCommits: boolean
    autoTag: boolean
    autoPush: boolean
    changelog: boolean
    bumpRules: Record<string, string>
  }
}

export interface FlowcraftContext {
  projectName: string
  ciProvider: 'github' | 'gitlab'
  mergeStrategy: 'fast-forward' | 'merge'
  requireConventionalCommits: boolean
  initialBranch: string
  finalBranch: string
  branchFlow: string[]
  domains: Record<string, { paths: string[], description: string }>
  semver: {
    bumpRules: Record<string, string>
  }
  actions: {
    onDevelopMerge: string[]
    onStagingMerge: string[]
  }
}
