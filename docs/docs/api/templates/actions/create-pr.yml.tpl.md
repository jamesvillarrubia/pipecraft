# templates/actions/create-pr.yml.tpl

Create Pull Request Action Template

Generates a composite action that creates pull requests between branches, used for
automating branch promotion in trunk-based development workflows.

## Functions

### generate()

```ts
function generate(ctx): Promise<any>;
```

Defined in: [templates/actions/create-pr.yml.tpl.ts:158](https://github.com/jamesvillarrubia/pipecraft/blob/4c8257c45ffc880272b225e3f335e5026e96be2e/src/templates/actions/create-pr.yml.tpl.ts#L158)

Generator entry point for create-pr composite action.

#### Parameters

##### ctx

`PinionContext`

Pinion generator context

#### Returns

`Promise`\<`any`\>

Updated context after file generation
