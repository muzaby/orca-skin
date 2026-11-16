// 비밀 파일은 주입받은 디렉토리에 생긴다 (0324 EP-13 · AC37).

import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRODUCT_SLUG } from '../../../shared/product'
import { FileBackedStore } from '../electron-store.testfixture'

vi.mock('electron-store', async () => ({
  default: (await import('../electron-store.testfixture')).FileBackedStore
}))
vi.mock('./crypto', () => ({
  encrypt: (plain: string) => `enc:${plain}`,
  safeDecrypt: (enc: string) => enc.replace(/^enc:/, '')
}))

import { SecretStore } from './secret-store'

let injected: string
let fallback: string

beforeEach(() => {
  injected = mkdtempSync(join(tmpdir(), 'oo-secret-cwd-'))
  fallback = mkdtempSync(join(tmpdir(), 'oo-secret-fallback-'))
  FileBackedStore.fallbackDir = fallback
})

afterEach(() => {
  rmSync(injected, { recursive: true, force: true })
  rmSync(fallback, { recursive: true, force: true })
})

describe('SecretStore 의 파일 위치', () => {
  it('주입받은 디렉토리에 비밀 파일을 쓰고 다른 디렉토리에는 쓰지 않는다', () => {
    const store = new SecretStore(injected)
    store.set('TOKEN', 'value')

    expect(readdirSync(injected)).toEqual([`${PRODUCT_SLUG}-secrets.json`])
    expect(readdirSync(fallback)).toEqual([])
    expect(store.get('TOKEN')).toBe('value')
  })
})
