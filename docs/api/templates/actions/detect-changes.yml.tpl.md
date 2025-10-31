[**pipecraft v0.0.0-releaseit**](../../README.md)

---

[pipecraft](../../README.md) / templates/actions/detect-changes.yml.tpl

# templates/actions/detect-changes.yml.tpl

Detect Changes Action Template

Generates a GitHub composite action that detects which domains (application areas)
have changes in a pull request. This is the foundation for PipeCraft's path-based
conditional workflow execution.

## Purpose

In monorepos or multi-domain projects, not every change affects every part of the
system. This action uses GitHub's `dorny/paths-filter` to detect which domains
have modifications, allowing subsequent jobs to run conditionally.

## How It Works

1. Checks out the repository with full history
2. Uses paths-filter action to check each domain's file patterns
3. Outputs a boolean for each domain (true if changed, false if not)
4. Logs results for debugging

## Generated Action Location

`.github/actions/detect-changes/action.yml`

## Usage in Workflows

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.changes.outputs.api }}
      web: ${{ steps.changes.outputs.web }}
    steps:
      - uses: ./.github/actions/detect-changes
        id: changes
        with:
          baseRef: main

  test-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    # Only runs if API domain changed
```

## Functions

### generate()

> **generate**(`ctx`): `Promise`\<`any`\>

Defined in: [templates/actions/detect-changes.yml.tpl.ts:174](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/templates/actions/detect-changes.yml.tpl.ts#L174)

Generator entry point for detect-changes composite action.

Generates the `.github/actions/detect-changes/action.yml` file with domain-specific
change detection logic. This action is used by the main pipeline to determine which
domains have changes and need to run tests/deployment.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation

#### Example

```typescript
await generate({
  cwd: '/path/to/project',
  domains: {
    api: { paths: ['src/api/**'], description: 'API' },
    web: { paths: ['src/web/**'], description: 'Web' }
  }
})
// Creates: .github/actions/detect-changes/action.yml
```
