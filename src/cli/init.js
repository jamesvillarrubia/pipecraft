import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { prompt } from '@featherscloud/pinion'

/**
 * Default configuration template
 */
const defaultConfig = {
  ciProvider: "github",
  mergeStrategy: "fast-forward",
  requireConventionalCommits: true,
  initialBranch: "develop",
  finalBranch: "main",
  branchFlow: [
    "develop",
    "staging", 
    "main"
  ],
  semver: {
    bumpRules: {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  actions: {
    onDevelopMerge: ["runTests", "fastForwardToStaging"],
    onStagingMerge: ["runTests", "calculateVersion", "createOrFastForwardToMain"]
  },
  domains: {
    api: {
      paths: ["apps/api/**"],
      description: "API application changes"
    },
    web: {
      paths: ["apps/web/**"],
      description: "Web application changes"
    },
    libs: {
      paths: ["libs/**"],
      description: "Shared library changes"
    },
    cicd: {
      paths: [".github/workflows/**"],
      description: "CI/CD configuration changes"
    }
  }
}

/**
 * Interactive configuration setup
 */
const interactiveSetup = async () => {
  console.log('🚀 Welcome to Trunkflow Setup!\n')
  
  const answers = await prompt([
    {
      type: 'select',
      name: 'ciProvider',
      message: 'Which CI provider are you using?',
      choices: [
        { name: 'GitHub Actions', value: 'github' },
        { name: 'GitLab CI/CD', value: 'gitlab' }
      ],
      default: 'github'
    },
    {
      type: 'select',
      name: 'mergeStrategy',
      message: 'What merge strategy do you prefer?',
      choices: [
        { name: 'Fast-forward only (recommended)', value: 'fast-forward' },
        { name: 'Merge commits', value: 'merge' }
      ],
      default: 'fast-forward'
    },
    {
      type: 'confirm',
      name: 'requireConventionalCommits',
      message: 'Require conventional commit format for PR titles?',
      default: true
    },
    {
      type: 'input',
      name: 'initialBranch',
      message: 'What is your development branch name?',
      default: 'develop'
    },
    {
      type: 'input',
      name: 'finalBranch',
      message: 'What is your production branch name?',
      default: 'main'
    },
    {
      type: 'input',
      name: 'branchFlow',
      message: 'Enter your branch flow (comma-separated, e.g., develop,staging,main)',
      default: 'develop,staging,main',
      transform: (input) => input.split(',').map(branch => branch.trim())
    }
  ])

  return {
    ...defaultConfig,
    ...answers,
    branchFlow: answers.branchFlow
  }
}

/**
 * Initialize configuration file
 * @param {Object} options - Command options
 */
export const initConfig = async (options = {}) => {
  const configPath = '.trunkflowrc.json'
  
  // Check if config already exists
  if (existsSync(configPath) && !options.force) {
    throw new Error(`Configuration file already exists at ${configPath}. Use --force to overwrite.`)
  }

  let config

  if (options.interactive) {
    config = await interactiveSetup()
  } else {
    config = defaultConfig
    console.log('📝 Using default configuration. Use --interactive for custom setup.')
  }

  // Write configuration file
  writeFileSync(configPath, JSON.stringify(config, null, 2))
  
  console.log(`✅ Configuration written to ${configPath}`)
  
  // Show next steps
  console.log('\n📋 Next steps:')
  console.log('1. Review and customize your configuration if needed')
  console.log('2. Run "trunkflow generate" to create your GitHub Actions workflow')
  console.log('3. Run "trunkflow verify" to ensure everything is set up correctly')
}
