// Discovery 분류와 권한 판정이 같은 계열을 인식한다. 기본 alias 목록과는 별개다.
export const CLAUDE_MODEL_FAMILIES = ['sonnet', 'opus', 'haiku', 'fable'] as const

export const CLAUDE_NAME_FAMILIES = [...CLAUDE_MODEL_FAMILIES, 'mythos'] as const
export type ClaudeNameFamily = (typeof CLAUDE_NAME_FAMILIES)[number]

export interface ClaudeModelVersion {
  readonly major: number
  readonly minor: number
}

export interface ClaudeModelName {
  readonly family: ClaudeNameFamily
  readonly version?: ClaudeModelVersion
}

const CLAUDE_NAME_PATTERN = new RegExp(
  `(?:^|[^a-z])(${CLAUDE_NAME_FAMILIES.join('|')})(?![a-z])`,
  'i'
)

// Context policy and effort defaults share family/version parsing. Permission eligibility
// remains stricter: gateway names and bare aliases are not evidence for auto permission.
export function parseClaudeModelName(model: string): ClaudeModelName | undefined {
  const name = model.replace(/\[1m\]/gi, '').toLowerCase()
  const match = CLAUDE_NAME_PATTERN.exec(name)
  if (!match) return undefined
  const family = match[1] as ClaudeNameFamily
  const familyStart = match.index + match[0].length - family.length
  const after = name.slice(familyStart + family.length)
  const before = name.slice(0, familyStart)
  // A date is not a minor version: 4-20250514 means 4.0, not 4.20.
  const version =
    /^[-_.:/@ ]*(\d)(?!\d)(?:[-_.](\d{1,2})(?!\d))?/.exec(after) ??
    /(\d)[-_.](\d{1,2})[-_.]*$/.exec(before)
  return {
    family,
    ...(version ? { version: { major: Number(version[1]), minor: Number(version[2] ?? 0) } } : {})
  }
}

const AUTO_PERMISSION_MODEL_PATTERN = new RegExp(
  String.raw`^(?:(?:(?:us|eu|apac|global)\.)?anthropic[./])?claude(?:code)?-(?:${CLAUDE_MODEL_FAMILIES.join('|')})-(\d+)(?:[.-](\d{1,2}))?(?:-\d{8})?(?:-v\d+(?::\d+)?)?$`,
  'i'
)

// 자동 승인은 명시적으로 버전을 아는 Claude만 허용한다. alias/커스텀 provider 이름을
// 최신 모델의 증거로 사용하지 않는다. 날짜 접미사는 minor 버전이 아니다.
export function supportsAutoPermission(modelName: string | null | undefined): boolean {
  if (!modelName) return false
  const name = modelName.trim().replace(/\[1m\]$/i, '')
  const match = AUTO_PERMISSION_MODEL_PATTERN.exec(name)
  if (!match) return false
  const major = Number(match[1])
  const minor = Number(match[2] ?? '0')
  return major > 4 || (major === 4 && minor > 5)
}
