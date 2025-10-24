import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd || process.cwd(),
      ...options
    })
  } catch (error) {
    if (options.throwOnError !== false) {
      throw error
    }
    return null
  }
}

export async function checkNxSetup() {
  console.log('🔍 Checking Nx setup...')

  const checks = {
    nxJsonExists: false,
    packageJsonExists: false,
    libsExist: false,
    appsExist: false
  }

  try {
    await fs.access('nx.json')
    checks.nxJsonExists = true
    console.log('  ✅ nx.json found')
  } catch {
    console.log('  ❌ nx.json not found')
  }

  try {
    await fs.access('package.json')
    checks.packageJsonExists = true
    console.log('  ✅ package.json found')
  } catch {
    console.log('  ❌ package.json not found')
  }

  try {
    const libsStat = await fs.stat('libs')
    checks.libsExist = libsStat.isDirectory()
    console.log('  ✅ libs/ directory found')
  } catch {
    console.log('  ❌ libs/ directory not found')
  }

  try {
    const appsStat = await fs.stat('apps')
    checks.appsExist = appsStat.isDirectory()
    console.log('  ✅ apps/ directory found')
  } catch {
    console.log('  ❌ apps/ directory not found')
  }

  const allChecksPass = Object.values(checks).every(Boolean)

  if (allChecksPass) {
    console.log('✅ Nx setup verified')
  } else {
    console.log('⚠️  Nx setup incomplete')
  }

  return { success: allChecksPass, checks }
}

export async function runPipecraftInit() {
  console.log('🚀 Running pipecraft init...')

  const config = {
    branchFlow: ['develop', 'staging', 'main'],
    domains: {
      'nx-apps': {
        paths: ['apps/**'],
        description: 'Nx workspace applications',
        tasks: ['build', 'test', 'integration-test'],
        testable: true,
        deployable: true
      },
      'nx-libs': {
        paths: ['libs/**'],
        description: 'Nx workspace libraries',
        tasks: ['build', 'test'],
        testable: true,
        deployable: false
      },
      'infra-pulumi': {
        paths: ['infra/pulumi/**'],
        description: 'Pulumi infrastructure code',
        tasks: ['preview', 'up'],
        testable: false,
        deployable: true
      },
      'infra-kubernetes': {
        paths: ['infra/kubernetes/**'],
        description: 'Kubernetes manifests',
        tasks: ['validate', 'apply'],
        testable: false,
        deployable: true
      },
      'migrations': {
        paths: ['migrations/**'],
        description: 'Database migrations',
        tasks: ['migrate'],
        testable: false,
        deployable: false
      }
    }
  }

  const configPath = '.pipecraftrc.json'
  await fs.writeFile(configPath, JSON.stringify(config, null, 2))

  console.log('  ✅ Created .pipecraftrc.json')
  return { success: true, configPath }
}

export async function runPipecraftGenerate() {
  console.log('🔨 Running pipecraft generate...')

  const startTime = Date.now()

  try {
    const output = exec('npx pipecraft generate', { cwd: '../../../', silent: false, throwOnError: true })
    const duration = Date.now() - startTime

    console.log(`  ✅ Generate completed in ${duration}ms`)

    return {
      success: true,
      duration,
      output: output || ''
    }
  } catch (error) {
    const duration = Date.now() - startTime

    console.log(`  ❌ Generate failed after ${duration}ms`)
    console.error('Error:', error.message)

    return {
      success: false,
      duration,
      error: error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    }
  }
}

export async function captureGeneratedFiles() {
  console.log('📦 Capturing generated files...')

  const files = []

  try {
    const workflowDir = '.github/workflows'
    const workflowFiles = await fs.readdir(workflowDir)

    for (const file of workflowFiles) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const filePath = path.join(workflowDir, file)
        const content = await fs.readFile(filePath, 'utf8')
        files.push({ path: filePath, content })
      }
    }

    console.log(`  ✅ Captured ${files.length} workflow files`)
  } catch (error) {
    console.log('  ⚠️  No workflows found')
  }

  return files
}

export async function cleanPipecraftFiles() {
  console.log('🧹 Cleaning PipeCraft generated files...')

  const filesToClean = [
    '.github/workflows/pipeline.yml',
    '.github/workflows/deploy-develop.yml',
    '.github/workflows/deploy-staging.yml',
    '.github/workflows/deploy-main.yml',
    '.github/actions/detect-changes/action.yml',
    '.pipecraftrc.json'
  ]

  let cleaned = 0

  for (const file of filesToClean) {
    try {
      await fs.unlink(file)
      console.log(`  ✅ Deleted ${file}`)
      cleaned++
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log(`  ⚠️  Could not delete ${file}: ${error.message}`)
      }
    }
  }

  console.log(`  ✅ Cleaned ${cleaned} files`)
  return { cleaned, total: filesToClean.length }
}

export async function getPipecraftVersion() {
  try {
    const output = exec('npx pipecraft --version', { silent: true, cwd: '../../../' })
    return output.trim()
  } catch {
    return 'unknown'
  }
}
