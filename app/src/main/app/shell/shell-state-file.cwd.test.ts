// 셸 상태 파일은 주입받은 디렉토리에 생긴다 (0324 EP-13 · AC37′) — 다른 세 스토어의 `*.cwd.test.ts` 와 같다.

import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRODUCT_SLUG } from '../../../shared/product'
import { FileBackedStore } from '../../infra/electron-store.testfixture'

vi.mock('electron-store', async () => ({
  default: (await import('../../infra/electron-store.testfixture')).FileBackedStore
}))

import { openShellState } from './shell-state-file'

let injected: string
let fallback: string

beforeEach(() => {
  injected = mkdtempSync(join(tmpdir(), 'oo-shell-state-cwd-'))
  fallback = mkdtempSync(join(tmpdir(), 'oo-shell-state-fallback-'))
  FileBackedStore.fallbackDir = fallback
})

afterEach(() => {
  rmSync(injected, { recursive: true, force: true })
  rmSync(fallback, { recursive: true, force: true })
})

describe('셸 상태 파일의 위치', () => {
  it('주입받은 디렉토리에 셸 상태 파일을 쓰고 다른 디렉토리에는 쓰지 않는다', () => {
    openShellState(injected).mirrorUiLocale('en')

    expect(readdirSync(injected)).toEqual([`${PRODUCT_SLUG}-shell-state.json`])
    expect(readdirSync(fallback)).toEqual([])
  })
})
