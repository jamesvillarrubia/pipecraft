# Repository Cleanup and Reorganization Plan

## Overview

This document outlines a comprehensive cleanup and reorganization of the PipeCraft repository to improve maintainability, reduce confusion, and establish clear boundaries between production code, test infrastructure, and documentation.

## Current State Issues

### File Organization

- Mixed test utilities across multiple directories
- Debugging scripts scattered in various locations
- Documentation spread across `/docs`, root, and `/tests`
- Unclear which scripts are for development vs. production

### Temporary/Debug Files

- `tests/debugging/` directory with ad-hoc debugging utilities
- Old planning documents in root (`PIPELINE_TESTING_PLAN.md`)
- Debug TypeScript config (`tsconfig.debug.json`)
- Scripts that may be obsolete

### Test Structure

- Multiple test runner scripts in different locations
- Unclear test categories (act, github-live, github-local)
- Test documentation fragmented

### Documentation

- `docs/USER_JOURNEY_ERRORS.md` may be stale/redundant with `ERROR_HANDLING.md`
- `src/utils/README-ast-path-operations.md` should be in main docs
- No clear index of all documentation

---

## PHASE 0: Repository Cleanup and Reorganization

### 0.1 Audit and Categorize

**Review each directory/file for:**

- Is it production code?
- Is it test infrastructure?
- Is it debugging/development-only?
- Is it documentation?
- Is it obsolete?

**Specific items to audit:**

```
tests/
├── act/                    # ACT local testing - keep or remove?
├── debugging/              # Debug utilities - consolidate or remove?
├── github-live/            # Live GitHub testing - keep?
├── github-local/           # Local GitHub testing - keep?
├── integration/            # Integration tests - keep
├── unit/                   # Unit tests - keep
├── fixtures/               # Test fixtures - keep
├── setup.ts                # Test setup - needs refactor
├── README.md               # Test docs - update
└── TEST_STRUCTURE.md       # Test structure docs - merge with README

scripts/
├── debug-workflows.sh      # Debugging - remove or move to tests/debugging?
├── parse-pipeline.js       # Utility - keep or integrate?
├── test-job-order.cjs      # Test script - move to tests/?
├── validate-pipeline.cjs   # Validation - move to tests/?
└── verify-job-order.sh     # Verification - move to tests/?

docs/
├── ARCHITECTURE.md         # ✅ Keep
├── CURRENT_TRUNK_FLOW.md   # ✅ Keep
├── ERROR_HANDLING.md       # ✅ Keep
└── USER_JOURNEY_ERRORS.md  # Review - may be stale/redundant

Root files:
├── PIPELINE_TESTING_PLAN.md   # Old planning doc - archive or remove?
├── TRUNK_FLOW_PLAN.md          # ✅ Keep (marked as roadmap)
├── tsconfig.debug.json         # Debug config - remove if unused
└── test-yaml-*.js              # Orphan files - should be gone already
```

### 0.2 Consolidate Test Infrastructure

**Goal**: Clear separation between test categories

**New Structure**:

```
tests/
├── unit/                   # Unit tests (isolated, mocked)
├── integration/            # Integration tests (multiple components)
├── e2e/                    # End-to-end tests (full workflows)
├── fixtures/               # Shared test data
├── helpers/                # Test helper utilities (new)
│   ├── workspace.ts        # Workspace management
│   ├── fixtures.ts         # Fixture generation
│   ├── mocks.ts            # Reusable mocks
│   └── assertions.ts       # Custom matchers
├── tools/                  # Development/debugging tools (consolidated)
│   ├── act/                # ACT testing tools
│   ├── github-live/        # Live GitHub test runners
│   ├── github-local/       # Local GitHub test runners
│   └── debug/              # Debugging utilities
├── setup.ts                # Test setup (refactored)
├── README.md               # Main test documentation
└── CONTRIBUTING_TESTS.md   # How to write tests (new)
```

**Actions**:

1. Create `tests/helpers/` directory
2. Create `tests/tools/` directory
3. Move `tests/debugging/` → `tests/tools/debug/`
4. Move `tests/act/` → `tests/tools/act/`
5. Move `tests/github-live/` → `tests/tools/github-live/`
6. Move `tests/github-local/` → `tests/tools/github-local/`
7. Merge `TEST_STRUCTURE.md` into `README.md`
8. Create `CONTRIBUTING_TESTS.md` with testing guidelines

### 0.3 Consolidate Scripts

**Goal**: Clear purpose for each script

**Review and Categorize**:

```bash
# Production scripts (keep in /scripts)
scripts/
└── (none currently - all are dev/test scripts)

# Development scripts (move to appropriate locations)
test-job-order.cjs → tests/tools/validation/
validate-pipeline.cjs → tests/tools/validation/
verify-job-order.sh → tests/tools/validation/
debug-workflows.sh → tests/tools/debug/
parse-pipeline.js → tests/tools/debug/
```

**Decision Tree**:

- **Used in CI/CD?** → Keep in `/scripts`
- **Used for testing?** → Move to `/tests/tools`
- **Used for development debugging?** → Move to `/tests/tools/debug`
- **Obsolete?** → Remove

**Actions**:

1. Create `tests/tools/validation/` directory
2. Move validation scripts to `tests/tools/validation/`
3. Move debug scripts to `tests/tools/debug/`
4. Update any references in documentation
5. Create `/scripts/README.md` explaining purpose (if any remain)

### 0.4 Consolidate Documentation

**Goal**: Single source of truth for each topic

**Current Docs**:

- `/README.md` - Main user documentation
- `/docs/ARCHITECTURE.md` - System architecture
- `/docs/CURRENT_TRUNK_FLOW.md` - Current implementation
- `/docs/ERROR_HANDLING.md` - Error handling guide
- `/docs/USER_JOURNEY_ERRORS.md` - User journey errors (review)
- `/TRUNK_FLOW_PLAN.md` - Future roadmap
- `/PIPELINE_TESTING_PLAN.md` - Old testing plan (remove?)
- `/tests/README.md` - Test structure
- `/tests/TEST_STRUCTURE.md` - Test structure (duplicate)
- `/src/utils/README-ast-path-operations.md` - AST docs (wrong location)

**New Structure**:

```
docs/
├── README.md                   # Index of all documentation (new)
├── ARCHITECTURE.md             # System architecture ✅
├── CURRENT_TRUNK_FLOW.md       # Current implementation ✅
├── ERROR_HANDLING.md           # Error handling guide ✅
├── CONTRIBUTING.md             # How to contribute (new)
├── TESTING_GUIDE.md            # How to write tests (new)
├── AST_OPERATIONS.md           # YAML AST manipulation (moved)
└── ROADMAP.md                  # Future plans (consolidated)

/ (root)
├── README.md                   # Main user documentation ✅
└── CHANGELOG.md                # Version history (create if missing)

tests/
├── README.md                   # Test structure and running tests
└── CONTRIBUTING_TESTS.md       # Writing tests for this project
```

**Actions**:

1. Create `docs/README.md` as documentation index
2. Review `docs/USER_JOURNEY_ERRORS.md`:
   - If content is in `ERROR_HANDLING.md`, remove it
   - If unique content, integrate into `ERROR_HANDLING.md` and remove
3. Move `src/utils/README-ast-path-operations.md` → `docs/AST_OPERATIONS.md`
4. Archive or remove `PIPELINE_TESTING_PLAN.md` (outdated planning doc)
5. Rename `TRUNK_FLOW_PLAN.md` → `docs/ROADMAP.md` or keep with clearer header
6. Merge `tests/TEST_STRUCTURE.md` → `tests/README.md`
7. Create `docs/CONTRIBUTING.md` with contribution guidelines
8. Create `tests/CONTRIBUTING_TESTS.md` with test-writing guidelines
9. Create `CHANGELOG.md` if missing

### 0.5 Clean Up Configuration Files

**Review**:

- `tsconfig.debug.json` - Is this used? If not, remove
- `vitest.config.ts` - Should have clear comments explaining setup
- `eslint.config.js` - Should have clear comments

**Actions**:

1. Check if `tsconfig.debug.json` is referenced anywhere
2. If unused, remove `tsconfig.debug.json`
3. Add comments to `vitest.config.ts` explaining configuration
4. Add comments to `eslint.config.js` explaining rules

### 0.6 Update .gitignore

**Review current .gitignore against actual needs**:

**Actions**:

1. Ensure all generated directories are ignored
2. Add `tests/tools/*/output/` if needed
3. Add `.plan.md` files to ignore (temporary planning docs)
4. Verify `coverage/` is ignored ✅
5. Verify `test-temp/` is ignored ✅
6. Verify `test-output/` is ignored ✅

### 0.7 Create Documentation Index

**Create** `docs/README.md`:

```markdown
# PipeCraft Documentation Index

Welcome to PipeCraft documentation! This index helps you find the right documentation for your needs.

## Getting Started

- [Main README](../README.md) - Installation, quick start, basic usage
- [Current Trunk Flow](./CURRENT_TRUNK_FLOW.md) - How the current workflow works

## For Users

- [Configuration Options](./CONFIGURATION.md) - All config options explained
- [Error Handling](./ERROR_HANDLING.md) - Error types and troubleshooting
- [Examples](../examples/) - Example configurations

## For Contributors

- [Architecture](./ARCHITECTURE.md) - System design and components
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [Testing Guide](./TESTING_GUIDE.md) - Writing and running tests
- [AST Operations](./AST_OPERATIONS.md) - YAML manipulation internals

## Planning & Roadmap

- [Roadmap](./ROADMAP.md) - Future features and enhancements
- [Changelog](../CHANGELOG.md) - Version history

## Test Documentation

- [Test Structure](../tests/README.md) - Test organization
- [Writing Tests](../tests/CONTRIBUTING_TESTS.md) - Test guidelines
```

---

## Implementation Checklist

### Phase 0.1: Audit (1-2 hours)

- [ ] Review all files in `tests/debugging/`
- [ ] Review all files in `tests/act/`, `github-live/`, `github-local/`
- [ ] Review all files in `scripts/`
- [ ] Review all documentation files
- [ ] Create categorization list (keep/move/remove)

### Phase 0.2: Test Infrastructure (2-3 hours)

- [ ] Create `tests/helpers/` directory
- [ ] Create `tests/tools/` directory structure
- [ ] Move `tests/debugging/` → `tests/tools/debug/`
- [ ] Move ACT/GitHub test directories
- [ ] Merge `TEST_STRUCTURE.md` into `README.md`
- [ ] Update all references to moved files

### Phase 0.3: Scripts (1 hour)

- [ ] Create `tests/tools/validation/` directory
- [ ] Move validation scripts
- [ ] Move debug scripts
- [ ] Update documentation references
- [ ] Test that moved scripts still work

### Phase 0.4: Documentation (2-3 hours)

- [ ] Review `USER_JOURNEY_ERRORS.md` vs `ERROR_HANDLING.md`
- [ ] Move/merge/remove as appropriate
- [ ] Move `README-ast-path-operations.md` → `docs/AST_OPERATIONS.md`
- [ ] Archive/remove `PIPELINE_TESTING_PLAN.md`
- [ ] Merge `tests/TEST_STRUCTURE.md` → `tests/README.md`
- [ ] Create `docs/README.md` (documentation index)
- [ ] Create `docs/CONTRIBUTING.md`
- [ ] Create `tests/CONTRIBUTING_TESTS.md`
- [ ] Create `CHANGELOG.md` if missing
- [ ] Update all cross-references

### Phase 0.5: Configuration (30 minutes)

- [ ] Check usage of `tsconfig.debug.json`
- [ ] Remove if unused
- [ ] Add comments to `vitest.config.ts`
- [ ] Add comments to `eslint.config.js`

### Phase 0.6: .gitignore (15 minutes)

- [ ] Review `.gitignore` completeness
- [ ] Add any missing patterns
- [ ] Test that ignored files are actually ignored

### Phase 0.7: Final Steps (1 hour)

- [ ] Create documentation index
- [ ] Update main README with doc links
- [ ] Run full test suite to verify nothing broke
- [ ] Build project to verify all imports work
- [ ] Create summary of changes
- [ ] Commit cleanup with detailed message

---

## Success Criteria

### Organization

- ✅ Clear separation: production code, tests, docs, tools
- ✅ No orphan or unclear-purpose files
- ✅ Consistent directory structure
- ✅ All documentation discoverable from index

### Test Infrastructure

- ✅ `tests/unit/`, `/integration/`, `/e2e/` clearly defined
- ✅ `tests/helpers/` provides reusable utilities
- ✅ `tests/tools/` contains development/debugging tools
- ✅ No debugging code in production test suites

### Documentation

- ✅ Single source of truth for each topic
- ✅ No duplicate or contradictory docs
- ✅ Clear index showing all documentation
- ✅ Contribution guidelines clearly documented

### Maintenance

- ✅ Easy to find where to add new tests
- ✅ Easy to find where to add new docs
- ✅ Clear what's production vs. development
- ✅ No confusion about file purposes

---

## Estimated Time

**Total: 7-10 hours**

- Audit: 1-2 hours
- Test reorg: 2-3 hours
- Script reorg: 1 hour
- Docs reorg: 2-3 hours
- Config cleanup: 30 minutes
- Final verification: 1 hour

**Recommendation**: Do this cleanup BEFORE starting major test refactoring (Phase 2) to establish clean foundation.

---

## Notes

- **Preserve git history**: Use `git mv` for moves to preserve history
- **Test after each section**: Run tests after each major change
- **Document decisions**: Update this plan with decisions made
- **Create backups**: Tag current state before major cleanup
