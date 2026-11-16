// 설정 파일은 주입받은 디렉토리에 생긴다 (0324 EP-13 · AC37).

import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRODUCT_SLUG } from '../../shared/product'
import { FileBackedStore } from './electron-store.testfixture'

vi.mock('electron-store', async () => ({
  default: (await import('./electron-store.testfixture')).FileBackedStore
}))

import { SettingsStore } from './settings-store'

let injected: string
let fallback: string

beforeEach(() => {
  injected = mkdtempSync(join(tmpdir(), 'oo-settings-cwd-'))
  fallback = mkdtempSync(join(tmpdir(), 'oo-settings-fallback-'))
  FileBackedStore.fallbackDir = fallback
})

afterEach(() => {
  rmSync(injected, { recursive: true, force: true })
  rmSync(fallback, { recursive: true, force: true })
})

describe('SettingsStore 의 파일 위치', () => {
  it('주입받은 디렉토리에 설정 파일을 쓰고 다른 디렉토리에는 쓰지 않는다', () => {
    new SettingsStore('1.0.0', { cwd: injected }).getAll()

    expect(readdirSync(injected)).toEqual([`${PRODUCT_SLUG}-settings.json`])
    expect(readdirSync(fallback)).toEqual([])
  })
})
