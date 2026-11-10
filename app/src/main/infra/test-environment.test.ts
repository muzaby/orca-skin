// 테스트 실행 환경 배선 (0294) — 배율과 호스트 격리가 **이 파일이 도는 프로세스에** 실제로 걸렸는가.
// 순수 계산은 `scripts/test-time.test.mjs`·`scripts/test-host.test.mjs` 가 갖는다.
import { execFile } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { relative, isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import { isMainThread } from 'node:worker_threads'
import { describe, expect, it, vi } from 'vitest'
import {
  BASE_CASE_MS,
  BASE_WAIT_FOR_MS,
  resolveTestTimeScale
} from '../../../scripts/test-time.mjs'
import { HERMETIC_GIT_CONFIG } from '../../../scripts/test-host.mjs'

const host = (globalThis as unknown as Record<symbol, { root: string; originalHome: string }>)[
  Symbol.for('orcinus-orca.test.host')
]
const within = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
const scale = resolveTestTimeScale()

describe('시간 예산 배선 (AC1·AC3)', () => {
  it('케이스 예산은 기준값 × 배율이다', ({ task }) => {
    expect((task as unknown as { timeout: number }).timeout).toBe(BASE_CASE_MS * scale)
  })

  it('vi.waitFor 는 배율 wrapper 다', () => {
    expect(
      (vi.waitFor as unknown as Record<symbol, boolean>)[
        Symbol.for('orcinus-orca.test.waitFor.scaled')
      ]
    ).toBe(true)
  })

  it('무옵션 vi.waitFor 는 vitest 기본 1초를 넘겨 재시도한다', async () => {
    expect(BASE_WAIT_FOR_MS * scale).toBeGreaterThan(1_500)
    const start = Date.now()
    await vi.waitFor(() => {
      if (Date.now() - start < 1_500) throw new Error('not yet')
    })
    expect(Date.now() - start).toBeGreaterThanOrEqual(1_500)
  })
})

describe('호스트 격리 배선 (AC11)', () => {
  it('홈은 이 파일의 임시 루트 아래이고 setup 전 홈과 다르다', () => {
    expect(host).toBeDefined()
    expect(within(host.root, realpathSync.native(tmpdir()))).toBe(true)
    expect(within(homedir(), host.root)).toBe(true)
    expect(homedir()).not.toBe(host.originalHome)
    expect(process.env.USERPROFILE).toBe(homedir())
  })

  it('홈은 실경로다 — realpath 로 비교하는 production 경로 검사와 같은 표기', () => {
    expect(realpathSync.native(homedir())).toBe(homedir())
  })

  it('XDG 4종은 루트 아래, git 은 고정 전역 설정(0298)과 시스템 설정 무시', () => {
    for (const key of ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME'])
      expect(within(process.env[key]!, host.root), key).toBe(true)
    expect(process.env.GIT_CONFIG_NOSYSTEM).toBe('1')
    expect(within(process.env.GIT_CONFIG_GLOBAL!, host.root)).toBe(true)
    expect(readFileSync(process.env.GIT_CONFIG_GLOBAL!, 'utf8')).toBe(HERMETIC_GIT_CONFIG)
    if (process.platform === 'win32') expect(within(process.env.ProgramData!, host.root)).toBe(true)
  })

  it('하네스 변수가 남아 있지 않다', () => {
    const leaked = Object.keys(process.env).filter(
      (key) =>
        key === 'CLAUDECODE' ||
        ['ANTHROPIC_', 'CLAUDE_', 'OPENCODE_'].some((prefix) => key.startsWith(prefix)) ||
        (key.startsWith('GIT_') && key !== 'GIT_CONFIG_GLOBAL' && key !== 'GIT_CONFIG_NOSYSTEM')
    )
    expect(leaked).toEqual([])
  })

  it('자식 프로세스도 격리된 홈을 받는다', async () => {
    const { stdout } = await promisify(execFile)(process.execPath, [
      '-e',
      'process.stdout.write(require("node:os").homedir())'
    ])
    expect(stdout).toBe(homedir())
  })
})

describe('풀 배선 (0298)', () => {
  it('자식 프로세스를 쓰는 이 파일은 io 풀 — 워커 스레드가 아니라 프로세스에서 돈다', () => {
    expect(isMainThread).toBe(true)
    expect(
      (process as unknown as Record<symbol, unknown>)[Symbol.for('orcinus-orca.test.unitGuard')]
    ).toBeUndefined()
  })
})
