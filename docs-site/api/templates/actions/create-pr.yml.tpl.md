[**pipecraft v0.0.0-releaseit**](../../README.md)

***

[pipecraft](../../README.md) / templates/actions/create-pr.yml.tpl

# templates/actions/create-pr.yml.tpl

Create Pull Request Action Template

Generates a composite action that creates pull requests between branches, used for
automating branch promotion in trunk-based development workflows.

## Functions

### generate()

> **generate**(`ctx`): `Promise`\<`any`\>

Defined in: [templates/actions/create-pr.yml.tpl.ts:158](https://github.com/jamesvillarrubia/pipecraft/blob/a4d1ce6db034158185e20f941de0d6838044bd89/src/templates/actions/create-pr.yml.tpl.ts#L158)

Generator entry point for create-pr composite action.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation
