---
sidebar_position: 14
---

# Roadmap & Known Limitations

PipeCraft currently focuses on trunk-based development with GitHub Actions. This page
covers what is on the immediate roadmap, known limitations you should be aware of
before adopting, and what is planned for the future.

The full technical roadmap with priority ratings and fix details lives in
[`ROADMAP.md`](https://github.com/the-craftlab/pipecraft/blob/main/ROADMAP.md) at
the repository root.

---

## Known limitations

These are gaps in the current implementation that you should understand before
building on PipeCraft. None of them are silent — they are documented here so you
can plan around them.

### No built-in rollback after a failed deployment

When a promotion PR merges and the deploy job on the target branch fails, there is
no Pipecraft-managed recovery path. The version tag is already on the target branch.

**Recommended recovery steps:**

1. Push a `fix:` commit to your initial branch (e.g., `develop`)
2. Let the pipeline re-run — it will produce a new patch version
3. The new version will promote normally through the branch flow
4. Avoid force-pushing the target branch — it breaks the linear history that
   PipeCraft's version model depends on

If the failure is catastrophic and you need to revert immediately, use
`git revert <merge-commit-sha>` on the target branch to create a revert commit that
safely undoes the merge without rewriting history.

**Fix status:** Documentation gap only (P1-2 in ROADMAP.md) — no generator change
needed; rollback is inherently environment-specific.

---

### Gate job needs manual updates when you add domains

When you add a new domain to `.pipecraftrc` and regenerate, the new domain's test
job is **not** automatically added to `gate.needs`. The gate job guards the version →
tag → promote chain, so a gate that passes without running all domain tests gives
false confidence.

**What to do:** After adding a domain and regenerating, manually add the new test
job to `gate.needs` in your workflow file. This customization survives future
regenerations.

**Fix status:** A future `pipecraft doctor` check will detect this gap (P2-4 in
ROADMAP.md).

---

### GitHub Actions only (GitLab planned)

PipeCraft currently generates GitHub Actions workflows only. The `ciProvider: gitlab`
config value is reserved but not implemented.

**Fix status:** P2-1 in ROADMAP.md — no timeline yet.

---

### Single workflow file (no sharding)

All domains are emitted into a single `pipeline.yml`. At 20+ domains this becomes
unwieldy in the GitHub Actions UI, and projects approaching 255 jobs per run could
hit GitHub's documented limit.

**Fix status:** P2-3 in ROADMAP.md — planned as a future architectural option, not
an immediate priority.

---

## What's coming next

These are the near-term priorities, in order:

**1. Publish Marketplace actions (P0-2)**
The `create-tag`, `promote-branch`, and `calculate-version` actions have been readied
for GitHub Marketplace but not yet published. `remote` action mode already works
today through pinned repository refs (`actionSourceMode: remote` + `actionVersion`;
see `examples/remote/.pipecraftrc.json`). Publishing adds Marketplace discoverability:
teams find the actions by browsing the Marketplace instead of pointing at the repo
directly).

**2. Thread version through promotion (P1-1)**
Calculate the version on the initial branch and pass it explicitly as a
`workflow_dispatch` input to the target branch's pipeline. This eliminates the need
for `calculate-version` to re-derive the version on the target branch, removing the
main source of "no release was cut" failures.

**3. GitLab CI support (P2-1)**
Generate `.gitlab-ci.yml` with the same domain-based testing, semantic versioning,
and branch promotion features available to GitHub Actions users today.

**4. Additional branch flow patterns (P2-2)**
GitHub Flow (feature branches → main) and GitFlow (develop → release → main with
hotfixes) are planned after the current trunk-based model is fully hardened.

---

## Ideas under consideration

Several features are being evaluated but haven't been prioritized yet:

**Workflow visualization** would generate diagrams showing how code flows through
your pipeline. This helps teams understand and communicate their deployment process.

**Matrix builds** would let you test across multiple Node versions or operating
systems simultaneously. This is particularly useful for libraries that need to
support multiple environments.

**Deployment environments** would integrate with GitHub's environment protection
rules, adding manual approval gates and environment-specific secrets.

**Notifications** could alert your team on Slack or Discord when deployments happen
or tests fail.

These ideas need community feedback before they're prioritized. If one of these
would be valuable for your team, let us know through GitHub Issues or Discussions.

---

## How you can help

The roadmap is shaped by user feedback. If you want to influence what gets built
next:

- **Vote on existing feature requests** using GitHub issue reactions — issues with
  more upvotes get higher priority
- **Open new feature requests** if you need something not listed — describe your
  use case in detail, not just a solution
- **Contribute code** if you're comfortable with TypeScript and GitHub Actions —
  pull requests for both bug fixes and new features are welcome
- **Join discussions** on GitHub Discussions to share ideas and debate approaches

Links:

- [GitHub Issues](https://github.com/the-craftlab/pipecraft/issues) for bugs and
  feature requests
- [GitHub Discussions](https://github.com/the-craftlab/pipecraft/discussions) for
  open-ended questions and ideas
- [`ROADMAP.md`](https://github.com/the-craftlab/pipecraft/blob/main/ROADMAP.md)
  for the full technical roadmap with source references
