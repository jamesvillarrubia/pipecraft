[**pipecraft v0.0.0-releaseit**](../../README.md)

***

[pipecraft](../../README.md) / templates/actions/manage-branch.yml.tpl

# templates/actions/manage-branch.yml.tpl

Manage Branch Action Template

Generates a composite action for branch operations including fast-forward merges,
branch creation, and deletion. Core utility for trunk-based development workflows.

## Functions

### generate()

> **generate**(`ctx`): `Promise`\<`any`\>

Defined in: [templates/actions/manage-branch.yml.tpl.ts:143](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/templates/actions/manage-branch.yml.tpl.ts#L143)

Generator entry point for manage-branch composite action.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation
