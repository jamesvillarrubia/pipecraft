# templates/actions/calculate-version.yml.tpl

Calculate Version Action Template

Generates a composite action that calculates the next semantic version based on
conventional commits. Uses `release-it` to analyze commit history and determine
the appropriate version bump (major, minor, or patch).

## Purpose

Automates semantic versioning in the CI/CD pipeline by:

- Analyzing conventional commit messages since the last tag
- Determining the appropriate version bump (feat→minor, fix→patch, BREAKING→major)
- Installing and running release-it for version calculation
- Outputting the calculated version for use in subsequent jobs

## Generated Action Location

`actions/calculate-version/action.yml`

## Usage in Workflows

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.calc.outputs.version }}
    steps:
      - uses: ./actions/calculate-version
        id: calc
        with:
          baseRef: main

  tag:
    needs: version
    steps:
      - run: echo "Next version: ${{ needs.version.outputs.version }}"
```

## Functions

### generate()

```ts
function generate(ctx): Promise<any>
```

Defined in: [templates/actions/calculate-version.yml.tpl.ts:168](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/templates/actions/calculate-version.yml.tpl.ts#L168)

Generator entry point for calculate-version composite action.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation
