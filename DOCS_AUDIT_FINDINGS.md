# Documentation Audit Findings

## Issues Found

### README.md

1. **Line 60**: `git add .github/workflows .pipecraftrc` - Missing actions directory
   - Should be: `git add .github/workflows .github/actions .pipecraftrc` (for default local mode)
   - Or mention that action location depends on actionSourceMode config

### docs/docs/intro.md

1. **Lines 25-29**: Recommends global install first

   - Should recommend `npx pipecraft init` first (no install needed)
   - Then show global install as an alternative

2. **Need to verify**: All workflow examples show correct action paths based on default mode

### To Check

- [ ] configuration-reference.md - verify all config options are accurate
- [ ] commands.md - verify all command examples work with npx
- [ ] examples.md - verify all examples are complete and accurate
- [ ] All code blocks that show `pipecraft` commands - should show `npx pipecraft` option

## Action Needed

1. Update README git add command
2. Update intro.md to recommend npx first
3. Systematic review of all docs for npx vs global install
4. Verify all generated file paths match default config
