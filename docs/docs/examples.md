---
sidebar_position: 9
---

# Real-World Examples

The best way to understand how PipeCraft configurations work is to see them in context. These examples represent real-world scenarios with explanations of why each choice was made. You can use these as starting points for your own configurations.

## Live Example Repositories

**Looking for complete, working examples?** Check out our example repositories on GitHub with real code, tests, and workflows:

### [📦 pipecraft-example-minimal](https://github.com/jamesvillarrubia/pipecraft-example-minimal)
Simplest possible setup (1 domain, 2-branch flow). **Perfect for getting started in 5 minutes.**

### [🏗️ pipecraft-example-basic](https://github.com/jamesvillarrubia/pipecraft-example-basic)
Multi-domain application (4 domains, 3-branch trunk flow). **Most common use case.**

### [🎯 pipecraft-example-nx](https://github.com/jamesvillarrubia/pipecraft-example-nx)
Advanced Nx monorepo (10+ projects + mixed detection). **For large monorepos.**

### [🔐 pipecraft-example-gated](https://github.com/jamesvillarrubia/pipecraft-example-gated)
Enterprise gated workflow (5-branch flow, manual approvals). **For compliance requirements.**

**[📖 View detailed comparison of all examples →](https://github.com/jamesvillarrubia/pipecraft/blob/main/examples/README.md)**

Each example includes working code, comprehensive documentation, and is ready to clone and customize for your project.

---

## Configuration Examples

Below are additional configuration examples for specific scenarios:

## Simple Web Application

This example represents a straightforward web application with a single codebase. You're using a two-branch flow to keep things simple: developers merge features to develop, and when you're ready to release, you promote to main.

### The Scenario

You're building a web application for a small team. You don't need a complex staging environment—you test in development, and when things look good, you ship to production. You want automatic versioning based on your commit messages, but you don't want to overcomplicate your workflow.

### Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "main"],

  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },

  "domains": {
    "app": {
      "paths": ["src/**", "public/**", "tests/**"],
      "description": "Complete application code including tests"
    }
  },

  "versioning": {
    "enabled": true,
    "conventionalCommits": true,
    "autoTag": true,
    "changelog": true
  }
}
```

### Why This Works

The simplicity here is intentional. You have one domain because everything in your repository is part of the same deployable application. The two-branch flow means that code goes from development directly to production without an intermediate staging step—appropriate for small teams or applications with strong test coverage.

Fast-forward merging keeps your git history clean, making it easy to see exactly what changes went into each release. Conventional commits enable automatic semantic versioning, so you don't have to manually decide what version number comes next.

### What Gets Generated

PipeCraft creates a workflow that runs tests on the develop branch whenever you push. When you promote develop to main, the workflow runs tests again, bumps the version number based on your commits since the last release, creates a git tag, updates the changelog, and triggers your deployment process.

## Full-Stack Monorepo

This example represents a more complex setup: a monorepo containing separate frontend and backend applications, shared libraries, and infrastructure code. Different teams work on different parts of the codebase, and you need to test only what changed.

### The Scenario

You're running a product with distinct frontend and backend services, plus some shared utility libraries. Your frontend team and backend team work independently most of the time, and you don't want frontend changes triggering backend tests. You have three environments: development, staging (for QA), and production.

### Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],

  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },

  "domains": {
    "api": {
      "paths": [
        "apps/api/**",
        "libs/api-core/**",
        "libs/shared/**"
      ],
      "description": "Backend API service and core business logic"
    },
    "web": {
      "paths": [
        "apps/web/**",
        "libs/ui-components/**",
        "libs/shared/**"
      ],
      "description": "Frontend web application and UI library"
    },
    "infrastructure": {
      "paths": [
        "infrastructure/**",
        "docker/**",
        ".github/workflows/**"
      ],
      "description": "Infrastructure as code and deployment configs"
    }
  },

  "versioning": {
    "enabled": true,
    "conventionalCommits": true,
    "autoTag": true,
    "autoPush": true,
    "changelog": true
  }
}
```

### Why This Works

Notice that the `libs/shared/**` path appears in both the api and web domains. This is intentional—when shared code changes, both domains should run their tests because both depend on it. PipeCraft handles this correctly: changes to shared libraries trigger both API and web test jobs.

The three-branch flow gives you a proper QA environment in staging. Code must pass tests in develop, get promoted to staging for manual testing, and only then move to production. This extra step catches issues that automated tests might miss.

Each domain is sized appropriately—large enough to be meaningful (API vs web), but not so granular that you have dozens of domains. Infrastructure gets its own domain because Terraform changes should trigger validation even though they don't affect application code.

### What Gets Generated

The generated workflow uses GitHub's `paths-filter` action to detect which domains changed. If you modify only frontend code, only the web tests run. If you touch shared libraries, both API and web tests run in parallel. Infrastructure changes trigger their own validation steps.

Each branch in your flow has appropriate jobs: develop runs tests, staging runs tests plus any additional QA validations, and main runs tests plus versioning and deployment. The workflow is smart enough to skip unchanged domains, saving CI minutes.

## Enterprise Application with Complex Flow

This example represents an enterprise setup with multiple environments, strict approval requirements, and a complex deployment topology. You have separate teams for API, web, mobile, and platform infrastructure.

### The Scenario

You're working at a company with compliance requirements and a formal release process. Code moves through four environments: development, staging (for integration testing), UAT (for business stakeholder approval), and production. Different services deploy independently, but you need to track versions for the entire repository. You use a monorepo because coordinating changes across multiple repos proved too complex.

### Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "production",
  "branchFlow": ["develop", "staging", "uat", "production"],

  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },

  "domains": {
    "api-users": {
      "paths": [
        "services/api-users/**",
        "libs/auth/**",
        "libs/shared/**"
      ],
      "description": "User management API and authentication libraries"
    },
    "api-orders": {
      "paths": [
        "services/api-orders/**",
        "libs/payments/**",
        "libs/shared/**"
      ],
      "description": "Order processing API and payment integration"
    },
    "api-catalog": {
      "paths": [
        "services/api-catalog/**",
        "libs/search/**",
        "libs/shared/**"
      ],
      "description": "Product catalog API and search functionality"
    },
    "web-customer": {
      "paths": [
        "apps/web-customer/**",
        "libs/ui-components/**",
        "libs/shared/**"
      ],
      "description": "Customer-facing web application"
    },
    "web-admin": {
      "paths": [
        "apps/web-admin/**",
        "libs/ui-components/**",
        "libs/admin-components/**",
        "libs/shared/**"
      ],
      "description": "Internal administration portal"
    },
    "mobile": {
      "paths": [
        "apps/mobile/**",
        "libs/mobile-shared/**",
        "libs/shared/**"
      ],
      "description": "Mobile application for iOS and Android"
    },
    "platform": {
      "paths": [
        "infrastructure/**",
        "k8s/**",
        "terraform/**"
      ],
      "description": "Platform infrastructure and Kubernetes configurations"
    }
  },

  "versioning": {
    "enabled": true,
    "releaseItConfig": ".release-it.cjs",
    "conventionalCommits": true,
    "autoTag": true,
    "autoPush": true,
    "changelog": true
  }
}
```

### Why This Works

This configuration splits APIs by business domain rather than having one monolithic API domain. This reflects the actual microservice architecture—each API can deploy independently, so each should test independently. The frontend is split between customer-facing and internal admin applications because they have different deployment schedules and risk profiles.

The four-branch flow accommodates the approval process. UAT exists specifically for business stakeholders to verify features in a production-like environment before actual production deployment. This might seem like overkill for some organizations, but for enterprises with compliance requirements, it's essential.

Notice that libraries are thoughtfully shared between domains. All domains include `libs/shared/**`, but admin-specific UI components are only in the admin domain. This prevents unnecessary test runs—when you modify an admin component, you don't need to test the customer-facing web app.

### What Gets Generated

The generated workflow is sophisticated but manageable. It creates separate job matrices for each domain, allowing them to run in parallel. The workflow includes checkpoints at each branch: develop runs all relevant tests, staging adds integration tests, UAT includes smoke tests for stakeholder validation, and production includes versioning and deployment orchestration.

Because of the domain granularity, teams can work independently without blocking each other. The API teams don't wait for mobile builds, and frontend changes don't delay backend deployments. Yet when changes touch shared code, all affected domains test automatically.

## Custom Branch Names

Some organizations have established branch naming conventions that don't match the typical develop/staging/main pattern. PipeCraft accommodates this flexibility.

### The Scenario

Your organization uses a branch naming scheme inherited from a previous tool: alpha for active development, beta for testing, gamma for pre-production validation, and release for production. You want to adopt PipeCraft without renaming all your branches and retraining your team.

### Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "alpha",
  "finalBranch": "release",
  "branchFlow": ["alpha", "beta", "gamma", "release"],

  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },

  "domains": {
    "core": {
      "paths": ["src/core/**", "tests/core/**"],
      "description": "Core application functionality"
    },
    "plugins": {
      "paths": ["src/plugins/**", "tests/plugins/**"],
      "description": "Plugin system and extensions"
    }
  }
}
```

### Why This Works

PipeCraft doesn't enforce specific branch names—it only cares about the order and roles. By setting `initialBranch` to "alpha" and `finalBranch` to "release", and defining the flow in the correct sequence, PipeCraft generates workflows that understand your conventions.

The branch names themselves don't matter; what matters is how code flows through them. Alpha is where development happens, beta is for testing, gamma is for final validation, and release is production. PipeCraft adapts.

### What Gets Generated

The workflow triggers on pushes to alpha, beta, gamma, and release. It recognizes alpha as the starting point (no version bumps, just testing) and release as the ending point (version bumps and tagging). The branch names in the workflow YAML match your configuration, so developers looking at the workflows see familiar terminology.

## Microservices with Independent Deployment

This example shows how to configure PipeCraft when each service in your monorepo deploys completely independently, but you still want unified version tracking and shared CI/CD configuration.

### The Scenario

You have five microservices that share common libraries but deploy on different schedules. Each service has its own tests, own Dockerfile, and own deployment process. You use a monorepo for code sharing and developer experience, but you need CI/CD that respects service boundaries.

### Configuration

```json
{
  "ciProvider": "github",
  "mergeStrategy": "fast-forward",
  "requireConventionalCommits": true,
  "initialBranch": "develop",
  "finalBranch": "main",
  "branchFlow": ["develop", "staging", "main"],

  "semver": {
    "bumpRules": {
      "feat": "minor",
      "fix": "patch",
      "breaking": "major"
    }
  },

  "domains": {
    "auth-service": {
      "paths": [
        "services/auth/**",
        "libs/auth-utils/**",
        "libs/common/**"
      ],
      "description": "Authentication and authorization service"
    },
    "user-service": {
      "paths": [
        "services/user/**",
        "libs/user-utils/**",
        "libs/common/**"
      ],
      "description": "User profile and preferences service"
    },
    "notification-service": {
      "paths": [
        "services/notification/**",
        "libs/email-templates/**",
        "libs/common/**"
      ],
      "description": "Email and push notification service"
    },
    "analytics-service": {
      "paths": [
        "services/analytics/**",
        "libs/data-processing/**",
        "libs/common/**"
      ],
      "description": "Event tracking and analytics processing"
    },
    "reporting-service": {
      "paths": [
        "services/reporting/**",
        "libs/report-generation/**",
        "libs/common/**"
      ],
      "description": "Report generation and data export service"
    },
    "shared-libs": {
      "paths": ["libs/**"],
      "description": "All shared libraries (runs when any library changes)"
    }
  },

  "versioning": {
    "enabled": true,
    "conventionalCommits": true,
    "autoTag": true,
    "changelog": true
  }
}
```

### Why This Works

Each service gets its own domain with its specific paths plus the common libraries it depends on. When you modify the auth service, only auth tests run. When you modify `libs/common`, every service tests because they all depend on it—exactly what you want.

The clever addition here is the `shared-libs` domain that includes all libs. This ensures that library changes always trigger a comprehensive test suite. Even if a library isn't explicitly included in a service's paths, the shared-libs domain catches it.

### What Gets Generated

The generated workflow creates isolated test jobs for each service. They run in parallel, taking full advantage of GitHub Actions' concurrency. Each service can define its own deployment steps in custom job sections that PipeCraft preserves during regeneration.

When a service reaches main, it can deploy independently because the workflow knows which domain changed. You don't deploy all five services on every change—just the one (or ones) that actually changed.

## Adapting These Examples

These examples cover common scenarios, but your needs might differ. Here's how to adapt them:

**Fewer environments**: Remove branches from `branchFlow`. A two-branch setup (develop and main) works well for teams with strong test coverage.

**More granular domains**: Split domains further when different teams own different parts of the code and you want to minimize unnecessary test runs.

**Less granular domains**: Combine domains when services are tightly coupled and should always test together anyway.

**Different commit conventions**: Adjust `bumpRules` to match your team's versioning philosophy. Some teams make all features major bumps during early development.

**No versioning**: Set `versioning.enabled` to `false` if you version manually or don't version at all.

For more details on what each configuration option does, see the [Configuration Reference](configuration-reference.md). To understand how these configurations translate into workflow behavior, see [Workflow Generation](workflow-generation.md).
