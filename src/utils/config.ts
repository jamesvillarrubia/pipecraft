import { cosmiconfigSync } from 'cosmiconfig'

export const loadConfig = (configPath?: string) => {
  const explorer = cosmiconfigSync('trunkflow')
  const result = explorer.search()
  
  if (!result) {
    throw new Error(`No configuration file found. Expected: ${configPath || '.trunkflowrc.json'}`)
  }
  
  return result.config
}

export const validateConfig = (config: any) => {
  const requiredFields = ['ciProvider', 'mergeStrategy', 'requireConventionalCommits', 'initialBranch', 'finalBranch', 'branchFlow', 'domains']
  
  for (const field of requiredFields) {
    if (!(field in config)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  if (!['github', 'gitlab'].includes(config.ciProvider)) {
    throw new Error('ciProvider must be either "github" or "gitlab"')
  }
  
  if (!['fast-forward', 'merge'].includes(config.mergeStrategy)) {
    throw new Error('mergeStrategy must be either "fast-forward" or "merge"')
  }
  
  if (!Array.isArray(config.branchFlow) || config.branchFlow.length < 2) {
    throw new Error('branchFlow must be an array with at least 2 branches')
  }
  
  if (typeof config.domains !== 'object') {
    throw new Error('domains must be an object')
  }
  
  for (const [domainName, domainConfig] of Object.entries(config.domains)) {
    if (!domainConfig.paths || !Array.isArray(domainConfig.paths)) {
      throw new Error(`Domain "${domainName}" must have a "paths" array`)
    }
    
    if (domainConfig.paths.length === 0) {
      throw new Error(`Domain "${domainName}" must have at least one path pattern`)
    }
  }
  
  return true
}
