# PipeCraft Roadmap Planning Session

**Date**: 2025-10-21
**Status**: Draft - Pending Clarifications
**Purpose**: Capture comprehensive roadmap planning discussion for future refinement

---

## Session Overview

This document captures a detailed planning session for PipeCraft's roadmap. It includes:
- Initial roadmap proposal (20 items)
- Item-by-item feedback from maintainer
- Clarifying questions that need resolution
- New feature ideas introduced during discussion
- Next steps for finalizing the roadmap

**Context**: Planning to add a prominent Roadmap page to Docusaurus documentation.

---

## Original Roadmap Proposal

### Immediate Priorities (v1.x - Bug Fixes & Completion)

#### 1. Fix Missing `create-release` Action Template 🔴 CRITICAL
**Proposed**: The pipeline references `./.github/actions/create-release` but the template doesn't exist

**FEEDBACK**: ❌ **INCORRECT** - Create release DOES exist at `.github/actions/create-release/action.yml`

**CLARIFICATION NEEDED**:
- Does PipeCraft need to generate this action template for users?
- Or should users reference the example from the PipeCraft repo?
- Should this be added to the templates that PipeCraft generates?

---

#### 2. Complete Version Management Commands 🟡 HIGH
**Proposed**:
- `pipecraft version --bump` - Currently stubbed, needs full implementation
- `pipecraft version --release` - Currently stubbed, needs full implementation
- Better integration with release-it for automated releases

**FEEDBACK**: ❌ **MISUNDERSTOOD** - "Pipecraft shouldn't be MANAGING releases. Pipecraft version should return the LIBRARY's version. I think there is confusion."

**CLARIFICATION NEEDED**:
- **PipeCraft's version** (`pipecraft --version` or `pipecraft version`) should show PipeCraft library version
- **User project versioning** happens through:
  - GitHub Actions workflows (tags, releases)
  - User's own release-it config
  - PipeCraft generates workflows but doesn't actively manage user releases
- **Question**: Should we remove/deprecate `pipecraft version --bump` and `pipecraft version --release` commands entirely? Or keep them as optional helpers for user projects?

---

#### 3. Enhance Documentation 🟡 HIGH
**Proposed**:
- Add more real-world examples and use cases
- Create video tutorials or GIF demonstrations
- Document common troubleshooting scenarios
- Better examples for custom test/deploy job patterns

**FEEDBACK**: ✅ **APPROVED** - "Fair enough. Let's add that to the roadmap"

**ACTION**: Keep on roadmap as HIGH priority

---

### Near-Term Features (v2.0 - GitLab & Enhanced UX)

#### 4. Full GitLab CI/CD Support 🟢 PLANNED
**Proposed**:
- Currently accepts 'gitlab' in config but generates GitHub Actions syntax
- Generate proper `.gitlab-ci.yml` files
- Support GitLab-specific features (runners, artifacts, environments)
- Migrate existing GitHub workflows to GitLab

**FEEDBACK**: ⬇️ **MOVE DOWN** - "Move this down (this is hard, need community support)"

**ALSO NOTED**: "This is important, but there aren't other options yet. Supposed to be the `init` flow"

**CLARIFICATION NEEDED**:
- Should this stay as "Future/Community-Driven" item?
- Or "Medium-Term (needs contributors)"?
- What does "supposed to be the `init` flow" mean in this context?

---

#### 5. Interactive Setup Wizard 🟢 ENHANCEMENT
**Proposed**:
- Step-by-step guided configuration for first-time users
- Smart defaults based on repository structure detection
- Domain auto-detection from monorepo structure
- Branch flow recommendations based on team size/workflow

**FEEDBACK**: ✅ **IMPORTANT** - "This is important, but there aren't other options yet. Supposed to be the `init` flow"

**CLARIFICATION NEEDED**:
- Enhance the existing `pipecraft init` command to be more interactive/guided?
- Or create a separate wizard?
- What should the "interactive init" experience include?

---

#### 6. Enhanced Branch Protection Automation 🟢 ENHANCEMENT
**Proposed**:
- Fully automated branch protection rule setup
- Template-based protection rules (e.g., "production-strict", "development-flexible")
- Integration with GitHub required reviewers and CODEOWNERS

**FEEDBACK**: 🤔 **UNCERTAIN** - "Could be interesting, but need to understand more"

**CLARIFICATION NEEDED**:
- What would you like to understand more about?
- Complexity of implementation?
- Whether teams actually need automated protection rule setup?
- What should this do beyond current `setup-github` command?
- Specific use cases you envision?

---

### Medium-Term Features (v2.5 - Advanced Workflows)

#### 7. Additional Merge Strategies 🟢 ENHANCEMENT
**Proposed**:
- Support for 'squash' merge strategy
- Support for 'rebase' merge strategy
- Configurable merge strategy per branch

**FEEDBACK**: 🤷 **KEEP BUT UNCERTAIN** - "Not sure the value here, but lets keep it"

**CLARIFICATION NEEDED**:
- What's the current use case for this?
- Just for completeness?
- Do you see teams actually needing squash/rebase strategies in trunk-based workflows?
- Should this be lower priority?

---

#### 8. Deployment Pattern Templates 🟢 NEW FEATURE
**Proposed**:
- Blue-green deployment templates
- Canary deployment templates
- Rolling deployment templates
- Multi-environment staging patterns

**FEEDBACK**: ❌ **OUT OF SCOPE** - "Deployments are OUTSIDE of this tool. We could have an example for sure. This IS a multi-environment pattern, right?"

**CLARIFICATION NEEDED**:
- **Confusion on my part**: By "multi-environment" I meant each branch = environment
- Blue-green/canary = deployment STRATEGIES within an environment
- You're saying actual deployment execution is out of scope
- **Question**: Should this be "Deployment Pattern Examples" (in examples folder) rather than "Deployment Pattern Templates" (as a feature)?
- **Question**: By "multi-environment pattern" do you mean PipeCraft's develop → staging → main flow itself?

---

#### 9. Workflow Templates Library 🟢 NEW FEATURE
**Proposed**:
- Pre-built templates for common scenarios (Node.js apps, Docker, serverless)
- Community-contributed templates
- Template marketplace/registry

**FEEDBACK**: ✅ **APPROVED** - "Yes we could do that. Probably pipeline files in the examples folder?"

**CLARIFICATION NEEDED**:
- Rather than a template system built INTO PipeCraft, you want curated example configurations in `/examples/`?
- Examples showing different patterns:
  - Node.js monorepo
  - Docker-based apps
  - Serverless functions
  - Different domain configurations
- Should these be `.pipecraftrc.json` examples or full generated workflow examples?

---

#### 10. Enhanced Change Detection 🟢 ENHANCEMENT
**Proposed**:
- Dependency graph analysis (detect shared library changes affecting multiple domains)
- Smart change impact analysis
- Configurable change detection rules

**FEEDBACK**: ✅ **APPROVED WITH CLARIFICATION** - "We need an example of how to USE layered dependencies, but sure enhance change could include 'other domains'. Nx does this, right?"

**CLARIFICATION NEEDED**:
- Add examples showing how to use Nx with PipeCraft?
- OR build dependency graph analysis INTO PipeCraft (complex)?
- Should change detection be able to trigger domain B's tests when shared library (used by B) changes?
- What level of integration with existing tools (Nx, Turborepo) vs. custom implementation?

---

### Long-Term Vision (v3.0+ - Enterprise & Ecosystem)

#### 11. Multi-Repository Support 🔵 FUTURE
**Proposed**:
- Manage pipelines across multiple repositories
- Cross-repo dependency handling
- Centralized pipeline configuration management

**FEEDBACK**: ❌ **REJECTED** - "No."

**ACTION**: Remove from roadmap

---

#### 12. Additional CI/CD Providers 🔵 FUTURE
**Proposed**:
- Azure DevOps Pipelines
- CircleCI
- Jenkins Pipeline DSL
- Bitbucket Pipelines
- AWS CodePipeline

**FEEDBACK**: 🤔 **MAYBE**

**ACTION**: Keep as "Long-Term / Community-Driven" with lower priority

---

#### 13. Advanced Environment Management 🔵 FUTURE
**Proposed**:
- GitHub Environments integration with protection rules
- Environment-specific secrets management
- Deployment approval workflows
- Environment provisioning integration

**FEEDBACK**: ⬆️ **MOVE UP** - "Move this up"

**CLARIFICATION NEEDED**:
- What priority level?
- Near-Term (v2.0) or Medium-Term (v2.5)?
- Which specific features are most important:
  - GitHub Environments protection rules?
  - Deployment approvals?
  - Secrets management?
  - All of the above?

---

#### 14. Policy Enforcement & Governance 🔵 FUTURE
**Proposed**:
- Compliance rules enforcement (required checks, approval counts)
- Audit logging for all pipeline changes
- Team-based pipeline templates with inheritance
- Pipeline change approval workflows

**FEEDBACK**: 🤔 **MAYBE**

**ACTION**: Keep as "Long-Term / Enterprise" feature

---

#### 15. Plugin & Extension System 🔵 FUTURE
**Proposed**:
- Custom action generators
- Third-party integrations (Slack, PagerDuty, DataDog)
- Custom workflow patterns
- Community plugin marketplace

**FEEDBACK**: 🤔 **MAYBE**

**ACTION**: Keep as "Long-Term / Ecosystem" feature

---

#### 16. Visual Workflow Editor 🔵 FUTURE
**Proposed**:
- Web-based workflow configuration UI
- Drag-and-drop job creation
- Visual branch flow designer
- Real-time workflow validation

**FEEDBACK**: ❌ **REJECTED** - "No."

**ACTION**: Remove from roadmap

---

#### 17. Analytics & Insights 🔵 FUTURE
**Proposed**:
- Pipeline performance metrics
- Deployment frequency tracking
- Lead time and change failure rate
- DORA metrics integration

**FEEDBACK**: 🤔 **MAYBE**

**ACTION**: Keep as "Long-Term / Enterprise" feature

---

### Community & Ecosystem

#### 18. CLI Improvements 🟢 ONGOING
**Proposed**:
- Better error messages with actionable suggestions
- Progress indicators for long-running operations
- Configuration migration tools (from other CI/CD tools)
- Dry-run mode improvements

**FEEDBACK**: 🤔 **MAYBE**

**ACTION**: Keep as ongoing improvements

---

#### 19. Testing & Quality 🟢 ONGOING
**Proposed**:
- Expand test coverage
- Integration tests for generated workflows
- Performance benchmarking
- Security scanning integration

**FEEDBACK**: ✅ **APPROVED** - "Yes"

**ACTION**: Keep as HIGH priority ongoing work

**CODECOV INTEGRATION** (Added 2025-10-21):
- ✅ Codecov integration added to CI pipeline
- ✅ Coverage reporting enabled with lcov format
- 📊 Current coverage: ~63% (lines/statements)
- 🎯 Current threshold: 60% (minimum to pass CI)
- 🚀 **Target: Gradually increase to 75%+**

**Coverage Improvement Priorities**:
1. **CLI Entry Point** (`src/cli/index.ts`) - Currently 0% coverage
   - Add tests for main CLI command parsing
   - Test error handling and help text generation
   - Test command routing and option validation

2. **GitHub Setup** (`src/utils/github-setup.ts`) - Currently ~25% coverage
   - Test branch protection rule creation
   - Test GitHub API error handling
   - Test webhook and secret configuration
   - Mock GitHub API calls for comprehensive testing

3. **Versioning** (`src/utils/versioning.ts`) - Currently ~57% coverage
   - Test edge cases in version calculation
   - Test git tag creation and validation
   - Test conventional commit parsing edge cases
   - Test error recovery scenarios

4. **AST Path Operations** (`src/utils/ast-path-operations.ts`) - Currently ~92% coverage
   - Add tests for remaining edge cases
   - Target: 95%+ coverage (well-tested critical code)

**Success Metrics**:
- Increase overall coverage by 3-5% per quarter
- Reach 70% coverage by Q2 2025
- Reach 75% coverage by Q3 2025
- Maintain >90% coverage on all new code

---

#### 20. Developer Experience 🟢 ONGOING
**Proposed**:
- VSCode extension for PipeCraft configuration
- GitHub App for easier setup
- Configuration file JSON schema for IDE autocomplete
- Better logging and debugging tools

**FEEDBACK**: 🤔 **MAYBE**

**ACTION**: Keep as ongoing improvements

---

## New Ideas Introduced During Discussion

### 💡 Interactive Template Builder (Website)

**Proposed By**: Maintainer during session

**Description**:
- Web-based configuration generator on the docs site
- Users click through options (branch names, domain paths, etc.)
- Real-time config preview
- Copy/download the `.pipecraftrc.json`

**Quote**: "I would like an interactive template builder for the website which generates the right config commands or shows the user the options of what to setup. That should be on there, but probably only after we have functioning options."

**CLARIFICATION NEEDED**:
- Should this generate the config file OR show CLI commands to run? OR both?
- Should it live on the Docusaurus site or separate web app?
- What "functioning options" need to exist first?
- Priority: After we have "functioning options" - so Medium-Term (v2.5) or later?
- Interactive form with:
  - Branch flow selection (dropdowns, add/remove branches)
  - Domain configuration (path patterns, descriptions)
  - Merge strategy selection
  - Auto-merge configuration
  - Output: downloadable `.pipecraftrc.json` + copy button

---

### 💡 Local Flow Testing/Mocking

**Proposed By**: Maintainer during session

**Description**:
- Ability to test entire CI/CD flows locally without hitting GitHub/GitLab APIs
- Mock the GitHub Actions environment
- Test multiple flows locally

**Quote**: "I also want to be able to mock and confirm the ENTIRE flow in code and not rely on github. That would be huge since we can then test multiple flows locally. Same for gitlab, etc."

**CLARIFICATION NEEDED**:
- Should this be a `pipecraft test` command that simulates the workflow?
- Mock the GitHub Actions environment (events, contexts, env vars, etc.)?
- Generate test reports showing what would happen?
- Where does this fit priority-wise? This seems HIGH value for development but significant effort.
- Should this work with existing tools like `act` (https://github.com/nektos/act)?
- Or be a custom PipeCraft implementation?
- Integration with existing test suites?

**Potential Features**:
- `pipecraft test --flow develop-to-staging` - simulate branch promotion
- `pipecraft test --domain api` - test domain-specific jobs
- `pipecraft test --all` - run full workflow simulation
- Mock GitHub API responses
- Validate generated YAML syntax
- Test idempotency of regeneration
- Output: test report showing jobs that would run, in what order, with what conditions

---

## Key Insights & Philosophy

### PipeCraft's Role
- **Generates workflows** - creates GitHub Actions (and future GitLab CI) YAML files
- **Does NOT manage releases** - users manage their own project releases
- **Provides structure** - branch flow, change detection, conditional jobs
- **Examples, not execution** - deployment patterns are examples, not built-in features

### Scope Boundaries
- ✅ **In Scope**: CI/CD workflow generation, branch flow management, change detection
- ❌ **Out of Scope**: Actual deployments, release management, multi-repo orchestration

### Community & Support
- GitLab and additional CI/CD providers require community contributions
- Complex features need validation with real-world users
- Examples and documentation are high value, low maintenance

---

## Next Steps

1. **Answer Clarifying Questions** (10+ questions above)
   - Resolve confusion around version management
   - Define scope for each feature
   - Prioritize based on value vs. effort

2. **Create Refined Roadmap**
   - Remove rejected items (#11, #16)
   - Adjust priorities based on feedback
   - Add new features (interactive builder, local testing)
   - Group by version/timeline

3. **Determine Docusaurus Content**
   - What gets published vs. internal planning
   - How detailed should public roadmap be
   - Interactive elements (voting, comments)

4. **Define Success Criteria**
   - What makes a feature "complete"
   - Testing requirements
   - Documentation requirements

5. **Create Docusaurus Roadmap Page**
   - Prominent tab in navigation
   - Linked from intro page
   - Clear status indicators
   - Community feedback mechanism

---

## Reference Links

- **Current Implementation Status**: See agent's comprehensive codebase analysis above
- **Future Plans**: [TRUNK_FLOW_PLAN.md](./TRUNK_FLOW_PLAN.md) - Detailed plan for temporary branch promotions (Phases 2-4)
- **Create Release Action**: [.github/actions/create-release/action.yml](./.github/actions/create-release/action.yml)
- **Main README**: [README.md](./README.md) - Current features and documentation

---

## Document Status

**Current State**: Draft with pending clarifications
**Next Session**: Review clarifying questions and create final roadmap
**Target Deliverable**: Docusaurus roadmap page with prominent navigation

---

*Last Updated: 2025-10-21*
