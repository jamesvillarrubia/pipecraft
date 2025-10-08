#!/usr/bin/env node

import { runModule } from '@featherscloud/pinion'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load test configuration with multiple domains
const config = JSON.parse(readFileSync(join(__dirname, 'tests/__fixtures__/basic-config.json'), 'utf8'))

// Add more domains to test dynamic generation
config.domains = {
  api: {
    paths: ["apps/api/**"],
    description: "API application changes"
  },
  web: {
    paths: ["apps/web/**"],
    description: "Web application changes"
  },
  libs: {
    paths: ["libs/**"],
    description: "Shared libraries changes"
  },
  mobile: {
    paths: ["apps/mobile/**"],
    description: "Mobile application changes"
  },
  cicd: {
    paths: [".github/**", "*.yml", "*.yaml"],
    description: "CI/CD configuration changes"
  }
}

// Create a minimal existing pipeline file to test injection
const existingPipeline = `name: My Custom Pipeline

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main

jobs:
  # EXISTING: My custom job
  my-custom-job:
    runs-on: ubuntu-latest
    steps:
      - name: Custom step
        run: echo "This is my custom job"
`

async function testDynamicDomains() {
  console.log('🧪 Testing dynamic domain job generation...\n')
  
  try {
    // Create a test pipeline file
    const testPipelinePath = join(process.cwd(), '.github/workflows/pipeline.yml')
    writeFileSync(testPipelinePath, existingPipeline)
    console.log('📄 Created test pipeline file with existing content')
    
    console.log('📝 Testing dynamic domain injection...')
    console.log('📋 Domains in config:', Object.keys(config.domains))
    
    await runModule(join(__dirname, 'src/templates/pipeline-injection-anchored.yml.tpl.ts'), {
      cwd: process.cwd(),
      argv: process.argv,
      pinion: {
        logger: {
          ...console,
          notice: console.log
        },
        prompt: (await import('inquirer')).prompt,
        cwd: process.cwd(),
        force: true,
        trace: [],
        exec: async (command, args) => {
          const { spawn } = await import('child_process')
          return new Promise((resolve, reject) => {
            const child = spawn(command, args, { stdio: 'inherit', shell: true })
            child.once('exit', (code) => (code === 0 ? resolve(code) : reject(code)))
          })
        }
      },
      // Pass the config as context
      ...config
    })
    
    console.log('✅ Dynamic domain injection completed successfully')
    
    // Check the result
    const fs = await import('fs')
    if (fs.existsSync(testPipelinePath)) {
      const content = fs.readFileSync(testPipelinePath, 'utf8')
      console.log('📄 Modified pipeline file:')
      console.log('📊 File size:', content.length, 'characters')
      
      // Check if domain-specific jobs were created
      const domains = Object.keys(config.domains).filter(d => d !== 'cicd')
      console.log('\n📋 Generated domain jobs:')
      
      for (const domain of domains) {
        if (content.includes(`${domain}-test:`)) {
          console.log(`  ✅ ${domain}-test job created`)
        }
        if (content.includes(`${domain}-deploy:`)) {
          console.log(`  ✅ ${domain}-deploy job created`)
        }
        if (content.includes(`job.app.${domain}.test.yml`)) {
          console.log(`  ✅ ${domain} test workflow reference created`)
        }
        if (content.includes(`job.app.${domain}.deploy.yml`)) {
          console.log(`  ✅ ${domain} deploy workflow reference created`)
        }
      }
      
      // Check if cicd domain was excluded
      if (!content.includes('cicd-test:') && !content.includes('cicd-deploy:')) {
        console.log('  ✅ cicd domain correctly excluded from test/deploy jobs')
      }
      
      // Show a sample of the generated jobs
      console.log('\n📋 Sample generated test jobs:')
      const lines = content.split('\n')
      const testJobLines = lines.filter(line => line.includes('-test:') && line.includes('FLOWCRAFT'))
      testJobLines.slice(0, 3).forEach(line => console.log('  ' + line.trim()))
      
      console.log('\n📋 Sample generated deploy jobs:')
      const deployJobLines = lines.filter(line => line.includes('-deploy:') && line.includes('FLOWCRAFT'))
      deployJobLines.slice(0, 3).forEach(line => console.log('  ' + line.trim()))
    }
    
  } catch (error) {
    console.error('❌ Dynamic domain injection failed:', error.message)
  }
  
  console.log('\n🎉 Dynamic domain test completed!')
}

testDynamicDomains().catch(console.error)
