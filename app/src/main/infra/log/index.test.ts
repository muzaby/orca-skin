import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installTestHostEnvironment } from '../host-environment.testfixture'
import { closeLog, flushLogSync, initLog, logDirectory } from './index'

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

describe('log files', () => {
  it('the default process writes the application file with the host app version', () => {
    dir = mkdtempSync(join(tmpdir(), 'orcinus-orca-log-path-'))
    mocks.configDir.mockReturnValue(dir)
    initLog().error('test.path.failed', new Error('retained failure'))
    flushLogSync()
    const written = readFileSync(join(dir, 'logs', 'application.jsonl'), 'utf8')
    expect(written).toContain('retained failure')
    expect(written).toContain('9.8.7-log')
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
    expect(logDirectory()).toBe(join(dir, 'logs'))
    const record = JSON.parse(readFileSync(join(dir, 'logs', file), 'utf8').trim())
    expect(record.process).toBe(process)
  })
})
