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
