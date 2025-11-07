/**
 * PipeCraft Configuration Widget
 * Embeddable form and diagram generator for PipeCraft configurations
 */

class PipeCraftWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId)
    if (!this.container) {
      throw new Error(`Container element with id '${containerId}' not found`)
    }

    // Default configuration
    const branchFlow = options.branchFlow || ['develop', 'staging', 'main']

    // Initialize autoMerge based on branchFlow (all branches except the first default to true)
    const defaultAutoMerge = {}
    branchFlow.forEach((branch, idx) => {
      if (idx > 0) {
        defaultAutoMerge[branch] = true
      }
    })

    this.state = {
      ciProvider: options.ciProvider || 'github',
      mergeStrategy: options.mergeStrategy || 'fast-forward',
      requireConventionalCommits: options.requireConventionalCommits !== false,
      packageManager: options.packageManager || 'npm',
      initialBranch: options.initialBranch || 'develop',
      finalBranch: options.finalBranch || 'main',
      branchFlow: branchFlow,
      autoMerge: options.autoMerge || defaultAutoMerge,
      domains: options.domains || {
        api: {
          paths: ['apps/api/**'],
          prefixes: ['test', 'deploy'],
          description: 'API application changes'
        },
        web: {
          paths: ['apps/web/**'],
          prefixes: ['test', 'deploy'],
          description: 'Web application changes'
        }
      }
    }

    this.callbacks = {
      onChange: options.onChange || (() => {}),
      onCopy: options.onCopy || (() => {})
    }

    this.prismLoading = false

    this.render()
    this.attachEventListeners()

    // Watch for theme changes to update Prism theme
    this.setupThemeWatcher()
  }

  setupThemeWatcher() {
    // Watch for theme changes
    const observer = new MutationObserver(() => {
      this.updatePrismTheme()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
  }

  render() {
    this.container.innerHTML = `
            <div class="pipecraft-widget">
                <div class="widget-container">
                    <div class="form-section">
                        ${this.renderForm()}
                    </div>
                    <div class="preview-section">
                        ${this.renderPreview()}
                    </div>
                </div>
                <div class="toast" id="pipecraft-toast"></div>
            </div>
        `

    this.injectStyles()
    this.updatePreview()
  }

  renderForm() {
    return `
            <h1>PipeCraft Configuration Builder</h1>
            <p class="subtitle">Create your CI/CD pipeline configuration with visual feedback</p>

            <h2>Basic Settings</h2>

            <div class="form-group">
                <label for="pc-ciProvider">CI Provider</label>
                <select id="pc-ciProvider">
                    <option value="github" ${
                      this.state.ciProvider === 'github' ? 'selected' : ''
                    }>GitHub Actions</option>
                    <option value="gitlab" ${
                      this.state.ciProvider === 'gitlab' ? 'selected' : ''
                    }>GitLab CI</option>
                </select>
            </div>

            <div class="form-group">
                <label for="pc-mergeStrategy">Merge Strategy</label>
                <select id="pc-mergeStrategy">
                    <option value="fast-forward" ${
                      this.state.mergeStrategy === 'fast-forward' ? 'selected' : ''
                    }>Fast-forward (rebase)</option>
                    <option value="merge" ${
                      this.state.mergeStrategy === 'merge' ? 'selected' : ''
                    }>Merge commits</option>
                </select>
                <div class="help-text">How branches should be merged together</div>
            </div>

            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="pc-requireConventionalCommits" ${
                      this.state.requireConventionalCommits ? 'checked' : ''
                    }>
                    <span>Require Conventional Commits</span>
                </label>
                <div class="help-text">Enforce commit message format (feat:, fix:, etc.)</div>
            </div>

            <div class="form-group">
                <label for="pc-packageManager">Package Manager</label>
                <select id="pc-packageManager">
                    <option value="npm" ${
                      this.state.packageManager === 'npm' ? 'selected' : ''
                    }>npm</option>
                    <option value="yarn" ${
                      this.state.packageManager === 'yarn' ? 'selected' : ''
                    }>yarn</option>
                    <option value="pnpm" ${
                      this.state.packageManager === 'pnpm' ? 'selected' : ''
                    }>pnpm</option>
                </select>
            </div>

            <h2>Branch Flow</h2>

            <div class="form-group">
                <label for="pc-initialBranch">Initial Branch (Development)</label>
                <input type="text" id="pc-initialBranch" value="${
                  this.state.initialBranch
                }" placeholder="develop">
                <div class="help-text">The branch where features are first merged</div>
            </div>

            <div class="form-group">
                <label for="pc-finalBranch">Final Branch (Production)</label>
                <input type="text" id="pc-finalBranch" value="${
                  this.state.finalBranch
                }" placeholder="main">
                <div class="help-text">The branch that represents production</div>
            </div>

            <div class="form-group">
                <label for="pc-branchFlow">Branch Flow (comma-separated)</label>
                <input type="text" id="pc-branchFlow" value="${this.state.branchFlow.join(
                  ', '
                )}" placeholder="develop, staging, main">
                <div class="help-text">Ordered list of branches for promotion</div>
            </div>

            <h2>Auto-Merge Configuration</h2>
            <p class="help-text" style="margin-bottom: 15px;">Configure which branches automatically merge after tests pass (vs. requiring manual PR approval)</p>
            <div id="pc-autoMergeList"></div>

            <h2>Domains</h2>
            <p class="help-text" style="margin-bottom: 15px;">Define the different parts of your codebase for independent testing and deployment</p>

            <div id="pc-domainsList" class="domain-list"></div>
            <button class="btn-add" id="pc-addDomain">+ Add Domain</button>
        `
  }

  renderPreview() {
    return `
            <div>
                <h2>Workflow Diagram</h2>
                <div class="diagram-container" id="pc-diagram"></div>
            </div>

            <div style="flex: 1; display: flex; flex-direction: column;">
                <h2>Generated Configuration</h2>
                <div class="spec-container">
                    <button class="btn-copy-icon" id="pc-copyBtn" title="Copy code">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.5 3.5H3.5C2.67157 3.5 2 4.17157 2 5V12.5C2 13.3284 2.67157 14 3.5 14H11C11.8284 14 12.5 13.3284 12.5 12.5V10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M5.5 3.5C5.5 2.67157 6.17157 2 7 2H11.5C12.3284 2 13 2.67157 13 3.5V8C13 8.82843 12.3284 9.5 11.5 9.5H7C6.17157 9.5 5.5 8.82843 5.5 8V3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg class="copy-success" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
                            <path d="M13.5 4L6 11.5L2.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <pre class="spec-code" id="pc-specOutput"><code class="language-yaml"></code></pre>
                </div>
            </div>
        `
  }

  attachEventListeners() {
    const $ = id => document.getElementById(id)

    $('pc-ciProvider').addEventListener('change', e => {
      this.state.ciProvider = e.target.value
      this.handleChange()
    })

    $('pc-mergeStrategy').addEventListener('change', e => {
      this.state.mergeStrategy = e.target.value
      this.handleChange()
    })

    $('pc-requireConventionalCommits').addEventListener('change', e => {
      this.state.requireConventionalCommits = e.target.checked
      this.handleChange()
    })

    $('pc-packageManager').addEventListener('change', e => {
      this.state.packageManager = e.target.value
      this.handleChange()
    })

    $('pc-initialBranch').addEventListener('input', e => {
      this.state.initialBranch = e.target.value.trim()
      this.updateBranchFlow()
    })

    $('pc-finalBranch').addEventListener('input', e => {
      this.state.finalBranch = e.target.value.trim()
      this.updateBranchFlow()
    })

    $('pc-branchFlow').addEventListener('input', e => {
      const branches = e.target.value
        .split(',')
        .map(b => b.trim())
        .filter(b => b)

      this.state.branchFlow = branches

      // Update autoMerge to match the new branch flow
      const newAutoMerge = {}
      branches.forEach((branch, idx) => {
        if (idx > 0) {
          // Skip initial branch
          // Preserve existing setting or default to true
          newAutoMerge[branch] = this.state.autoMerge.hasOwnProperty(branch)
            ? this.state.autoMerge[branch]
            : true
        }
      })
      this.state.autoMerge = newAutoMerge

      this.renderAutoMerge()
      this.handleChange()
    })

    $('pc-addDomain').addEventListener('click', () => this.addDomain())
    $('pc-copyBtn').addEventListener('click', () => this.copySpec())

    this.renderAutoMerge()
    this.renderDomains()
  }

  updateBranchFlow() {
    const flowInput = document.getElementById('pc-branchFlow')
    const branches = flowInput.value
      .split(',')
      .map(b => b.trim())
      .filter(b => b)

    if (this.state.initialBranch && !branches.includes(this.state.initialBranch)) {
      branches[0] = this.state.initialBranch
    }
    if (this.state.finalBranch && !branches.includes(this.state.finalBranch)) {
      branches[branches.length - 1] = this.state.finalBranch
    }

    this.state.branchFlow = branches
    flowInput.value = branches.join(', ')

    // Update autoMerge to include all branches (except the first one)
    // Preserve existing settings for branches that remain, default new branches to true
    const newAutoMerge = {}
    branches.forEach((branch, idx) => {
      if (idx > 0) {
        // Skip initial branch
        // If this branch already has a setting, keep it; otherwise default to true
        newAutoMerge[branch] = this.state.autoMerge.hasOwnProperty(branch)
          ? this.state.autoMerge[branch]
          : true
      }
    })
    this.state.autoMerge = newAutoMerge

    this.renderAutoMerge()
    this.handleChange()
  }

  renderAutoMerge() {
    const container = document.getElementById('pc-autoMergeList')
    if (!container) return

    container.innerHTML = ''

    // Skip the initial branch (index 0)
    this.state.branchFlow.slice(1).forEach(branch => {
      const autoMergeDiv = document.createElement('div')
      autoMergeDiv.className = 'form-group'
      autoMergeDiv.style.marginBottom = '10px'

      const isAutoMerge = this.state.autoMerge[branch] !== false

      autoMergeDiv.innerHTML = `
        <label class="checkbox-label">
          <input type="checkbox" ${
            isAutoMerge ? 'checked' : ''
          } data-branch="${branch}" class="automerge-checkbox">
          <span>Auto-merge to <strong>${branch}</strong></span>
        </label>
        <div class="help-text">Automatically merge after tests pass (vs. manual PR approval)</div>
      `
      container.appendChild(autoMergeDiv)
    })

    // Attach event listeners
    container.querySelectorAll('.automerge-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', e => {
        const branch = e.target.dataset.branch
        this.state.autoMerge[branch] = e.target.checked
        this.handleChange()
      })
    })
  }

  renderDomains() {
    const container = document.getElementById('pc-domainsList')
    if (!container) return

    container.innerHTML = ''

    Object.entries(this.state.domains).forEach(([name, config]) => {
      const domainDiv = document.createElement('div')
      domainDiv.className = 'domain-item'
      domainDiv.innerHTML = `
                <div class="domain-header">
                    <input type="text" value="${name}" data-domain="${name}" class="domain-name-input" placeholder="Domain name">
                    <button class="btn-remove" data-domain="${name}">Remove</button>
                </div>
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 12px;">Description</label>
                    <input type="text" value="${
                      config.description
                    }" data-domain="${name}" data-field="description" placeholder="What does this domain do?">
                </div>
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 12px;">Paths (comma-separated globs)</label>
                    <input type="text" value="${config.paths.join(
                      ', '
                    )}" data-domain="${name}" data-field="paths" placeholder="apps/api/**, src/**">
                </div>
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 12px;">Prefixes (optional, comma-separated)</label>
                    <input type="text" value="${(config.prefixes || []).join(
                      ', '
                    )}" data-domain="${name}" data-field="prefixes" placeholder="test, deploy, remote-test (optional)">
                    <div class="help-text" style="margin-top: 4px;">Job types to generate (leave empty to skip). Common: test, deploy, remote-test</div>
                </div>
            `
      container.appendChild(domainDiv)
    })

    // Attach domain event listeners
    container.querySelectorAll('.domain-name-input').forEach(input => {
      input.addEventListener('change', e => {
        const oldName = e.target.dataset.domain
        const newName = e.target.value.trim()
        this.renameDomain(oldName, newName)
      })
    })

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        const name = e.target.dataset.domain
        this.removeDomain(name)
      })
    })

    container.querySelectorAll('input[data-field]').forEach(input => {
      const field = input.dataset.field
      const name = input.dataset.domain

      if (input.type === 'checkbox') {
        input.addEventListener('change', e => {
          this.state.domains[name][field] = e.target.checked
          this.handleChange()
        })
      } else {
        input.addEventListener('input', e => {
          if (field === 'paths' || field === 'prefixes') {
            this.state.domains[name][field] = e.target.value
              .split(',')
              .map(p => p.trim())
              .filter(p => p)
          } else {
            this.state.domains[name][field] = e.target.value
          }
          this.handleChange()
        })
      }
    })
  }

  addDomain() {
    const name = prompt('Enter domain name:')
    if (!name || this.state.domains[name]) {
      if (this.state.domains[name]) {
        alert('Domain name already exists')
      }
      return
    }

    this.state.domains[name] = {
      paths: [`apps/${name}/**`],
      prefixes: ['test'],
      description: `${name} changes`
    }

    this.renderDomains()
    this.handleChange()
  }

  removeDomain(name) {
    delete this.state.domains[name]
    this.renderDomains()
    this.handleChange()
  }

  renameDomain(oldName, newName) {
    if (!newName || newName === oldName) return
    if (this.state.domains[newName]) {
      alert('Domain name already exists')
      this.renderDomains()
      return
    }

    this.state.domains[newName] = this.state.domains[oldName]
    delete this.state.domains[oldName]
    this.renderDomains()
    this.handleChange()
  }

  handleChange() {
    this.updatePreview()
    this.callbacks.onChange(this.getConfig())
  }

  updatePreview() {
    this.renderDiagram()
    this.renderSpec()
  }

  renderDiagram() {
    const diagram = document.getElementById('pc-diagram')
    if (!diagram) return

    let html = '<div class="branch-flow">'
    this.state.branchFlow.forEach((branch, idx) => {
      const isInitial = branch === this.state.initialBranch
      const isFinal = branch === this.state.finalBranch

      // Add badges to branch box
      let badgeHtml = ''
      if (isInitial) badgeHtml += '<span class="branch-badge initial">dev</span>'
      if (isFinal) badgeHtml += '<span class="branch-badge final">prod</span>'

      html += `<div class="branch-box">${branch}${badgeHtml ? ' ' + badgeHtml : ''}</div>`

      if (idx < this.state.branchFlow.length - 1) {
        const nextBranch = this.state.branchFlow[idx + 1]
        const nextIsAutoMerge = this.state.autoMerge[nextBranch] !== false

        // Show different arrow style for auto-merge vs manual
        if (nextIsAutoMerge) {
          html +=
            '<div class="branch-arrow auto-merge" title="Auto-merge enabled"><span class="arrow-label">AUTO</span> →</div>'
        } else {
          html +=
            '<div class="branch-arrow manual-merge" title="Manual approval required"><span class="arrow-label">MANUAL</span> →</div>'
        }
      }
    })
    html += '</div>'

    // Domains visualization
    if (Object.keys(this.state.domains).length > 0) {
      html +=
        '<h3 style="margin-top: 20px; margin-bottom: 10px; color: var(--ifm-heading-color, #555); font-size: 16px;">Domains</h3>'
      html += '<div class="domain-grid">'
      Object.entries(this.state.domains).forEach(([name, config]) => {
        const prefixes = config.prefixes || []
        const badgesHtml = prefixes
          .map(prefix => {
            const badgeClass =
              prefix === 'deploy'
                ? 'badge deploy'
                : prefix === 'remote-test'
                ? 'badge remote-test'
                : 'badge'
            return `<span class="${badgeClass}">${prefix}</span>`
          })
          .join('')

        html += `
                    <div class="domain-card">
                        <div class="domain-card-name">${name}</div>
                        <div class="domain-card-paths">${config.paths[0] || 'No paths'}</div>
                        <div class="domain-card-badges">
                            ${
                              badgesHtml ||
                              '<span style="color: var(--ifm-font-color-secondary, #999); font-size: 11px;">No prefixes</span>'
                            }
                        </div>
                    </div>
                `
      })
      html += '</div>'
    }

    diagram.innerHTML = html
  }

  renderSpec() {
    const spec = this.generateYAML()
    const output = document.getElementById('pc-specOutput')
    if (output) {
      const codeElement = output.querySelector('code') || output
      // Apply syntax highlighting if Prism is available
      if (window.Prism && Prism.languages.yaml) {
        codeElement.className = 'language-yaml'
        codeElement.innerHTML = Prism.highlight(spec, Prism.languages.yaml, 'yaml')
      } else {
        codeElement.textContent = spec
        // Try to load Prism.js for syntax highlighting
        this.loadPrism()
      }
    }
  }

  loadPrism() {
    // Check if Prism is already loaded
    if (window.Prism) return

    // Check if already loading
    if (this.prismLoading) return
    this.prismLoading = true

    // Load Prism.js CSS - using GitHub theme to match Docusaurus light theme
    const cssLink = document.createElement('link')
    cssLink.rel = 'stylesheet'
    cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css'
    cssLink.id = 'prism-light-theme'
    document.head.appendChild(cssLink)

    // Load Prism.js dark theme CSS - using Dracula theme to match Docusaurus dark theme
    const darkCssLink = document.createElement('link')
    darkCssLink.rel = 'stylesheet'
    darkCssLink.href =
      'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-dark.min.css'
    darkCssLink.id = 'prism-dark-theme'
    document.head.appendChild(darkCssLink)

    // Load Prism.js core
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js'
    script.onload = () => {
      // Load YAML language support
      const yamlScript = document.createElement('script')
      yamlScript.src =
        'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js'
      yamlScript.onload = () => {
        // Re-render spec with highlighting
        this.renderSpec()
        // Apply dark theme if needed
        this.updatePrismTheme()
      }
      document.body.appendChild(yamlScript)
    }
    document.body.appendChild(script)
  }

  updatePrismTheme() {
    const darkTheme = document.getElementById('prism-dark-theme')
    const lightTheme = document.getElementById('prism-light-theme')
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

    if (darkTheme) {
      darkTheme.disabled = !isDark
    }
    if (lightTheme) {
      lightTheme.disabled = isDark
    }
  }

  generateYAML() {
    let yaml = `# PipeCraft Configuration
# Generated by PipeCraft Configuration Builder

# CI Provider: github or gitlab
ciProvider: ${this.state.ciProvider}

# Merge Strategy: fast-forward or merge
mergeStrategy: ${this.state.mergeStrategy}

# Require conventional commit messages
requireConventionalCommits: ${this.state.requireConventionalCommits}

# Package manager: npm, yarn, or pnpm
packageManager: ${this.state.packageManager}

# Initial development branch
initialBranch: ${this.state.initialBranch}

# Final production branch
finalBranch: ${this.state.finalBranch}

# Ordered branch flow for promotions
branchFlow:
${this.state.branchFlow.map(b => `  - ${b}`).join('\n')}

# Automatic promotion after successful tests
autoMerge:
${Object.entries(this.state.autoMerge)
  .map(([branch, enabled]) => `  ${branch}: ${enabled}`)
  .join('\n')}

# Semantic versioning bump rules
semver:
  bumpRules:
    test: ignore
    build: ignore
    ci: patch
    docs: patch
    style: patch
    fix: patch
    perf: patch
    refactor: patch
    chore: patch
    feat: minor
    major: major
    breaking: major

# Domain configuration for independent testing and deployment
domains:
`

    Object.entries(this.state.domains).forEach(([name, config]) => {
      const prefixes = config.prefixes || []
      yaml += `  ${name}:
    description: ${config.description}
    paths:
${config.paths.map(p => `      - ${p}`).join('\n')}
    prefixes: [${prefixes.map(p => `'${p}'`).join(', ')}]
`
    })

    return yaml
  }

  copySpec() {
    const spec = this.generateYAML()
    const copyBtn = document.getElementById('pc-copyBtn')

    navigator.clipboard
      .writeText(spec)
      .then(() => {
        // Show success state
        if (copyBtn) {
          copyBtn.classList.add('copying')
          setTimeout(() => {
            copyBtn.classList.remove('copying')
          }, 2000)
        }
        this.showToast('Configuration copied to clipboard!')
        this.callbacks.onCopy(spec)
      })
      .catch(err => {
        this.showToast('Failed to copy: ' + err.message)
      })
  }

  showToast(message) {
    const toast = document.getElementById('pipecraft-toast')
    if (!toast) return

    toast.textContent = message
    toast.classList.add('show')
    setTimeout(() => {
      toast.classList.remove('show')
    }, 3000)
  }

  getConfig() {
    return { ...this.state }
  }

  setConfig(config) {
    this.state = { ...this.state, ...config }
    this.render()
    this.attachEventListeners()
  }

  injectStyles() {
    if (document.getElementById('pipecraft-widget-styles')) return

    const style = document.createElement('style')
    style.id = 'pipecraft-widget-styles'
    style.textContent = `
            .pipecraft-widget * {
                box-sizing: border-box;
            }

            .pipecraft-widget {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
                background: var(--ifm-background-color, #f5f5f5);
            }

            .widget-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                background: var(--ifm-background-surface-color, white);
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                overflow: hidden;
            }

            .form-section, .preview-section {
                padding: 30px;
            }

            .form-section {
                border-right: 1px solid var(--ifm-border-color, #e0e0e0);
                overflow-y: auto;
                max-height: 90vh;
            }

            .preview-section {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }

            .pipecraft-widget h1 {
                font-size: 24px;
                margin-bottom: 10px;
                color: var(--ifm-heading-color, #333);
            }

            .pipecraft-widget h2 {
                font-size: 18px;
                margin-bottom: 15px;
                color: var(--ifm-heading-color, #555);
                border-bottom: 2px solid var(--ifm-color-primary, #4CAF50);
                padding-bottom: 8px;
            }

            .pipecraft-widget .subtitle {
                color: var(--ifm-font-color-secondary, #666);
                margin-bottom: 30px;
                font-size: 14px;
            }

            .pipecraft-widget .form-group {
                margin-bottom: 20px;
            }

            .pipecraft-widget label {
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: var(--ifm-font-color-base, #333);
                font-size: 14px;
            }

            .pipecraft-widget .help-text {
                font-size: 12px;
                color: var(--ifm-font-color-secondary, #666);
                margin-top: 4px;
            }

            .pipecraft-widget input[type="text"],
            .pipecraft-widget select,
            .pipecraft-widget textarea {
                width: 100%;
                padding: 10px;
                border: 1px solid var(--ifm-border-color, #ddd);
                border-radius: 4px;
                font-size: 14px;
                font-family: inherit;
                background: var(--ifm-background-color, white);
                color: var(--ifm-font-color-base, #333);
            }

            .pipecraft-widget input[type="text"]:focus,
            .pipecraft-widget select:focus,
            .pipecraft-widget textarea:focus {
                outline: none;
                border-color: var(--ifm-color-primary, #4CAF50);
                box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
            }

            .pipecraft-widget input[type="checkbox"] {
                width: 18px;
                height: 18px;
                margin-right: 8px;
                cursor: pointer;
            }

            .pipecraft-widget .checkbox-label {
                display: flex;
                align-items: center;
                cursor: pointer;
            }

            .pipecraft-widget .domain-list {
                border: 1px solid var(--ifm-border-color, #ddd);
                border-radius: 4px;
                padding: 10px;
                background: var(--ifm-background-surface-color, #fafafa);
            }

            .pipecraft-widget .domain-item {
                background: var(--ifm-background-color, white);
                border: 1px solid var(--ifm-border-color, #e0e0e0);
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 10px;
            }

            .pipecraft-widget .domain-item:last-child {
                margin-bottom: 0;
            }

            .pipecraft-widget .domain-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .pipecraft-widget .domain-name-input {
                font-weight: 600;
                width: 150px;
            }

            .pipecraft-widget .btn-remove {
                background: #f44336;
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }

            .pipecraft-widget .btn-remove:hover {
                background: #d32f2f;
            }

            .pipecraft-widget .btn-add {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-top: 10px;
            }

            .pipecraft-widget .btn-add:hover {
                background: #45a049;
            }


            .pipecraft-widget .diagram-container {
                border: 1px solid var(--ifm-border-color, #ddd);
                border-radius: 4px;
                padding: 20px;
                background: var(--ifm-background-color, white);
                min-height: 250px;
                color: var(--ifm-font-color-base, #333);
            }

            .pipecraft-widget .spec-container {
                border: 1px solid var(--ifm-border-color, #ddd);
                border-radius: 8px;
                background: var(--ifm-code-background, #1e1e1e);
                position: relative;
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            [data-theme='dark'] .pipecraft-widget .spec-container {
                background: var(--ifm-code-background, #282a36);
            }

            .pipecraft-widget .btn-copy-icon {
                position: absolute;
                top: 8px;
                right: 8px;
                background: transparent;
                border: 1px solid var(--ifm-border-color, rgba(255, 255, 255, 0.2));
                border-radius: 6px;
                padding: 6px;
                cursor: pointer;
                color: var(--ifm-font-color-base, #d4d4d4);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                transition: all 0.2s ease;
                opacity: 0.7;
            }

            .pipecraft-widget .spec-container:hover .btn-copy-icon {
                opacity: 1;
            }

            .pipecraft-widget .btn-copy-icon:hover {
                background: var(--ifm-background-surface-color, rgba(255, 255, 255, 0.1));
                border-color: var(--ifm-border-color, rgba(255, 255, 255, 0.3));
                opacity: 1;
            }

            .pipecraft-widget .btn-copy-icon:active {
                transform: scale(0.95);
            }

            .pipecraft-widget .btn-copy-icon svg {
                display: block;
            }

            .pipecraft-widget .btn-copy-icon.copying svg:first-child {
                display: none;
            }

            .pipecraft-widget .btn-copy-icon.copying .copy-success {
                display: block !important;
            }

            .pipecraft-widget .spec-code {
                padding: 16px;
                padding-top: 48px;
                font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.6;
                color: var(--ifm-code-color, #d4d4d4);
                overflow-x: auto;
                white-space: pre;
                flex: 1;
                overflow-y: auto;
                max-height: 400px;
                margin: 0;
                background: var(--ifm-code-background, #1e1e1e);
            }

            [data-theme='dark'] .pipecraft-widget .spec-code {
                background: var(--ifm-code-background, #282a36);
            }

            .pipecraft-widget .spec-code code {
                display: block;
                background: transparent;
                padding: 0;
                border: none;
                font-size: inherit;
                font-family: inherit;
                color: inherit;
            }

            .pipecraft-widget .branch-flow {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                margin: 20px 0;
            }

            .pipecraft-widget .branch-box {
                background: #4CAF50;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                font-weight: 500;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .pipecraft-widget .branch-arrow {
                font-size: 20px;
                color: var(--ifm-font-color-secondary, #666);
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .pipecraft-widget .arrow-label {
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.5px;
                padding: 2px 6px;
                border-radius: 3px;
                background: rgba(0,0,0,0.05);
            }

            .pipecraft-widget .branch-arrow.auto-merge {
                color: #4CAF50;
            }

            .pipecraft-widget .branch-arrow.auto-merge .arrow-label {
                background: #4CAF50;
                color: white;
            }

            .pipecraft-widget .branch-arrow.manual-merge {
                color: #FF9800;
            }

            .pipecraft-widget .branch-arrow.manual-merge .arrow-label {
                background: #FF9800;
                color: white;
            }

            .pipecraft-widget .branch-badge {
                font-size: 9px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 3px;
                margin-left: 6px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .pipecraft-widget .branch-badge.initial {
                background: rgba(255,255,255,0.3);
                color: rgba(255,255,255,0.9);
            }

            .pipecraft-widget .branch-badge.final {
                background: rgba(255,255,255,0.3);
                color: rgba(255,255,255,0.9);
            }

            .pipecraft-widget .domain-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 12px;
                margin-top: 15px;
            }

            .pipecraft-widget .domain-card {
                border: 2px solid var(--ifm-border-color, #e0e0e0);
                border-radius: 6px;
                padding: 12px;
                background: var(--ifm-background-color, white);
                text-align: center;
            }

            .pipecraft-widget .domain-card-name {
                font-weight: 600;
                color: var(--ifm-heading-color, #333);
                margin-bottom: 4px;
            }

            .pipecraft-widget .domain-card-paths {
                font-size: 11px;
                color: var(--ifm-font-color-secondary, #666);
                font-family: monospace;
            }

            .pipecraft-widget .domain-card-badges {
                display: flex;
                gap: 4px;
                justify-content: center;
                margin-top: 6px;
                flex-wrap: wrap;
            }

            .pipecraft-widget .badge {
                background: #2196F3;
                color: white;
                padding: 2px 8px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 500;
            }

            .pipecraft-widget .badge.deploy {
                background: #FF9800;
            }

            .pipecraft-widget .badge.remote-test {
                background: #9C27B0;
            }

            .pipecraft-widget .toast {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 16px 24px;
                border-radius: 4px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 1000;
            }

            .pipecraft-widget .toast.show {
                opacity: 1;
            }

            @media (max-width: 1024px) {
                .widget-container {
                    grid-template-columns: 1fr;
                }

                .form-section {
                    border-right: none;
                    border-bottom: 1px solid var(--ifm-border-color, #e0e0e0);
                }
            }
        `

    document.head.appendChild(style)
  }
}

// Export for use as module or global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PipeCraftWidget
} else {
  window.PipeCraftWidget = PipeCraftWidget
}
