#!/bin/bash
set -e

echo "Recreating all Nx demo files..."

# Create nx.json
cat > nx.json << 'EOF'
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "test": {
      "dependsOn": [],
      "cache": true
    },
    "integration-test": {
      "dependsOn": ["build", "^build"],
      "cache": true
    },
    "e2e": {
      "dependsOn": ["build", "^build"],
      "cache": false
    },
    "lint": {
      "dependsOn": [],
      "cache": true
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.[jt]s",
      "!{projectRoot}/.eslintrc.json",
      "!{projectRoot}/src/test-setup.[jt]s",
      "!{projectRoot}/test/**/*"
    ],
    "sharedGlobals": []
  },
  "generators": {
    "@nx/js:library": {
      "unitTestRunner": "jest"
    }
  }
}
EOF

# Create tsconfig.base.json
cat > tsconfig.base.json << 'EOF'
{
  "compileOnSave": false,
  "compilerOptions": {
    "rootDir": ".",
    "sourceMap": true,
    "declaration": false,
    "moduleResolution": "node",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "es2015",
    "module": "esnext",
    "lib": ["es2020", "dom"],
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@demo/auth": ["libs/auth/src/index.ts"],
      "@demo/database": ["libs/database/src/index.ts"],
      "@demo/logging": ["libs/logging/src/index.ts"],
      "@demo/config": ["libs/config/src/index.ts"],
      "@demo/user-management": ["libs/user-management/src/index.ts"],
      "@demo/analytics": ["libs/analytics/src/index.ts"],
      "@demo/billing": ["libs/billing/src/index.ts"],
      "@demo/notifications": ["libs/notifications/src/index.ts"],
      "@demo/reporting": ["libs/reporting/src/index.ts"],
      "@demo/admin-dashboard": ["libs/admin-dashboard/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "tmp"]
}
EOF

# Create jest files
cat > jest.config.ts << 'EOF'
import { getJestProjectsAsync } from '@nx/jest';

export default async () => ({
  projects: await getJestProjectsAsync(),
});
EOF

cat > jest.preset.js << 'EOF'
const nxPreset = require('@nx/jest/preset').default;

module.exports = { ...nxPreset };
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# See http://help.github.com/ignore-files/ for more about ignoring files.

# compiled output
dist
tmp
/out-tsc

# dependencies
node_modules

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# IDE - VSCode
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# misc
/.sass-cache
/connect.lock
/coverage
/libpeerconnection.log
npm-debug.log
yarn-error.log
testem.log
/typings

# System Files
.DS_Store
Thumbs.db

# Nx
.nx/cache

# PipeCraft test output
.test-output/

# PipeCraft generated files
.pipecraftrc.json
.pipecraft-cache.json
.github/
release-it.cjs
EOF

echo "✅ Created root config files"
