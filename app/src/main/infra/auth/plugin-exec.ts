// auth provider 의 CLI 체인 지원 (0157) — 구 `features/sso/exec.ts` 이식.
// child_process.execFile 래퍼(shell 미경유, 인자 배열 그대로).
//
// 비-zero 종료는 정상 결과(code)로 resolve 하고, spawn 자체 실패(ENOENT 등 문자열 코드)만
// reject 한다 — provider 가 CLI 종료 코드를 체인 분기에 쓸 수 있게.
//
// 구 sso 판 대비 변경: **`process.env` 전체를 자식에게 물려주지 않는다.** Hermes 의
// `run_secret_cli` 선례(PATH/HOME/locale + allowlist 만 전달)를 따라 최소 env 만 구성한다 —
// broker 밖 subprocess 로 다른 서비스의 비밀이 상속되는 경로를 끊는다.

import { execFile } from 'node:child_process'

const MAX_BUFFER = 10 * 1024 * 1024

// 자식 프로세스가 정상 동작하는 데 필요한 최소 env 이름. 비밀을 담지 않는 것들만.
const BASE_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'SystemRoot',
  'windir',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'TZ'
] as const

export interface PluginExecResult {
  code: number | null
  stdout: string
  stderr: string
}

export interface PluginExecOptions {
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
  stdin?: string
}

function baseEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of BASE_ENV_ALLOWLIST) {
    const value = process.env[name]
    if (value !== undefined) out[name] = value
  }
  return out
}

export function pluginExec(
  file: string,
  args: readonly string[],
  opts?: PluginExecOptions
): Promise<PluginExecResult> {
  return new Promise<PluginExecResult>((resolve, reject) => {
    const child = execFile(
      file,
      [...args],
      {
        ...(opts?.cwd !== undefined ? { cwd: opts.cwd } : {}),
        // 전체 상속이 아니라 allowlist + 호출자가 명시한 값만.
        env: { ...baseEnv(), ...(opts?.env ?? {}) },
        ...(opts?.timeoutMs !== undefined ? { timeout: opts.timeoutMs } : {}),
        windowsHide: true,
        maxBuffer: MAX_BUFFER
      },
      (err, stdout, stderr) => {
        if (err && typeof (err as NodeJS.ErrnoException).code === 'string') {
          reject(err)
          return
        }
        resolve({ code: child.exitCode, stdout: String(stdout), stderr: String(stderr) })
      }
    )
    if (opts?.stdin !== undefined && child.stdin) {
      child.stdin.write(opts.stdin)
      child.stdin.end()
    }
  })
}
