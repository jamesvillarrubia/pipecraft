/**
 * Simple section-based pipeline management
 * Uses comment boundaries to define logical sections
 */

export interface PipelineSection {
  name: string
  content: string
  type: 'template' | 'user' | 'mixed'
  commentHeader: string
}

/**
 * Section definitions based on comment boundaries
 */
export const PIPELINE_SECTIONS = {
  // Template-managed sections (always use latest template)
  'CHANGES DETECTION': 'template',
  'VERSIONING': 'template', 
  'TAG & CREATE PR': 'template',
  
  // User-managed sections (preserve user content)
  'TESTING JOBS': 'user',
  'DEPLOYMENT JOBS': 'user',
  
  // Mixed sections (merge template + user)
  'WORKFLOW INPUTS': 'mixed'
} as const

/**
 * Extract sections from pipeline content based on comment headers
 */
export function extractSections(pipelineContent: string): PipelineSection[] {
  const sections: PipelineSection[] = []
  
  // Split by comment headers
  const sectionRegex = /# =============================================================================\n# ([^#\n]+)\n# =============================================================================/g
  let match
  let lastIndex = 0
  
  while ((match = sectionRegex.exec(pipelineContent)) !== null) {
    const sectionName = match[1].trim()
    const startIndex = match.index
    const endIndex = sectionRegex.lastIndex
    
    // Get content between this section and the next
    const nextMatch = sectionRegex.exec(pipelineContent)
    const contentEnd = nextMatch ? nextMatch.index : pipelineContent.length
    sectionRegex.lastIndex = endIndex // Reset for next iteration
    
    const content = pipelineContent.substring(startIndex, contentEnd)
    const sectionType = PIPELINE_SECTIONS[sectionName as keyof typeof PIPELINE_SECTIONS] || 'user'
    
    sections.push({
      name: sectionName,
      content,
      type: sectionType,
      commentHeader: match[0]
    })
  }
  
  return sections
}

/**
 * Merge template sections with user sections
 */
export function mergeSections(templateSections: PipelineSection[], userSections: PipelineSection[]): PipelineSection[] {
  const merged: PipelineSection[] = []
  const userSectionMap = new Map(userSections.map(s => [s.name, s]))
  
  for (const templateSection of templateSections) {
    const userSection = userSectionMap.get(templateSection.name)
    
    if (templateSection.type === 'template') {
      // Always use template version
      merged.push(templateSection)
    } else if (templateSection.type === 'user') {
      // Use user version if exists, otherwise template
      merged.push(userSection || templateSection)
    } else if (templateSection.type === 'mixed') {
      // Merge template and user content
      if (userSection) {
        merged.push({
          ...templateSection,
          content: mergeMixedContent(templateSection.content, userSection.content)
        })
      } else {
        merged.push(templateSection)
      }
    }
  }
  
  return merged
}

/**
 * Merge mixed content (like workflow inputs)
 */
function mergeMixedContent(templateContent: string, userContent: string): string {
  // Simple merge - in practice you'd want more sophisticated AST merging
  // For now, just use user content if it exists
  return userContent || templateContent
}

/**
 * Reconstruct pipeline from sections
 */
export function reconstructPipeline(sections: PipelineSection[]): string {
  return sections.map(section => section.content).join('\n\n')
}
