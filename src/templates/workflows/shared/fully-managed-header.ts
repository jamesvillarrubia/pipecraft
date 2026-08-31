/**
 * Header for workflows Pipecraft renders whole from config.
 *
 * `pipeline.yml` announces itself as managed and lists what it preserves, so a reader
 * reasonably takes an unlabelled workflow to be theirs. `enforce-pr-target.yml` and
 * `pr-title-check.yml` carried no such notice while Pinion was skipping them on
 * regeneration, which made hand-editing look safe. They are rewritten on every generate
 * as of v0.43.2, so the file has to say so.
 *
 * Unlike pipeline.yml there are no preserved regions here: the whole file is replaced.
 *
 * @module templates/workflows/shared/fully-managed-header
 */

/**
 * Build the comment block that opens a fully-generated workflow.
 *
 * @param derivedFrom - Config keys this workflow's content comes from, for the reader who
 *   wants to know which knob to turn instead of editing the file.
 */
export function fullyManagedHeader(derivedFrom: string[]): string {
  const sources = derivedFrom.map(key => `#   - ${key}`).join('\n')

  return `#=============================================================================
# PIPECRAFT MANAGED WORKFLOW
#=============================================================================
#
# 🔒 THIS ENTIRE FILE IS GENERATED. Edits are overwritten on the next
#    'pipecraft generate'. Unlike pipeline.yml, nothing here is preserved.
#
# ⚙️  Generated from your .pipecraftrc:
${sources}
#
# ✏️  To change this workflow, change the config above and regenerate. To add
#    checks of your own, put them in a separate workflow file.
#=============================================================================
`
}
