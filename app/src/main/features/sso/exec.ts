// SsoContext.exec 구현 — child_process.execFile 래퍼(shell 미경유, 인자 배열 그대로).
// 비-zero 종료는 정상 결과(code)로 resolve 하고, spawn 자체 실패(ENOENT 등 문자열 코드)만
// reject 한다 — 모듈이 CLI 종료 코드를 체인 분기에 쓸 수 있게.

import { execFile } from 'node:child_process'
import type { SsoContext, SsoExecResult } from '../../contracts/sso'

const MAX_BUFFER = 10 * 1024 * 1024

export const ssoExec: SsoContext['exec'] = (file, args, opts) =>
  new Promise<SsoExecResult>((resolve, reject) => {
    const child = execFile(
      file,
      [...args],
      {
        ...(opts?.cwd !== undefined ? { cwd: opts.cwd } : {}),
        ...(opts?.env !== undefined ? { env: { ...process.env, ...opts.env } } : {}),
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
