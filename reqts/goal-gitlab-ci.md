# GitLab CI output

Rank 10. Decision: **defer indefinitely**, and stop describing it as planned.

## State

`src/utils/config.ts:162` accepts `ciProvider: "gitlab"`. Nothing under `src/` branches on
the value; `src/generators/workflows.tpl.ts:70` hardcodes `github`. The goal 3 PR makes
`init --ci-provider gitlab` exit 1. A follow-up issue covers `generate` doing the same.
`docs/docs/roadmap.md` P2-1 and `configuration-reference.md:44` call GitLab "planned" and
"reserved for future support".

## What a real implementation needs

A second template tree for `.gitlab-ci.yml`, a replacement for every composite action
(detect-changes, calculate-version, create-tag, promote-branch, create-release) as GitLab
jobs or a container, a GitLab API client for merge requests in place of `gh`, and a seventh
e2e flavor against a GitLab project. Every existing test that reads generated YAML gains a
second expectation.

## Why defer

Value 3, feasibility 1. The work is a second product. No issue asks for it, and the npm
download count does not justify splitting the test bed.

## Docs change to make now

Replace "planned" with "not planned; the value is rejected" in `docs/docs/roadmap.md`,
`configuration-reference.md`, and `faq.md`, in the same PR as the `generate` rejection.
Keeping the enum value in the schema is harmless once both commands reject it; removing it
is a breaking change for any config that already carries it.
