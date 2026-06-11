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
  it('정상 샘플을 파싱하고 models 를 보존하며 알 수 없는 키는 strip 한다', () => {
    const { config, warnings } = parseOrcaFile(
      JSON.stringify({
        version: 1,
        extra: true,
        agents: [
          {
            adapter: 'claude-code',
            provider: 'bedrock',
            apiKey: '${ANTHROPIC_API_KEY}',
            baseUrl: '',
            env: { AWS_REGION: 'us-west-2' },
            models: [{ family: 'sonnet', name: 'claude-sonnet-4-5', default: true }],
            ignored: 'value'
          }
        ]
      })
    )

    expect(warnings).toEqual([])
    expect(config.agents).toEqual([
      {
        adapter: 'claude-code',
        provider: 'bedrock',
        apiKey: '${ANTHROPIC_API_KEY}',
        baseUrl: '',
        env: { AWS_REGION: 'us-west-2' },
        models: [{ family: 'sonnet', name: 'claude-sonnet-4-5', default: true }]
      }
    ])
  })

  it('JSON 손상 시 기본값으로 동작한다', () => {
    const { config, warnings } = parseOrcaFile('{ bad json')
    expect(config).toEqual({ version: 1, agents: [] })
    expect(warnings[0]).toContain('JSON 파싱 실패')
  })

  it('최상위 version 위반 시 전체 기본값으로 동작한다', () => {
    const { config, warnings } = parseOrcaFile(JSON.stringify({ version: 2, agents: [] }))
    expect(config).toEqual({ version: 1, agents: [] })
    expect(warnings[0]).toContain('최상위 스키마 위반')
  })

  it('개별 invalid agent 만 드롭하고 나머지는 유지한다', () => {
    const { config, warnings } = parseOrcaFile(
      JSON.stringify({
        version: 1,
        agents: [{ adapter: '' }, { adapter: 'claude-code', models: [{ name: 'haiku' }] }]
      })
    )

    expect(config.agents).toEqual([{ adapter: 'claude-code', models: [{ name: 'haiku' }] }])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('agents[0] 드롭')
  })
})

describe('orca file I/O', () => {
  it('부재 시 빈 템플릿을 생성한다', () => {
    ensureOrcaFile()
    expect(JSON.parse(readFileSync(join(dir, 'orca.json'), 'utf8'))).toEqual({
      version: 1,
      agents: []
    })
  })

  it('기존 파일은 덮어쓰지 않는다', () => {
    writeFileSync(join(dir, 'orca.json'), '{"version":1,"agents":[{"adapter":"x"}]}', 'utf8')
    ensureOrcaFile()
    expect(readFileSync(join(dir, 'orca.json'), 'utf8')).toBe(
      '{"version":1,"agents":[{"adapter":"x"}]}'
    )
  })

  it('손상된 원본 파일을 수정하지 않고 기본값을 반환한다', () => {
    writeFileSync(join(dir, 'orca.json'), '{ bad json', 'utf8')
    const result = readOrcaFile()
    expect(result.config).toEqual({ version: 1, agents: [] })
    expect(readFileSync(join(dir, 'orca.json'), 'utf8')).toBe('{ bad json')
  })
})
