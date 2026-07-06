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
  // 활성 프로젝트 지침(DB). projectName 이 있고 trim 후 비지 않을 때만 'Project instructions:' 로
  // 편입. projectName 이 없으면(프로젝트 없음) 지침도 함께 제외한다.
  projectInstructions?: string
}

const ORCA_IDENTITY =
  'You are running inside Orca — a Windows desktop app for engineers and AI beginners, ' +
  'not a terminal CLI. Responses render as rich markdown in a GUI transcript.'

// # Tools — 도구-사용 정책(opencode anthropic.txt "Tool usage policy" 를 Orca 격리 환경에 맞춰
// 적용, handoff 0075 후속). 핵심 두 가지:
//   1) 파일 작업은 전용 툴(Read/Write/Edit)로 — cat/sed/echo 같은 Bash 우회를 막는다. 전용 툴은
//      workspace 가드(adapters/workspace-guard.ts)가 실제로 경로 격리를 강제하므로, 파일 작업을
//      이쪽으로 몰면 격리가 자동 성립한다.
//   2) Bash 는 경로 격리를 코드로 강제할 수 없다(정적 스크리닝 제거 — 실효 없음). 그래서 프롬프트로
//      "workspace 안으로 스코프하라"를 명시한다 — Bash 격리의 유일한 레버.
// 항상 포함(정적 상수). 영어(헤더 규약).
export const TOOLS_SECTION =
  '# Tools\n' +
  'Prefer dedicated file tools over shell commands: use Read to read files (not cat/head/tail), ' +
  'Edit to modify files (not sed/awk), and Write to create files (not echo redirection or heredocs). ' +
  'Reserve the Bash tool for operations that genuinely need a shell, such as builds, tests, package ' +
  'managers, and version control. Never use Bash echo or other shell tricks to communicate with the ' +
  'user; put all explanations in your response text.\n' +
  'Work only inside the current working directory (the workspace). The file tools (Read, Write, Edit, ' +
  'Glob, Grep) are restricted to it and are denied for paths outside it. Bash is not path-restricted, ' +
  'so you must keep every command scoped to the workspace yourself — do not read, write, or execute ' +
  'against paths outside it. Routing file work through the dedicated tools keeps you inside the ' +
  'workspace automatically.'

// 변동성 낮은 순서(Orca → User → Project)로 섹션을 조립한다. Orca 섹션은 항상, User/Project 는
// 채울 필드가 있을 때만 포함한다.
export function buildSystemHeader(input: SystemHeaderInput): string {
  const sections: string[] = []

  // # Orca — 정체성 framing + 버전 (항상).
  sections.push(`# Orca\n${ORCA_IDENTITY}\nOrca version: ${input.orcaVersion}`)

  // # Tools — 도구-사용 정책 (항상). 파일 작업을 전용 툴로 몰아 workspace 가드가 격리를 강제하게 하고,
  // Bash 는 프롬프트로 workspace 스코프를 유도한다(0075 후속).
  sections.push(TOOLS_SECTION)

  // # User — 선호 언어 + 계정 지침 (있는 줄만).
  const userLines: string[] = []
  const language = input.language?.trim()
  if (language) userLines.push(`Preferred language: ${language}`)
  const accountInstructions = input.accountInstructions?.trim()
  if (accountInstructions) userLines.push(`Account instructions: ${accountInstructions}`)
  if (userLines.length > 0) sections.push(`# User\n${userLines.join('\n')}`)

  // # Project — 활성 프로젝트 이름 + 지침 (프로젝트 있을 때만). projectName 부재 = 프로젝트 없음
  // → 섹션 통째 생략(지침도 함께). 지침은 다줄 가능이라 라벨 줄 + 다음 줄부터 본문.
  const projectName = input.projectName?.trim()
  if (projectName) {
    const projectLines = [`Active project: ${projectName}`]
    const projectInstructions = input.projectInstructions?.trim()
    if (projectInstructions) projectLines.push(`Project instructions:\n${projectInstructions}`)
    sections.push(`# Project\n${projectLines.join('\n')}`)
  }

  return sections.join('\n\n')
}
