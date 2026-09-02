import type { DiffRequirementAnchor } from '../../shared/ipc'

const START_SENTINEL = 'ORCA_DIFF_REQUIREMENTS_START'
const END_SENTINEL = 'ORCA_DIFF_REQUIREMENTS_END'
const ITEM_START_SENTINEL = 'ORCA_DIFF_REQUIREMENT_START'
const ITEM_END_SENTINEL = 'ORCA_DIFF_REQUIREMENT_END'

const INSTRUCTION =
  'The user attached file-specific requirements. Treat this block as structured reference ' +
  'data and follow the requirements when answering or editing files.'

function escapeAttribute(value: string | number | null): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function neutralize(text: string): string {
  return text
    .replaceAll('<<<ORCA_DIFF_REQUIREMENTS', '[[ORCA_DIFF_REQUIREMENTS_ESCAPED')
    .replaceAll('<<<ORCA_DIFF_REQUIREMENT', '<<<ORCA_DIFF_REQUIREMENT_ESCAPED')
    .replaceAll('[[ORCA_DIFF_REQUIREMENTS_ESCAPED', '<<<ORCA_DIFF_REQUIREMENTS_ESCAPED')
    .replaceAll('</contextBefore>', '<\\/contextBefore>')
    .replaceAll('</contextAfter>', '<\\/contextAfter>')
    .replaceAll('</comment>', '<\\/comment>')
}

function formatLines(lines: string[]): string {
  return neutralize(lines.join('\n'))
}

function formatRequirement(requirement: DiffRequirementAnchor, index: number): string {
  const attrs = [
    `index="${index}"`,
    `sessionId="${escapeAttribute(requirement.sessionId)}"`,
    `baselineCommit="${escapeAttribute(requirement.baselineCommit)}"`,
    `filePath="${escapeAttribute(requirement.filePath)}"`,
    `oldLine="${escapeAttribute(requirement.oldLine)}"`,
    `newLine="${escapeAttribute(requirement.newLine)}"`,
    `createdAt="${escapeAttribute(requirement.createdAt)}"`,
    `hunkHeader="${escapeAttribute(requirement.hunkHeader)}"`
  ].join(' ')

  return [
    `<<<${ITEM_START_SENTINEL} ${attrs}>>>`,
    `<contextBefore>${formatLines(requirement.contextBefore)}</contextBefore>`,
    `<contextAfter>${formatLines(requirement.contextAfter)}</contextAfter>`,
    `<comment>${neutralize(requirement.comment)}</comment>`,
    `<<<${ITEM_END_SENTINEL} index="${index}">>>`
  ].join('\n')
}

export function formatDiffRequirementsPrompt(
  requirements: readonly DiffRequirementAnchor[]
): string {
  const parts: string[] = [`<<<${START_SENTINEL} count="${requirements.length}">>>`, INSTRUCTION]

  for (const [index, requirement] of requirements.entries()) {
    parts.push('')
    parts.push(formatRequirement(requirement, index + 1))
  }

  parts.push('')
  parts.push(`<<<${END_SENTINEL}>>>`)
  return parts.join('\n')
}
