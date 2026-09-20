// Orcinus orca config 루트 경로 헬퍼. 사람이 편집하는 정규 소스(sources/)와 엔진별 배포 산출물(dist/<engine>/)을
// DB/settings 의 <userData> 와 분리해 ~/.config/orcinus-orca 아래 둔다 (제안서 명시 — 사용자가 직접 편집·버전관리
// 가능한 "설정 소스" 성격). 비밀은 여기 두지 않는다(secret-store 가 <userData> 의 safeStorage 로 보관).
//
// 표준화 계층(arch/backend/standardization.md §5.1):
//   ~/.config/orcinus-orca/
//   ├── orcinus-orca.json               # 앱 전역 설정(env 만 — agents 는 handoff 0014 에서 제거).
//   ├── sources/                        # 사람이 편집하는 단일 원천 (instructions/AGENTS.md · skills ·
//   │   ├── mcp/mcp.json                #   agents · commands · mcp/mcp.json · hooks/<engine> ·
//   │   └── settings/<adapter>/         #   settings/<adapter>/<provider>/settings.json)
//   ├── dist/<engine>/                  # deployer 산출 (읽기 전용)
//   │   └── plugins/orcinus-orca/       #   Claude Code plugin(.claude-plugin, skills, agents, hooks, .mcp.json)
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
import { LEGACY_PRODUCT_SLUG, PRODUCT_SLUG } from '../../../shared/product'

// 모든 OS 동일하게 ~/.config/orcinus-orca (제안서 §환경구성). Windows 에서도 homedir() 하위로 통일.
export function orcaConfigDir(): string {
  return join(homedir(), '.config', PRODUCT_SLUG)
}

// dev(`npm run dev`) 전용 userData 디렉토리 — prod `<appData>/orcinus-orca` 와 sibling
// `<appData>/orcinus-orca-dev`. userData 는 Electron 이 app.getName()(dev·prod 모두
// `orcinus-orca`)에서 파생하므로 기본값은 dev·prod 가 같은 폴더를 공유한다. dev 에서만 여기로
// 리디렉션해 DB·WAL·마이그레이션 백업·secret-store 를 통째로 격리한다(개발 중 마이그레이션/데이터
// 변경이 실제 설치본을 오염시키지 않도록). 호출은 index.ts 가 import.meta.env.DEV 게이트로 감싸
// prod 번들에서 dead-code 제거되게 한다.
export function devUserDataDir(appDataDir: string): string {
  return join(appDataDir, `${PRODUCT_SLUG}-dev`)
}

// ── 레거시(0225 이전) 루트 — **이관 모듈 전용** ────────────────────────────────
// 여기서 조립만 하고, 소비는 `migrate-legacy.ts` 한 파일이 독점한다. 다른 파일이 이 둘을
// import 하면 D-010("전환 후 옛 경로를 정상 저장소나 자동 fallback 으로 쓰지 않는다")이 깨지고
// `product-identity.test.ts` 의 import 그래프 전수 단언이 red 가 된다(§10 EP-05).
export function legacyConfigDir(): string {
  return join(homedir(), '.config', LEGACY_PRODUCT_SLUG)
}

export function legacyUserDataDir(appDataDir: string, isDev: boolean): string {
  return join(appDataDir, isDev ? `${LEGACY_PRODUCT_SLUG}-dev` : LEGACY_PRODUCT_SLUG)
}

// 격리 worktree 루트. `<userData>` 가 아니라 `orcaConfigDir()` 하위다(0210 D-102) — 저장소
// 내부에 두면 `status --untracked-files=all` 이 그 저장소를 영구 dirty 로 만들고, `<userData>`
// 아래는 사용자가 찾아갈 경로가 아니다.
//
// **dev 는 이 디렉토리에만 `-dev` 를 붙인다**(D-103). `orcaConfigDir()` 자체를 가르면 dev 가
// settings·plugins·projects 를 통째로 잃는다 — 그 격리는 `devUserDataDir` 이 DB 축에서 이미 한다.
export function managedWorktreesDir(isDev: boolean): string {
  return join(orcaConfigDir(), isDev ? 'worktrees-dev' : 'worktrees')
}

// 정규 소스 루트(사람 편집 SSOT).
function sourcesDir(): string {
  return join(orcaConfigDir(), 'sources')
}

// Orcinus orca 앱 자체 전역 설정 파일. sources/ 는 엔진별 배포 리소스 SSOT 이고, orcinus-orca.json 은
// 앱 부팅 시 1회 로드되는 전역 agent/provider 설정이다.
export function orcaJsonPath(): string {
  return join(orcaConfigDir(), `${PRODUCT_SLUG}.json`)
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

// ── 플러그인 데이터 루트 (0237 ΔV2 — D-057) ───────────────────────────────────
//
// **배포가 정하는 값이 아니라서 여기 있다.** 0237 r2 까지 이 경로는 `bootstrap.ts` 가
// `app.getPath('userData')` 를 읽어 배포 파라미터 → 도구 ctx → sync manager → store 로
// **5단 체인**으로 흘렀다. 배포가 고를 것이 없는 값은 배포 계약에 두지 않는다.
//
// **왜 슬롯인가**: `userData` 는 `app.getPath` 로만 알 수 있고(dev 는 `index.ts` 가 sibling 로
// 리디렉션한다), 이 파일이 electron 을 import 하면 여기를 쓰는 feature 가 전부 vitest 에서
// 죽는다(P29). 그래서 **부팅이 값을 한 번 알려주고** 이후 소비자는 electron 없이 읽는다 —
// `initLog()`·`initDb()` 와 같은 infra 싱글턴 형상이다.
let configuredUserDataDir: string | null = null

/** 부팅이 1회 호출한다 (`src/main/index.ts`, userData 리디렉트 **직후**). 테스트는 임시 폴더를 준다. */
export function configureUserDataDir(dir: string): void {
  configuredUserDataDir = dir
}

/** 배선 전에 부르면 던진다 — 조용히 `cwd` 같은 엉뚱한 곳에 데이터를 만들지 않는다. */
export function userDataDir(): string {
  if (configuredUserDataDir === null) {
    throw new Error('userData 루트가 아직 배선되지 않았습니다 (configureUserDataDir 미호출)')
  }
  return configuredUserDataDir
}

// `userData` 하위인 것이 중요하다 — DB·secret-store 와 같은 계층이고 `orcaConfigDir()`(사람이
// 편집하는 설정 소스)이 아니다. 플러그인 데이터는 사람이 편집하는 것이 아니다.
//
// `pluginId`·`accountId` 는 경로 조각이 되므로 문자를 접는다 — 계정 식별자가 사용자 입력에서 온다.
export function pluginDataDir(pluginId: string, accountId: string): string {
  return join(userDataDir(), 'plugins', safePathSegment(pluginId), safePathSegment(accountId))
}

// 경로 한 조각으로 쓸 수 있게 접는다. 빈 문자열이 되면 `_` — 이름 없는 디렉터리를 만들지 않는다.
export function safePathSegment(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, '_') || '_'
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

// Desktop is supplied by Electron's app.getPath so redirected/OneDrive folders are respected.
export function getWorkspacePath(
  project: { cwd?: string | null } | null | undefined,
  desktopPath: string
): string {
  return project?.cwd || desktopPath
}

function sourcesMcpDir(): string {
  return join(sourcesDir(), 'mcp')
}

// MCP 정규 소스. mcp/mcp.json = 순정 Claude mcpServers 스키마 + ${VAR} 플레이스홀더(평문 비밀 0).
export function mcpJsonPath(): string {
  return join(sourcesMcpDir(), 'mcp.json')
}

// 개별 플러그인 루트(dist/<engine>/plugins/<name>)는 여기서 제공하지 않는다 — 레이아웃과
// 이름의 소유자는 features/extensions/harness-plugins/{claude,claude-user-skills}.ts 의
// builtInHarnessPluginRoot/userClaudePluginRoot 다(경로 지식 이중 정의 방지, /simplify 0120).

// 부팅 시 1회. mkdir -p 의미 (recursive). 이미 있으면 무시.
export async function ensureConfigDir(): Promise<void> {
  await mkdir(orcaConfigDir(), { recursive: true })
}
