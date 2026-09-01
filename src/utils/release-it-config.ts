/**
 * The single source of `.release-it.cjs`
 *
 * Two callers write this file and they used to disagree, so a user's config depended on
 * which command they ran last:
 *
 *   - `pipecraft generate` renders `src/templates/release-it.cjs.tpl.ts`
 *   - `pipecraft init --with-versioning` calls `setupVersionManagement()`, which calls
 *     `VersionManager.generateReleaseItConfig()`
 *
 * Every divergence between them turned out to be a bug: #483 (each read bump rules from a
 * different config key) and #287 (one returned `Infinity` for an empty commit list). #496
 * closed the last two, on `github.release` and on whether `options.preset.types` is read,
 * by moving the whole thing here. The template's behaviour won, so `generate` output is
 * unchanged; `tests/fixtures/release-it-golden.cjs` pins that.
 *
 * @module utils/release-it-config
 */

/**
 * Build the contents of `.release-it.cjs`.
 *
 * @param config - the Pipecraft config. `semver.bumpRules` is the schema-required location;
 *   `versioning.bumpRules` is the deprecated spelling and loses to it.
 */
export function buildReleaseItConfig(config: any): string {
  // Base default prefixes for conventional commits
  const baseDefaults: Record<string, string> = {
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
    major: 'major'
  }

  // Get user-defined bump rules from config
  const userBumpRules = config?.semver?.bumpRules || config?.versioning?.bumpRules || {}

  // Merge user rules with defaults (user rules take precedence)
  const mergedRules = { ...baseDefaults, ...userBumpRules }

  // Convert to formatted string for the config file
  const rulesEntries = Object.entries(mergedRules)
    .map(([type, level]) => `  ${type}: '${level}'`)
    .join(',\n')

  return `const DEFAULT_PREFIXES = {
${rulesEntries}
}

module.exports = {
    DEFAULT_PREFIXES,
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
      'after:release': "echo \${version} > .release-version"
    },

    
    "plugins": {
      "@release-it/conventional-changelog": {
        "whatBump": (commits,options)=>{
            let defaults = DEFAULT_PREFIXES;
   
            let types = (options?.preset?.types || [])
            .reduce((a, v) => {
              return { ...a, [v.type]: v.release}
            }, {}) 
  
            // Config wins over the preset. DEFAULT_PREFIXES already carries the user's
            // semver.bumpRules merged over Pipecraft's baseline, so it is the stated
            // intent; the preset only supplies types the config never mentions. Merging
            // the other way round silently discarded configured rules.
            types = Object.assign({},types,defaults)
            let breakings = 0
            let features = 0
            let levelSet = ['major','minor','patch','ignore']

            // Handle empty commits array - return null to skip release
            if (!commits || commits.length === 0) {
              return {
                level: null,
                reason: 'No commits found - skipping release'
              }
            }

            let levels = commits.map(commit => {
              let level = levelSet.indexOf(types[commit.type])
              level = level<0?3:level
              if (commit.notes.length > 0) {
                breakings += commit.notes.length
              }
              if(commit.type === 'feat'){
                features += 1;
              }
              return level
            })

            let level = Math.min.apply(Math, levels)
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
