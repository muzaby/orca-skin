import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installTestHostEnvironment } from '../host-environment.testfixture'
import { closeLog, currentLogFilePath, flushLogSync, initLog } from './index'

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
})
