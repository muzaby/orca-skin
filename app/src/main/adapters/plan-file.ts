// ExitPlanMode 파일 출처(0249 D-015~D-017): 성공한 메인 에이전트의 마지막 plans 쓰기를
// 채널 셀에 기록하고 Stop마다 비운다. 읽기는 승인 요청 시점이며 파일을 쓰지는 않는다.
import { lstat, open } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { HookCallback, Options } from '@anthropic-ai/claude-agent-sdk'
import { isRecord } from '../../shared/obj'
import { isWithinDir } from '../infra/config/paths'

export const PLAN_FILE_MAX_BYTES = 256 * 1024
export interface PlanFile {
  plan: string
  planFilePath: string
}
export interface PlanFileCell {
  path?: string
}
export type PlanFileReader = (absolutePath: string) => Promise<string | null>

function expandHome(value: string, home: string): string {
  if (value === '~') return home
  return /^~[\\/]/.test(value) ? path.join(home, value.slice(2)) : value
}

export function claudePlansDirectory(
  lookup: (key: string) => string | undefined,
  home = homedir()
): string {
  const configured = lookup('CLAUDE_CONFIG_DIR')
  const root = configured?.trim() ? expandHome(configured, home) : path.join(home, '.claude')
  return path.resolve(root, 'plans')
}

export function planFileTarget(
  toolName: string,
  input: unknown,
  plansDir: string,
  home = homedir()
): string | null {
  if (toolName !== 'Write' && toolName !== 'Edit') return null
  if (!isRecord(input) || typeof input.file_path !== 'string' || !input.file_path.trim())
    return null
  const absolutePath = path.resolve(expandHome(input.file_path, home))
  if (path.extname(absolutePath).toLowerCase() !== '.md') return null
  return isWithinDir(absolutePath, plansDir) ? absolutePath : null
}

export function nodePlanFileReader(maxBytes = PLAN_FILE_MAX_BYTES): PlanFileReader {
  return async (absolutePath) => {
    try {
      const stat = await lstat(absolutePath)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) return null
      const handle = await open(absolutePath, 'r')
      try {
        const opened = await handle.stat()
        if (
          !opened.isFile() ||
          opened.size > maxBytes ||
          opened.ino !== stat.ino ||
          opened.dev !== stat.dev
        )
          return null
        // Windows의 8.3 별칭도 일반 경로다. realpath 문자열 비교로 링크를 추정하면
        // 짧은 TEMP 경로의 정상 파일까지 거부하므로 조상 자체의 링크 속성을 검사한다.
        for (let parent = path.dirname(absolutePath); ;) {
          if ((await lstat(parent)).isSymbolicLink()) return null
          const next = path.dirname(parent)
          if (next === parent) break
          parent = next
        }
        // 조상 검사 중 경로가 교체됐으면 열린 파일과 다른 출처를 읽지 않는다.
        const current = await lstat(absolutePath)
        if (
          !current.isFile() ||
          current.isSymbolicLink() ||
          current.ino !== opened.ino ||
          current.dev !== opened.dev
        )
          return null
        // stat 이후 파일이 커져도 무제한으로 읽지 않는다. 1바이트 초과 probe로 상한을
        // 판정하고 이미 연 핸들은 모든 반환·실패 경로에서 닫는다.
        const bytes = Buffer.alloc(maxBytes + 1)
        let size = 0
        while (size < bytes.length) {
          const { bytesRead } = await handle.read(bytes, size, bytes.length - size, size)
          if (bytesRead === 0) break
          size += bytesRead
        }
        return size <= maxBytes ? bytes.subarray(0, size).toString('utf8') : null
      } finally {
        await handle.close()
      }
    } catch {
      return null
    }
  }
}

async function readPlanFile(
  absolutePath: string | undefined,
  read: PlanFileReader
): Promise<PlanFile | undefined> {
  if (!absolutePath) return undefined
  try {
    const plan = await read(absolutePath)
    return plan?.trim() ? { plan, planFilePath: absolutePath } : undefined
  } catch {
    return undefined
  }
}

export function readTrackedPlanFile(
  cell: PlanFileCell,
  read: PlanFileReader
): Promise<PlanFile | undefined> {
  return readPlanFile(cell.path, read)
}

export function readDeclaredPlanFile(
  input: unknown,
  plansDir: string,
  read: PlanFileReader
): Promise<PlanFile | undefined> {
  const target = planFileTarget(
    'Write',
    { file_path: isRecord(input) ? input.planFilePath : undefined },
    plansDir
  )
  return readPlanFile(target ?? undefined, read)
}

export function makePlanFileHook(cell: PlanFileCell, plansDir: string): Pick<Options, 'hooks'> {
  const record: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PostToolUse' || input.agent_id !== undefined) return {}
    if (isRecord(input.tool_response) && input.tool_response.isError === true) return {}
    const target = planFileTarget(input.tool_name, input.tool_input, plansDir)
    if (target) cell.path = target
    return {}
  }
  const reset: HookCallback = async () => {
    delete cell.path
    return {}
  }
  return {
    hooks: {
      PostToolUse: [{ matcher: 'Write|Edit', hooks: [record] }],
      Stop: [{ hooks: [reset] }]
    }
  }
}
