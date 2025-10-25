#!/bin/bash
set -e

# Function to create a library
create_lib() {
  local name=$1
  local deps=$2
  local needs_build=$3
  local lib_path="libs/$name"
  
  mkdir -p "$lib_path/src/lib"
  
  # project.json
  if [ "$needs_build" = "true" ]; then
    cat > "$lib_path/project.json" << EOF
{
  "name": "$name",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "options": {
        "outputPath": "dist/libs/$name",
        "main": "libs/$name/src/index.ts",
        "tsConfig": "libs/$name/tsconfig.json"
      }
    },
    "test": {
      "dependsOn": ["build"],
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "libs/$name/jest.config.ts"
      }
    },
    "integration-test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "libs/$name/jest.config.ts"
      }
    }
  }
}
EOF
  else
    cat > "$lib_path/project.json" << EOF
{
  "name": "$name",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "options": {
        "outputPath": "dist/libs/$name",
        "main": "libs/$name/src/index.ts",
        "tsConfig": "libs/$name/tsconfig.json"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "libs/$name/jest.config.ts"
      }
    },
    "integration-test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "libs/$name/jest.config.ts"
      }
    }
  }
}
EOF
  fi
  
  # Other files...
  cat > "$lib_path/package.json" << EOF
{"name": "@demo/$name", "version": "1.0.0"}
EOF
  
  cat > "$lib_path/tsconfig.json" << EOF
{"extends": "../../tsconfig.base.json", "compilerOptions": {"module": "commonjs"}, "include": ["src/**/*.ts"], "exclude": ["node_modules"]}
EOF
  
  cat > "$lib_path/jest.config.ts" << EOF
export default {
  displayName: '$name',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {'^.+\\.[tj]s\$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]},
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../coverage/libs/$name'
};
EOF
  
  echo "export * from './lib/$name';" > "$lib_path/src/index.ts"
  
  echo "$deps" > "$lib_path/src/lib/$name.ts"
  echo "export function ${name}Function() { return '$name works!'; }" >> "$lib_path/src/lib/$name.ts"
  
  cat > "$lib_path/src/lib/$name.spec.ts" << EOF
import { ${name}Function } from './$name';
describe('$name', () => {
  it('should work', () => { expect(${name}Function()).toBe('$name works!'); });
});
EOF
  
  cat > "$lib_path/src/lib/$name.integration.spec.ts" << EOF
import { ${name}Function } from './$name';
describe('$name integration', () => {
  it('should integrate', () => { expect(${name}Function()).toBeDefined(); });
});
EOF
  
  cat > "$lib_path/README.md" << EOF
# @demo/$name

Test WITH build: $needs_build

Dependencies: $deps
EOF
  
  echo "Created $name"
}

# Create foundational libraries
create_lib "auth" "" "false"
create_lib "database" "" "true"
create_lib "logging" "" "false"
create_lib "config" "" "false"

# Create level 2 libraries
create_lib "user-management" "import { authFunction } from '@demo/auth';" "false"
create_lib "analytics" "import { loggingFunction } from '@demo/logging';" "true"

# Create level 3+ libraries
create_lib "billing" "import { userManagementFunction } from '@demo/user-management';" "true"
create_lib "notifications" "import { userManagementFunction } from '@demo/user-management';" "false"
create_lib "reporting" "import { analyticsFunction } from '@demo/analytics';" "false"
create_lib "admin-dashboard" "import { userManagementFunction } from '@demo/user-management';" "false"

# Create apps
for app in frontend backend widget client; do
  mkdir -p "apps/$app/src/app" "apps/$app/test/e2e"
  cat > "apps/$app/project.json" << EOF
{
  "name": "$app",
  "targets": {
    "build": {"executor": "@nx/js:tsc", "options": {"outputPath": "dist/apps/$app", "main": "apps/$app/src/main.ts", "tsConfig": "apps/$app/tsconfig.json"}},
    "test": {"executor": "@nx/jest:jest", "options": {"jestConfig": "apps/$app/jest.config.ts"}},
    "e2e": {"executor": "@nx/jest:jest", "options": {"jestConfig": "apps/$app/jest.config.ts", "testPathPattern": "e2e"}}
  }
}
EOF
  cat > "apps/$app/package.json" << EOF
{"name": "@demo/$app", "version": "1.0.0"}
EOF
  cat > "apps/$app/tsconfig.json" << EOF
{"extends": "../../tsconfig.base.json", "compilerOptions": {"module": "commonjs"}, "include": ["src/**/*.ts", "test/**/*.ts"], "exclude": ["node_modules"]}
EOF
  cat > "apps/$app/jest.config.ts" << EOF
export default {displayName: '$app', preset: '../../jest.preset.js', testEnvironment: 'node', transform: {'^.+\\.[tj]s\$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]}, moduleFileExtensions: ['ts', 'js'], coverageDirectory: '../../coverage/apps/$app'};
EOF
  echo "console.log('$app app started!');" > "apps/$app/src/main.ts"
  echo "export function ${app}App() { return '$app application'; }" > "apps/$app/src/app/app.ts"
  cat > "apps/$app/src/app/app.spec.ts" << EOF
import { ${app}App } from './app';
describe('$app app', () => { it('should work', () => { expect(${app}App()).toBe('$app application'); }); });
EOF
  cat > "apps/$app/test/e2e/app.e2e.spec.ts" << EOF
describe('$app e2e', () => { it('should run e2e test', () => { expect(true).toBe(true); }); });
EOF
  echo "Created $app"
done

# Create infra
mkdir -p infra/pulumi infra/kubernetes
cat > infra/pulumi/index.ts << 'EOF'
// Pulumi IaC
export const bucket = 'demo-bucket';
EOF
cat > infra/pulumi/Pulumi.yaml << 'EOF'
name: pipecraft-demo
runtime: nodejs
description: Demo infrastructure
EOF
cat > infra/kubernetes/deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pipecraft-demo
EOF

# Create migrations
mkdir -p migrations/001-initial-schema migrations/002-add-billing
cat > migrations/001-initial-schema/migration.json << 'EOF'
{"name": "001_initial_schema", "operations": []}
EOF
cat > migrations/002-add-billing/migration.json << 'EOF'
{"name": "002_add_billing", "operations": []}
EOF

echo "✅ All libs, apps, infra, and migrations created!"
