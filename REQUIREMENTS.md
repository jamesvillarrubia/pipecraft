# 🚀 Branching + Release Workflow Specification  
### (Including CLI Setup Tool Requirements)

---

## 🧠 Core Principles
- **Trunk-based development** with a **linear history**.
- **Fast-forward merges only** — no merge commits.
- **Squash PRs** required for all merges into long-lived branches.
- **PR titles must match Conventional Commit format**; enforced by automation.
- **Automation drives environment promotion** (e.g., `develop` → `staging` → `main`).
- Entire system designed to be initialized and managed by a **CLI configuration tool**.

---

## 🌳 Branching Model

### `develop`
- Integration branch for **active development**.  
- Only **squash-merged PRs** allowed.  
- Enforces **PR title = Conventional Commit message**.  
- On merge:
  - Runs **full test suite**.
  - **Auto fast-forwards into `staging`** if all tests pass.

### `staging`
- Always represents the **latest stable build candidate**.  
- Fast-forward only from `develop`.  
- Runs **staging validation pipeline**.  
- On success:
  - Calculates **proposed version bump** using commit history (semantic versioning).
  - If **patch release** → auto fast-forward to `main`.  
  - If **feature/minor/major release** → create **temporary PR** to `main`.

### `main`
- Represents **production-ready code**.  
- **Fast-forward only**; no direct commits.  
- **Temporary PRs** (named like `release/v1.3.0`) are created automatically for non-patch releases.  
  - The PR contains a full diff from `staging`.  
  - On merge approval:
    - **Background job fast-forwards `main`**.
    - Deletes the temporary branch.
    - Applies the **new tag** (`vX.Y.Z`).

---

## 🧩 Versioning & Automation Rules
- **Semantic Versioning (semver)** auto-derived from Conventional Commits.
- **CI/CD system** responsibilities:
  - Parse commit history to calculate version bumps.
  - Create and clean up **temporary PRs**.
  - Enforce **Conventional Commit validation**.
  - Run test suites for `develop`, `staging`, and `main`.
  - Maintain **fully linear Git history** across all environments.
  - Require **manual approval for non-patch releases**.

---

## ⚙️ CLI Setup Tool Requirements

### General
- The CLI initializes and manages all branch and release configurations.  
- Provides an **interactive setup wizard** to define workflow parameters.  
- Supports both **GitHub Actions** (default) and **GitLab CI/CD**.

### Configuration
- Configuration stored via **Cosmic Config** for flexible resolution:
  - **Local repo config file** (e.g., `.trunkflowrc`, `.trunkflowrc.json`, or package.json field).  
  - **Global config** for default organization-wide rules.

#### Configuration Schema Example
```json
{
  "ciProvider": "github",               // or "gitlab"
  "mergeStrategy": "fast-forward",      // or "branch"
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": [
    "develop",
    "staging",
    "main"
  ],
  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },
  "actions": {
    "onDevelopMerge": ["runTests", "fastForwardToStaging"],
    "onStagingMerge": ["runTests", "calculateVersion", "createOrFastForwardToMain"]
  },
  "domains": {
    "api": {
      "paths": ["apps/api/**"],
      "description": "API application changes"
    },
    "web": {
      "paths": ["apps/web/**"],
      "description": "Web application changes"
    },
    "libs": {
      "paths": ["libs/**"],
      "description": "Shared library changes"
    },
    "cicd": {
      "paths": [".github/workflows/**"],
      "description": "CI/CD configuration changes"
    }
  }
}
```

### CLI Behavior
- On initialization:
  - Prompts for **CI provider**, **merge strategy**, **branch order**, and **Conventional Commit enforcement**.
  - Generates config file and sets up **pre-commit / PR validation hooks**.
  - Optionally scaffolds **GitHub Actions** workflows matching configuration.
- On execution:
  - Validates Conventional Commits locally.
  - Checks for correct PR naming.
  - Ensures fast-forward safety before merges.
  - Provides commands such as:
    - `trunkflow init`
    - `trunkflow verify`
    - `trunkflow promote`
    - `trunkflow bump`
    - `trunkflow clean`

---

## 🧭 Net Result
- `develop` → Active development branch.  
- `staging` → Pre-release validation branch.  
- `main` → Production; tagged and audit-clean.  
- History remains **linear**, **semantic**, and **automation-safe**.  
- The CLI ensures consistent setup, validation, and enforcement across all repos and environments.

