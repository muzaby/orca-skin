// 고아 선별의 OS 쪽 — 프로세스 목록과 트리 종료 (0324 EP-12 · MD-07).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { killPidTree, listProcesses, type ShellRunInput, type ShellRunResult } from './shell-runner'

const ok = (output: string): ShellRunResult => ({
  exitCode: 0,
  output,
  truncated: false,
  timedOut: false,
  error: null
})

describe('listProcesses', () => {
  it('플랫폼 명령을 돌려 "pid 부모pid" 줄을 읽는다', async () => {
    const calls: ShellRunInput[] = []
    const rows = await listProcesses({
      cwd: '/work',
      timeoutMs: 987,
      platform: 'linux',
      run: async (input) => {
        calls.push(input)
        return ok('  10  4200\n  11 1\n')
      }
    })
    expect(rows).toEqual([
      { pid: 10, parentPid: 4200 },
      { pid: 11, parentPid: 1 }
    ])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      command: 'ps -A -o pid=,ppid=',
      cwd: '/work',
      timeoutMs: 987,
      platform: 'linux'
    })
  })

  it('Windows 에서는 CIM 명령을 쓴다', async () => {
    let command = ''
    await listProcesses({
      cwd: 'C:\\',
      timeoutMs: 1,
      platform: 'win32',
      run: async (input) => {
        command = input.command
        return ok('')
      }
    })
    expect(command).toContain('Get-CimInstance Win32_Process')
  })

  it.each([
    ['띄우지 못함', { ...ok(''), exitCode: null, error: 'spawn ENOENT' }, 'spawn ENOENT'],
    ['0 이 아닌 종료', { ...ok('1 0'), exitCode: 1 }, 'exit 1'],
    ['잘린 출력', { ...ok('1 0'), truncated: true }, 'exit 0']
  ])('%s 이면 던진다 — 일부 목록으로 고아를 고르지 않는다', async (_name, result, reason) => {
    await expect(
      listProcesses({ cwd: '/', timeoutMs: 1, platform: 'linux', run: async () => result })
    ).rejects.toThrow(`프로세스 목록 실패: ${reason}`)
  })
})

describe('killPidTree (POSIX)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('프로세스 그룹을 먼저 끝낸다', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
    await killPidTree(4301, 'linux')
    expect(kill.mock.calls).toEqual([[-4301, 'SIGKILL']])
  })

  it('그룹 대표가 아니면 그 프로세스만 끝낸다', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid) => {
      if (Number(pid) < 0) throw new Error('ESRCH')
      return true
    })
    await killPidTree(4301, 'linux')
    expect(kill.mock.calls).toEqual([
      [-4301, 'SIGKILL'],
      [4301, 'SIGKILL']
    ])
  })
})
