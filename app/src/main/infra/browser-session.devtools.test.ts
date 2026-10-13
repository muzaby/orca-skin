// 0261 AC5 · EP-02 ② — 로그인 창의 DevTools 는 빌드 상수를 따른다(D-002·D-003).
//
// 로그인 창은 외부 IdP 페이지를 싣는다. production 번들에서는 `import.meta.env.DEV` 가 false 로 접히고,
// 여기서는 `vi.stubEnv('DEV', …)` 로 같은 두 값을 만든 뒤 **실제 생성자 인자**를 본다 — 구조 스캔
// (`browser-window-devtools.test.ts`)이 리터럴을, 이 테스트가 그 리터럴이 창에 도달하는 경로를 잠근다.

import { afterEach, describe, expect, it, vi } from 'vitest'

interface CreatedWindow {
  options: { webPreferences?: Record<string, unknown> }
  emit: (event: string) => void
}

const { BrowserWindowMock, created } = vi.hoisted(() => {
  const created: CreatedWindow[] = []
  const BrowserWindowMock = vi.fn(function (options: CreatedWindow['options']) {
    const handlers = new Map<string, () => void>()
    created.push({ options, emit: (event) => handlers.get(event)?.() })
    return {
      webContents: { on: vi.fn(), setWindowOpenHandler: vi.fn() },
      on: vi.fn((event: string, fn: () => void) => void handlers.set(event, fn)),
      loadURL: vi.fn(async () => undefined),
      isDestroyed: () => false,
      destroy: vi.fn()
    }
  })
  return { BrowserWindowMock, created }
})

vi.mock('electron', () => ({
  BrowserWindow: BrowserWindowMock,
  session: { fromPartition: vi.fn(() => ({ allowNTLMCredentialsForDomains: vi.fn() })) },
  net: {}
}))

import { BrowserSessionStore } from './browser-session'

// 창을 띄우고 사용자가 닫은 것으로 정착시킨다(타이머 정리) — 생성자에 넘긴 webPreferences 를 돌려준다.
async function openLoginWindowPrefs(): Promise<Record<string, unknown> | undefined> {
  const store = new BrowserSessionStore()
  store.register({ sessionGroup: 'g', allowedOrigins: ['https://idp.example'] })
  const pending = store.openLoginWindow(store.acquire('g'), {
    url: 'https://idp.example/login',
    isDone: () => false
  })
  const win = created.at(-1)
  win?.emit('closed')
  await expect(pending).rejects.toThrow('사용자가 로그인 창을 닫았습니다')
  return win?.options.webPreferences
}

afterEach(() => {
  vi.unstubAllEnvs()
  created.length = 0
})

describe('로그인 창 DevTools (0261 AC5 · EP-02 ②)', () => {
  it('production 빌드(DEV=false)에서는 devTools 를 끈다 — 보안 3키·파티션은 그대로', async () => {
    vi.stubEnv('DEV', false)
    expect(await openLoginWindowPrefs()).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:auth.g',
      devTools: false
    })
  })

  it('dev 빌드(DEV=true)에서는 devTools 를 연다', async () => {
    vi.stubEnv('DEV', true)
    expect((await openLoginWindowPrefs())?.devTools).toBe(true)
  })
})
