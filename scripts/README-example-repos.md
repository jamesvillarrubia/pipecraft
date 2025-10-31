# Example Repository Management

The example repositories in `examples/pipecraft-example-*` are tracked as regular files in the parent repository, but they also need to function as git repositories for testing.

## How It Works

1. **Normal State**: `.git` directories are stored as `.git.stored` and tracked in the parent repo
2. **Test State**: Before tests run, `.git.stored` is renamed to `.git` (repos become functional)
3. **Cleanup**: After tests, `.git` is renamed back to `.git.stored` (repos return to tracked state)

## Scripts

### `npm run examples:store-git`
Stores current `.git` directories as `.git.stored` so they can be committed to the parent repo.

**Run this** after making changes to example repos before committing to parent repo.

### `npm run examples:activate`
Activates git repos by renaming `.git.stored` → `.git`. Repos become functional git repositories.

Automatically called by test setup (`tests/setup.ts` beforeAll).

### `npm run examples:deactivate`
Deactivates git repos by renaming `.git` → `.git.stored` and resetting working trees.

Automatically called by test cleanup (`tests/setup.ts` afterAll).

## Workflow

### When Making Changes to Example Repos

```bash
# 1. Activate repos (make them functional)
npm run examples:activate

# 2. Make your changes, commit, test, etc.
cd examples/pipecraft-example-basic
git add .
git commit -m "feat: add feature"
# ... make changes ...

# 3. Store repos (prepare for parent commit)
npm run examples:store-git

# 4. Commit to parent repo
git add examples/
git commit -m "chore: update example repos"
```

### During Tests

The test setup automatically:
- Activates repos before all tests (`beforeAll` hook)
- Deactivates repos after all tests (`afterAll` hook)

So tests can use the repos as functional git repositories, but they remain tracked as files in the parent repo.

## Benefits

- ✅ All test data versioned in parent repo
- ✅ No submodule complexity
- ✅ Repos function as git repos during tests
- ✅ Clean state after tests (idempotent)
- ✅ Easy to pull/clone parent repo without submodule hassles

## Notes

- `.git.stored` directories are tracked in the parent repo (git allows this)
- `.git` directories are ignored when present (to avoid conflicts)
- Repos automatically reset to clean state when deactivated
- Remote URLs are set to test defaults during activation

