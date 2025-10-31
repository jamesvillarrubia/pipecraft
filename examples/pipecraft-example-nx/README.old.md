# Trunk-Based Nx Demo

This is a demonstration Nx monorepo designed to test PipeCraft's ability to handle complex dependency graphs with mixed task dependencies.

## Structure

```
trunk-based-nx-demo/
├── apps/
│   ├── frontend/          # Frontend application
│   ├── backend/           # Backend API
│   ├── widget/            # Embeddable widget
│   └── client/            # CLI client
├── libs/
│   ├── auth/              # Authentication (foundational)
│   ├── database/          # Database layer (foundational) - test WITH build
│   ├── logging/           # Logging utilities (foundational)
│   ├── config/            # Configuration (foundational)
│   ├── user-management/   # User management features
│   ├── analytics/         # Analytics tracking - test WITH build
│   ├── billing/           # Billing system - test WITH build
│   ├── notifications/     # Notification service
│   ├── reporting/         # Report generation
│   └── admin-dashboard/   # Admin dashboard features
├── infra/
│   ├── pulumi/            # Infrastructure as Code (Pulumi)
│   └── kubernetes/        # Kubernetes manifests
├── migrations/
│   ├── 001-initial-schema/    # Initial database schema (pgroll)
│   └── 002-add-billing/       # Billing tables (pgroll)
└── test-utils/            # Test suite utilities
```

## Dependency Graph

### Foundational Libraries (No Dependencies)

- **auth**: Authentication and authorization
- **database**: Database connection and ORM
- **logging**: Logging utilities
- **config**: Configuration management

### Domain Libraries (With Dependencies)

- **user-management**: depends on auth, database, logging
- **analytics**: depends on database, logging
- **billing**: depends on auth, database, logging
- **notifications**: depends on logging
- **reporting**: depends on analytics, logging
- **admin-dashboard**: depends on auth, analytics, logging

### Applications

- **frontend**: depends on auth, logging, user-management, admin-dashboard
- **backend**: depends on auth, database, logging, user-management, analytics, billing, notifications
- **widget**: depends on logging
- **client**: depends on logging

## Task Dependencies

### Default Behavior

Most libraries have **test WITHOUT build** dependency:

- auth
- logging
- config
- user-management
- notifications
- reporting
- admin-dashboard

This is configured in `nx.json` via `targetDefaults`.

### Exceptions (Test WITH Build)

Three libraries require build before test:

- **database**: Uses compiled TypeScript for database connections
- **analytics**: Event tracking needs compiled modules
- **billing**: Payment processing requires built artifacts

These are configured in each library's `project.json` via the `dependsOn` property.

## Path-Based Detection

### Infrastructure (infra/)

- **infra/pulumi/**: Pulumi TypeScript infrastructure

  - Tasks: preview, up
  - Detected via path pattern: `infra/pulumi/**`

- **infra/kubernetes/**: Kubernetes YAML manifests
  - Tasks: validate, apply
  - Detected via path pattern: `infra/kubernetes/**`

### Migrations (migrations/)

- **migrations/**: Database migrations using pgroll JSON format
  - Tasks: migrate
  - Detected via path pattern: `migrations/**`

## Test Suite

The test suite validates PipeCraft's ability to:

1. **Generate Workflows**: Create CI/CD pipelines from Nx configuration
2. **Detect Changes**: Use Nx affected detection to find impacted projects
3. **Respect Task Dependencies**: Build before test only when required
4. **Preserve Custom Jobs**: Maintain user-defined jobs during regeneration
5. **Handle Mixed Detection**: Combine Nx and path-based detection

### Running Tests

```bash
# Full test suite (requires act)
npm run test:pipecraft

# Skip act scenarios (faster)
npm run test:pipecraft:fast

# Clean generated files only
npm run test:pipecraft:clean
```

### Test Scenarios

The test suite includes 11 scenarios:

1. **auth-library-change**: Foundational library change affecting many projects
2. **database-library-change**: Library with test-WITH-build exception
3. **logging-library-change**: Library with test-WITHOUT-build (default)
4. **analytics-library-change**: Another test-WITH-build exception
5. **notifications-library-change**: Test-WITHOUT-build
6. **frontend-app-change**: App-specific change
7. **backend-app-change**: App with integration tests
8. **pulumi-infrastructure-change**: Path-based detection for infra
9. **kubernetes-manifest-change**: Path-based detection for K8s
10. **pgroll-migration-change**: Path-based detection for migrations
11. **mixed-nx-and-path-changes**: Hybrid Nx + path detection

## PipeCraft Integration

See [PIPECRAFT_INTEGRATION.md](./PIPECRAFT_INTEGRATION.md) for details on how PipeCraft should handle this monorepo.

## Test Suite Documentation

See [TEST-SUITE-README.md](./TEST-SUITE-README.md) for detailed test suite architecture and usage.
