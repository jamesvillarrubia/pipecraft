# PipeCraft Generation Behavior Reference

This document outlines how PipeCraft's `generate` and `--force` options interact with different workflow sections and job types.

## Generation Modes

| Mode       | Command                      | Behavior                                                                                         | Use Case                                     |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **Normal** | `pipecraft generate`         | Intelligent merging - preserves user customizations, only regenerates when configuration changes | Regular updates, preserving user work        |
| **Force**  | `pipecraft generate --force` | Complete regeneration - rebuilds all workflows from scratch                                      | Major configuration changes, troubleshooting |

## Workflow Sections & Job Types

### 🔧 Managed Sections (Always Regenerated)

| Section                                    | Normal Generate              | Force Generate            | Notes                                         |
| ------------------------------------------ | ---------------------------- | ------------------------- | --------------------------------------------- |
| **Workflow Triggers** (`on:`)              | ✅ Updated if config changes | ✅ Completely regenerated | Always managed by PipeCraft                   |
| **Workflow Metadata** (`name`, `run-name`) | ✅ Updated if config changes | ✅ Completely regenerated | Name can be customized but may be overwritten |
| **Changes Detection** (`changes` job)      | ✅ Updated if config changes | ✅ Completely regenerated | Core functionality, always managed            |
| **Version Calculation** (`version` job)    | ✅ Updated if config changes | ✅ Completely regenerated | Semantic versioning logic                     |
| **Tag Creation** (`tag` job)               | ✅ Updated if config changes | ✅ Completely regenerated | Git tagging functionality                     |
| **Branch Promotion** (`promote` job)       | ✅ Updated if config changes | ✅ Completely regenerated | Trunk-based flow management                   |
| **Release Creation** (`release` job)       | ✅ Updated if config changes | ✅ Completely regenerated | GitHub releases                               |

### 🎯 Domain Jobs (Configuration-Driven)

| Job Type                               | Normal Generate            | Force Generate                       | Creation Trigger                        |
| -------------------------------------- | -------------------------- | ------------------------------------ | --------------------------------------- |
| **Test Jobs** (`test-*`)               | ✅ Preserved if customized | ✅ Regenerated (customizations lost) | `test: true` in domain config           |
| **Deploy Jobs** (`deploy-*`)           | ✅ Preserved if customized | ✅ Regenerated (customizations lost) | `deployable: true` in domain config     |
| **Remote Test Jobs** (`remote-test-*`) | ✅ Preserved if customized | ✅ Regenerated (customizations lost) | `remoteTestable: true` in domain config |

### 👤 User Jobs (Always Preserved)

| Job Type                       | Normal Generate              | Force Generate       | Notes                                   |
| ------------------------------ | ---------------------------- | -------------------- | --------------------------------------- |
| **Custom Jobs** (user-defined) | ✅ Always preserved          | ✅ Always preserved  | Any job not matching PipeCraft patterns |
| **Custom Dependencies**        | ✅ Preserved in managed jobs | ❌ Reset to template | User modifications to `needs` arrays    |
| **Custom Conditions**          | ✅ Preserved in managed jobs | ❌ Reset to template | User modifications to `if` statements   |

## Detailed Behavior Matrix

### Normal `generate` Command

| Scenario                  | Behavior                                       | Example                                                        |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| **No config changes**     | Skip all files                                 | `Skipped file .github/workflows/pipeline.yml`                  |
| **Domain added**          | Create missing jobs, preserve existing         | Add `mobile` domain → create `test-mobile`, `deploy-mobile`    |
| **Domain removed**        | Remove orphaned jobs, preserve others          | Remove `mobile` domain → delete `test-mobile`, `deploy-mobile` |
| **Domain config changed** | Update job conditions, preserve customizations | Change `deployable: false` → `true` → update `if` conditions   |
| **Custom job exists**     | Preserve completely                            | User's `database-migrations` job untouched                     |
| **Custom dependencies**   | Preserve in user jobs, update in managed jobs  | User's custom `needs` arrays preserved                         |

### `--force` Command

| Scenario                 | Behavior                  | Example                                          |
| ------------------------ | ------------------------- | ------------------------------------------------ |
| **All managed sections** | Completely regenerated    | Workflow triggers, version logic, etc.           |
| **All domain jobs**      | Regenerated from template | `test-*`, `deploy-*`, `remote-test-*` jobs reset |
| **User custom jobs**     | Preserved exactly         | `database-migrations`, `build-assets` kept       |
| **Job dependencies**     | Reset to template         | `needs` arrays in managed jobs reset             |
| **Job conditions**       | Reset to template         | `if` statements in managed jobs reset            |
| **Pipeline name**        | Reset to template         | Custom names may be overwritten                  |

## Configuration Change Detection

PipeCraft detects changes in these configuration areas:

| Configuration                   | Triggers Regeneration | Affects                            |
| ------------------------------- | --------------------- | ---------------------------------- |
| **Domain paths**                | ✅                    | Job conditions, change detection   |
| **Domain test flags**           | ✅                    | Test job creation/removal          |
| **Domain deployable flags**     | ✅                    | Deploy job creation/removal        |
| **Domain remoteTestable flags** | ✅                    | Remote test job creation/removal   |
| **Branch flow**                 | ✅                    | Promotion logic, workflow triggers |
| **Semver rules**                | ✅                    | Version calculation logic          |
| **CI provider**                 | ✅                    | Action generation                  |

## Best Practices

### ✅ When to Use Normal `generate`

- Regular configuration updates
- Adding/removing domains
- Changing domain properties
- Preserving user customizations

### ✅ When to Use `--force`

- Major configuration restructuring
- Troubleshooting workflow issues
- Resetting to clean template state
- After significant PipeCraft updates

### ⚠️ Important Notes

- **Always backup** custom jobs before using `--force`
- **Test changes** in a separate branch first
- **Review generated workflows** after regeneration
- **Custom dependencies** in managed jobs will be lost with `--force`

## Examples

### Scenario 1: Adding a New Domain

```bash
# Configuration change: Add 'mobile' domain
# Normal generate: Creates test-mobile, deploy-mobile jobs
# Preserves: All existing customizations
pipecraft generate
```

### Scenario 2: Custom Job Preservation

```bash
# User has: database-migrations, build-assets jobs
# Normal generate: Preserves both jobs completely
# Force generate: Preserves both jobs, resets managed jobs
pipecraft generate --force
```

### Scenario 3: Configuration Update

```bash
# Change: mobile domain deployable: false → true
# Normal generate: Updates deploy-mobile job conditions
# Preserves: All custom job logic
pipecraft generate
```

This reference helps developers understand exactly what PipeCraft will preserve, update, or regenerate in different scenarios.
