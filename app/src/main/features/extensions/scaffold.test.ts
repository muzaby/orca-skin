import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scaffoldProviderSettings } from './scaffold'

let root: string
const settingsDir = (): string => join(root, 'sources', 'settings', 'claude')

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-scaffold-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scaffoldProviderSettings', () => {
  it('빈 상태에서 anthropic settings.json 템플릿만 생성한다', () => {
    const r = scaffoldProviderSettings('claude', root)
    expect(r.created).toEqual([join(settingsDir(), 'anthropic', 'settings.json')])
    expect(
      JSON.parse(readFileSync(join(settingsDir(), 'anthropic', 'settings.json'), 'utf8'))
    ).toEqual({ env: {} })
  })

  it('멱등 — 재호출 시 아무것도 만들지 않는다', () => {
    scaffoldProviderSettings('claude', root)
    expect(scaffoldProviderSettings('claude', root).created).toEqual([])
  })

  it('provider 디렉토리가 이미 있으면 손대지 않는다', () => {
    mkdirSync(join(settingsDir(), 'bedrock'), { recursive: true })
    const r = scaffoldProviderSettings('claude', root)
    expect(existsSync(join(settingsDir(), 'anthropic'))).toBe(false)
    expect(r.created).toEqual([])
  })
})

// 0090 — 사용자 전역 ~/.claude/settings.json 원문이 주어지면 env 판별 provider 로 전문 시딩.
describe('scaffoldProviderSettings — 사용자 settings 시딩 (0090)', () => {
  const read = (provider: string): unknown =>
    JSON.parse(readFileSync(join(settingsDir(), provider, 'settings.json'), 'utf8'))

  it('bedrock env 면 bedrock provider 로 전문을 verbatim 시딩한다', () => {
    const user = {
      env: { CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'ap-northeast-2' },
      permissions: { allow: ['Read'] }
    }
    const r = scaffoldProviderSettings('claude', root, JSON.stringify(user))
    expect(r.created).toEqual([join(settingsDir(), 'bedrock', 'settings.json')])
    expect(read('bedrock')).toEqual(user)
  })

  it('vertex env 면 vertex, 게이트웨이(ANTHROPIC_BASE_URL)면 custom 으로 시딩한다', () => {
    const vertexRoot = mkdtempSync(join(tmpdir(), 'orca-scaffold-'))
    scaffoldProviderSettings(
      'claude',
      vertexRoot,
      JSON.stringify({ env: { CLAUDE_CODE_USE_VERTEX: '1' } })
    )
    expect(
      existsSync(join(vertexRoot, 'sources', 'settings', 'claude', 'vertex', 'settings.json'))
    ).toBe(true)
    rmSync(vertexRoot, { recursive: true, force: true })

    scaffoldProviderSettings('claude', root, JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'x' } }))
    expect(existsSync(join(settingsDir(), 'custom', 'settings.json'))).toBe(true)
  })

  it('판별 신호 없는 env 는 anthropic 으로 전문 시딩한다', () => {
    const user = { env: { ANTHROPIC_API_KEY: 'k' } }
    scaffoldProviderSettings('claude', root, JSON.stringify(user))
    expect(read('anthropic')).toEqual(user)
  })

  it('파싱 실패/비객체 원문은 기본 템플릿으로 폴백한다', () => {
    scaffoldProviderSettings('claude', root, '{broken')
    expect(read('anthropic')).toEqual({ env: {} })
  })

  it('기존 provider 가 있으면 사용자 원문이 있어도 미개입 (업데이트 시나리오)', () => {
    mkdirSync(join(settingsDir(), 'anthropic'), { recursive: true })
    const r = scaffoldProviderSettings(
      'claude',
      root,
      JSON.stringify({ env: { CLAUDE_CODE_USE_BEDROCK: '1' } })
    )
    expect(r.created).toEqual([])
    expect(existsSync(join(settingsDir(), 'bedrock'))).toBe(false)
  })
})
