import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Apps Deployment GitHub Action
const appsActionTemplate = (ctx: any) => `name: 'Deploy Applications'
description: 'Deploy applications to specified environment'
author: 'Flowcraft'

inputs:
  environment:
    description: 'Environment to deploy to'
    required: true
  domains:
    description: 'Comma-separated list of domains to deploy'
    required: true
  version:
    description: 'Version to deploy'
    required: false

outputs:
  deploymentStatus:
    description: 'Status of the deployment'
    value: \${{ steps.deploy.outputs.status }}
  deployedDomains:
    description: 'List of deployed domains'
    value: \${{ steps.deploy.outputs.domains }}

runs:
  using: 'composite'
  steps:
    - name: Checkout Code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Parse Domains
      id: parse-domains
      shell: bash
      run: |
        DOMAINS="\${{ inputs.domains }}"
        IFS=',' read -ra DOMAIN_ARRAY <<< "\$DOMAINS"
        
        # Create JSON array of domains
        DOMAIN_JSON="["
        for i in "\${!DOMAIN_ARRAY[@]}"; do
          if [ \$i -gt 0 ]; then
            DOMAIN_JSON="\$DOMAIN_JSON,"
          fi
          DOMAIN_JSON="\$DOMAIN_JSON\"\${DOMAIN_ARRAY[i]// /}\""
        done
        DOMAIN_JSON="\$DOMAIN_JSON]"
        
        echo "domains=\$DOMAIN_JSON" >> \$GITHUB_OUTPUT
        echo "domain_count=\${#DOMAIN_ARRAY[@]}" >> \$GITHUB_OUTPUT
        
        echo "📋 Domains to deploy:"
        for domain in "\${DOMAIN_ARRAY[@]}"; do
          echo "  - \$domain"
        done

    - name: Set Environment Variables
      shell: bash
      run: |
        ENV="\${{ inputs.environment }}"
        VERSION="\${{ inputs.version }}"
        
        echo "ENVIRONMENT=\$ENV" >> \$GITHUB_ENV
        echo "VERSION=\${VERSION:-latest}" >> \$GITHUB_ENV
        
        # Set environment-specific variables
        case "\$ENV" in
          "development")
            echo "DEPLOY_URL=https://dev.example.com" >> \$GITHUB_ENV
            echo "REGISTRY=dev-registry.example.com" >> \$GITHUB_ENV
            ;;
          "staging")
            echo "DEPLOY_URL=https://staging.example.com" >> \$GITHUB_ENV
            echo "REGISTRY=staging-registry.example.com" >> \$GITHUB_ENV
            ;;
          "production")
            echo "DEPLOY_URL=https://example.com" >> \$GITHUB_ENV
            echo "REGISTRY=prod-registry.example.com" >> \$GITHUB_ENV
            ;;
        esac

    - name: Deploy Applications
      id: deploy
      shell: bash
      run: |
        ENV="\${{ inputs.environment }}"
        DOMAINS="\${{ inputs.domains }}"
        VERSION="\${{ inputs.version }}"
        
        echo "🚀 Deploying to \$ENV environment"
        echo "📦 Version: \${VERSION:-latest}"
        echo "🌐 Domains: \$DOMAINS"
        
        # Simulate deployment for each domain
        IFS=',' read -ra DOMAIN_ARRAY <<< "\$DOMAINS"
        DEPLOYED_DOMAINS=""
        SUCCESS_COUNT=0
        
        for domain in "\${DOMAIN_ARRAY[@]}"; do
          echo "📦 Deploying \$domain..."
          
          # Simulate deployment logic based on domain
          case "\$domain" in
            "api")
              echo "  🔧 Building API service..."
              echo "  🐳 Creating Docker image..."
              echo "  🚀 Deploying to Kubernetes..."
              echo "  ✅ API deployed successfully"
              ;;
            "web")
              echo "  🎨 Building web application..."
              echo "  📦 Creating static build..."
              echo "  🌐 Deploying to CDN..."
              echo "  ✅ Web app deployed successfully"
              ;;
            "libs")
              echo "  📚 Building library packages..."
              echo "  📦 Publishing to npm registry..."
              echo "  ✅ Libraries published successfully"
              ;;
            *)
              echo "  ⚠️  Unknown domain: \$domain"
              ;;
          esac
          
          DEPLOYED_DOMAINS="\$DEPLOYED_DOMAINS,\$domain"
          SUCCESS_COUNT=\$((SUCCESS_COUNT + 1))
        done
        
        # Remove leading comma
        DEPLOYED_DOMAINS="\${DEPLOYED_DOMAINS#,}"
        
        echo "status=success" >> \$GITHUB_OUTPUT
        echo "domains=\$DEPLOYED_DOMAINS" >> \$GITHUB_OUTPUT
        
        echo "✅ Deployment completed successfully"
        echo "📊 Deployed \$SUCCESS_COUNT/\${#DOMAIN_ARRAY[@]} domains"

    - name: Deployment Summary
      shell: bash
      run: |
        echo "🎉 Deployment Summary:"
        echo "  Environment: \${{ inputs.environment }}"
        echo "  Version: \${{ inputs.version }}"
        echo "  Status: \${{ steps.deploy.outputs.status }}"
        echo "  Domains: \${{ steps.deploy.outputs.domains }}"`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(appsActionTemplate, toFile('.github/actions/job._apps/action.yml')))