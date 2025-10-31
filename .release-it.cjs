const DEFAULT_PREFIXES = {
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
  breaking: 'major'
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
      "releaseName": "Release ${version}"
    },
    "npm": {
      "ignoreVersion": true,
      "publish": false,
      "skipChecks": true
    },
    "hooks": {
      "after:release": "echo ${version} > .release-version"
    },

    
    "plugins": {
      "@release-it/conventional-changelog": {
        "whatBump": (commits,options)=>{
            let defaults = DEFAULT_PREFIXES;
   
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
                ? `There is ${breakings} BREAKING CHANGE and ${features} features`
                : `There are ${breakings} BREAKING CHANGES and ${features} features`
            }
        },
      }
    }
  }