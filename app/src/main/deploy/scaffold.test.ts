import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scaffoldProviderSettings } from './scaffold'

let root: string
const settingsDir = (): string => join(root, 'sources', 'settings', 'claude-code')

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-scaffold-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scaffoldProviderSettings', () => {
  it('빈 상태에서 anthropic 템플릿 + meta.json 을 생성한다', () => {
    const r = scaffoldProviderSettings('claude-code', root)
    expect(r.created).toHaveLength(2)
    expect(
      JSON.parse(readFileSync(join(settingsDir(), 'anthropic', 'settings.json'), 'utf8'))
    ).toEqual({ env: {} })
    const meta = JSON.parse(readFileSync(join(settingsDir(), 'meta.json'), 'utf8'))
    expect(meta.anthropic).toBeDefined()
  })

  it('멱등 — 재호출 시 아무것도 만들지 않는다', () => {
    scaffoldProviderSettings('claude-code', root)
    expect(scaffoldProviderSettings('claude-code', root).created).toEqual([])
  })

  it('provider 디렉토리가 이미 있으면 settings 는 손대지 않고 meta.json 부재만 채운다', () => {
    mkdirSync(join(settingsDir(), 'bedrock'), { recursive: true })
    const r = scaffoldProviderSettings('claude-code', root)
    expect(existsSync(join(settingsDir(), 'anthropic'))).toBe(false)
    expect(r.created).toEqual([join(settingsDir(), 'meta.json')])
  })

  it('기존 meta.json 은 절대 덮어쓰지 않는다', () => {
    mkdirSync(settingsDir(), { recursive: true })
    writeFileSync(join(settingsDir(), 'meta.json'), '{"custom":{}}', 'utf8')
    scaffoldProviderSettings('claude-code', root)
    expect(readFileSync(join(settingsDir(), 'meta.json'), 'utf8')).toBe('{"custom":{}}')
  })
})
