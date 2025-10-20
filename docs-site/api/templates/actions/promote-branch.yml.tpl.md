[**pipecraft v0.0.0-releaseit**](../../README.md)

***

[pipecraft](../../README.md) / templates/actions/promote-branch.yml.tpl

# templates/actions/promote-branch.yml.tpl

Promote Branch Action Template

Generates a composite action that promotes code from one branch to another via
temporary branch and pull request. Handles auto-merge and cleanup for trunk flow.

## Functions

### generate()

> **generate**(`ctx`): `Promise`\<`any`\>

Defined in: [templates/actions/promote-branch.yml.tpl.ts:374](https://github.com/jamesvillarrubia/pipecraft/blob/cb845e32e411a81bc157107558e393368b42ccf5/src/templates/actions/promote-branch.yml.tpl.ts#L374)

Generator entry point for promote-branch composite action.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation
