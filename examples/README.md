# PipeCraft example flavors

Canonical `.pipecraftrc.json` configs for each supported workflow shape ("flavor").
These mirror the public `the-craftlab/pipecraft-example-*` repositories and are the
source of truth for them.

`tests/integration/example-flavors.test.ts` generates every flavor through the real CLI
and asserts its defining invariants, so a generator change can't silently break a
published flavor.

| Flavor      | Branch flow                                     | Promotion                                | Notable                                                                                      |
| ----------- | ----------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| **minimal** | `develop → main`                                | auto to `main`                           | Smallest real two-branch setup, one domain                                                   |
| **library** | `main` only                                     | none                                     | Single-branch publish; `promote` job is emitted but hard-guarded off                         |
| **basic**   | `develop → staging → main`                      | auto every hop                           | Multi-domain, `mergeStrategy: merge`                                                         |
| **gated**   | `develop → alpha → beta → release → production` | every hop a manual gate                  | Enterprise approval flow                                                                     |
| **mixed**   | `develop → staging → main`                      | auto to `staging`, manual gate to `main` | Per-target `autoPromote` map                                                                 |
| **remote**  | `develop → main`                                | auto (`autoPromote: true`)               | `actionSourceMode: remote` — references published marketplace actions, no local action files |

## Promotion semantics

`autoPromote` accepts either a global boolean or a per-target map:

```jsonc
"autoPromote": true                          // auto-promote every hop
"autoPromote": { "staging": true, "main": false }  // auto to staging, manual gate to main
```

Omitting `autoPromote` (or setting it `false`) makes every hop a manual gate — PipeCraft
opens a promotion PR for human approval instead of merging automatically.

## Remote action mode

The `remote` flavor sets `actionSourceMode: remote` and pins `actionVersion` to a published
PipeCraft release tag. The referenced tag must contain the `actions/` directory (every
release tag does). Pin to a release that includes the promotion-cascade fixes; tags at or
before `v0.41.0` predate them.
