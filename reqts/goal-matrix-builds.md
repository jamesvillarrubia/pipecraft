# Matrix builds per domain

Rank 6. Decision: **defer** until a user asks. Design recorded so the ask has a shape.

## Problem

A library that supports several Node versions tests each one by hand-editing the generated
domain job. `docs/docs/roadmap.md` lists matrix builds under "Ideas under consideration"
and says the idea needs community feedback. No open issue asks for it.

## Contract

```json
"domains": { "core": { "paths": ["packages/core"], "matrix": { "node": ["20", "22"] } } }
```

The domain's test job gains `strategy: { matrix: <object> }` and its `setup-node` step reads
`${{ matrix.node }}`. Keys other than `node` pass through unchanged, so `os` works.

## Behaviours

- No `matrix` key generates today's single job.
- The `gate` job depends on the matrix job as a whole, so one failing cell blocks promotion.
- Reserved names stay reserved: a matrix key cannot be named after a managed job.

## Non-goals

Matrix on the `version`, `tag`, `promote`, or `release` jobs. Fan-out on deploy jobs.

## Why defer

Value 3, feasibility 3, and zero demand on the tracker. The `library` flavor is the only one
that would use it. Revisit when an issue arrives or when the deployment-environments work
touches the same job template.
