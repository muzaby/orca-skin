import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import path from 'node:path'
import {
  resolveGuardRoots,
  guardToolAccess,
  screenBashCommand,
  makeWorkspaceGuardHook,
  type GuardRoots
} from './workspace-guard'
import { orcaConfigDir } from '../infra/config/paths'

// 세션 cwd 는 실제로 ~/.config/orca/projects/<…> 하위다(paths.ts getWorkspacePath). read-only 예외
// (~/.config/orca)의 하위이면서도 write 가 허용돼야 하는 "예외의 예외"를 실제 경로로 검증한다.
const WS = path.join(orcaConfigDir(), 'projects', 'default')
const roots: GuardRoots = resolveGuardRoots(WS)

const OUTSIDE = process.platform === 'win32' ? 'C:\\Windows\\System32\\x' : '/etc/passwd'
const CLAUDE_FILE = path.join(homedir(), '.claude', 'skills', 'foo', 'ref.md')
const ORCA_SOURCES = path.join(orcaConfigDir(), 'sources', 'skills', 'x.md')

describe('guardToolAccess — write 계열(writeRoots 만 참조)', () => {
  it('workspace 안 Write 는 pass-through(null)', () => {
    expect(guardToolAccess('Write', { file_path: path.join(WS, 'a.txt') }, roots)).toBeNull()
  })

  it('상대경로 Write 는 workspace 기준 해석되어 통과', () => {
    expect(guardToolAccess('Write', { file_path: 'note.txt' }, roots)).toBeNull()
    expect(guardToolAccess('Edit', { file_path: 'sub/dir/b.ts' }, roots)).toBeNull()
  })

  it('workspace 밖 절대경로 Write 는 deny', () => {
    expect(guardToolAccess('Write', { file_path: OUTSIDE }, roots)).not.toBeNull()
  })

  it('read 예외(~/.claude)라도 Write 는 차단 — writeRoots 에 없다', () => {
    const p = path.join(homedir(), '.claude', 'settings.json')
    expect(guardToolAccess('Write', { file_path: p }, roots)).not.toBeNull()
    expect(guardToolAccess('Edit', { file_path: CLAUDE_FILE }, roots)).not.toBeNull()
  })

  it('예외의 예외: 세션 cwd 하위는 ~/.config/orca 밑이어도 Write 허용, sources 는 차단', () => {
    // cwd 자신은 ~/.config/orca 의 하위지만 writeRoots 라 통과.
    expect(
      guardToolAccess('Write', { file_path: path.join(WS, 'deep', 'out.txt') }, roots)
    ).toBeNull()
    // 같은 ~/.config/orca 밑이라도 cwd 밖(sources)은 write 차단.
    expect(guardToolAccess('Write', { file_path: ORCA_SOURCES }, roots)).not.toBeNull()
  })

  it('Write 경로 누락은 deny', () => {
    expect(guardToolAccess('Write', {}, roots)).not.toBeNull()
  })
})

describe('guardToolAccess — read 계열(readRoots 참조)', () => {
  it('workspace 안 Read 는 통과', () => {
    expect(guardToolAccess('Read', { file_path: path.join(WS, 'a.txt') }, roots)).toBeNull()
  })

  it('workspace 밖 Read 는 deny', () => {
    expect(guardToolAccess('Read', { file_path: OUTSIDE }, roots)).not.toBeNull()
  })

  it('read 예외 경로(~/.claude·~/.config/orca)는 Read 허용', () => {
    expect(guardToolAccess('Read', { file_path: CLAUDE_FILE }, roots)).toBeNull()
    expect(guardToolAccess('Read', { file_path: ORCA_SOURCES }, roots)).toBeNull()
  })

  it('Glob/Grep 은 path(검색 루트)로 판정, 생략 시 cwd 기준 → 통과', () => {
    expect(guardToolAccess('Glob', {}, roots)).toBeNull()
    expect(guardToolAccess('Grep', { path: path.join(WS, 'src') }, roots)).toBeNull()
    expect(guardToolAccess('Grep', { path: OUTSIDE }, roots)).not.toBeNull()
  })
})

describe('guardToolAccess — Bash / 비파일 툴', () => {
  it('workspace 안·PATH 명령은 통과', () => {
    expect(guardToolAccess('Bash', { command: 'ls -la' }, roots)).toBeNull()
    expect(guardToolAccess('Bash', { command: 'npm test' }, roots)).toBeNull()
    expect(
      guardToolAccess('Bash', { command: `cat ${path.join(WS, 'pkg.json')}` }, roots)
    ).toBeNull()
  })

  it('밖 절대경로·상위 탈출은 deny', () => {
    expect(guardToolAccess('Bash', { command: 'cat /etc/hosts' }, roots)).not.toBeNull()
    expect(guardToolAccess('Bash', { command: 'cat ../../secret' }, roots)).not.toBeNull()
  })

  it('파일 접근이 아닌 툴은 pass-through', () => {
    expect(guardToolAccess('TodoWrite', { todos: [] }, roots)).toBeNull()
    expect(guardToolAccess('AskUserQuestion', { questions: [] }, roots)).toBeNull()
    expect(guardToolAccess('ExitPlanMode', { plan: 'x' }, roots)).toBeNull()
  })
})

describe('additionalDirectories 확장', () => {
  it('추가 디렉토리는 read·write 모두 허용', () => {
    const extra = process.platform === 'win32' ? 'C:\\extra\\dir' : '/opt/extra/dir'
    const r = resolveGuardRoots(WS, [extra])
    expect(guardToolAccess('Write', { file_path: path.join(extra, 'x.txt') }, r)).toBeNull()
    expect(guardToolAccess('Read', { file_path: path.join(extra, 'x.txt') }, r)).toBeNull()
    // 확장 배열을 안 준 roots 에서는 여전히 차단.
    expect(guardToolAccess('Write', { file_path: path.join(extra, 'x.txt') }, roots)).not.toBeNull()
  })
})

describe('screenBashCommand', () => {
  it('workspace 안 절대경로는 통과', () => {
    expect(screenBashCommand(`cat ${path.join(WS, 'a')}`, WS, roots.readRoots).block).toBe(false)
  })
  it('밖 절대경로는 차단', () => {
    expect(screenBashCommand('cat /etc/hosts', WS, roots.readRoots).block).toBe(true)
  })
  it('상위 탈출은 차단', () => {
    expect(screenBashCommand('cp ../../x .', WS, roots.readRoots).block).toBe(true)
  })
  it('홈 확장은 차단, ~/.claude·~/.config/orca 는 예외', () => {
    expect(screenBashCommand('cat ~/secret', WS, roots.readRoots).block).toBe(true)
  })
})

describe('makeWorkspaceGuardHook — 훅 조각 + 콜백 계약', () => {
  const fragment = makeWorkspaceGuardHook(WS) as {
    hooks: { PreToolUse: { hooks: Array<(input: unknown) => Promise<unknown>> }[] }
  }
  const callback = fragment.hooks.PreToolUse[0].hooks[0]

  it('PreToolUse 매처 1개를 가진 조각을 반환', () => {
    expect(typeof callback).toBe('function')
    expect(fragment.hooks.PreToolUse).toHaveLength(1)
  })

  it('밖 경로는 deny 출력(permissionDecision: deny)', async () => {
    const out = (await callback({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: OUTSIDE }
    })) as { hookSpecificOutput?: { permissionDecision?: string } }
    expect(out.hookSpecificOutput?.permissionDecision).toBe('deny')
  })

  it('안 경로는 pass-through({}) — allow 아님', async () => {
    const out = await callback({
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: path.join(WS, 'a.txt') }
    })
    expect(out).toEqual({})
  })

  it('PreToolUse 가 아닌 이벤트는 pass-through', async () => {
    const out = await callback({
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_input: {}
    })
    expect(out).toEqual({})
  })
})
