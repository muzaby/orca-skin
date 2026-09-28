import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeLog, currentLogFilePath, flushLogSync, initLog } from './index'

const mocks = vi.hoisted(() => ({ configDir: vi.fn() }))
vi.mock('electron', () => ({ app: { getVersion: () => 'test' } }))
vi.mock('../config/paths', () => ({ orcaConfigDir: mocks.configDir }))
let dir: string | undefined
afterEach(() => {
  closeLog()
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

describe('current log file path', () => {
  it('uses the transport destination before initialization, while open and after close', () => {
    dir = mkdtempSync(join(tmpdir(), 'orca-log-path-'))
    mocks.configDir.mockReturnValue(dir)
    const expected = join(dir, 'logs', 'application.jsonl')
    expect(currentLogFilePath()).toBe(expected)
    initLog().error('test.path.failed', new Error('retained failure'))
    flushLogSync()
    expect(currentLogFilePath()).toBe(expected)
    expect(readFileSync(currentLogFilePath(), 'utf8')).toContain('retained failure')
    closeLog()
    expect(currentLogFilePath()).toBe(expected)
  })
})
