import { generator, renderTemplate, toFile, readFile, writeFile } from '@featherscloud/pinion'
import { cosmiconfigSync } from 'cosmiconfig'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Load configuration using cosmiconfig
 * @param {string} configPath - Path to the configuration file
 * @returns {Object} Configuration object
 */
export const loadConfig = async (configPath = '.trunkflowrc.json') => {
  try {
    const explorer = cosmiconfigSync('trunkflow')
    const result = explorer.search()
    
    if (!result) {
      throw new Error(`No configuration file found. Expected: ${configPath}`)
    }
    
    return result.config
  } catch (error) {
    console.error(`Failed to load config:`, error.message)
    throw error
  }
}

/**
 * Generate all workflow files from configuration
 * @param {string} configPath - Path to the configuration file
 * @param {string} outputDir - Directory where to write the generated workflows
 */
export const generateAllWorkflows = async (configPath, outputDir = '.github/workflows') => {
  try {
    const config = await loadConfig(configPath)
    
    if (!config.domains) {
      throw new Error('Configuration must include a "domains" section')
    }

    if (!config.branchFlow || !Array.isArray(config.branchFlow)) {
      throw new Error('Configuration must include a "branchFlow" array')
    }

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    const context = {
      domains: config.domains,
      branchFlow: config.branchFlow,
      ciProvider: config.ciProvider || 'github',
      mergeStrategy: config.mergeStrategy || 'fast-forward',
      requireConventionalCommits: config.requireConventionalCommits !== false
    }

    // Generate individual job workflows
    const jobTemplates = [
      'changes',
      'version', 
      'tag',
      'createpr',
      'branch',
      'apps'
    ]

    for (const jobName of jobTemplates) {
      const templatePath = join(__dirname, '../../templates/jobs', `${jobName}.yml.template`)
      const outputPath = join(outputDir, `job.${jobName}.yml`)
      
      if (existsSync(templatePath)) {
        const template = await readFile(templatePath, 'utf8')
        const rendered = renderTemplateFromString(template, context)
        await writeFile(outputPath, rendered)
        console.log(`✅ Generated job.${jobName}.yml`)
      } else {
        console.warn(`⚠️  Template not found: ${templatePath}`)
      }
    }

    // Generate main pipeline
    const pipelineTemplatePath = join(__dirname, '../../templates/pipeline.yml.template')
    const pipelineOutputPath = join(outputDir, 'pipeline.yml')
    
    if (existsSync(pipelineTemplatePath)) {
      const template = await readFile(pipelineTemplatePath, 'utf8')
      const rendered = renderTemplateFromString(template, context)
      await writeFile(pipelineOutputPath, rendered)
      console.log(`✅ Generated pipeline.yml`)
    } else {
      console.warn(`⚠️  Pipeline template not found: ${pipelineTemplatePath}`)
    }

    console.log(`🎉 Successfully generated all workflow files in ${outputDir}`)
    
  } catch (error) {
    console.error('❌ Failed to generate workflows:', error.message)
    throw error
  }
}

/**
 * Simple template renderer for EJS-style templates
 * @param {string} template - Template string
 * @param {Object} context - Context object with variables
 * @returns {string} Rendered template
 */
const renderTemplateFromString = (template, context) => {
  let rendered = template
  
  // Handle simple variable substitution
  Object.entries(context).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const regex = new RegExp(`<%= ${key} %>`, 'g')
      rendered = rendered.replace(regex, value)
    }
  })
  
  // Handle JSON.stringify
  rendered = rendered.replace(/<%= JSON\.stringify\(([^)]+)\) %>/g, (match, expr) => {
    try {
      const value = eval(`context.${expr}`)
      return JSON.stringify(value)
    } catch (error) {
      console.warn(`Warning: Could not evaluate ${expr}`)
      return 'null'
    }
  })
  
  // Handle for loops
  rendered = rendered.replace(/<% for \(const \[([^,]+), ([^)]+)\] of Object\.entries\(([^)]+)\)\) { -%>([\s\S]*?)<% } -%>/g, (match, keyVar, valueVar, objectExpr, loopContent) => {
    try {
      const object = eval(`context.${objectExpr}`)
      if (!object || typeof object !== 'object') return ''
      
      return Object.entries(object).map(([key, value]) => {
        const contextWithLoop = { ...context, [keyVar]: key, [valueVar]: value }
        return renderTemplateFromString(loopContent, contextWithLoop)
      }).join('')
    } catch (error) {
      console.warn(`Warning: Could not evaluate loop for ${objectExpr}`)
      return ''
    }
  })
  
  // Handle for loops with arrays
  rendered = rendered.replace(/<% for \(const (\w+) of ([^)]+)\) { -%>([\s\S]*?)<% } -%>/g, (match, itemVar, arrayExpr, loopContent) => {
    try {
      const array = eval(`context.${arrayExpr}`)
      if (!Array.isArray(array)) return ''
      
      return array.map(item => {
        const contextWithLoop = { ...context, [itemVar]: item }
        return renderTemplateFromString(loopContent, contextWithLoop)
      }).join('')
    } catch (error) {
      console.warn(`Warning: Could not evaluate array loop for ${arrayExpr}`)
      return ''
    }
  })
  
  // Handle for loops with index
  rendered = rendered.replace(/<% for \(let i = 0; i < ([^;]+); i\+\+\) { -%>([\s\S]*?)<% } -%>/g, (match, condition, loopContent) => {
    try {
      const arrayLength = eval(`context.${condition}`)
      if (typeof arrayLength !== 'number') return ''
      
      let result = ''
      for (let i = 0; i < arrayLength; i++) {
        const contextWithLoop = { ...context, i }
        result += renderTemplateFromString(loopContent, contextWithLoop)
      }
      return result
    } catch (error) {
      console.warn(`Warning: Could not evaluate indexed loop for ${condition}`)
      return ''
    }
  })
  
  // Handle conditional statements
  rendered = rendered.replace(/<% if \(([^)]+)\) { -%>([\s\S]*?)<% } -%>/g, (match, condition, content) => {
    try {
      const result = eval(`context.${condition}`)
      return result ? renderTemplateFromString(content, context) : ''
    } catch (error) {
      console.warn(`Warning: Could not evaluate condition ${condition}`)
      return ''
    }
  })
  
  // Handle else conditions
  rendered = rendered.replace(/<% } else { -%>([\s\S]*?)<% } -%>/g, (match, content) => {
    // This is a simplified else handler - in a real implementation you'd need more sophisticated parsing
    return renderTemplateFromString(content, context)
  })
  
  return rendered
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.argv[2] || '.trunkflowrc.json'
  const outputDir = process.argv[3] || '.github/workflows'
  
  generateAllWorkflows(configPath, outputDir)
    .catch(process.exit)
}
