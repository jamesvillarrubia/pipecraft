/**
 * Utility functions for formatting YAML content in GitHub Actions workflows
 */

/**
 * Formats long GitHub Actions conditional expressions for better readability.
 * Takes a YAML string and formats multi-line `if:` conditions with proper indentation.
 *
 * @param yamlContent - The YAML content to format
 * @param minLength - Minimum length threshold for formatting (default: 80 characters)
 * @returns Formatted YAML content
 *
 * @example
 * Input:
 *   if: ${{ always() && github.event_name != 'pull_request' && needs.test.result == 'success' }}
 *
 * Output:
 *   if: ${{
 *       always() &&
 *       github.event_name != 'pull_request' &&
 *       needs.test.result == 'success'
 *     }}
 */
export function formatIfConditions(yamlContent: string, minLength: number = 80): string {
  return yamlContent.replace(
    /if: \$\{\{([^}]+)\}\}/g,
    (match, condition) => {
      // Only format if the condition is long enough to benefit from formatting
      if (condition.length < minLength) return match

      let formatted = condition.trim()

      // Step 1: Protect function calls like always() by replacing with placeholders
      const functionCalls: string[] = []
      formatted = formatted.replace(/(\w+)\(\)/g, (match: string) => {
        const placeholder = `__FUNC_${functionCalls.length}__`
        functionCalls.push(match)
        return placeholder
      })

      // Step 2: Add line breaks for logical operators
      formatted = formatted.replace(/\s+&&\s+/g, ' &&\n        ')
      formatted = formatted.replace(/\s+\|\|\s+/g, ' ||\n        ')

      // Step 3: Format grouping parentheses (now that function calls are protected)
      formatted = formatted.replace(/\(\s*/g, '(\n        ')
      formatted = formatted.replace(/\s*\)\s*(&&|\|\|)/g, '\n      ) $1')
      formatted = formatted.replace(/\s*\)(\s*)$/g, '\n      )')

      // Step 4: Restore function calls
      functionCalls.forEach((funcCall, index) => {
        formatted = formatted.replace(`__FUNC_${index}__`, funcCall)
      })

      return `if: $\{{\n        ${formatted}\n      }}`
    }
  )
}
