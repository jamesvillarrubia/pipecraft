[**pipecraft v0.0.0-releaseit**](../../README.md)

***

[pipecraft](../../README.md) / templates/actions/promote-branch.yml.tpl

# templates/actions/promote-branch.yml.tpl

Promote Branch Action Template

Generates a composite action that promotes code from one branch to another via
temporary branch and pull request. Handles auto-merge and cleanup for trunk flow.

## Functions

### generate()

```ts
function generate(ctx): Promise<any>;
```

Defined in: [templates/actions/promote-branch.yml.tpl.ts:385](https://github.com/jamesvillarrubia/pipecraft/blob/311b4e1840ae375ec42f3c283b86b8687af74f0e/src/templates/actions/promote-branch.yml.tpl.ts#L385)

Generator entry point for promote-branch composite action.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation
