# Path-Based Template Refactor - Next Session Instructions

## Current State ✅

The Nx template has been successfully refactored to use the new shared operations architecture:
- **Before**: 414 lines of manual string concatenation
- **After**: 220 lines using declarative operations array
- **Shared utilities created**: 5 operation generator files (~300 lines total)
- **Result**: ~70% code reduction through reuse

## What's Left 🔧

The path-based template (`pipeline-path-based.yml.tpl.ts`) is still 1100+ lines using the old AST approach. It needs to be refactored to use the same shared operations.

## How to Refactor Path-Based Template

### Step 1: Understand Current Structure

The current `pipeline-path-based.yml.tpl.ts` has this structure:

```typescript
// 1. Define Pipecraft-owned jobs (~90 lines)
const PIPECRAFT_OWNED_JOBS = new Set([...])

// 2. Define deprecated jobs (~20 lines)
const DEPRECATED_JOBS = new Set([...])

// 3. Extract user jobs from existing workflow (~50 lines)
const userJobs = new Map()
// ... complex AST traversal ...

// 4. Build operations array (~600+ lines)
const operations: PathOperationConfig[] = [
  // Header operations (duplicate of what's now in shared/operations-header.ts)
  { path: 'name', operation: 'preserve', ... },
  { path: 'run-name', operation: 'preserve', ... },

  // Changes job (duplicate of shared/operations-changes.ts)
  { path: 'jobs.changes', operation: 'overwrite', ... },

  // Domain test jobs (duplicate of shared/operations-domain-jobs.ts)
  ...Object.keys(domains).map(domain => ({
    path: `jobs.test-${domain}`,
    operation: 'preserve',
    ...
  })),

  // Version (duplicate of shared/operations-version.ts)
  { path: 'jobs.version', operation: 'overwrite', ... },

  // Deploy/remote-test (duplicate of shared/operations-domain-jobs.ts)
  ...

  // Tag/promote/release (duplicate of shared/operations-tag-promote.ts)
  ...
]

// 5. Apply operations and merge (~300 lines)
const doc = parseDocument(existingContent)
applyPathOperations(doc.contents, rootOperations, doc)
// ... complex merging logic ...
```

### Step 2: Create New `pipeline-path-based.tpl.ts`

Model it after the new Nx template. It should look like:

```typescript
import {
  createHeaderOperations,
  createChangesJobOperation,
  createDomainTestJobOperations,
  createDomainDeployJobOperations,
  createDomainRemoteTestJobOperations,
  createVersionJobOperation,
  createTagPromoteReleaseOperations,
  getDomainJobNames
} from './shared/index.js'

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(ctx => {
      const { config, branchFlow } = ctx
      const domains = config.domains || {}

      // Get domain job names
      const { testJobs, deployJobs, remoteTestJobs } = getDomainJobNames(domains)

      // Build operations array
      const operations: PathOperationConfig[] = [
        // Header (shared)
        ...createHeaderOperations({ branchFlow }),

        // Changes (shared, useNx = false)
        createChangesJobOperation({ domains, useNx: false, baseRef: 'main' }),

        // NO nx-ci job (that's the only difference from Nx template!)

        // Domain jobs (shared)
        ...createDomainTestJobOperations({ domains }),

        // Version (shared)
        createVersionJobOperation({
          testJobNames: testJobs,
          nxEnabled: false,  // <-- Key difference!
          baseRef: 'main'
        }),

        // Deploy/remote-test (shared)
        ...createDomainDeployJobOperations({ domains }),
        ...createDomainRemoteTestJobOperations({ domains }),

        // Tag/promote/release (shared)
        ...createTagPromoteReleaseOperations({
          branchFlow,
          deployJobNames: deployJobs,
          remoteTestJobNames: remoteTestJobs
        })
      ]

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        // Create new
        const doc = parseDocument('')
        if (doc.contents) {
          applyPathOperations(doc.contents as any, operations, doc)
        }
        return { ...ctx, yamlContent: stringify(doc), mergeStatus: 'created' }
      }

      // Parse existing and preserve user jobs
      const existingContent = fs.readFileSync(filePath, 'utf8')
      const doc = parseDocument(existingContent)

      // Define managed jobs
      const managedJobs = new Set(['changes', 'version', 'tag', 'promote', 'release'])

      // Extract user jobs (same logic as Nx template)
      const userJobs = new Map()
      const existingJobs = doc.contents?.get?.('jobs')
      if (existingJobs?.items) {
        for (const item of existingJobs.items) {
          const jobName = item.key?.toString()
          if (jobName &&
              !managedJobs.has(jobName) &&
              !testJobs.includes(jobName) &&
              !deployJobs.includes(jobName) &&
              !remoteTestJobs.includes(jobName)) {
            userJobs.set(jobName, item)
          }
        }
      }

      // Apply operations
      if (doc.contents) {
        applyPathOperations(doc.contents as any, operations, doc)
      }

      // Add back user jobs
      if (userJobs.size > 0) {
        logger.verbose(`📋 Preserving ${userJobs.size} user jobs: ${Array.from(userJobs.keys()).join(', ')}`)
        const jobsNode = doc.contents?.get?.('jobs')
        if (jobsNode?.items) {
          for (const [_, item] of userJobs) {
            jobsNode.items.push(item)
          }
        }
      }

      return { ...ctx, yamlContent: stringify(doc), mergeStatus: userJobs.size > 0 ? 'merged' : 'updated' }
    })
    .then(ctx => {
      logger.verbose(`${ctx.mergeStatus === 'merged' ? '🔄 Merged' : '📝 Created'} .github/workflows/pipeline.yml`)
      return ctx
    })
    .then(renderTemplate((ctx: any) => ctx.yamlContent, toFile('.github/workflows/pipeline.yml')))
```

### Step 3: What to Delete

From the old `pipeline-path-based.yml.tpl.ts`, delete:
1. Lines 154-600+ (operations array) - replaced by shared operations
2. The `PIPECRAFT_OWNED_JOBS` helper (line ~93) - replaced by managedJobs Set
3. The `isPipecraftJob` helper (line ~116) - not needed
4. Complex AST comment preservation logic (lines ~663-820) - simplified in new approach

Keep:
- The imports (update to use shared)
- The `generate` function signature
- The user job extraction logic (but simplify it like Nx template)

### Step 4: Key Differences from Nx Template

The path-based template is almost identical to Nx template except:
1. **NO `nx-ci` job** - that's the only structural difference!
2. **`useNx: false`** when calling `createChangesJobOperation`
3. **`nxEnabled: false`** when calling `createVersionJobOperation`
4. **Managed jobs Set** doesn't include `'nx-ci'`

That's it! The rest is identical.

### Step 5: Test Strategy

After refactoring:
1. Run `pnpm run build` - should compile
2. Test generation: `cd examples/trunk-based-demo && pipecraft generate`
3. Verify all jobs are present (check with `grep -n "^  [a-z-]*:" .github/workflows/pipeline.yml`)
4. Verify user jobs are preserved (add a custom job, regenerate, check it's still there)
5. Compare output with previous version (should be nearly identical)

## Benefits After Refactor

- **Path-based**: ~1100 lines → ~220 lines (80% reduction!)
- **Total codebase**: ~1500 lines → ~520 lines + ~300 shared = ~820 lines (45% reduction!)
- **Maintainability**: Update shared operations, both templates get the fix
- **Clarity**: Declarative operations array vs. complex AST manipulation
- **Type safety**: Reuse existing `PathOperationConfig` types

## Files to Update

1. **Create**: `src/templates/workflows/pipeline-path-based.tpl.ts` (new simplified version)
2. **Backup**: Move old version to `pipeline-path-based.tpl.OLD.ts` temporarily
3. **Update tests**: Check if any tests reference the old structure

## Estimated Time

- 30-45 minutes to write new template (copy Nx template, remove nx-ci logic)
- 15 minutes to test thoroughly
- 10 minutes to update tests if needed
- Total: ~1 hour

## Success Criteria

✅ Build succeeds with no TypeScript errors
✅ Path-based demo generates correctly
✅ All jobs present in generated workflow
✅ User jobs preserved during regeneration
✅ Output matches previous version (except maybe whitespace)
✅ Both templates use shared operations
✅ Code reduction achieved (~45% total)
