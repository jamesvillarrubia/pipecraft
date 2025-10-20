[**pipecraft v0.0.0-releaseit**](../../README.md)

***

[pipecraft](../../README.md) / templates/actions/create-tag.yml.tpl

# templates/actions/create-tag.yml.tpl

Create Tag Action Template

Generates a composite action that creates and pushes git tags, and optionally creates
GitHub releases. Used after version calculation to tag the codebase with semantic versions.

## Functions

### generate()

> **generate**(`ctx`): `Promise`\<`any`\>

Defined in: [templates/actions/create-tag.yml.tpl.ts:124](https://github.com/jamesvillarrubia/pipecraft/blob/9027a5c61144dee1b7466e0ffeb3b1cd8ef28015/src/templates/actions/create-tag.yml.tpl.ts#L124)

Generator entry point for create-tag composite action.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation
