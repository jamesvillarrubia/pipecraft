[**pipecraft v0.0.0-releaseit**](../../README.md)

***

[pipecraft](../../README.md) / templates/workflows/pipeline-path-based.yml.tpl

# templates/workflows/pipeline-path-based.yml.tpl

Path-Based Pipeline Template Generator

The core template that generates the main CI/CD pipeline workflow for PipeCraft.
This is the most complex template in the system, responsible for creating a
GitHub Actions workflow that orchestrates the entire trunk-based development flow.

## Key Responsibilities

1. **Change Detection**: Generates jobs to detect which domains (api, web, libs, etc.) changed
2. **Test Execution**: Creates domain-specific test jobs based on changes
3. **Version Management**: Integrates semantic versioning for staging/production branches
4. **Branch Promotion**: Auto-promotes code through branch flow (develop → staging → main)
5. **User Job Preservation**: Maintains user-added custom jobs during regeneration
6. **Comment Preservation**: Retains user comments when updating workflows

## Intelligent Merging

The generator distinguishes between:
- **Pipecraft-owned jobs**: `changes`, `version`, `tag`, `promote`, `release`, `test-*`, `deploy-*`
- **User jobs**: Any jobs not owned by Pipecraft

During regeneration:
- Pipecraft jobs are completely replaced with template versions
- User jobs are preserved exactly as-is
- User comments are maintained
- Job order is intelligently managed (Pipecraft jobs first, then user jobs)

## Architecture

Uses AST-based path operations for surgical YAML manipulation:
- Parse existing workflow into AST
- Apply precise path-based operations
- Preserve formatting and comments
- Rebuild YAML maintaining structure

## Example

```typescript
import { generate } from './templates/workflows/pipeline-path-based.yml.tpl.js'

// Initial generation
await generate({
  cwd: '/path/to/project',
  branchFlow: ['develop', 'staging', 'main'],
  domains: {
    api: { paths: ['src/api/**'], test: true },
    web: { paths: ['src/web/**'], test: true }
  }
})

// Incremental update (preserves user jobs)
await generate({
  cwd: '/path/to/project',
  existingPipeline: parsedYAML,
  existingPipelineContent: rawYAMLString,
  branchFlow: ['develop', 'staging', 'main'],
  domains: { ... }
})
```

## See

module:utils/ast-path-operations for YAML manipulation details

## Functions

### createPathBasedPipeline()

```ts
function createPathBasedPipeline(ctx): object;
```

Defined in: [templates/workflows/pipeline-path-based.yml.tpl.ts:123](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/templates/workflows/pipeline-path-based.yml.tpl.ts#L123)

Create path-based pipeline content

#### Parameters

##### ctx

`any`

#### Returns

`object`

##### mergeStatus

```ts
mergeStatus: string;
```

##### yamlContent

```ts
yamlContent: string = finalContent;
```

***

### generate()

```ts
function generate(ctx): Promise<any>;
```

Defined in: [templates/workflows/pipeline-path-based.yml.tpl.ts:1064](https://github.com/jamesvillarrubia/pipecraft/blob/290101696d3569c36886634c8a3467a47778728d/src/templates/workflows/pipeline-path-based.yml.tpl.ts#L1064)

Main pipeline generator entry point.

Generates the complete GitHub Actions pipeline workflow with intelligent
merging of existing user customizations.

#### Parameters

##### ctx

`PinionContext` & `object`

Generator context

#### Returns

`Promise`\<`any`\>

Updated context with generated YAML

#### Throws

If pipeline file cannot be written

#### Throws

If existing pipeline cannot be parsed

#### Example

```typescript
// Generate new pipeline
await generate({
  cwd: '/path/to/project',
  branchFlow: ['develop', 'main'],
  domains: {
    api: { paths: ['src/api/**'], test: true }
  }
})

// Update existing pipeline (preserves user jobs)
const existing = parseDocument(readFileSync('pipeline.yml', 'utf8'))
await generate({
  cwd: '/path/to/project',
  existingPipeline: existing,
  existingPipelineContent: readFileSync('pipeline.yml', 'utf8'),
  branchFlow: ['develop', 'staging', 'main'],
  domains: { ... }
})
```

#### Note

The generator performs these steps:
1. Calls `createPathBasedPipeline()` to build the workflow
2. Logs merge status (new vs. merged)
3. Writes the final YAML to the output path

The heavy lifting is done by `createPathBasedPipeline()` which handles:
- Job generation based on domains and branch flow
- User job preservation and merging
- Comment preservation from existing pipeline
- Intelligent job ordering
