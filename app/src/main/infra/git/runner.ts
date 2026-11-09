import { execFile, type ExecFileException } from 'node:child_process'
import { gitCommand, type GitCommand } from './git-executable'

export interface GitRunResult {
  ok: boolean
  stdout: string
  stderr: string
  code: number | null
  aborted: boolean
  unavailable?: true
}

export interface GitRunOptions {
  signal?: AbortSignal
  readOnly?: boolean
  timeoutMs?: number
  maxBuffer?: number
  execFileImpl?: typeof execFile
  resolveExecutable?: () => Promise<GitCommand | null>
}

export async function runGit(
  cwd: string,
  args: string[],
  options: GitRunOptions = {}
): Promise<GitRunResult> {
  const executable = await (options.resolveExecutable ?? gitCommand)()
  if (!executable)
    return {
      ok: false,
      stdout: '',
      stderr: 'Git executable not found',
      code: null,
      aborted: false,
      unavailable: true
    }
  const baseEnv = await executable.env(process.env)
  return new Promise((resolve) => {
    const env = {
      ...baseEnv,
      GIT_TERMINAL_PROMPT: '0',
      ...(options.readOnly ? { GIT_OPTIONAL_LOCKS: '0' } : {})
    }
    const exec = options.execFileImpl ?? execFile
    exec(
      executable.file,
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
