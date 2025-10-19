import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PipecraftConfig } from '../types/index.js'

export class VersionManager {
  private config: PipecraftConfig

  constructor(config: PipecraftConfig) {
    this.config = config
  }

  /**
   * Generate release-it configuration
   */
  generateReleaseItConfig(): string {
    const defaultConfig = {
      git: {
        requireCleanWorkingDir: false,
        commit: false,
        pushArgs: ["--tags"],
        tagMatch: "v[0-9]*.[0-9]*.[0-9]*"
      },
      github: {
        release: false
      },
      npm: {
        ignoreVersion: true,
        publish: false,
        skipChecks: true
      },
      hooks: {
        "after:release": "echo ${version} > .release-version"
      },
      plugins: {
        "@release-it/conventional-changelog": {
          whatBump: (commits: any[], options: any) => {
            const defaults = {
              test: 'ignore',
              build: 'ignore',
              ci: 'patch',
              docs: 'patch',
              chore: 'minor',
              style: 'patch',
              fix: 'patch',
              perf: 'patch',
              refactor: 'patch',
              feat: 'minor',
              major: 'major',
            }

            // Merge with user-defined bump rules
            const bumpRules = { ...defaults, ...this.config.versioning?.bumpRules }
            
            let breakings = 0
            let features = 0
            let levelSet = ['major', 'minor', 'patch', 'ignore']
            
            // eslint-disable-next-line prefer-spread
            let level = Math.min.apply(Math, commits.map(commit => {
              let level = levelSet.indexOf(bumpRules[commit.type as keyof typeof bumpRules] || 'ignore')
              level = level < 0 ? 3 : level
              
              if (commit.notes.length > 0) {
                breakings += commit.notes.length
              }
              if (commit.type === 'feat') {
                features += 1
              }
              return level
            }))

            return {
              level: level,
              reason: breakings === 1
                ? `There is ${breakings} BREAKING CHANGE and ${features} features`
                : `There are ${breakings} BREAKING CHANGES and ${features} features`
            }
          }
        }
      }
    }

    return `module.exports = ${JSON.stringify(defaultConfig, null, 2)}`
  }

  /**
   * Generate commitlint configuration
   */
  generateCommitlintConfig(): string {
    return `module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert'
      ]
    ],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never']
  }
}`
  }

  /**
   * Generate husky configuration
   */
  generateHuskyConfig(): string {
    return `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx commitlint --edit $1`
  }

  /**
   * Setup version management files
   */
  setupVersionManagement(): void {
    if (!this.config.versioning?.enabled) {
      return
    }

    // Generate .release-it.cjs
    const releaseItConfig = this.generateReleaseItConfig()
    writeFileSync('.release-it.cjs', releaseItConfig)

    // Generate commitlint.config.js
    const commitlintConfig = this.generateCommitlintConfig()
    writeFileSync('commitlint.config.js', commitlintConfig)

    // Generate .husky/commit-msg
    const huskyDir = '.husky'
    if (!existsSync(huskyDir)) {
      execSync('npx husky install', { stdio: 'inherit' })
      // Ensure directory exists (in case husky install was mocked/failed)
      if (!existsSync(huskyDir)) {
        const { mkdirSync } = require('fs')
        mkdirSync(huskyDir, { recursive: true })
      }
    }
    
    const commitMsgHook = this.generateHuskyConfig()
    writeFileSync(join(huskyDir, 'commit-msg'), commitMsgHook)
    execSync(`chmod +x ${join(huskyDir, 'commit-msg')}`)

    // Update package.json scripts
    this.updatePackageJsonScripts()
  }

  /**
   * Update package.json with version management scripts
   */
  private updatePackageJsonScripts(): void {
    const packageJsonPath = 'package.json'
    if (!existsSync(packageJsonPath)) {
      return
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    
    packageJson.scripts = {
      ...packageJson.scripts,
      'release': 'release-it',
      'release:dry': 'release-it --dry-run',
      'version:check': 'release-it --dry-run',
      'changelog': 'conventional-changelog -p angular -i CHANGELOG.md -s',
      'commit': 'git add . && git commit',
      'prepare': 'husky install'
    }

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }

  /**
   * Check if conventional commits are being used
   */
  validateConventionalCommits(): boolean {
    try {
      const result = execSync('git log --oneline -10', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr to avoid "not a git repository" errors in tests
      })
      const commits = result.split('\n').filter(line => line.trim())
      
      // Check if commits follow conventional format
      const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .+/
      
      return commits.every(commit => conventionalPattern.test(commit))
    } catch (error) {
      return false
    }
  }

  /**
   * Get current version from git tags
   */
  getCurrentVersion(): string {
    try {
      const result = execSync('git describe --tags --abbrev=0', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr to avoid "not a git repository" errors in tests
      })
      return result.trim().replace('v', '')
    } catch (error) {
      return '0.0.0'
    }
  }

  /**
   * Calculate next version based on conventional commits
   */
  calculateNextVersion(): { version: string, type: string } {
    try {
      const currentVersion = this.getCurrentVersion()
      const result = execSync('npx release-it --dry-run --no-git.requireCleanWorkingDir', { 
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      // Parse release-it output to get version info
      const versionMatch = result.match(/version\s+(\d+\.\d+\.\d+)/)
      const typeMatch = result.match(/bump\s+(\w+)/)
      
      return {
        version: versionMatch ? versionMatch[1] : currentVersion,
        type: typeMatch ? typeMatch[1] : 'patch'
      }
    } catch (error) {
      return {
        version: this.getCurrentVersion(),
        type: 'patch'
      }
    }
  }
}
