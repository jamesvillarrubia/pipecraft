# Rollback after a failed deployment

Rank 8. Decision: **drop** as a generator feature. Keep the documented recovery path.

## Problem as stated

`docs/docs/roadmap.md` "Known limitations" says a promotion PR that merges and then fails its
deploy job leaves the version tag on the target branch with no Pipecraft-managed recovery.

## Why drop

The same section already records the decision: "Documentation gap only (P1-2 in
ROADMAP.md), no generator change needed; rollback is inherently environment-specific."
Pipecraft does not know what a deploy did, so it cannot undo it. A `fix:` commit on the
initial branch produces a new patch version and promotes normally; `git revert` on the
target branch handles the catastrophic case without rewriting history. Both are documented.

Deployment environments (rank 5) reduce how often this happens, because a required
reviewer stands between the merge and the deploy.

## What stays

The recovery steps in `docs/docs/roadmap.md` and the note that force-pushing the target
branch breaks the version model. Move the same text into `docs/docs/troubleshooting.md` when
that file is next touched, so it is findable from an error rather than from the roadmap.
