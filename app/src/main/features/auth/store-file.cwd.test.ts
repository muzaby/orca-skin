// 인증 파일(grant · OAuth pending)은 주입받은 디렉토리에 생긴다 (0324 EP-13 · AC37).

import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRODUCT_SLUG } from '../../../shared/product'
import { FileBackedStore } from '../../infra/electron-store.testfixture'

vi.mock('electron-store', async () => ({
  default: (await import('../../infra/electron-store.testfixture')).FileBackedStore
}))

import { createGrantPersistence, createOAuthStatePersistence } from './store-file'

let injected: string
let fallback: string

beforeEach(() => {
  injected = mkdtempSync(join(tmpdir(), 'oo-auth-cwd-'))
  fallback = mkdtempSync(join(tmpdir(), 'oo-auth-fallback-'))
  FileBackedStore.fallbackDir = fallback
})

afterEach(() => {
  rmSync(injected, { recursive: true, force: true })
  rmSync(fallback, { recursive: true, force: true })
})

describe('인증 파일의 위치', () => {
  it('grant 파일을 주입받은 디렉토리에 쓴다', () => {
    const unavailable = vi.fn()
    expect(createGrantPersistence(injected, unavailable).save({})).toBe(true)

    expect(readdirSync(injected)).toEqual([`${PRODUCT_SLUG}-provider-grants.json`])
    expect(readdirSync(fallback)).toEqual([])
    expect(unavailable).not.toHaveBeenCalled()
  })

  it('OAuth pending 파일을 주입받은 디렉토리에 쓴다', () => {
    const unavailable = vi.fn()
    createOAuthStatePersistence(injected, unavailable).save({})

    expect(readdirSync(injected)).toEqual([`${PRODUCT_SLUG}-provider-oauth.json`])
    expect(readdirSync(fallback)).toEqual([])
    expect(unavailable).not.toHaveBeenCalled()
  })
})
