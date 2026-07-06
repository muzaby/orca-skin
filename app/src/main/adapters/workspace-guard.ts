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

// read 는 허용하되 write 는 막을 예외 루트(skills/plugins/런타임). skill/plugin **로딩**은 CLI 내부라
// 훅이 안 보지만, node/python skill **실행**(Bash)·번들 파일 read 는 모델 툴 호출이라 훅이 본다 →
// 그 read 를 허용하려면 이 루트가 필요하다(요구사항: node/python skill 실행 예외).
export function readOnlyExceptionRoots(): string[] {
  const home = homedir()
  return [
    path.join(home, '.claude'), // plugin/skill 제공
    orcaConfigDir(), // ~/.config/orca — plugin/skill 제공 (dist·sources)
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
  const writeRoots = [ws, ...extra] // write 허용 = cwd + additionalDirectories
  const readRoots = [...writeRoots, ...readOnlyExceptionRoots()] // read 허용 = write + 예외
  return { ws, writeRoots, readRoots }
}

// Bash 명령 정적 스크리닝(가이드 §3.5, best-effort). "절대경로 화이트리스트 + 상위 탈출 차단". Bash 는
// 임의 문자열이라 read/write 의도를 못 가르므로 readRoots 기준으로만 판정한다. **한계**: eval·변수치환
// ($HOME)·파이프·base64 우회는 잡지 못한다 — Bash 를 허용하는 한 정적 격리는 불완전하다(OS 샌드박스
// 대체 아님). URL 처럼 `//` 로 시작하는 토큰도 절대경로로 오인해 차단할 수 있다(false-positive 수용).
export function screenBashCommand(
  cmd: string,
  ws: string,
  readRoots: string[]
): { block: boolean; reason: string } {
  // 1) 절대경로 토큰이 readRoots 밖이면 차단.
  const absPaths = cmd.match(/(?<![\w-])\/[^\s"'`|;&><]+/g) ?? []
  for (const raw of absPaths) {
    const p = path.resolve(raw)
    if (!readRoots.some((r) => isWithinDir(p, r))) {
      return { block: true, reason: `Bash 절대경로 접근 차단: ${p}` }
    }
  }
  // 2) 상위 탈출(../) — cwd 기준 resolve 후 검사.
  const relTokens = cmd.match(/(?<![\w-])\.\.\/[^\s"'`|;&><]*/g) ?? []
  for (const raw of relTokens) {
    const p = path.resolve(ws, raw)
    if (!readRoots.some((r) => isWithinDir(p, r))) {
      return { block: true, reason: `Bash 상위경로 탈출 차단: ${p}` }
    }
  }
  // 3) 홈/시스템 확장 차단(~/.claude·~/.config/orca 예외).
  if (/(^|\s)(~[^/\s]|~\/(?!\.claude|\.config\/orca))/.test(cmd)) {
    return { block: true, reason: 'Bash 홈 디렉터리 확장 차단' }
  }
  return { block: false, reason: '' }
}

// 툴 1건의 경로 접근을 판정한다. 반환 `null` = pass-through(안·예외·비파일툴), 문자열 = deny 사유.
// **write 불변식**: WRITE_TOOLS 는 writeRoots 만 참조한다 — read-only 예외 루트를 보지 않으므로 세션
// cwd(`~/.config/orca/projects/<…>`)는 `~/.config/orca`(read 예외)의 하위여도 writeRoots 라 write 가
// 허용되고, `~/.config/orca/sources` 등 cwd 밖은 write 차단된다.
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

  if (toolName === 'Bash') {
    const cmd = typeof toolInput.command === 'string' ? toolInput.command : ''
    const verdict = screenBashCommand(cmd, roots.ws, roots.readRoots)
    return verdict.block ? verdict.reason : null
  }

  // 그 외(TodoWrite·AskUserQuestion·ExitPlanMode 등) = 파일 접근 아님 → 보류.
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
