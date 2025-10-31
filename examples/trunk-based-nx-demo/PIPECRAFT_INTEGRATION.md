# PipeCraft Integration Guide

This document describes how PipeCraft should handle the trunk-based-nx-demo monorepo.

## Current Implementation (Path-Based)

The test suite currently uses **path-based detection** because PipeCraft's Nx strategy isn't fully implemented yet.

### Configuration

```json
{
  "branchFlow": ["develop", "staging", "main"],
  "domains": {
    "nx-apps": {
      "paths": ["apps/**"],
      "description": "Nx workspace applications",
      "tasks": ["build", "test", "integration-test"],
      "testable": true,
      "deployable": true
    },
    "nx-libs": {
      "paths": ["libs/**"],
      "description": "Nx workspace libraries",
      "tasks": ["build", "test"],
      "testable": true,
      "deployable": false
    },
    "infra-pulumi": {
      "paths": ["infra/pulumi/**"],
      "description": "Pulumi infrastructure code",
      "tasks": ["preview", "up"],
      "testable": false,
      "deployable": true
    },
    "infra-kubernetes": {
      "paths": ["infra/kubernetes/**"],
      "description": "Kubernetes manifests",
      "tasks": ["validate", "apply"],
      "testable": false,
      "deployable": true
    },
    "migrations": {
      "paths": ["migrations/**"],
      "description": "Database migrations",
      "tasks": ["migrate"],
      "testable": false,
      "deployable": false
    }
  }
}
```

### Limitations

1. **No Nx Affected Detection**: Can't use `nx show projects --affected`
2. **No Task Dependency Awareness**: Can't respect `project.json` overrides
3. **Coarse-Grained Detection**: Changes to any lib trigger all libs
4. **No Implicit Dependencies**: Can't detect library imports

## Future Implementation (Nx Strategy)

### Proposed Configuration

```json
{
  "branchFlow": ["develop", "staging", "main"],
  "strategy": "nx",
  "nx": {
    "affectedCommand": "nx show projects --affected --base=origin/develop --head=HEAD",
    "respectTaskDependencies": true,
    "parallelizeJobs": true,
    "maxParallel": 10
  },
  "domains": {
    "nx-projects": {
      "strategy": "nx",
      "description": "Nx monorepo projects",
      "tasks": {
        "build": {
          "dependsOn": ["^build"]
        },
        "test": {
          "dependsOn": []
        },
        "integration-test": {
          "dependsOn": ["build", "^build"]
        }
      }
    },
    "infra-pulumi": {
      "paths": ["infra/pulumi/**"],
      "tasks": ["preview", "up"]
    },
    "infra-kubernetes": {
      "paths": ["infra/kubernetes/**"],
      "tasks": ["validate", "apply"]
    },
    "migrations": {
      "paths": ["migrations/**"],
      "tasks": ["migrate"]
    }
  }
}
```

## How PipeCraft Should Work

### 1. Detection Phase

When PipeCraft detects an Nx workspace (presence of `nx.json`):

1. Read `nx.json` to understand workspace configuration
2. Read `tsconfig.base.json` to get path mappings
3. For each changed file:
   - If in Nx-managed directory (apps/, libs/):
     - Run `nx show projects --affected`
     - Parse affected project list
   - If in path-based directory (infra/, migrations/):
     - Use existing path-based detection

### 2. Task Dependency Analysis

For each affected Nx project:

1. Read `project.json` (or `package.json` with Nx config)
2. Check `targets` for task definitions
3. Check `dependsOn` for each target:
   - If `dependsOn` is missing: Use workspace default from `nx.json` `targetDefaults`
   - If `dependsOn` is present: Use project-specific override

Example:

**Workspace Default (nx.json):**

```json
{
  "targetDefaults": {
    "test": {
      "dependsOn": [] // test WITHOUT build by default
    }
  }
}
```

**Project Override (libs/database/project.json):**

```json
{
  "targets": {
    "test": {
      "dependsOn": ["build"] // Override: test WITH build
    }
  }
}
```

### 3. Job Generation

For each affected project and task:

```yaml
test-database:
  runs-on: ubuntu-latest
  needs:
    - detect-changes
    - build-database # Added because project.json has dependsOn: ["build"]
  if: contains(needs.detect-changes.outputs.affected, 'database')
  steps:
    - uses: actions/checkout@v4
    - name: Run tests
      run: nx test database
```

```yaml
test-logging:
  runs-on: ubuntu-latest
  needs:
    - detect-changes
    # NO build-logging dependency (workspace default)
  if: contains(needs.detect-changes.outputs.affected, 'logging')
  steps:
    - uses: actions/checkout@v4
    - name: Run tests
      run: nx test logging
```

### 4. Matrix Strategy (Advanced)

For large monorepos, use matrix strategy:

```yaml
test:
  runs-on: ubuntu-latest
  needs: detect-changes
  if: needs.detect-changes.outputs.affected != ''
  strategy:
    matrix:
      project: ${{ fromJson(needs.detect-changes.outputs.testable-projects) }}
  steps:
    - uses: actions/checkout@v4
    - name: Run tests
      run: nx test ${{ matrix.project }}
```

## Task Dependency Patterns

### Pattern 1: No Build Required (Default)

Most TypeScript libraries don't need build before test:

```json
// nx.json (workspace default)
{
  "targetDefaults": {
    "test": {
      "dependsOn": []
    }
  }
}
```

Projects using this:

- auth
- logging
- config
- user-management
- notifications
- reporting
- admin-dashboard

### Pattern 2: Build Required (Override)

Some libraries need build artifacts:

```json
// libs/database/project.json
{
  "targets": {
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

Projects using this:

- database (compiled DB drivers)
- analytics (event tracking modules)
- billing (payment processing)

### Pattern 3: Upstream Dependencies

Integration tests need upstream builds:

```json
// nx.json (workspace default)
{
  "targetDefaults": {
    "integration-test": {
      "dependsOn": ["build", "^build"]
    }
  }
}
```

The `^build` means "build all dependencies first".

## Implementation Steps

### Step 1: Detect Nx Workspace

In `pipecraft init`:

```typescript
async function detectNxWorkspace() {
  const nxJsonPath = path.join(process.cwd(), 'nx.json')

  if (await fs.pathExists(nxJsonPath)) {
    const nxJson = await fs.readJson(nxJsonPath)

    return {
      isNxWorkspace: true,
      targetDefaults: nxJson.targetDefaults || {},
      workspaceLayout: nxJson.workspaceLayout || {
        appsDir: 'apps',
        libsDir: 'libs'
      }
    }
  }

  return { isNxWorkspace: false }
}
```

### Step 2: Generate Nx-Aware Detect-Changes

In `.github/actions/detect-changes/action.yml`:

```yaml
- name: Detect affected Nx projects
  id: nx-affected
  if: env.IS_NX_WORKSPACE == 'true'
  run: |
    affected=$(nx show projects --affected --base=origin/${{ github.base_ref }} --head=HEAD)
    echo "affected=$affected" >> $GITHUB_OUTPUT

- name: Detect path-based changes
  id: path-changes
  run: |
    # Existing path-based detection for infra, migrations, etc.
```

### Step 3: Generate Jobs with Task Dependencies

```typescript
function generateJobForProject(project: NxProject, task: string) {
  const taskConfig = getTaskConfig(project, task)
  const dependencies = taskConfig.dependsOn || []

  const needs = ['detect-changes']

  for (const dep of dependencies) {
    if (dep.startsWith('^')) {
      // Upstream dependency - handled by Nx
      // Still need to wait for upstream build jobs
      const upstreamTask = dep.slice(1) // Remove ^
      needs.push(`${upstreamTask}-${project.name}`)
    } else {
      // Same-project dependency
      needs.push(`${dep}-${project.name}`)
    }
  }

  return {
    name: `${task}-${project.name}`,
    needs,
    runsOn: 'ubuntu-latest',
    if: `contains(needs.detect-changes.outputs.affected, '${project.name}')`,
    steps: [
      { uses: 'actions/checkout@v4' },
      { name: `Run ${task}`, run: `nx ${task} ${project.name}` }
    ]
  }
}
```

## Testing with This Demo

To validate PipeCraft's Nx integration:

1. **Run the test suite**: `./test-pipecraft.mjs`
2. **Check generated workflows**: Inspect `.github/workflows/pipeline.yml`
3. **Verify task dependencies**:
   - database, analytics, billing should have `test` → `build` dependency
   - Other libs should NOT have this dependency
4. **Test idempotency**: Custom jobs should be preserved after regeneration
5. **Run act scenarios**: Verify affected detection and job execution

## Success Criteria

PipeCraft successfully handles this demo if:

1. ✅ Detects Nx workspace automatically
2. ✅ Uses `nx show projects --affected` for change detection
3. ✅ Respects per-project task dependency overrides
4. ✅ Generates jobs with correct `needs` dependencies
5. ✅ Handles mixed Nx + path-based detection
6. ✅ Preserves custom jobs during regeneration
7. ✅ Generated workflows pass act tests
8. ✅ All 11 test scenarios pass

## Current Status

**Status**: Path-based detection working, Nx strategy NOT implemented

**Blockers**:

- Nx detection logic not implemented
- Task dependency analysis not implemented
- Job generation doesn't respect Nx graph

**Workaround**: Use path-based detection with coarse-grained patterns

**Next Steps**:

1. Implement Nx workspace detection in `pipecraft init`
2. Add `nx show projects --affected` to detect-changes action
3. Parse `project.json` for task dependencies
4. Generate jobs with correct `needs` relationships
5. Add tests to verify Nx integration
