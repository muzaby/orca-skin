import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileTransport } from './file-transport'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-log-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// 타이머 없이(flushIntervalMs: 0) 명시 flushSync 로만 검증한다.
function transport(
  opts: Partial<ConstructorParameters<typeof FileTransport>[0]> = {}
): FileTransport {
  return new FileTransport({ dir, flushIntervalMs: 0, ...opts })
}

describe('FileTransport', () => {
  it('write + flushSync 가 JSONL 1줄 = 1레코드로 append 한다', () => {
    const t = transport()
    t.write('{"a":1}')
    t.write('{"b":2}')
    t.flushSync()
    const content = readFileSync(join(dir, 'application.jsonl'), 'utf8')
    expect(content).toBe('{"a":1}\n{"b":2}\n')
    t.close()
  })

  it('close() 가 잔여 버퍼를 flush 한다', () => {
    const t = transport()
    t.write('{"a":1}')
    t.close()
    expect(readFileSync(join(dir, 'application.jsonl'), 'utf8')).toBe('{"a":1}\n')
  })

  it('maxBytes 초과 시 base → .1 로 시프트하고 새 파일에 이어쓴다', () => {
    const t = transport({ maxBytes: 64 })
    t.write('x'.repeat(80))
    t.flushSync()
    t.write('{"next":true}')
    t.flushSync()
    expect(readFileSync(join(dir, 'application.1.jsonl'), 'utf8')).toContain('xxx')
    expect(readFileSync(join(dir, 'application.jsonl'), 'utf8')).toBe('{"next":true}\n')
    t.close()
  })

  it('보관 상한(maxFiles) 초과분은 가장 오래된 것부터 삭제한다', () => {
    const t = transport({ maxBytes: 16, maxFiles: 3 })
    for (let i = 0; i < 6; i++) {
      t.write(`{"gen":${i},"pad":"${'p'.repeat(24)}"}`)
      t.flushSync()
    }
    t.close()
    const files = readdirSync(dir).sort()
    // base + .1 + .2 만 남는다 (.3 이상 없음).
    expect(files).toEqual(['application.1.jsonl', 'application.2.jsonl', 'application.jsonl'])
  })

  it('재실행(새 인스턴스) 시 기존 파일 크기를 이어받아 로테이션이 연속된다', () => {
    writeFileSync(join(dir, 'application.jsonl'), 'y'.repeat(60) + '\n')
    const t = transport({ maxBytes: 64 })
    t.write('{"after":"restart"}')
    t.flushSync()
    t.close()
    // 기존 60B + 신규 20B > 64B → 기존 파일이 .1 로 밀려났어야 한다.
    expect(existsSync(join(dir, 'application.1.jsonl'))).toBe(true)
    expect(readFileSync(join(dir, 'application.jsonl'), 'utf8')).toBe('{"after":"restart"}\n')
  })

  it('쓰기 실패 시 스스로 비활성화하고 이후 write 는 무해한 no-op (앱 무영향)', () => {
    const failures: string[] = []
    // dir 를 파일로 만들어 append 실패를 유도한다.
    const bad = join(dir, 'not-a-dir')
    writeFileSync(bad, 'file')
    const t = new FileTransport({
      dir: join(bad, 'logs'),
      flushIntervalMs: 0,
      onInternalError: (m) => failures.push(m)
    })
    expect(() => {
      t.write('{"a":1}')
      t.flushSync()
      t.close()
    }).not.toThrow()
    expect(t.isDisabled).toBe(true)
    expect(failures.length).toBeGreaterThan(0)
  })
})
