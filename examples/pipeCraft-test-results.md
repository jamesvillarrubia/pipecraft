# PipeCraft Generation Test Results

Based on comprehensive testing with the trunk-based-demo repository, here are the actual behaviors observed:

## Test Scenarios Executed

### 1. Custom Job Preservation

| Test                     | Input                                                  | Normal Generate | Force Generate       | Result      |
| ------------------------ | ------------------------------------------------------ | --------------- | -------------------- | ----------- |
| **Custom Jobs**          | `database-migrations`, `build-assets`, `security-scan` | ✅ Preserved    | ✅ Preserved         | ✅ PASS     |
| **Custom Pipeline Name** | `"Trunk-Based CI/CD Pipeline"`                         | ✅ Preserved    | ✅ Preserved         | ✅ PASS     |
| **Custom Dependencies**  | User-modified `needs` arrays                           | ✅ Preserved    | ❌ Reset to template | ⚠️ Expected |

### 2. Configuration-Driven Job Creation

| Test                           | Input                                    | Normal Generate                 | Force Generate                  | Result  |
| ------------------------------ | ---------------------------------------- | ------------------------------- | ------------------------------- | ------- |
| **Add Deployable Domain**      | `mobile: {deployable: true}`             | ✅ Created `deploy-mobile`      | ✅ Created `deploy-mobile`      | ✅ PASS |
| **Add Remote Testable Domain** | `shared: {remoteTestable: true}`         | ✅ Created `remote-test-shared` | ✅ Created `remote-test-shared` | ✅ PASS |
| **Remove Domain Jobs**         | Delete `test-cicd`, `remote-test-mobile` | ✅ Recreated as placeholders    | ✅ Recreated as placeholders    | ✅ PASS |

### 3. Managed Section Updates

| Test                         | Input                  | Normal Generate | Force Generate            | Result      |
| ---------------------------- | ---------------------- | --------------- | ------------------------- | ----------- |
| **Version Job Dependencies** | Custom `needs` array   | ✅ Preserved    | ❌ Reset to template      | ⚠️ Expected |
| **Job Conditions**           | Custom `if` statements | ✅ Preserved    | ❌ Reset to template      | ⚠️ Expected |
| **Workflow Triggers**        | Configuration changes  | ✅ Updated      | ✅ Completely regenerated | ✅ PASS     |

## Detailed Behavior Matrix

### Normal `pipecraft generate`

| Section/Job Type         | Behavior                     | Evidence from Testing                                       |
| ------------------------ | ---------------------------- | ----------------------------------------------------------- |
| **User Custom Jobs**     | ✅ Always preserved          | `database-migrations`, `build-assets`, `security-scan` kept |
| **Custom Pipeline Name** | ✅ Preserved                 | `"Trunk-Based CI/CD Pipeline"` maintained                   |
| **Domain Jobs**          | ✅ Preserved if customized   | Custom `test-backend` logic preserved                       |
| **Missing Jobs**         | ✅ Created as placeholders   | `test-cicd`, `remote-test-mobile` recreated                 |
| **New Domain Jobs**      | ✅ Created based on config   | `deploy-mobile`, `remote-test-shared` created               |
| **Managed Sections**     | ✅ Updated if config changes | Workflow triggers, version logic updated                    |
| **No Changes**           | ✅ Skip all files            | `Skipped file .github/workflows/pipeline.yml`               |

### `pipecraft generate --force`

| Section/Job Type         | Behavior                  | Evidence from Testing                                       |
| ------------------------ | ------------------------- | ----------------------------------------------------------- |
| **User Custom Jobs**     | ✅ Always preserved       | `database-migrations`, `build-assets`, `security-scan` kept |
| **Custom Pipeline Name** | ✅ Preserved              | `"Trunk-Based CI/CD Pipeline"` maintained                   |
| **Domain Jobs**          | ❌ Reset to template      | Custom `test-backend` logic lost                            |
| **Managed Sections**     | ❌ Completely regenerated | Version job dependencies reset                              |
| **Job Dependencies**     | ❌ Reset to template      | Custom `needs` arrays reset                                 |
| **Job Conditions**       | ❌ Reset to template      | Custom `if` statements reset                                |
| **All Files**            | ❌ Regenerated            | `Wrote file .github/workflows/pipeline.yml`                 |

## Key Findings

### ✅ What PipeCraft Preserves (Both Modes)

- **User-defined custom jobs** (any job not matching PipeCraft patterns)
- **Custom pipeline names** (workflow metadata)
- **Custom job logic** (steps, run commands, etc.)

### ⚠️ What PipeCraft Resets (Force Mode Only)

- **Managed job dependencies** (`needs` arrays in PipeCraft jobs)
- **Managed job conditions** (`if` statements in PipeCraft jobs)
- **Domain job customizations** (user modifications to `test-*`, `deploy-*`, `remote-test-*`)

### 🔄 What PipeCraft Updates (Both Modes)

- **Missing jobs** (creates placeholders for missing domain jobs)
- **New domain jobs** (creates jobs based on configuration changes)
- **Workflow triggers** (updates `on:` section based on config)
- **Version logic** (updates semantic versioning based on config)

## Recommendations

### Use Normal `generate` When:

- ✅ Making regular configuration updates
- ✅ Adding/removing domains
- ✅ Preserving user customizations
- ✅ Daily development workflow

### Use `--force` When:

- ⚠️ Major configuration restructuring
- ⚠️ Troubleshooting workflow issues
- ⚠️ Resetting to clean template state
- ⚠️ After significant PipeCraft updates

### ⚠️ Important Warnings:

- **Always backup** custom jobs before using `--force`
- **Custom dependencies** in managed jobs will be lost with `--force`
- **Test changes** in a separate branch first
- **Review generated workflows** after regeneration

## Test Repository

The comprehensive test was conducted using:

- **Repository**: [trunk-based-demo](https://github.com/jamesvillarrubia/trunk-based-demo)
- **Domains**: frontend, backend, mobile, shared, cicd
- **Custom Jobs**: database-migrations, build-assets, security-scan
- **Configuration**: Full PipeCraft setup with trunk-based flow

This testing validates PipeCraft's intelligent merging capabilities and provides clear guidance for users on when to use each generation mode.
