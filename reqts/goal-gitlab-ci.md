# GitLab CI output

Rank 10. Decision: **paused until a GitLab test bed exists.** James, 2026-09-04: GitLab
was paused for lack of time to set up a test bed; it stays on the roadmap.

## State

`src/utils/config.ts:162` accepts `ciProvider: "gitlab"`. Nothing under `src/` branches on
the value; `src/generators/workflows.tpl.ts:70` hardcodes `github`. PR #604 makes
`init --ci-provider gitlab` exit 1. Issue #607 covers `generate` doing the same.
`docs/docs/roadmap.md:63` and `:100` describe GitLab output as future work;
`configuration-reference.md:40` lists the enum value.

## What a real implementation needs

A second template tree for `.gitlab-ci.yml`, a replacement for every composite action
(detect-changes, calculate-version, create-tag, promote-branch, create-release) as GitLab
jobs or a container, a GitLab API client for merge requests in place of `gh`, and a seventh
e2e flavor against a GitLab project. Every existing test that reads generated YAML gains a
second expectation.

## Order of work

1. **Test bed first.** `scripts/e2e/harness.ts` resets and proves the
   `the-craftlab/pipecraft-example-*` repos through `gh` (clone at `:46`, branch protection
   at `:62`, releases and tags at `:68`). A GitLab flavor needs a gitlab.com group of
   disposable projects, a token in repo secrets, and a `glab` or REST equivalent of each of
   those calls. The spike issue scopes this; nothing in the generator changes until the bed
   can reset and read pipeline status on a throwaway project.
2. **Then the generator.** The `.gitlab-ci.yml` template tree and the composite-action
   replacements, each landing behind the new flavor.

## Docs wording

Until step 2 lands, the docs say "not yet supported; the value is rejected" (issue #607).
They do not say "not planned". Keep the enum value in the schema: removing it is a breaking
change for any config that already carries it.
