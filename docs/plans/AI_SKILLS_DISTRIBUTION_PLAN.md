# AI Skills Distribution Plan

**Branch:** `feature/ai-skills-distribution`
**Created:** 2026-02-05
**Status:** In Progress

## Objective

Make Pipecraft easily usable with AI coding assistants (Claude Code, Cursor, GitHub Copilot, Windsurf, etc.) by creating and distributing skill/instruction files that teach these tools how to help users with Pipecraft setup and configuration.

---

## Summary of Work Completed

### 1. Documentation Created

| File                                | Purpose                          | Location     |
| ----------------------------------- | -------------------------------- | ------------ |
| `PIPECRAFT_AI_GUIDE.md`             | Comprehensive AI agent reference | Project root |
| `.cursorrules`                      | Cursor AI configuration          | Project root |
| `.github/copilot-instructions.md`   | GitHub Copilot instructions      | `.github/`   |
| `skills/pipecraft-cli/SKILL.md`     | The skill itself; the only copy  | `skills/`    |
| `skills/pipecraft-cli/package.json` | npm package config               | `skills/`    |
| `skills/pipecraft-cli/README.md`    | Package documentation            | `skills/`    |

This branch also created `.claude/skills/pipecraft-cli/SKILL.md` as a Claude Code project
skill. It is gone; see "Files Changed in This Branch" below for why a second copy was a
defect rather than a convenience.

### 2. CLI Features Added

| Feature                            | Description                                    |
| ---------------------------------- | ---------------------------------------------- |
| `pipecraft skill` command          | Installs AI skills to user's system            |
| `pipecraft skill --list`           | Shows detected AI tools and skill status       |
| `pipecraft skill --uninstall`      | Removes installed skills                       |
| `pipecraft skill --local`          | Project-level installation (the default)       |
| `pipecraft skill --global`         | `~/.claude/skills/pipecraft`, Claude Code only |
| `pipecraft skill --target <tools>` | Install for specific tools only                |
| `pipecraft init --with-skill`      | Install skills during init                     |

### 3. Source Files Created

| File                                           | Purpose                                        |
| ---------------------------------------------- | ---------------------------------------------- |
| `src/utils/skill-installer.ts`                 | Skill installation utility                     |
| `skills/pipecraft-cli/SKILL.md`                | The one source; both packages ship this file   |
| `skills/pipecraft-cli/bin.js`                  | `npx @thecraftlab/pipecraft-skill` entry point |
| `tests/unit/skill-installer.test.ts`           | Targets, markers, detection, uninstall         |
| `tests/integration/init-with-skill.test.ts`    | What `init --with-skill` writes, and where     |
| `tests/unit/documented-commands-exist.test.ts` | One SKILL.md, and the package can install      |

### 4. Issues Filed (CLI Bugs Found During Review)

| Issue                                                        | Title                                                         | Priority |
| ------------------------------------------------------------ | ------------------------------------------------------------- | -------- |
| [#313](https://github.com/the-craftlab/pipecraft/issues/313) | verify command uses wrong cosmiconfig search term 'trunkflow' | High     |
| [#314](https://github.com/the-craftlab/pipecraft/issues/314) | version --bump and --release flags are non-functional stubs   | Medium   |
| [#315](https://github.com/the-craftlab/pipecraft/issues/315) | generate --dry-run should show what would be generated        | Medium   |
| [#316](https://github.com/the-craftlab/pipecraft/issues/316) | remove unused --clean flag from setup-github command          | Low      |
| [#317](https://github.com/the-craftlab/pipecraft/issues/317) | remove test comments from CLI source file                     | Low      |
| [#318](https://github.com/the-craftlab/pipecraft/issues/318) | setup command should not change working directory             | Medium   |

---

## Distribution Channels & Action Items

### Channel 1: npm Package

**Status:** Awaiting its first publish
**Package:** `@thecraftlab/pipecraft-skill`

`.github/workflows/publish.yml` publishes it from the same job as the CLI, at the same
version, with `dependencies.pipecraft` pinned to match. That job cannot create the package:
npm's OIDC publishing answers `404 Not Found - PUT` for a name the registry has never seen,
which is how the v0.47.0 release failed after the CLI itself published cleanly.

**Action Items:**

- [ ] First publish, from an authenticated shell: `cd skills/pipecraft-cli && npm publish --access public`
- [ ] Skip the workflow's skill-publish step when that version is already on the registry, so
      a duplicate cannot fail a release the way v0.46.1 did
- [ ] Add npm badge to README

**Installation for users:**

```bash
npx @thecraftlab/pipecraft-skill
```

The package carries `SKILL.md` and a `bin` that forwards to `pipecraft skill`; the installer
itself lives in the CLI, so there is no second implementation to drift.

---

### Channel 2: Anthropic Official Skills Repository

**URL:** https://github.com/anthropics/skills
**Stars:** 173k
**Status:** Not a channel. Do not spend time here.

Their README documents what a skill needs and says nothing about third-party contributions,
and the repo has no `CONTRIBUTING.md`, so their merge history is the only answer available.
Checked on 2026-09-03:

- every merged pull request comes from an Anthropic-affiliated account (`cj-ant`,
  `peterlai-ant`, `zack-anthropic`, `rlancemartin`, `kswan-wk` and similar), and each one
  updates a skill Anthropic already owns
- 15 open pull requests titled "Add … skill" come from community accounts, the oldest from
  2026-08-16, and none has been merged

Submitting Pipecraft's skill there would join that queue. Revisit only if a
community-contributed skill lands.

**Action Items:**

- [ ] Fork https://github.com/anthropics/skills
- [ ] Add `skills/pipecraft/SKILL.md` following their template format
- [ ] Create PR with description:
  - What Pipecraft is
  - What the skill helps with
  - Example usage
- [ ] Link to Pipecraft documentation

**PR Description Template:**

```markdown
## Add Pipecraft CI/CD Workflow Generator Skill

### What is Pipecraft?

Pipecraft is a trunk-based development CI/CD workflow generator for GitHub Actions.
It generates production-ready workflows from a simple configuration file.

### What does this skill do?

Helps users:

- Set up Pipecraft from scratch
- Configure domains, branch flows, and auto-promotion
- Troubleshoot configuration issues
- Understand generated workflow structure

### Links

- Documentation: https://pipecraft.thecraftlab.dev
- GitHub: https://github.com/the-craftlab/pipecraft
- npm: https://www.npmjs.com/package/pipecraft
```

---

### Channel 3: awesome-agent-skills Community Repository

**URL:** https://github.com/VoltAgent/awesome-agent-skills
**Status:** Wait, then submit

Their `CONTRIBUTING.md` curates links only, so no packaging matters here; the entry is a link
to a path in this repo. It also sets a bar this skill does not clear yet: _"Skill must have
real community usage. We focus on community-adopted, proven skills. Brand new skills that were
just created are not accepted. Give your skill time to mature and gain users before
submitting."_ Download counts on `@thecraftlab/pipecraft-skill` are the evidence to point at,
which makes the first publish the start of that clock.

Their other stated requirements: a public repo, a README or SKILL.md, an author prefix in the
name, a description of ten words or fewer, and a PR titled `Add skill: author/skill-name`.

**Action Items:**

- [ ] Wait for usage worth citing
- [ ] Fork https://github.com/VoltAgent/awesome-agent-skills
- [ ] Add entry to Community Skills section in README
- [ ] Submit PR

**Entry to add:**

```markdown
### CI/CD & DevOps

- [Pipecraft](https://github.com/the-craftlab/pipecraft/tree/main/skills/pipecraft-cli) - Trunk-based CI/CD workflow generator for GitHub Actions
```

---

### Channel 4: OpenSkills Universal Loader

**URL:** https://github.com/numman-ali/openskills
**Status:** Compatible (no action needed)

**How it works:**
Users can install via:

```bash
npx openskills install the-craftlab/pipecraft
```

This will read from the `skills/` directory in the repo.

---

### Channel 5: Built-in CLI Command

**Status:** ✅ Complete

**How it works:**

```bash
pipecraft skill           # Install to all detected AI tools
pipecraft skill --list    # See what's installed
```

---

## Installation Paths by Tool

Each tool gets the file it reads. The four `skills/` directories this plan first described
were a path only Claude Code loads; the other three wrote a file nothing opened.

| Tool             | Project Path                        | Written as             |
| ---------------- | ----------------------------------- | ---------------------- |
| Claude Code      | `.claude/skills/pipecraft/SKILL.md` | whole file             |
| Cursor           | `.cursorrules`                      | block inside your file |
| GitHub Copilot   | `.github/copilot-instructions.md`   | block inside your file |
| Windsurf         | `.windsurfrules`                    | block inside your file |
| Cline / Roo Code | `.clinerules`                       | block inside your file |
| Codex            | `AGENTS.md`                         | block inside your file |

Five of those files belong to the user. Pipecraft maintains only the region between
`<!-- pipecraft:start -->` and `<!-- pipecraft:end -->`, replaces it on reinstall, and removes
it on `--uninstall`.

`--global` covers Claude Code alone, at `~/.claude/skills/pipecraft/SKILL.md`. The other five
formats are project files and have no home-directory form.

---

## Skill Content Structure

### Required Frontmatter (YAML)

```yaml
---
name: pipecraft
description: Help users set up, configure, and use the Pipecraft CLI for GitHub Actions workflow generation.
---
```

### Key Sections

1. **Commands Reference** - All CLI commands with flags
2. **Configuration** - Required/optional fields, schema reference
3. **Common Errors** - Error messages and fixes
4. **Workflows** - Step-by-step guides for common tasks
5. **Questions to Ask** - Prompts for clarifying user needs

### Schema Reference

The JSON Schema at `.pipecraft-schema.json` can be referenced for IDE validation:

```json
{
  "$schema": "https://raw.githubusercontent.com/the-craftlab/pipecraft/main/.pipecraft-schema.json"
}
```

---

## Testing the Skill

### Manual Testing

```bash
# Build and test locally
pnpm build

# Test the skill command
./dist/cli/index.js skill --list
./dist/cli/index.js skill --install
./dist/cli/index.js skill --uninstall

# Test init with skill
./dist/cli/index.js init --with-skill
```

### Automated Tests

```bash
pnpm vitest run tests/unit/skill-installer.test.ts
```

---

## Documentation Updates Needed

### README.md

- [x] Added AI Assistant Integration section
- [ ] Update after npm publish with exact install command

### PIPECRAFT_AI_GUIDE.md

- [x] Created comprehensive guide
- [x] Added validate vs verify explanation
- [ ] Keep in sync with CLI changes

### Documentation Site (pipecraft.thecraftlab.dev)

- [ ] Add "AI Assistant Integration" page
- [ ] Document `pipecraft skill` command
- [ ] Add skill installation instructions

---

## Commit Plan

### Commit 1: Core skill infrastructure

```
feat: add AI coding assistant skills infrastructure

- Add PIPECRAFT_AI_GUIDE.md comprehensive reference
- Add .claude/skills/pipecraft-cli/SKILL.md for Claude Code
- Add .cursorrules for Cursor
- Add .github/copilot-instructions.md for GitHub Copilot
- Add skills/pipecraft-cli/ distributable package
```

### Commit 2: CLI command

```
feat: add 'pipecraft skill' CLI command

- Add src/utils/skill-installer.ts utility
- Add 'pipecraft skill' command with --list, --uninstall, --local, --global, --target options
- Add --with-skill flag to 'pipecraft init'
- Add tests for skill installer
```

### Commit 3: README updates

```
docs: update README with AI assistant integration

- Add installation instructions for npm, OpenSkills
- Document skill command usage
- Add manual setup instructions per tool
```

---

## Future Enhancements

### Phase 2: Interactive Skill Installation

- [ ] Add interactive prompts during `pipecraft init`
- [ ] Ask "Would you like to install AI assistant skills?" with y/n

### Phase 3: Skill Auto-Update

- [ ] Check for skill updates when running Pipecraft
- [ ] Notify users when newer skill version available

### Phase 4: Custom Skills

- [ ] Allow users to extend/customize the skill
- [ ] Support organization-specific skills

---

## Key Findings from Skill Review

### What AI Agents Need to Know

1. **validate vs verify confusion** - These commands are often confused

   - `validate` = config syntax only
   - `verify` = full setup health check

2. **Reserved domain names** - Users often try to use:

   - `version`, `changes`, `gate`, `tag`, `promote`, `release`

3. **Config validation rules** - Critical constraints:

   - `initialBranch` must be FIRST in `branchFlow`
   - `finalBranch` must be LAST in `branchFlow`

4. **Deprecated fields** - Still appear in old docs:

   - `testable` → use `prefixes: [test]`
   - `deployable` → use `prefixes: [deploy]`
   - `autoMerge` → use `autoPromote`
   - `packageManager` → removed

5. **JSON Schema** - Enable IDE validation:
   ```json
   { "$schema": "./.pipecraft-schema.json" }
   ```

---

## Quick Reference: What to Do Next

If this conversation is dropped, here's the priority order:

### Immediate (This PR)

1. Review all files created in this branch
2. Run tests: `pnpm vitest run --exclude '.worktrees/**'`
3. Commit changes with conventional commits
4. Create PR to develop

### After Merge

1. Publish npm package: `cd skills/pipecraft-cli && npm publish`
2. Submit PR to anthropics/skills
3. Submit PR to awesome-agent-skills
4. Update documentation site

### Commands to Resume

```bash
# Switch to this branch
git checkout feature/ai-skills-distribution

# See what's changed
git status
git diff

# Run tests
pnpm vitest run --exclude '.worktrees/**'

# Build
pnpm build
```

---

## Files Changed in This Branch

Six of the files this branch created no longer exist. `.claude/skills/pipecraft-cli/` was a
second `SKILL.md` declaring the same `name: pipecraft` as the shipped one, which showed a
stranger two identically-named entries to choose between:

```
$ npx openskills install the-craftlab/pipecraft
Found 2 skill(s)
❯ ◉ pipecraft-cli             12.0KB
  ◉ pipecraft-cli             14.4KB
```

Its Claude-only parts moved into the one source inside `<!-- claude-only:start -->` markers.
`install-skill.js`, `uninstall-skill.js` and `.claude-skill.json` went with the `postinstall`
hook they served; `bin.js` forwards to `pipecraft skill` instead.

```
New files:
  PIPECRAFT_AI_GUIDE.md
  .cursorrules
  .github/copilot-instructions.md
  skills/pipecraft-cli/SKILL.md
  skills/pipecraft-cli/package.json
  skills/pipecraft-cli/README.md
  skills/pipecraft-cli/bin.js
  src/utils/skill-installer.ts
  tests/unit/skill-installer.test.ts
  docs/plans/AI_SKILLS_DISTRIBUTION_PLAN.md

Modified files:
  README.md (added AI Assistant Integration section)
  src/cli/index.ts (added 'skill' command, '--with-skill' flag)
```

---

## Contact & Resources

- **Pipecraft Docs:** https://pipecraft.thecraftlab.dev
- **GitHub:** https://github.com/the-craftlab/pipecraft
- **Issues:** https://github.com/the-craftlab/pipecraft/issues

**Anthropic Skills:**

- Repo: https://github.com/anthropics/skills
- Spec: https://github.com/anthropics/skills/tree/main/spec

**Community:**

- awesome-agent-skills: https://github.com/VoltAgent/awesome-agent-skills
- OpenSkills: https://github.com/numman-ali/openskills
