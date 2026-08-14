// Orca config 루트 경로 헬퍼. 사람이 편집하는 정규 소스(sources/)와 엔진별 배포 산출물(dist/<engine>/)을
// DB/settings 의 <userData> 와 분리해 ~/.config/orca 아래 둔다 (제안서 명시 — 사용자가 직접 편집·버전관리
// 가능한 "설정 소스" 성격). 비밀은 여기 두지 않는다(secret-store 가 <userData> 의 safeStorage 로 보관).
//
// 표준화 계층(arch/backend/standardization.md §5.1):
//   ~/.config/orca/
//   ├── orca.json                       # 앱 전역 설정(env 만 — agents 는 handoff 0014 에서 제거).
//   ├── sources/                        # 사람이 편집하는 단일 원천 (instructions/AGENTS.md · skills ·
//   │   ├── mcp/mcp.json                #   agents · commands · mcp/mcp.json · hooks/<engine> ·
//   │   └── settings/<adapter>/         #   settings/<adapter>/<provider>/settings.json)
//   ├── dist/<engine>/                  # deployer 산출 (읽기 전용)
//   │   └── plugins/orca/               #   Claude Code plugin(.claude-plugin, skills, agents, hooks, .mcp.json)
//   │   └── plugins/claude/             #   사용자 ~/.claude/skills 래퍼 plugin(.claude-plugin + skills 정션/심링크, 0117)
//   └── projects/                       # 세션 작업 디렉토리(cwd) 루트 — 확장 파일을 복사하지 않는다.
//       ├── default/                    #   비-프로젝트 / cwd 미지정 세션 공용 cwd
//       └── <이름>-<프로젝트ID8>/        #   프로젝트 소속 세션 cwd (future: 절대경로 지정값으로 대체 가능)
//
// 본 파일은 *다른 모듈이 실제로 참조하는* 경로만 노출한다. 런타임 settings 는 dist 가 아니라
// sources/settings/<adapter>/<provider>/settings.json 을 해석해 query flag 로 주입한다. MCP 는 query 전
// 확장된 plugin .mcp.json 으로 렌더되므로 dist 산출물에 평문 비밀이 포함될 수 있다.

import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'

// 모든 OS 동일하게 ~/.config/orca (제안서 §환경구성). Windows 에서도 homedir() 하위로 통일.
export function orcaConfigDir(): string {
  return join(homedir(), '.config', 'orca')
}

// dev(`npm run dev`) 전용 userData 디렉토리 — prod `<appData>/orca` 와 sibling `<appData>/orca-dev`.
// userData 는 Electron 이 app.getName()(dev·prod 모두 `orca`)에서 파생하므로 기본값은 dev·prod 가
// 같은 폴더를 공유한다. dev 에서만 여기로 리디렉션해 DB·WAL·마이그레이션 백업·secret-store 를 통째로
// 격리한다(개발 중 마이그레이션/데이터 변경이 실제 설치본을 오염시키지 않도록). 호출은 index.ts 가
// import.meta.env.DEV 게이트로 감싸 prod 번들에서 dead-code 제거되게 한다.
export function devUserDataDir(appDataDir: string): string {
  return join(appDataDir, 'orca-dev')
}

// 정규 소스 루트(사람 편집 SSOT).
function sourcesDir(): string {
  return join(orcaConfigDir(), 'sources')
}

// Orca 앱 자체 전역 설정 파일. sources/ 는 엔진별 배포 리소스 SSOT 이고, orca.json 은
// 앱 부팅 시 1회 로드되는 전역 agent/provider 설정이다.
export function orcaJsonPath(): string {
  return join(orcaConfigDir(), 'orca.json')
}

export function sourcesSkillsDir(): string {
  return join(sourcesDir(), 'skills')
}

// 모든 세션 cwd 의 단일 루트. default/ 와 프로젝트별 디렉토리가 여기 산다.
export function projectsDir(): string {
  return join(orcaConfigDir(), 'projects')
}

// connector 플러그인이 내려받은 파일의 루트 (0160). `orcaConfigDir()` 하위인 것이 중요하다 —
// workspace-guard 의 `readOnlyExceptionRoots()` 가 이 루트를 이미 포함하므로, 도구가 경로만
// 반환해도 모델이 `Read`/`Grep` 으로 결과물을 읽을 수 있다. 세션 cwd 가 아니라 여기 두는 이유는
// 연결이 앱 전역이고 도구 컨텍스트에 cwd 가 없기 때문이다(`adapters/runtime-tools.ts`).
export function downloadsDir(): string {
  return join(orcaConfigDir(), 'downloads')
}

// child 가 parent 내부(또는 동일)인지 — 정규화 후 상대경로가 '..' 로 빠져나가거나
// 다른 절대경로면 false. files:openPath 경로 화이트리스트 등에 쓰는 순수 술어.
export function isWithinDir(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

// 프로젝트명을 디렉토리 세그먼트로 안전화. 공백류→'_'(사용자 의도), 그 외 비안전 문자→'-',
// 양끝 구두점 정리, 길이 cap. 빈 결과는 'project' 폴백.
export function safeProjectName(name: string): string {
  const safe = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 40)
  return safe === '' ? 'project' : safe
}

// 프로젝트 ID 단축(git short-hash 風) — 하이픈 제거 후 앞 8자. 이름 충돌 시 디렉토리 구분자.
export function shortProjectId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8)
}

// 프로젝트 소속 세션의 파생 디렉토리명: `<안전화한 이름>-<프로젝트ID8>`.
export function workspaceDirName(project: { id: string; name: string }): string {
  return `${safeProjectName(project.name)}-${shortProjectId(project.id)}`
}

// 세션 cwd 단일 해석기. 프로젝트 미소속이면 projects/default, 소속이면 파생 디렉토리.
// cwd 는 future scope(절대경로 지정) — 값이 있으면 파생값보다 우선한다(지금은 항상 미설정).
export function getWorkspacePath(
  project?: { id: string; name: string; cwd?: string | null } | null
): string {
  let dir: string
  if (!project) dir = join(projectsDir(), 'default')
  else if (project.cwd) dir = project.cwd
  else dir = join(projectsDir(), workspaceDirName(project))
  mkdirSync(dir, { recursive: true })
  return dir
}

function sourcesMcpDir(): string {
  return join(sourcesDir(), 'mcp')
}

// MCP 정규 소스. mcp/mcp.json = 순정 Claude mcpServers 스키마 + ${VAR} 플레이스홀더(평문 비밀 0).
export function mcpJsonPath(): string {
  return join(sourcesMcpDir(), 'mcp.json')
}

// 개별 플러그인 루트(dist/<engine>/plugins/<name>)는 여기서 제공하지 않는다 — 레이아웃과
// 이름의 소유자는 features/extensions/{harness-plugins/claude,claude-user-skills-plugin}.ts 의
// builtInHarnessPluginRoot/userClaudePluginRoot 다(경로 지식 이중 정의 방지, /simplify 0120).

// 부팅 시 1회. mkdir -p 의미 (recursive). 이미 있으면 무시.
export async function ensureConfigDir(): Promise<void> {
  await mkdir(orcaConfigDir(), { recursive: true })
}
