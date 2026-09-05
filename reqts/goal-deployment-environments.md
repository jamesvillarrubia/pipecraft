# Deployment environments

Rank 5 of the 2026-09-04 list. Decision: **docs recipe, no generator change.** James,
2026-09-04, after the Define gate below: "doc recipe is sufficient".

## Problem

`autoPromote: false` on a branch leaves the promotion PR open for a person to merge, and
that merge is the only gate Pipecraft provides. A GitHub environment on the deploy job adds
what GitHub already offers a deployment: environment-scoped secrets, a branch restriction on
which branch may deploy, an optional required-reviewer click before the job runs, and the
Environments sidebar with deployment history.

## What the first spec asked for, and why it stopped

The first version of this file specified an `environments` key mapping branch to GitHub
environment, with `generate` writing `environment: <name>` onto the promote and deploy jobs
and removing it when the key was removed. The issue-loop Define gate refuted that contract
(docs/tmp/goal-deploy-envs.md, MoSCoW 1):

- Domain jobs are written once by `src/templates/workflows/pipeline.yml.tpl.ts:226-240` and
  then preserved verbatim on every later `generate` (`:398-472`). A config-driven line would
  reach only a repository that has never generated, and "remove the key, the line goes away"
  would be false for every existing user.
- Deploy jobs carry no branch condition, so there is no "deploy job gated on branch X" for the
  key to attach to.
- `promote` opens the PR from the source branch; an environment on it would gate the wrong
  step.

## Decision

The deploy job belongs to the user, and one hand-added line does the whole job today:

```yaml
deploy-api:
  runs-on: ubuntu-latest
  environment: production
```

`generate` rewrites `pipeline.yml` on every run and preserves the custom-jobs section, so
the line survives regeneration. Before the regenerate fix that ships in the same PR as this
spec, the line survived only because `generate` never rewrote an existing `pipeline.yml`
(reqts/goal-regenerate-pipeline.md). `tests/integration/regenerate-pipeline.test.ts` adds
`environment: production` to a domain job by hand, runs `generate` twice more, and asserts
the line is still there. The docs carry the recipe below under "Customizing your workflows"
in `docs/docs/workflow-generation.md`. The generator and schema do not change for this goal.

## Recipe

1. On GitHub, open Settings, Environments, New environment, and name it, for example
   `production`. Add the protection you want: required reviewers, a deployment branch rule
   that allows only `main`, and environment secrets.
2. In `.github/workflows/pipeline.yml`, inside the `<--START CUSTOM JOBS-->` and
   `<--END CUSTOM JOBS-->` markers, add `environment:` to the deploy job:

   ```yaml
   deploy-api:
     needs: [changes, test-api]
     if: needs.changes.outputs.api == 'true'
     runs-on: ubuntu-latest
     environment: production
     steps:
       - uses: actions/checkout@v4
       - run: ./deploy.sh
   ```

3. Commit the file. Rerun `pipecraft generate` after any config change; the custom-jobs
   section, including this line, is preserved.

Notes for the docs text:

- A required reviewer on the environment holds the deploy job until someone approves it in
  the run's Deployments panel. With `autoPromote: false` on the branch, the promotion PR is a
  second, earlier hold.
- The generated `deploy-<domain>` job needs only `changes` (issue #609). Add the domain's test
  job to `needs` by hand, as in the example, so a deploy waits for its tests.
- Environment secrets resolve through `${{ secrets.NAME }}` only in a job that names the
  environment.
- Use a literal environment name. What GitHub does with an expression that resolves to an
  empty name is unverified (docs/tmp/goal-deploy-envs.md, ledger row 7).

## Not doing

- An `environments` config key (the contract above cannot hold for existing files).
- A scaffold-only expression written on first generate (half of users would see the key do
  nothing).
- `doctor` checking that the environment exists on the repository.
- An e2e flavor with a required reviewer; the harness would need to approve pending
  deployments through `POST .../actions/runs/{id}/pending_deployments`.

## Related

Issue #609: generated `deploy-{domain}` jobs need only `changes`, so a deploy can start while
its test job is still running. Independent of environments; fix there.
