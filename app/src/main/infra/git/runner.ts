import { execFile, type ExecFileException } from 'node:child_process'

export interface GitRunResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
  aborted: boolean
}

export interface GitRunOptions {
  signal?: AbortSignal
  readOnly?: boolean
  timeoutMs?: number
  maxBuffer?: number
}

export function runGit(
  cwd: string,
  args: string[],
  options: GitRunOptions = {}
): Promise<GitRunResult> {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      ...(options.readOnly ? { GIT_OPTIONAL_LOCKS: '0' } : {})
    }
    execFile(
      'git',
      args,
      {
        cwd,
        env,
        timeout: options.timeoutMs ?? 10_000,
        maxBuffer: options.maxBuffer ?? 4 * 1024 * 1024,
        windowsHide: true,
        ...(options.signal ? { signal: options.signal } : {})
      },
      (error: ExecFileException | null, stdout, stderr) => {
        resolve({
          ok: error == null,
          stdout: String(stdout),
          stderr: String(stderr),
          code: typeof error?.code === 'number' ? error.code : null,
          aborted: options.signal?.aborted ?? false
        })
      }
    )
  })
}
