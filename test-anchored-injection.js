#!/usr/bin/env node

import { runModule } from '@featherscloud/pinion'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load test configuration
const config = JSON.parse(readFileSync(join(__dirname, 'tests/fixtures/basic-config.json'), 'utf8'))

// Create a pipeline file with some existing jobs to test injection
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
  
  # EXISTING: Another custom job
  another-job:
    runs-on: ubuntu-latest
    steps:
      - name: Another step
        run: echo "Another custom job"
`

async function testAnchoredInjection() {
  console.log('🧪 Testing anchored pipeline injection...\n')
  
  try {
    // Create a test pipeline file
    const testPipelinePath = join(process.cwd(), '.github/workflows/pipeline.yml')
    writeFileSync(testPipelinePath, existingPipeline)
    console.log('📄 Created test pipeline file with existing content')
    
    console.log('📝 Testing anchored injection...')
    
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
    
    console.log('✅ Anchored injection completed successfully')
    
    // Check the result
    const fs = await import('fs')
    if (fs.existsSync(testPipelinePath)) {
      const content = fs.readFileSync(testPipelinePath, 'utf8')
      console.log('📄 Modified pipeline file:')
      console.log('📊 File size:', content.length, 'characters')
      
      // Check if specific sections were added with proper anchors
      if (content.includes("# FLOWCRAFT: ENV CHECK")) {
        console.log('✅ FLOWCRAFT env-check section was added with anchor')
      }
      if (content.includes("# FLOWCRAFT: LINTING")) {
        console.log('✅ FLOWCRAFT linting section was added with anchor')
      }
      if (content.includes("# FLOWCRAFT: CHANGE DETECTION")) {
        console.log('✅ FLOWCRAFT changes section was added with anchor')
      }
      if (content.includes("# FLOWCRAFT: SECURITY")) {
        console.log('✅ FLOWCRAFT security section was added with anchor')
      }
      if (content.includes("# FLOWCRAFT: TESTING")) {
        console.log('✅ FLOWCRAFT testing section was added with anchor')
      }
      if (content.includes("# FLOWCRAFT: VERSIONING")) {
        console.log('✅ FLOWCRAFT versioning section was added with anchor')
      }
      if (content.includes("# FLOWCRAFT: DEPLOYMENTS")) {
        console.log('✅ FLOWCRAFT deployments section was added with anchor')
      }
      if (content.includes("# FLOWCRAFT: RELEASE MANAGEMENT")) {
        console.log('✅ FLOWCRAFT release section was added with anchor')
      }
      if (content.includes("# EXISTING: My custom job")) {
        console.log('✅ Original custom jobs were preserved')
      }
      
      console.log('\n📋 Final pipeline structure:')
      const lines = content.split('\n')
      const jobLines = lines.filter(line => line.includes('# FLOWCRAFT:') || line.includes('# EXISTING:'))
      jobLines.forEach(line => console.log('  ' + line.trim()))
    }
    
  } catch (error) {
    console.error('❌ Anchored injection failed:', error.message)
  }
  
  console.log('\n🎉 Anchored injection test completed!')
}

testAnchoredInjection().catch(console.error)
