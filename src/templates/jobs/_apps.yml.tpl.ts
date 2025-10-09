import { PinionContext, toFile, renderTemplate } from '@featherscloud/pinion'

// Template for the Apps workflow
const appsWorkflowTemplate = (ctx: any) => `name: "Application Deployment"

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
        description: "Environment to deploy to"
      domains:
        required: true
        type: string
        description: "Comma-separated list of domains to deploy"
      version:
        required: false
        type: string
        description: "Version to deploy"
    outputs:
      deploymentStatus:
        value: \${{ jobs.deploy-apps.outputs.deploymentStatus }}
      deployedDomains:
        value: \${{ jobs.deploy-apps.outputs.deployedDomains }}
      
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
        - development
        - staging
        - production
      domains:
        description: 'Comma-separated list of domains to deploy'
        required: true
      version:
        description: 'Version to deploy (optional)'
        required: false

jobs:
  deploy-apps:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    outputs:
      deploymentStatus: \${{ steps.deploy.outputs.status }}
      deployedDomains: \${{ steps.deploy.outputs.domains }}
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Parse Domains
      id: parse-domains
      run: |
        DOMAINS="\${{ inputs.domains }}"
        IFS=',' read -ra DOMAIN_ARRAY <<< "$DOMAINS"
        
        # Create JSON array of domains
        DOMAIN_JSON="["
        for i in "\${!DOMAIN_ARRAY[@]}"; do
          if [ $i -gt 0 ]; then
            DOMAIN_JSON="$DOMAIN_JSON,"
          fi
          DOMAIN_JSON="$DOMAIN_JSON\"\${DOMAIN_ARRAY[i]// /}\""
        done
        DOMAIN_JSON="$DOMAIN_JSON]"
        
        echo "domains=$DOMAIN_JSON" >> $GITHUB_OUTPUT
        echo "domain_count=\${#DOMAIN_ARRAY[@]}" >> $GITHUB_OUTPUT
        
        echo "📋 Domains to deploy:"
        for domain in "\${DOMAIN_ARRAY[@]}"; do
          echo "  - $domain"
        done

    - name: Set Environment Variables
      run: |
        ENV="\${{ inputs.environment }}"
        VERSION="\${{ inputs.version }}"
        
        echo "ENVIRONMENT=$ENV" >> $GITHUB_ENV
        echo "VERSION=\${VERSION:-latest}" >> $GITHUB_ENV
        
        # Set environment-specific variables
        case "$ENV" in
          "development")
            echo "DEPLOY_URL=https://dev.example.com" >> $GITHUB_ENV
            echo "REGISTRY=dev-registry.example.com" >> $GITHUB_ENV
            ;;
          "staging")
            echo "DEPLOY_URL=https://staging.example.com" >> $GITHUB_ENV
            echo "REGISTRY=staging-registry.example.com" >> $GITHUB_ENV
            ;;
          "production")
            echo "DEPLOY_URL=https://example.com" >> $GITHUB_ENV
            echo "REGISTRY=prod-registry.example.com" >> $GITHUB_ENV
            ;;
        esac
        
        echo "🌍 Environment: $ENV"
        echo "📦 Version: $VERSION"
        echo "🔗 Deploy URL: $DEPLOY_URL"

    - name: Deploy Applications
      id: deploy
      run: |
        DOMAINS='\${{ steps.parse-domains.outputs.domains }}'
        ENV="\${{ inputs.environment }}"
        VERSION="\${{ inputs.version }}"
        
        echo "🚀 Starting deployment to $ENV..."
        
        # Parse domains from JSON
        DOMAIN_LIST=$(echo "$DOMAINS" | jq -r '.[]')
        DEPLOYED_DOMAINS=""
        SUCCESS_COUNT=0
        TOTAL_COUNT=0
        
        while IFS= read -r domain; do
          TOTAL_COUNT=$((TOTAL_COUNT + 1))
          echo "📦 Deploying $domain..."
          
          # Simulate deployment (replace with actual deployment logic)
          if [ "$domain" = "api" ]; then
            echo "  🔧 Building API application..."
            # Add actual build commands here
            echo "  ✅ API deployment successful"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            DEPLOYED_DOMAINS="$DEPLOYED_DOMAINS,$domain"
          elif [ "$domain" = "web" ]; then
            echo "  🔧 Building Web application..."
            # Add actual build commands here
            echo "  ✅ Web deployment successful"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            DEPLOYED_DOMAINS="$DEPLOYED_DOMAINS,$domain"
          elif [ "$domain" = "libs" ]; then
            echo "  🔧 Building shared libraries..."
            # Add actual build commands here
            echo "  ✅ Libraries deployment successful"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            DEPLOYED_DOMAINS="$DEPLOYED_DOMAINS,$domain"
          else
            echo "  ⚠️  Unknown domain: $domain - skipping"
          fi
        done <<< "$DOMAIN_LIST"
        
        # Clean up deployed domains list
        DEPLOYED_DOMAINS=$(echo "$DEPLOYED_DOMAINS" | sed 's/^,//')
        
        # Set outputs
        if [ $SUCCESS_COUNT -eq $TOTAL_COUNT ]; then
          echo "status=success" >> $GITHUB_OUTPUT
        else
          echo "status=partial" >> $GITHUB_OUTPUT
        fi
        
        echo "domains=$DEPLOYED_DOMAINS" >> $GITHUB_OUTPUT
        
        echo "📊 Deployment Summary:"
        echo "  ✅ Successful: $SUCCESS_COUNT/$TOTAL_COUNT"
        echo "  📦 Deployed domains: $DEPLOYED_DOMAINS"

    - name: Deployment Summary
      run: |
        STATUS="\${{ steps.deploy.outputs.status }}"
        DOMAINS="\${{ steps.deploy.outputs.domains }}"
        
        case "$STATUS" in
          "success")
            echo "🎉 All deployments successful!"
            echo "📦 Deployed domains: $DOMAINS"
            ;;
          "partial")
            echo "⚠️  Some deployments failed"
            echo "📦 Deployed domains: $DOMAINS"
            ;;
          *)
            echo "❌ Deployment failed"
            ;;
        esac`

export const generate = (ctx: PinionContext) =>
  Promise.resolve(ctx)
    .then(renderTemplate(appsWorkflowTemplate, toFile('.github/workflows/job._apps.yml')))
