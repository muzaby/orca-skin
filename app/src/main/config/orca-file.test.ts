import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureOrcaFile, parseOrcaFile, readOrcaFile } from './orca-file'

let dir = ''

vi.mock('./paths', () => ({
  orcaJsonPath: () => join(dir, 'orca.json')
}))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orca-config-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('parseOrcaFile', () => {
  it('정상 샘플을 파싱하고 env(${VAR} 미확장)를 보존하며 알 수 없는 키는 strip 한다', () => {
    const { config, warnings } = parseOrcaFile(
      JSON.stringify({
        version: 1,
        extra: true,
        env: { HTTPS_PROXY: 'http://proxy:8080', TOKEN: '${MY_TOKEN}' }
      })
    )

    expect(warnings).toEqual([])
    expect(config).toEqual({
      version: 1,
      env: { HTTPS_PROXY: 'http://proxy:8080', TOKEN: '${MY_TOKEN}' }
    })
  })

  it('env 부재 시 키 자체를 생략한다', () => {
    const { config, warnings } = parseOrcaFile(JSON.stringify({ version: 1 }))
    expect(warnings).toEqual([])
    expect(config).toEqual({ version: 1 })
  })

  it('JSON 손상 시 기본값으로 동작한다', () => {
    const { config, warnings } = parseOrcaFile('{ bad json')
    expect(config).toEqual({ version: 1 })
    expect(warnings[0]).toContain('JSON 파싱 실패')
  })

  it('최상위 version 위반 시 전체 기본값으로 동작한다', () => {
    const { config, warnings } = parseOrcaFile(JSON.stringify({ version: 2, env: {} }))
    expect(config).toEqual({ version: 1 })
    expect(warnings[0]).toContain('최상위 스키마 위반')
  })

  it('env 가 객체가 아니면 전체 스키마 위반으로 기본값 처리한다', () => {
    const { config, warnings } = parseOrcaFile(JSON.stringify({ version: 1, env: 'oops' }))
    expect(config).toEqual({ version: 1 })
    expect(warnings[0]).toContain('최상위 스키마 위반')
  })

  it('구 agents 필드(handoff 0009~0010) 잔존 시 무시하되 이전 안내 경고를 낸다 (클린 브레이크)', () => {
    const { config, warnings } = parseOrcaFile(
      JSON.stringify({
        version: 1,
        env: { A: '1' },
        agents: [{ adapter: 'claude-code', provider: 'bedrock', models: [] }]
      })
    )
    expect(config).toEqual({ version: 1, env: { A: '1' } })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('agents 필드는 제거')
    expect(warnings[0]).toContain('sources/settings/')
  })
})

describe('orca file I/O', () => {
  it('부재 시 빈 템플릿을 생성한다', () => {
    ensureOrcaFile()
    expect(JSON.parse(readFileSync(join(dir, 'orca.json'), 'utf8'))).toEqual({ version: 1 })
  })

  it('기존 파일은 덮어쓰지 않는다', () => {
    writeFileSync(join(dir, 'orca.json'), '{"version":1,"env":{"A":"1"}}', 'utf8')
    ensureOrcaFile()
    expect(readFileSync(join(dir, 'orca.json'), 'utf8')).toBe('{"version":1,"env":{"A":"1"}}')
  })

  it('손상된 원본 파일을 수정하지 않고 기본값을 반환한다', () => {
    writeFileSync(join(dir, 'orca.json'), '{ bad json', 'utf8')
    const result = readOrcaFile()
    expect(result.config).toEqual({ version: 1 })
    expect(readFileSync(join(dir, 'orca.json'), 'utf8')).toBe('{ bad json')
  })
})
