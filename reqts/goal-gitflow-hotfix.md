# GitFlow with hotfix branches

Rank 9. Decision: **defer**. GitHub Flow is already covered.

## What exists

The `library` example runs a single-branch flow (`initialBranch === finalBranch`, one
`branchFlow` entry) with change detection, versioning, tags and releases. That is GitHub
Flow. `docs/docs/roadmap.md` P2-2 lists GitHub Flow as planned; the roadmap PR for goal 4
did not change that line, and it should say "shipped as the single-branch flow" in the next
docs pass.

## What GitFlow adds

A `hotfix/*` branch cut from the final branch, versioned as a patch on the released version,
merged to the final branch and back to the initial branch. Pipecraft's version model reads
conventional commits on a linear history, so a hotfix needs: a second versioning root, a
back-merge job, and a rule for what `promote` does when the initial branch is behind.

## Why defer

Value 2, feasibility 2. Every hotfix design changes the version model that all six flavors
depend on, and no issue asks for it. Revisit after version threading (rank 7) lands, since
that work decides how a version travels between branches.

## Non-goals now

Release branches with their own version lines. Multiple concurrent hotfixes.
