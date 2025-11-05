---
sidebar_position: 9
---

# Action Reference Modes

PipeCraft supports three different modes for referencing GitHub Actions in your generated workflows. This flexibility allows you to choose between full customization, marketplace stability, or contributing back to PipeCraft itself.

## Configuration

Configure how your workflows reference actions using these options in your `.pipecraftrc`:

```json
{
  "actionSourceMode": "local",
  "actionVersion": "v1"
}
```

## Available Modes

### `local` (Default)

**Best for**: Teams that want full control and customization of actions

Actions are copied into your repository at `.github/actions/` where you can modify them freely.

```yaml
# Generated workflow references
- uses: ./.github/actions/detect-changes
- uses: ./.github/actions/calculate-version
- uses: ./.github/actions/create-tag
```

**Advantages**:

- ✅ Full control over action code
- ✅ Can customize actions for your specific needs
- ✅ No external dependencies
- ✅ Works in air-gapped environments

**Trade-offs**:

- ⚠️ Must manually update actions when PipeCraft releases improvements
- ⚠️ Larger repository size (actions are checked in)

**When to use**:

- You need to customize action behavior
- You want complete ownership of CI/CD code
- You work in a restricted environment
- You prefer stability over automatic updates

### `remote`

**Best for**: Teams that want marketplace stability with version pinning

Actions are referenced from the GitHub Marketplace with explicit version tags.

```yaml
# Generated workflow references (example with v1)
- uses: pipecraft-lab/pipecraft/actions/detect-changes@v1
- uses: pipecraft-lab/pipecraft/actions/calculate-version@v1
- uses: pipecraft-lab/pipecraft/actions/create-tag@v1
```

**Advantages**:

- ✅ No action code in your repository
- ✅ Explicit version pinning for stability
- ✅ Automatic security updates (within pinned version)
- ✅ Smaller repository size

**Trade-offs**:

- ⚠️ Can't customize action behavior
- ⚠️ Depends on external marketplace availability
- ⚠️ Must update `actionVersion` to get new features

**Configuration**:

```json
{
  "actionSourceMode": "remote",
  "actionVersion": "v1" // Pin to major version
}
```

**When to use**:

- You prefer marketplace-published actions
- You want automatic patch/minor updates
- You don't need to customize actions
- You trust PipeCraft's release process

### `source`

**Best for**: PipeCraft contributors and the PipeCraft repository itself

Actions are referenced from the `/actions/` directory where PipeCraft's action source lives.

```yaml
# Generated workflow references
- uses: ./actions/detect-changes
- uses: ./actions/calculate-version
- uses: ./actions/create-tag
```

**Advantages**:

- ✅ Test actions before marketplace publication
- ✅ Contribute improvements back to PipeCraft
- ✅ Dogfooding PipeCraft's own actions

**Trade-offs**:

- ⚠️ Only useful for PipeCraft development
- ⚠️ Not recommended for general use

**When to use**:

- You're contributing to PipeCraft
- You're testing action changes
- You're the PipeCraft repository

## Migration Between Modes

### From `local` to `remote`

When you're ready to use marketplace actions:

1. Update your `.pipecraftrc`:

   ```json
   {
     "actionSourceMode": "remote",
     "actionVersion": "v1"
   }
   ```

2. Regenerate workflows:

   ```bash
   npx pipecraft generate
   ```

3. Your customized actions in `.github/actions/` will remain but won't be used by generated workflows

4. Optional: Delete `.github/actions/` if you're no longer using local actions

### From `remote` to `local`

When you need to customize actions:

1. Update your `.pipecraftrc`:

   ```json
   {
     "actionSourceMode": "local"
   }
   ```

2. Regenerate workflows:

   ```bash
   npx pipecraft generate
   ```

3. Actions will be copied to `.github/actions/` where you can modify them

4. Commit the action files to your repository

## Version Pinning with `remote` Mode

When using `remote` mode, the `actionVersion` option controls which version of marketplace actions to use:

```json
{
  "actionSourceMode": "remote",
  "actionVersion": "v1" // Pin to major version 1.x.x
}
```

### Version Pinning Strategies

**Major version pinning** (recommended):

```json
"actionVersion": "v1"
```

- Gets automatic patch and minor updates
- Breaking changes require explicit version bump
- Balances stability and improvements

**Minor version pinning**:

```json
"actionVersion": "v1.2"
```

- Gets automatic patch updates only
- More stability, fewer updates
- Good for risk-averse teams

**Exact version pinning**:

```json
"actionVersion": "v1.2.3"
```

- No automatic updates
- Maximum stability
- Must manually bump to get any updates

## Action Directory Structure

Understanding where actions live in different modes:

```
your-repo/
├── .github/
│   ├── actions/              # local mode actions (customizable)
│   │   ├── detect-changes/
│   │   ├── calculate-version/
│   │   └── ...
│   └── workflows/
│       └── pipeline.yml      # Generated workflow
├── actions/                  # source mode actions (PipeCraft repo only)
│   ├── detect-changes/
│   ├── calculate-version/
│   └── ...
└── .pipecraftrc              # Configuration file
```

- **`.github/actions/`**: User-customizable actions (local mode)
- **`actions/`**: PipeCraft source actions (source mode, marketplace publication)
- **Marketplace**: Remote actions (remote mode)

## Recommendations

### For Most Teams: Start with `local`

```json
{
  "actionSourceMode": "local"
}
```

**Why**: Full control and easy customization as you learn PipeCraft.

**Later**: Move to `remote` when you're comfortable and don't need customizations.

### For Enterprise Teams: Use `remote` with exact pinning

```json
{
  "actionSourceMode": "remote",
  "actionVersion": "v1.2.3" // Exact version
}
```

**Why**: Predictable deployments, security review process, minimal repository size.

**Process**: Update `actionVersion` after security review of new releases.

### For PipeCraft Contributors: Use `source`

```json
{
  "actionSourceMode": "source"
}
```

**Why**: Test your action changes in real workflows before publishing.

## FAQs

### Can I mix modes?

No. All actions use the same mode. However, you can have custom actions in `.github/actions/` alongside any mode.

### What if I customize a `local` action then switch to `remote`?

Your customizations remain in `.github/actions/` but won't be used. To apply customizations:

1. Stay in `local` mode, or
2. Fork PipeCraft actions and reference your fork in `remote` mode

### How do I update actions in `local` mode?

Run `npx pipecraft generate` after updating PipeCraft. Your customizations in generated workflows are preserved, but action code is updated.

### Can I use actions from different versions?

Not directly. The `actionVersion` applies to all marketplace actions. For mixed versions, you'd need to customize workflows manually.

### Is `remote` mode production-ready?

Yes, once PipeCraft actions are published to the marketplace. Currently in preparation for marketplace publication.
