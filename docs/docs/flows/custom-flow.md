# Custom Flow

Custom flow support is planned for a future release. This would let you define your own branching strategies beyond the predefined patterns.

## Why custom flows?

Every team has unique needs. Maybe you have a dev → qa → uat → prod pipeline. Maybe you need parallel staging environments. Maybe you want feature flags to control promotions instead of branch merges. The predefined flows (trunk, GitHub Flow, GitFlow) can't cover every scenario.

Custom flows would give you complete control over how code moves through your pipeline. You'd define the branches, the promotion rules, and the deployment targets yourself.

## How it might work

A custom flow configuration might look like:

```json
{
  "flowPattern": "custom",
  "branches": ["dev", "qa", "uat", "prod"],
  "promotionRules": {
    "dev": {
      "autoPromote": true,
      "target": "qa",
      "requireTests": true
    },
    "qa": {
      "autoPromote": false,
      "target": "uat",
      "requireApproval": true
    },
    "uat": {
      "autoPromote": false,
      "target": "prod",
      "requireApproval": true,
      "requireHealthCheck": true
    }
  }
}
```

This would create a pipeline with four stages, manual approval gates between later stages, and health checks before production.

## The challenge

Custom flows are harder to implement than predefined patterns because every team's needs are different. The configuration format needs to be flexible enough to support many workflows while remaining simple enough to understand and maintain.

It also needs to generate safe workflows that handle edge cases properly - parallel branches, diamond dependencies, circular promotion paths, and error recovery.

## Timeline

Custom flows are lower priority than GitLab support and predefined patterns like GitHub Flow and GitFlow. They'll likely come later in the roadmap once the core patterns are solid.

If you have specific requirements for a custom flow, share them on [GitHub Discussions](https://github.com/pipecraft-lab/pipecraft/discussions). Real-world use cases help design better abstractions.
