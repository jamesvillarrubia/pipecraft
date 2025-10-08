import { readFileSync } from 'fs'

/**
 * Configuration schema validation
 */
const validateSchema = (config) => {
  const errors = []
  
  // Required fields
  const requiredFields = [
    'ciProvider',
    'mergeStrategy', 
    'requireConventionalCommits',
    'initialBranch',
    'finalBranch',
    'branchFlow',
    'domains'
  ]
  
  for (const field of requiredFields) {
    if (!(field in config)) {
      errors.push(`Missing required field: ${field}`)
    }
  }
  
  // Validate ciProvider
  if (config.ciProvider && !['github', 'gitlab'].includes(config.ciProvider)) {
    errors.push('ciProvider must be either "github" or "gitlab"')
  }
  
  // Validate mergeStrategy
  if (config.mergeStrategy && !['fast-forward', 'merge'].includes(config.mergeStrategy)) {
    errors.push('mergeStrategy must be either "fast-forward" or "merge"')
  }
  
  // Validate branchFlow
  if (config.branchFlow) {
    if (!Array.isArray(config.branchFlow)) {
      errors.push('branchFlow must be an array')
    } else if (config.branchFlow.length < 2) {
      errors.push('branchFlow must have at least 2 branches')
    }
  }
  
  // Validate domains
  if (config.domains) {
    if (typeof config.domains !== 'object') {
      errors.push('domains must be an object')
    } else {
      for (const [domainName, domainConfig] of Object.entries(config.domains)) {
        if (!domainConfig.paths || !Array.isArray(domainConfig.paths)) {
          errors.push(`Domain "${domainName}" must have a "paths" array`)
        }
        
        if (domainConfig.paths && domainConfig.paths.length === 0) {
          errors.push(`Domain "${domainName}" must have at least one path pattern`)
        }
        
        // Validate path patterns (basic glob pattern validation)
        if (domainConfig.paths) {
          for (const path of domainConfig.paths) {
            if (typeof path !== 'string' || path.trim() === '') {
              errors.push(`Domain "${domainName}" has invalid path pattern: "${path}"`)
            }
          }
        }
      }
    }
  }
  
  // Validate semver configuration
  if (config.semver) {
    if (!config.semver.bumpRules || typeof config.semver.bumpRules !== 'object') {
      errors.push('semver.bumpRules must be an object')
    } else {
      const validBumpTypes = ['major', 'minor', 'patch']
      for (const [commitType, bumpType] of Object.entries(config.semver.bumpRules)) {
        if (!validBumpTypes.includes(bumpType)) {
          errors.push(`Invalid semver bump type "${bumpType}" for commit type "${commitType}". Must be one of: ${validBumpTypes.join(', ')}`)
        }
      }
    }
  }
  
  return errors
}

/**
 * Validate configuration file
 * @param {string} configPath - Path to the configuration file
 */
export const validateConfig = async (configPath) => {
  try {
    const configContent = readFileSync(configPath, 'utf8')
    const config = JSON.parse(configContent)
    
    const errors = validateSchema(config)
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.map(error => `  - ${error}`).join('\n')}`)
    }
    
    return config
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${configPath}`)
    }
    
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`)
    }
    
    throw error
  }
}
