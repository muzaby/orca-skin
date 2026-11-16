import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installTestHostEnvironment } from '../host-environment.testfixture'
import { closeLog, currentLogFilePath, flushLogSync, initLog, logDirectory } from './index'

const mocks = vi.hoisted(() => ({ configDir: vi.fn() }))
vi.mock('../config/paths', () => ({ ooConfigDir: mocks.configDir }))
// 로그의 앱 버전은 호스트 환경에서 읽는다(0324 §11 단계 4).
installTestHostEnvironment({ appVersion: '9.8.7-log' })
let dir: string | undefined
afterEach(() => {
  closeLog()
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

describe('current log file path', () => {
  it('uses the transport destination before initialization, while open and after close', () => {
    dir = mkdtempSync(join(tmpdir(), 'orcinus-orca-log-path-'))
    mocks.configDir.mockReturnValue(dir)
    const expected = join(dir, 'logs', 'application.jsonl')
    expect(currentLogFilePath()).toBe(expected)
    initLog().error('test.path.failed', new Error('retained failure'))
    flushLogSync()
    expect(currentLogFilePath()).toBe(expected)
    expect(readFileSync(currentLogFilePath(), 'utf8')).toContain('retained failure')
    expect(readFileSync(currentLogFilePath(), 'utf8')).toContain('9.8.7-log')
    closeLog()
    expect(currentLogFilePath()).toBe(expected)
  })

  // 0324 AC46 — 프로세스마다 자기 파일에 쓴다. 한 폴더에 모인다.
  it.each([
    ['main', 'application.jsonl'],
    ['agent-host', 'agent-host.jsonl'],
    ['data-host', 'data-host.jsonl']
  ] as const)('%s 프로세스는 %s 에 쓰고 레코드에 프로세스 이름을 싣는다', (process, file) => {
    dir = mkdtempSync(join(tmpdir(), 'orcinus-orca-log-process-'))
    mocks.configDir.mockReturnValue(dir)
    initLog(process).error('test.process.failed', new Error('boom'))
    flushLogSync()
    expect(currentLogFilePath()).toBe(join(dir, 'logs', file))
    expect(logDirectory()).toBe(join(dir, 'logs'))
    const record = JSON.parse(readFileSync(join(dir, 'logs', file), 'utf8').trim())
    expect(record.process).toBe(process)
  })
})
