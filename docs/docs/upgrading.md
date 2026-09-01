---
sidebar_position: 4
---

# Upgrading

Most Pipecraft upgrades change what gets generated, and regenerating picks the change up.
This page covers the ones that change how your pipeline behaves, where regenerating is not
the whole story.

## v0.44 and v0.45

Three changes affect repositories that were already working. Each is listed with the symptom
you would see, because none of them announces itself.

### Hand-edits to two workflows are now overwritten

**What changed.** `enforce-pr-target.yml` and `pr-title-check.yml` are rewritten on every
`pipecraft generate`.

Before this, Pipecraft skipped any file that already existed, so those two were written once
and never updated. That was a bug with a quiet symptom: renaming `finalBranch` left the old
name enforced, and adding a commit type to `semver.bumpRules` left `pr-title-check`
rejecting PR titles that used it. Neither file tracked your config after the first run.

**Symptom.** Edits you made to either file disappear after `generate`.

**What to do.** Both files are wholly generated and now say so in a header comment. If you
had customised either, move that logic into a separate workflow file of your own; a workflow
Pipecraft does not manage is never touched.

`pipeline.yml` is unaffected. It merges into your existing file and preserves custom jobs
between the `# <--START CUSTOM JOBS-->` markers.

### `init --with-versioning` now creates GitHub releases

**What changed.** `.release-it.cjs` used to be built by two different code paths that
disagreed, so the file you got depended on whether you last ran `generate` or
`init --with-versioning`. They are now one builder, and the `generate` behaviour won.

**Symptom.** If you set up with `init --with-versioning`, your config had
`github.release: false`. It now has `github.release: true` with a `releaseName`, so your next
release cuts a GitHub release that would not have appeared before.

**What to do.** Nothing, if you want GitHub releases — this is the behaviour `generate`
users already had. If you do not, set `github.release` to `false` in your `.release-it.cjs`
after regenerating.

### Only merged pull requests promote

**What changed.** `tag` and `promote` now require the commit to have been authored by
GitHub:

```yaml
github.event.head_commit.committer.email == 'noreply@github.com' ||
github.event_name == 'workflow_dispatch'
```

GitHub stamps that committer on the commit it creates when a pull request is merged, and a
fast-forward promotion preserves it, so the marker survives your whole branch flow. A commit
pushed by hand keeps its author's address and does not promote. This stops a hotfix typed on
the wrong branch from cutting a release.

**Symptom.** A push to your initial branch runs the pipeline, `version` reports a version,
your domain jobs pass — and then `tag`, `release` and `promote` all show as skipped.

**What to do.** If the push came from a person typing on the wrong branch, that is the
feature working. If it came from CI pushing under its own identity rather than through a
pull request, trigger the workflow from the Actions tab instead; `workflow_dispatch` is in
the condition for exactly that.

Change detection, domain jobs and `version` all still run on a direct push, so the commit is
still tested and you still see the version it would have used.

## Reading a Pipecraft upgrade generally

Regenerate, then read the diff before committing it:

```bash
pipecraft generate --dry-run   # what would change, and which files
pipecraft generate
git diff .github/
```

`--dry-run` lists every file it would create or update and the domain jobs your config
produces, so a config that generates no test jobs is visible before you commit a pipeline
missing them.
