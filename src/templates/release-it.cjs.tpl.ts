/**
 * Release-It Configuration Template
 * 
 * Generates a release-it configuration file (.release-it.cjs) that integrates
 * with PipeCraft's versioning system and conventional commits workflow.
 * 
 * This template creates a release-it configuration that:
 * - Uses conventional commits for version bumping
 * - Integrates with GitHub releases
 * - Supports custom version bump rules
 * - Works with PipeCraft's trunk-based development flow
 * 
 * @module templates/release-it.cjs.tpl
 */

import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'
import { logger } from '../utils/logger.js'

/**
 * Generate release-it configuration content
 * 
 * Creates a release-it configuration that integrates with PipeCraft's
 * versioning system and supports the configured semver bump rules.
 * 
 * @param {any} ctx - Context containing semver configuration
 * @param {any} ctx.semver - Semantic versioning configuration
 * @param {any} ctx.semver.bumpRules - Version bump rules mapping
 * @returns {string} JavaScript configuration content
 */
const releaseItTemplate = (ctx: any) => {
  const bumpRules = ctx.semver?.bumpRules || {
    feat: 'minor',
    fix: 'patch',
    breaking: 'major'
  }

  // Convert bump rules to release-it format
  const releaseItTypes = Object.entries(bumpRules).map(([type, level]) => {
    const releaseItLevel = level === 'major' ? 'major' : 
                          level === 'minor' ? 'minor' : 
                          level === 'patch' ? 'patch' : 'ignore'
    return `              ${type}: '${releaseItLevel}'`
  }).join(',\n')

  return `module.exports = {
    "git": {
      "requireCleanWorkingDir": false,
      "commit": false,
      "pushArgs": ["--tags"],
      "tagMatch": "v[0-9]*.[0-9]*.[0-9]*" // Required to exclude non-versioning tags
    },
    "github": {
      "release": true,
      "releaseName": "Release \${version}"
    },
    "npm": {
      "ignoreVersion": true,
      "publish": false,
      "skipChecks": true
    },
    "hooks": {
      "after:release": "echo \${version} > .release-version"
    },

    
    "plugins": {
      "@release-it/conventional-changelog": {
        "whatBump": (commits,options)=>{
            let defaults = {
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
   
            let types = (options?.preset?.types || [])
            .reduce((a, v) => {
              return { ...a, [v.type]: v.release}
            }, {}) 
  
            types = Object.assign({},defaults,types)
            let breakings = 0
            let features = 0
            let levelSet = ['major','minor','patch','ignore']
            let level = Math.min.apply(Math, commits.map(commit => {
              let level = levelSet.indexOf(types[commit.type])
              level = level<0?3:level
              if (commit.notes.length > 0) {
                breakings += commit.notes.length
              }
              if(commit.type === 'feat'){
                features += 1;
              }
              return level
            }))
            return {
              level: level,
              reason: breakings === 1
                ? \`There is \${breakings} BREAKING CHANGE and \${features} features\`
                : \`There are \${breakings} BREAKING CHANGES and \${features} features\`
            }
        },
      }
    }
  }`
}

/**
 * Release-It configuration generator
 * 
 * Generates a release-it configuration file that integrates with PipeCraft's
 * versioning system and conventional commits workflow.
 * 
 * @param {PinionContext} ctx - Pinion generator context
 * @returns {Promise<PinionContext>} Updated context after file generation
 * 
 * @example
 * ```typescript
 * // Called by PipeCraft when generating workflows
 * await generate({
 *   cwd: '/path/to/project',
 *   semver: {
 *     bumpRules: {
 *       feat: 'minor',
 *       fix: 'patch',
 *       breaking: 'major'
 *     }
 *   }
 * })
 * ```
 */
export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then((ctx) => {
      logger.verbose('📝 Generating release-it configuration...')
      return ctx
    })
    .then(renderTemplate(
      (ctx: any) => releaseItTemplate(ctx),
      toFile('.release-it.cjs')
    ))
    .then((ctx) => {
      logger.verbose('✅ Generated .release-it.cjs')
      return ctx
    })
