// Workspace 격리 가드 — 작업 폴더(cwd) 밖 모든 경로의 r/w 를 막는 PreToolUse 훅. sandbox/docker/
// wsl 없이 SDK 코드레벨로만 구성한다(가이드 정본: docs/guides/workspace-isolation-permissions.md,
// 핸드오프 0074·0075). 격리를 permissionMode 가 아니라 **PreToolUse 훅**에 두는 이유:
//   - 훅은 권한 평가 1순위라 default·acceptEdits·plan·bypassPermissions 어느 모드에서든 밖을 먼저
//     자른다(모드-독립). hook deny 는 bypassPermissions 에서도 유효(agent-sdk/permissions).
//   - 안(허용) 경로는 `allow` 가 아니라 **pass-through(`{}`)** 를 반환한다 — hook `allow` 는 mode·
//     canUseTool 을 건너뛰어 기존 승인 카드(makeCanUseTool)·plan/acceptEdits 흐름을 우회하기 때문.
//   - 그래서 dontAsk 를 쓰지 않는다(그 모드는 canUseTool 을 죽여 AskUserQuestion·ExitPlanMode·승인
//     카드를 자동 거부한다).
// 어댑터 내부 훅 조각이라 makeSteerGateHook(claude-adapt.ts)과 동형으로 `{hooks:{PreToolUse:[…]}}`
// 를 반환하고 claude.ts 가 mergeHooks 로 합성한다. 순수 판정부는 named export 로 단위 테스트한다.

import { homedir } from 'node:os'
import path from 'node:path'
import type {
  HookCallback,
  HookJSONOutput,
  PreToolUseHookSpecificOutput
} from '@anthropic-ai/claude-agent-sdk'
import { isWithinDir, orcaConfigDir } from '../infra/config/paths'

const WRITE_TOOLS = ['Write', 'Edit']
const READ_TOOLS = ['Read', 'Glob', 'Grep']

// read **와 write** 를 모두 허용하는 예외 루트. `~/.claude` 는 plan 모드 산출물·skill 설치가 쓰기를
// 요구할 수 있어(예: `~/.claude/skills/<name>` 설치, plan 아티팩트 기록) write 까지 연다(사용자 결정
// 0075 r2). 가이드(0074 §3.2)의 기본 read-only 스탠스에서 Orca 가 의도적으로 넓힌 지점 — 편차로 문서화.
export function writeExceptionRoots(): string[] {
  return [path.join(homedir(), '.claude')].map((p) => path.resolve(p))
}

// read 는 허용하되 write 는 막을 예외 루트(런타임·plugin/skill 소스). skill/plugin **로딩**은 CLI
// 내부라 훅이 안 보지만, node/python skill **실행**(Bash)·번들 파일 read 는 모델 툴 호출이라 훅이
// 본다 → 그 read 를 허용하려면 이 루트가 필요하다(요구사항: node/python skill 실행 예외).
export function readOnlyExceptionRoots(): string[] {
  return [
    // ~/.config/orca — plugin/skill 제공(dist·sources). read-only 지만 세션 cwd(projects/<…>)는
    // writeRoots 라 write 허용된다(예외의 예외).
    orcaConfigDir(),
    // node/python 등 런타임(실행 특성상 read 불가피). 패키지 앱에서 process.execPath 는 앱 바이너리라
    // 근사치다 — 정상 명령이 절대 interpreter 경로를 쓰다 오차단되면 verify 에서 최소 추가한다.
    path.dirname(process.execPath)
  ].map((p) => path.resolve(p))
}

// 해석 완료된 판정 루트. write 판정은 writeRoots 만, read 판정은 readRoots(=write+예외)를 본다.
export interface GuardRoots {
  ws: string
  writeRoots: string[]
  readRoots: string[]
}

export function resolveGuardRoots(
  workspaceRoot: string,
  additionalDirs: string[] = []
): GuardRoots {
  const ws = path.resolve(workspaceRoot)
  const extra = additionalDirs.map((d) => path.resolve(d))
  // write 허용 = cwd + additionalDirectories + write 예외(~/.claude)
  const writeRoots = [ws, ...extra, ...writeExceptionRoots()]
  // read 허용 = write + read-only 예외(~/.config/orca·런타임)
  const readRoots = [...writeRoots, ...readOnlyExceptionRoots()]
  return { ws, writeRoots, readRoots }
}

// 툴 1건의 경로 접근을 판정한다. 반환 `null` = pass-through(안·예외·비파일툴), 문자열 = deny 사유.
// **write 불변식**: WRITE_TOOLS 는 writeRoots(cwd + additionalDirs + `~/.claude`)만 참조한다 —
// read-only 예외(`~/.config/orca`·런타임)는 보지 않는다. 그래서 세션 cwd(`~/.config/orca/projects/<…>`)
// 와 `~/.claude` 는 write 허용되고, `~/.config/orca/sources` 등은 write 차단된다.
//
// **Bash 는 판정하지 않는다(0075 후속)**: 명령 문자열 정적 스크리닝은 eval·변수치환($HOME)·파이프·
// base64 우회를 못 잡고 URL(`//host`)·literal `~/.claude` 를 오차단해 실효가 없었다 — 제거했다.
// 대신 시스템 프롬프트의 도구-사용 정책(`# Tools`, opencode 참고)이 파일 작업을 **전용 툴(Read/Write/
// Edit — 이 가드가 실제로 강제)** 로 라우팅하고 Bash 를 workspace 안으로 스코프하도록 유도한다.
export function guardToolAccess(
  toolName: string,
  toolInput: Record<string, unknown>,
  roots: GuardRoots
): string | null {
  const rawPath =
    typeof toolInput.file_path === 'string'
      ? toolInput.file_path
      : typeof toolInput.path === 'string'
        ? toolInput.path
        : null

  if (WRITE_TOOLS.includes(toolName)) {
    if (!rawPath) return 'write 경로를 확인할 수 없음'
    const p = path.resolve(roots.ws, rawPath) // 상대경로는 workspace 기준 해석
    if (roots.writeRoots.some((r) => isWithinDir(p, r))) return null
    return `workspace 밖 write 차단: ${p}`
  }

  if (READ_TOOLS.includes(toolName)) {
    if (!rawPath) return null // Glob/Grep path 생략 = cwd 기준 → 통과
    const p = path.resolve(roots.ws, rawPath)
    if (roots.readRoots.some((r) => isWithinDir(p, r))) return null
    return `허용되지 않은 경로 read 차단: ${p}`
  }

  // 그 외(Bash·TodoWrite·AskUserQuestion·ExitPlanMode 등) = 구조 파일툴 아님 → 보류(정책이 유도).
  return null
}

function deny(reason: string): HookJSONOutput {
  const spec: PreToolUseHookSpecificOutput = {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason
  }
  return { hookSpecificOutput: spec }
}

// options.hooks 조각. additionalDirs 는 options.additionalDirectories 와 **동일 배열**을 넘겨 드리프트를
// 막는다(가이드 §5). callback 은 밖=deny, 안·예외·비파일툴=pass-through(`{}`).
export function makeWorkspaceGuardHook(
  workspaceRoot: string,
  additionalDirs: string[] = []
): object {
  const roots = resolveGuardRoots(workspaceRoot, additionalDirs)
  const callback: HookCallback = async (input) => {
    const i = input as {
      hook_event_name?: string
      tool_name?: string
      tool_input?: Record<string, unknown>
    }
    if (i.hook_event_name !== 'PreToolUse') return {}
    const reason = guardToolAccess(i.tool_name ?? '', i.tool_input ?? {}, roots)
    return reason === null ? {} : deny(reason)
  }
  return { hooks: { PreToolUse: [{ hooks: [callback] }] } }
}
