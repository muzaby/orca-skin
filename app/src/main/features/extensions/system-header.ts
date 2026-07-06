// 구조화된 시스템 프롬프트 헤더 빌더 — 사용자 정보 + 실행환경 구성을 '# Orca / # User / # Project'
// 마크다운 섹션으로 조립하는 순수 함수. ExtensionBuilder 가 이 헤더를 프로젝트 지침 앞에 붙여
// systemPromptAppend(claude_code preset 뒤 append)로 매 턴 주입한다.
//
// 설계 근거(docs/arch/backend/system-prompt.md · study/opencode·hermes): 정체성/실행환경 framing 을
// 프롬프트 앞에 구조화해 붙인다. Orca 는 excludeDynamicSections:false 라 preset 이 이미
// cwd/platform/date/도구목록 동적섹션을 주입하므로 여기서 재주입하지 않고, preset 이 주지 못하는
// Orca 고유 framing(GUI/markdown 표면) + 사용자/프로젝트 컨텍스트만 얹는다.
//
// 불변식: 반드시 **단일 문자열** 반환(다중 블록 4-블록 버그 회피, system-prompt.md §1). 빈/공백
// 필드는 줄 자체를 생략한다(opencode instruction.ts "빈 조각 제외" 패턴).

export interface SystemHeaderInput {
  // Orca 앱 버전(app.getVersion()). 프로세스 수명 고정.
  orcaVersion: string
  // 선호 언어(settings.language). 없으면 Preferred language 줄 생략.
  language?: string
  // 계정 지침(settings.accountInstructions). trim 후 비면 줄 생략.
  accountInstructions?: string
  // 활성 프로젝트 이름. 세션이 프로젝트에 속할 때만. trim 후 비면 '# Project' 섹션 생략.
  projectName?: string
}

const ORCA_IDENTITY =
  'You are running inside Orca — a Windows desktop app for engineers and AI beginners, ' +
  'not a terminal CLI. Responses render as rich markdown in a GUI transcript.'

// 변동성 낮은 순서(Orca → User → Project)로 섹션을 조립한다. Orca 섹션은 항상, User/Project 는
// 채울 필드가 있을 때만 포함한다.
export function buildSystemHeader(input: SystemHeaderInput): string {
  const sections: string[] = []

  // # Orca — 정체성 framing + 버전 (항상).
  sections.push(`# Orca\n${ORCA_IDENTITY}\nOrca version: ${input.orcaVersion}`)

  // # User — 선호 언어 + 계정 지침 (있는 줄만).
  const userLines: string[] = []
  const language = input.language?.trim()
  if (language) userLines.push(`Preferred language: ${language}`)
  const accountInstructions = input.accountInstructions?.trim()
  if (accountInstructions) userLines.push(`Account instructions: ${accountInstructions}`)
  if (userLines.length > 0) sections.push(`# User\n${userLines.join('\n')}`)

  // # Project — 활성 프로젝트 이름 (있을 때만).
  const projectName = input.projectName?.trim()
  if (projectName) sections.push(`# Project\nActive project: ${projectName}`)

  return sections.join('\n\n')
}
