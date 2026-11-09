export declare const UNIT_GUARD: unique symbol
export declare const UNIT_GUARD_SETUP: string
export declare const TEST_INCLUDE: string
export declare const FORCED_IO: Readonly<Record<string, string>>
export declare const IO_RULES: ReadonlyArray<{
  id: string
  test: (text: string, relPath: string) => boolean
}>
export declare function classifyTestSource(
  source: string,
  relPath?: string
): { pool: 'io' | 'unit'; reasons: string[] }
export declare function partitionTestFiles(appDir: string): {
  io: string[]
  unit: string[]
  ioSqlite: string[]
}
export declare const IO_MODE_ENV: string
export declare const IO_MODES: readonly string[]
export declare function resolveIoMode(env?: Record<string, string | undefined>): string | undefined
export declare function buildProjects(input: {
  io: string[]
  ioSqlite?: string[]
  base: { setupFiles: string[] } & Record<string, unknown>
  exclude: string[]
  mode?: string
}): Array<{ test: Record<string, unknown> }>
export interface UnitGuardState {
  violations: string[]
}
export declare function installUnitGuard(input: {
  childProcess: typeof import('node:child_process')
  proc?: NodeJS.Process
  sync?: () => void
}): UnitGuardState
export declare function drainGuardViolations(state: UnitGuardState): Error | null
export declare function alignThreadHomedir(input: {
  os: typeof import('node:os')
  proc?: NodeJS.Process
  sync?: () => void
}): void
export declare const IO_GUARD: unique symbol
export declare const IO_GUARD_SETUP: string
export declare const FIXTURE_BUILDERS: readonly string[]
export interface GitAllowance {
  file: string
  subcommand: string
  count: number
  reason: string
}
export declare const IO_GIT_ALLOWED: GitAllowance[]
export interface GitSpawn {
  file: string
  args: string[]
  frames: { file: string; fn?: string }[]
  kind: string
  timeout?: number
}
export interface IoGitGuardState extends UnitGuardState {
  counts: Map<string, number>
  spawns: GitSpawn[]
}
export declare function gitSubcommand(args: string[]): string | undefined
export declare function gitSpawnFrames(stack: string): GitSpawn['frames']
export declare function judgeGitSpawn(
  input: Omit<GitSpawn, 'kind'> & { allowed?: GitAllowance[] }
):
  | { kind: 'ignore' | 'pass' }
  | { kind: 'violation'; message: string }
  | { kind: 'allowed'; entry: GitAllowance }
export declare function finishGitAllowances(
  state: IoGitGuardState,
  file: string,
  allowed?: GitAllowance[]
): void
export declare function installIoGitGuard(input: {
  childProcess: typeof import('node:child_process')
  proc?: NodeJS.Process
  sync?: () => void
}): IoGitGuardState
