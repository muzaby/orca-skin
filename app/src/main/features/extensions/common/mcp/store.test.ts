// McpStore mcp.json 파스 캐시 (0092) — read 는 최초 1회만 디스크를 파싱하고, write(CRUD)가
// 캐시를 갱신해 이후 read 가 신선값을 돌려준다. 디스크/electron 의존(file·secret-store)은 mock.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const readMcpFile = vi.fn()
const writeMcpFile = vi.fn()
vi.mock('./file', () => ({
  readMcpFile: (...args: unknown[]) => readMcpFile(...args),
  writeMcpFile: (...args: unknown[]) => writeMcpFile(...args)
}))
vi.mock('../../../../infra/config/secret-store', () => ({
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
import type { SettingsStore } from '../../../../infra/settings-store'
import { memorySecrets } from '../../../../infra/config/memory-secrets.testfixture'

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
    const store = new McpStore(fakeSettings(), memorySecrets())

    expect(store.enabledConfig()).toEqual({ gh: { command: 'gh-mcp' } })
    expect(store.enabledConfig()).toEqual({ gh: { command: 'gh-mcp' } })
    store.list()

    expect(readMcpFile).toHaveBeenCalledTimes(1)
  })

  it('CRUD(write) 후 enabledConfig 는 재파싱 없이 신선값을 반환한다', async () => {
    const store = new McpStore(fakeSettings(), memorySecrets())
    store.enabledConfig()

    await store.add({ name: 'api', transport: 'http', url: 'https://x' })
    expect(writeMcpFile).toHaveBeenCalledTimes(1)

    const config = store.enabledConfig()
    expect(Object.keys(config).sort()).toEqual(['api', 'gh'])
    expect(readMcpFile).toHaveBeenCalledTimes(1)

    await store.remove('gh')
    expect(store.enabledConfig()).toEqual({ api: { type: 'http', url: 'https://x' } })
    expect(readMcpFile).toHaveBeenCalledTimes(1)
  })

  it('비밀만 주고 변수 이름을 안 주면 제품 접두사로 합성한다 (0306 EP-07)', async () => {
    const store = new McpStore(fakeSettings(), memorySecrets())
    await store.add({ name: 'my-api', transport: 'http', url: 'https://x', auth: 'token' })
    expect(store.list().find((server) => server.name === 'my-api')?.authEnvKey).toBe(
      'ORCINUS_ORCA_MCP_MY_API_AUTH'
    )
  })
})

// 0324 EP-18 — MCP 서버의 인증값은 비밀 저장소(봉인 쓰기)에 두고 mcp.json 에는 변수 참조만 남는다.
describe('McpStore 비밀 경로 (0324 EP-18)', () => {
  beforeEach(() => {
    readMcpFile.mockReset()
    writeMcpFile.mockReset()
    readMcpFile.mockReturnValue({ mcpServers: {} })
  })
  const VAR = 'ORCINUS_ORCA_MCP_API_AUTH'

  it('비밀이 있는 서버만 hasAuth 다', async () => {
    const map = new Map<string, string>()
    const store = new McpStore(fakeSettings(), memorySecrets(map))
    await store.add({ name: 'api', transport: 'http', url: 'https://x', auth: 'token-A' })
    expect(map.get(VAR)).toBe('token-A')
    expect(store.list()[0]).toMatchObject({ authEnvKey: VAR, hasAuth: true })
    map.delete(VAR)
    expect(store.list()[0]).toMatchObject({ authEnvKey: VAR, hasAuth: false })
  })

  it('인증값을 바꾸지 않은 수정은 저장된 비밀의 참조를 그대로 둔다', async () => {
    const map = new Map<string, string>()
    const store = new McpStore(fakeSettings(), memorySecrets(map))
    await store.add({ name: 'api', transport: 'http', url: 'https://x', auth: 'token-A' })
    await store.update({ id: 'api', url: 'https://y' })
    expect(store.list()[0]).toMatchObject({ url: 'https://y', authEnvKey: VAR, hasAuth: true })
    expect(map.get(VAR)).toBe('token-A')
  })

  it('변수 이름만 바꾸면 비밀을 새 이름으로 옮기고 옛 이름은 지운다', async () => {
    const map = new Map<string, string>()
    const store = new McpStore(fakeSettings(), memorySecrets(map))
    await store.add({ name: 'api', transport: 'http', url: 'https://x', auth: 'token-A' })
    await store.update({ id: 'api', authEnvKey: 'NEW_AUTH' })
    expect(map.get('NEW_AUTH')).toBe('token-A')
    expect(map.has(VAR)).toBe(false)
    expect(store.list()[0]).toMatchObject({ authEnvKey: 'NEW_AUTH', hasAuth: true })
  })

  it('봉인 쓰기가 실패하면 추가가 실패하고 mcp.json 을 쓰지 않는다', async () => {
    const secrets = memorySecrets()
    secrets.set = async () => {
      throw new Error('암호화를 사용할 수 없어 인증값을 저장할 수 없습니다.')
    }
    const store = new McpStore(fakeSettings(), secrets)
    await expect(
      store.add({ name: 'api', transport: 'http', url: 'https://x', auth: 'token-A' })
    ).rejects.toThrow('암호화')
    expect(writeMcpFile).not.toHaveBeenCalled()
  })

  it('서버를 지우면 다른 서버가 쓰지 않는 비밀만 지운다', async () => {
    const map = new Map<string, string>()
    const store = new McpStore(fakeSettings(), memorySecrets(map))
    await store.add({
      name: 'a',
      transport: 'http',
      url: 'https://a',
      authEnvKey: 'SHARED_AUTH',
      auth: 'shared-token'
    })
    await store.add({
      name: 'b',
      transport: 'http',
      url: 'https://b',
      authEnvKey: 'SHARED_AUTH',
      auth: 'shared-token'
    })
    await store.remove('a')
    expect(map.get('SHARED_AUTH')).toBe('shared-token')
    await store.remove('b')
    expect(map.has('SHARED_AUTH')).toBe(false)
  })
})
