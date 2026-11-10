import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureOoFile, parseOoFile, readOoFile } from './oo-file'

let dir = ''

vi.mock('./paths', () => ({
  ooJsonPath: () => join(dir, 'orcinus-orca.json')
}))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orcinus-orca-config-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('parseOoFile', () => {
  it('정상 샘플을 파싱하고 env(${VAR} 미확장)를 보존하며 알 수 없는 키는 strip 한다', () => {
    const { config, warnings } = parseOoFile(
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
    const { config, warnings } = parseOoFile(JSON.stringify({ version: 1 }))
    expect(warnings).toEqual([])
    expect(config).toEqual({ version: 1 })
  })

  it('update 설정을 파싱한다', () => {
    expect(
      parseOoFile(
        JSON.stringify({
          version: 1,
          update: { provider: 'github', owner: 'company', repo: 'orcinus-orca', channel: 'latest' }
        })
      ).config.update
    ).toEqual({ provider: 'github', owner: 'company', repo: 'orcinus-orca', channel: 'latest' })

    expect(
      parseOoFile(
        JSON.stringify({
          version: 1,
          update: { provider: 'generic', url: 'https://updates.example.com/orcinus-orca/latest' }
        })
      ).config.update
    ).toEqual({ provider: 'generic', url: 'https://updates.example.com/orcinus-orca/latest' })

    expect(
      parseOoFile(JSON.stringify({ version: 1, update: { enabled: false } })).config.update
    ).toEqual({
      enabled: false
    })
  })

  it('github host(GitHub Enterprise) override 를 파싱한다', () => {
    expect(
      parseOoFile(
        JSON.stringify({
          version: 1,
          update: {
            provider: 'github',
            owner: 'infra',
            repo: 'orcinus-orca',
            host: 'github.company.com',
            protocol: 'https'
          }
        })
      ).config.update
    ).toEqual({
      provider: 'github',
      owner: 'infra',
      repo: 'orcinus-orca',
      host: 'github.company.com',
      protocol: 'https'
    })
  })

  it('s3(오브젝트 스토리지) 설정을 파싱한다 — MinIO endpoint/path 포함', () => {
    expect(
      parseOoFile(
        JSON.stringify({
          version: 1,
          update: {
            provider: 's3',
            bucket: 'orcinus-orca-updates',
            region: 'ap-northeast-2',
            endpoint: 'http://minio.internal:9000',
            path: 'win'
          }
        })
      ).config.update
    ).toEqual({
      provider: 's3',
      bucket: 'orcinus-orca-updates',
      region: 'ap-northeast-2',
      endpoint: 'http://minio.internal:9000',
      path: 'win'
    })
  })

  it('잘못된 update 설정은 최상위 스키마 위반으로 기본값 처리한다', () => {
    expect(
      parseOoFile(JSON.stringify({ version: 1, update: { provider: 'generic', url: 'not-url' } }))
        .warnings[0]
    ).toContain('최상위 스키마 위반')
    expect(
      parseOoFile(JSON.stringify({ version: 1, update: { provider: 'github', owner: 'x' } })).config
    ).toEqual({ version: 1 })
    // s3: bucket 누락 → 위반
    expect(parseOoFile(JSON.stringify({ version: 1, update: { provider: 's3' } })).config).toEqual({
      version: 1
    })
    // s3: endpoint 비-URL → 위반
    expect(
      parseOoFile(
        JSON.stringify({
          version: 1,
          update: { provider: 's3', bucket: 'orcinus-orca', endpoint: 'not-url' }
        })
      ).warnings[0]
    ).toContain('최상위 스키마 위반')
  })

  it('JSON 손상 시 기본값으로 동작한다', () => {
    const { config, warnings } = parseOoFile('{ bad json')
    expect(config).toEqual({ version: 1 })
    expect(warnings[0]).toContain('JSON 파싱 실패')
  })

  it('최상위 version 위반 시 전체 기본값으로 동작한다', () => {
    const { config, warnings } = parseOoFile(JSON.stringify({ version: 2, env: {} }))
    expect(config).toEqual({ version: 1 })
    expect(warnings[0]).toContain('최상위 스키마 위반')
  })

  it('env 가 객체가 아니면 전체 스키마 위반으로 기본값 처리한다', () => {
    const { config, warnings } = parseOoFile(JSON.stringify({ version: 1, env: 'oops' }))
    expect(config).toEqual({ version: 1 })
    expect(warnings[0]).toContain('최상위 스키마 위반')
  })

  it('debug 스위치(0144)를 파싱한다 — true/false 보존, 부재 시 키 생략', () => {
    expect(parseOoFile(JSON.stringify({ version: 1, debug: true })).config).toEqual({
      version: 1,
      debug: true
    })
    expect(parseOoFile(JSON.stringify({ version: 1, debug: false })).config).toEqual({
      version: 1,
      debug: false
    })
    expect(parseOoFile(JSON.stringify({ version: 1 })).config).toEqual({ version: 1 })
  })

  it('debug 가 불린이 아니면 최상위 스키마 위반으로 기본값 처리한다', () => {
    const { config, warnings } = parseOoFile(JSON.stringify({ version: 1, debug: 'yes' }))
    expect(config).toEqual({ version: 1 })
    expect(warnings[0]).toContain('최상위 스키마 위반')
  })

  it('구 agents 필드(handoff 0009~0010) 잔존 시 무시하되 이전 안내 경고를 낸다 (클린 브레이크)', () => {
    const { config, warnings } = parseOoFile(
      JSON.stringify({
        version: 1,
        env: { A: '1' },
        agents: [{ adapter: 'claude', provider: 'bedrock', models: [] }]
      })
    )
    expect(config).toEqual({ version: 1, env: { A: '1' } })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('agents 필드는 제거')
    expect(warnings[0]).toContain('sources/settings/')
  })
})

describe('Orcinus orca file I/O', () => {
  it('부재 시 빈 템플릿을 생성한다', () => {
    ensureOoFile()
    expect(JSON.parse(readFileSync(join(dir, 'orcinus-orca.json'), 'utf8'))).toEqual({ version: 1 })
  })

  it('기존 파일은 덮어쓰지 않는다', () => {
    writeFileSync(join(dir, 'orcinus-orca.json'), '{"version":1,"env":{"A":"1"}}', 'utf8')
    ensureOoFile()
    expect(readFileSync(join(dir, 'orcinus-orca.json'), 'utf8')).toBe(
      '{"version":1,"env":{"A":"1"}}'
    )
  })

  it('손상된 원본 파일을 수정하지 않고 기본값을 반환한다', () => {
    writeFileSync(join(dir, 'orcinus-orca.json'), '{ bad json', 'utf8')
    const result = readOoFile()
    expect(result.config).toEqual({ version: 1 })
    expect(readFileSync(join(dir, 'orcinus-orca.json'), 'utf8')).toBe('{ bad json')
  })
})
