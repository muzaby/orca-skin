// McpStore mcp.json 파스 캐시 (0092) — read 는 최초 1회만 디스크를 파싱하고, write(CRUD)가
// 캐시를 갱신해 이후 read 가 신선값을 돌려준다. 디스크/electron 의존(file·secret-store)은 mock.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const readMcpFile = vi.fn()
const writeMcpFile = vi.fn()
vi.mock('./file', () => ({
  readMcpFile: (...args: unknown[]) => readMcpFile(...args),
  writeMcpFile: (...args: unknown[]) => writeMcpFile(...args)
}))
vi.mock('../../../infra/config/secret-store', () => ({
  SecretStore: class {
    has(): boolean {
      return false
    }
    get(): string | undefined {
      return undefined
    }
    set(): void {
      /* no-op — 비밀 경로는 본 테스트 비대상 */
    }
    delete(): void {
      /* no-op */
    }
  }
}))

import { McpStore } from './store'
import type { SettingsStore } from '../../../infra/settings-store'

const baseSettings = {
  mcpEnabled: {} as Record<string, boolean>,
  mcpMeta: {} as Record<string, { description: string }>
}

function fakeSettings(): SettingsStore {
  return {
    getAll: () => baseSettings,
    patch: () => baseSettings
  } as unknown as SettingsStore
}

describe('McpStore 캐시 (0092)', () => {
  beforeEach(() => {
    readMcpFile.mockReset()
    writeMcpFile.mockReset()
    readMcpFile.mockReturnValue({ mcpServers: { gh: { command: 'gh-mcp' } } })
  })

  it('enabledConfig 반복 호출은 mcp.json 을 1회만 파싱한다', () => {
    const store = new McpStore(fakeSettings())

    expect(store.enabledConfig()).toEqual({ gh: { command: 'gh-mcp' } })
    expect(store.enabledConfig()).toEqual({ gh: { command: 'gh-mcp' } })
    store.list()

    expect(readMcpFile).toHaveBeenCalledTimes(1)
  })

  it('CRUD(write) 후 enabledConfig 는 재파싱 없이 신선값을 반환한다', () => {
    const store = new McpStore(fakeSettings())
    store.enabledConfig()

    store.add({ name: 'api', transport: 'http', url: 'https://x' })
    expect(writeMcpFile).toHaveBeenCalledTimes(1)

    const config = store.enabledConfig()
    expect(Object.keys(config).sort()).toEqual(['api', 'gh'])
    expect(readMcpFile).toHaveBeenCalledTimes(1)

    store.remove('gh')
    expect(store.enabledConfig()).toEqual({ api: { type: 'http', url: 'https://x' } })
    expect(readMcpFile).toHaveBeenCalledTimes(1)
  })
})
