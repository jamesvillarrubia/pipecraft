# Documentation Audit Progress

## Completed Fixes ✅

### Installation Instructions

- ✅ **README.md**: Fixed git add command, already uses npx
- ✅ **docs/docs/intro.md**: Now recommends npx first
- ✅ **docs/docs/cli-reference.md**: Updated to recommend npx first
- ✅ **docs/docs/faq.md**: Already correct (npx as Option 1)
- ✅ **docs/docs/readme.md**: Already correct (npx as Option 1)

## Remaining Issues

### High Priority

#### 1. action-modes.md - Missing npx in commands

**File**: docs/docs/action-modes.md
**Lines**: 144, 166, 292

Current:

```bash
pipecraft generate
```

Should be:

```bash
npx pipecraft generate
```

#### 2. intro.md - Confusing action paths

**File**: docs/docs/intro.md
**Line**: 245

Shows `./actions/detect-changes` (source mode) but new users will have `./.github/actions/detect-changes` (local mode).

Should either:

- Add a note explaining the path depends on actionSourceMode
- Show the default local mode path instead
- Reference the action-modes documentation

#### 3. intro.md - Command examples without npx

**File**: docs/docs/intro.md
**Line**: 193 and others

References `pipecraft generate` in explanatory text.

### Medium Priority

#### 4. architecture.md - Command references

**File**: docs/docs/architecture.md
**Lines**: 9, 55

Mentions `pipecraft generate` in explanatory text. These are fine as general references but should be consistent with recommending npx elsewhere.

#### 5. Review for "automatic" overselling

Need to check these files for overly generous claims:

- [ ] docs/docs/intro.md - "Why PipeCraft" section
- [ ] docs/docs/workflow-generation.md
- [ ] docs/docs/examples.md

### Low Priority

#### 6. Verify config examples match types

- [ ] Check all semver config examples
- [ ] Check all autoMerge examples
- [ ] Verify domain config examples

## Notes

- **Default mode**: `local` generates to `.github/actions/` and uses `./.github/actions/action-name`
- **Source mode**: Generates to `actions/` and uses `./actions/action-name` (PipeCraft's own repo)
- **Remote mode**: No local actions, uses `pipecraft-lab/pipecraft/actions/action-name@version`

Most docs showing `./actions/` are either:

1. Examples from PipeCraft's own repo (source mode)
2. Need clarification for new users (who will use local mode)
