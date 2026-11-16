// 0322 — 트레이 상주 판정·메뉴·수명주기. `tray-residency.ts` 는 electron 을 import 하지 않으므로
// 가짜 포트(리스너 맵 + vi.fn)로 production 함수를 그대로 실행한다.

import { describe, expect, it, vi, type Mock } from 'vitest'
import {
  installTrayResidency,
  TRAY_MENU_LABELS,
  type ResidentWindowPort,
  type TrayLocale,
  type TrayMenuItem
} from './tray-residency'

type Listener = (...args: never[]) => void

function emitter(): {
  on: (event: string, listener: Listener) => void
  emit: (event: string, ...args: unknown[]) => void
  count: (event: string) => number
} {
  const listeners = new Map<string, Listener[]>()
  return {
    on: (event, listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
    },
    emit: (event, ...args) => {
      for (const listener of listeners.get(event) ?? [])
        (listener as (...a: unknown[]) => void)(...args)
    },
    count: (event) => listeners.get(event)?.length ?? 0
  }
}

type PatchListener = (next: unknown, changedKeys: readonly string[]) => void

interface FakeWindow {
  port: ResidentWindowPort
  hide: Mock<() => void>
  // 닫기 요청을 한 번 보내고 그 이벤트의 preventDefault 를 돌려준다.
  close: () => Mock<() => void>
  emit: (event: string) => void
}

interface Harness {
  app: ReturnType<typeof emitter> & { quit: Mock<() => void> }
  tray: {
    setToolTip: Mock<(text: string) => void>
    setContextMenu: Mock<(menu: TrayMenuItem[]) => void>
    on: (event: string, listener: Listener) => void
    destroy: Mock<() => void>
  }
  trayEvents: ReturnType<typeof emitter>
  createTray: Mock<() => Harness['tray']>
  open: Mock<() => void>
  state: { uiLocale: TrayLocale }
  settings: {
    getAll: () => { uiLocale: TrayLocale }
    onPatch: Mock<(listener: PatchListener) => void>
  }
  install: () => { attach(win: ResidentWindowPort): void }
  win: () => FakeWindow
  patch: (changedKeys: readonly string[]) => void
  lastMenu: () => TrayMenuItem[]
}

function setup(
  options: { platform?: NodeJS.Platform; locale?: TrayLocale; trayError?: Error } = {}
): Harness {
  const app = { ...emitter(), quit: vi.fn<() => void>() }
  const trayEvents = emitter()
  const tray: Harness['tray'] = {
    setToolTip: vi.fn<(text: string) => void>(),
    setContextMenu: vi.fn<(menu: TrayMenuItem[]) => void>(),
    on: trayEvents.on,
    destroy: vi.fn<() => void>()
  }
  const createTray = vi.fn<() => Harness['tray']>(() => {
    if (options.trayError) throw options.trayError
    return tray
  })
  const open = vi.fn<() => void>()
  const state = { uiLocale: options.locale ?? ('ko' as TrayLocale) }
  const patchListeners: PatchListener[] = []
  const settings: Harness['settings'] = {
    getAll: () => ({ uiLocale: state.uiLocale }),
    onPatch: vi.fn<(listener: PatchListener) => void>((listener) => {
      patchListeners.push(listener)
    })
  }
  const install: Harness['install'] = () =>
    installTrayResidency<TrayMenuItem[]>({
      platform: options.platform ?? 'win32',
      app,
      createTray,
      // 메뉴 객체 = 받은 항목 그대로. 라벨·click 을 직접 관측한다.
      buildMenu: (items) => items,
      tooltip: 'Orcinus orca',
      open,
      settings
    })
  const win: Harness['win'] = () => {
    const events = emitter()
    const hide = vi.fn<() => void>()
    return {
      port: { on: events.on, hide },
      hide,
      close: () => {
        const preventDefault = vi.fn<() => void>()
        events.emit('close', { preventDefault })
        return preventDefault
      },
      emit: events.emit
    }
  }
  const patch: Harness['patch'] = (changedKeys) => {
    for (const listener of patchListeners) listener({}, changedKeys)
  }
  const lastMenu: Harness['lastMenu'] = () => tray.setContextMenu.mock.lastCall![0]
  return { app, tray, trayEvents, createTray, open, state, settings, install, win, patch, lastMenu }
}

describe('installTrayResidency — 닫기 판정 (EP-01)', () => {
  it('AC1 — Windows 에서 종료 중이 아니면 닫기를 취소하고 창을 숨긴다', () => {
    const h = setup()
    const w = h.win()
    h.install().attach(w.port)
    const preventDefault = w.close()
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(w.hide).toHaveBeenCalledOnce()
  })

  it('B5 — 숨김은 종료 중 상태를 켜지 않는다: 닫기 두 번 모두 숨긴다', () => {
    const h = setup()
    const w = h.win()
    h.install().attach(w.port)
    expect(w.close()).toHaveBeenCalledOnce()
    expect(w.close()).toHaveBeenCalledOnce()
    expect(w.hide).toHaveBeenCalledTimes(2)
  })

  it.each([1, 2])('AC4 — before-quit %i회 뒤의 닫기는 숨기지 않는다', (times) => {
    const h = setup()
    const w = h.win()
    h.install().attach(w.port)
    for (let i = 0; i < times; i++) h.app.emit('before-quit')
    expect(w.close()).not.toHaveBeenCalled()
    expect(w.hide).not.toHaveBeenCalled()
  })

  it('AC5 — OS 세션 종료 통지 뒤의 닫기는 숨기지 않는다', () => {
    const h = setup()
    const w = h.win()
    h.install().attach(w.port)
    w.emit('session-end')
    expect(w.close()).not.toHaveBeenCalled()
    expect(w.hide).not.toHaveBeenCalled()
  })

  it.each(['darwin', 'linux'] as const)(
    'AC6 — %s 에서는 트레이를 만들지 않고 닫기를 건드리지 않는다',
    (platform) => {
      const h = setup({ platform })
      const w = h.win()
      h.install().attach(w.port)
      expect(h.createTray).not.toHaveBeenCalled()
      expect(h.settings.onPatch).not.toHaveBeenCalled()
      expect(w.close()).not.toHaveBeenCalled()
      expect(w.hide).not.toHaveBeenCalled()
      // 트레이가 없으면 종료 정리도 던지지 않는다 (EP-04).
      expect(() => h.app.emit('will-quit')).not.toThrow()
      expect(h.tray.destroy).not.toHaveBeenCalled()
    }
  )
})

describe('installTrayResidency — 트레이 표면 (EP-02 · EP-05)', () => {
  it.each([
    ['ko', ['열기', '종료']],
    ['en', ['Open', 'Quit']]
  ] as const)('AC2 — %s: 메뉴는 두 항목뿐이고 순서대로 창 열기·앱 종료다', (locale, labels) => {
    const h = setup({ locale })
    h.install()
    const menu = h.lastMenu()
    expect(menu.map((item) => item.label)).toEqual(labels)

    menu[0].click()
    expect(h.open).toHaveBeenCalledOnce()
    expect(h.app.quit).not.toHaveBeenCalled()

    menu[1].click()
    expect(h.app.quit).toHaveBeenCalledOnce()
    // 실제 app.quit 은 App 인스턴스 메서드다 — 분리 참조로 부르면 바인딩이 깨진다 (ΔV4).
    expect(h.app.quit.mock.contexts[0]).toBe(h.app)
    expect(h.open).toHaveBeenCalledOnce()
  })

  it('라벨 표의 두 언어는 서로 다른 문구다', () => {
    expect(TRAY_MENU_LABELS.ko).not.toEqual(TRAY_MENU_LABELS.en)
  })

  it('AC3 — 트레이 아이콘 좌클릭은 창을 연다', () => {
    const h = setup()
    h.install()
    h.trayEvents.emit('click')
    expect(h.open).toHaveBeenCalledOnce()
    expect(h.app.quit).not.toHaveBeenCalled()
  })

  it('툴팁은 받은 문자열 그대로다', () => {
    const h = setup()
    h.install()
    expect(h.tray.setToolTip).toHaveBeenCalledExactlyOnceWith('Orcinus orca')
  })

  it('AC7 — 트레이 생성 실패는 삼키지 않고 같은 오류로 던진다', () => {
    const error = new Error('tray unavailable')
    const h = setup({ trayError: error })
    expect(() => h.install()).toThrow(error)
  })

  it('AC11 — UI 언어가 바뀌면 메뉴를 다시 만들고, 다른 설정 변경에는 반응하지 않는다', () => {
    const h = setup({ locale: 'ko' })
    h.install()
    expect(h.tray.setContextMenu).toHaveBeenCalledOnce()

    h.state.uiLocale = 'en'
    h.patch(['theme'])
    expect(h.tray.setContextMenu).toHaveBeenCalledOnce()

    h.patch(['theme', 'uiLocale'])
    expect(h.tray.setContextMenu).toHaveBeenCalledTimes(2)
    const menu = h.lastMenu()
    expect(menu.map((item) => item.label)).toEqual(['Open', 'Quit'])
    menu[0].click()
    expect(h.open).toHaveBeenCalledOnce()
    menu[1].click()
    expect(h.app.quit).toHaveBeenCalledOnce()
    // 다시 만든 메뉴의 종료도 app 에 묶인 채 부른다 (ΔV4).
    expect(h.app.quit.mock.contexts[0]).toBe(h.app)
  })
})

describe('installTrayResidency — 수명주기 (EP-04 · VP-02)', () => {
  it('AC8 — 프로세스 종료 때 트레이 아이콘을 없앤다', () => {
    const h = setup()
    h.install()
    expect(h.tray.destroy).not.toHaveBeenCalled()
    h.app.emit('will-quit')
    expect(h.tray.destroy).toHaveBeenCalledOnce()
  })

  it('숨김 → 열기 → 종료 시작 → 닫힘 통과 → 정리 순서로 한 인스턴스가 지난다', () => {
    const h = setup()
    const w = h.win()
    h.install().attach(w.port)

    const first = w.close()
    expect(first).toHaveBeenCalledOnce()
    expect(w.hide).toHaveBeenCalledOnce()

    h.trayEvents.emit('click')
    expect(h.open).toHaveBeenCalledOnce()

    h.lastMenu()[1].click()
    expect(h.app.quit).toHaveBeenCalledOnce()
    h.app.emit('before-quit')

    const second = w.close()
    expect(second).not.toHaveBeenCalled()
    expect(w.hide).toHaveBeenCalledOnce()

    h.app.emit('will-quit')
    expect(h.tray.destroy).toHaveBeenCalledOnce()
  })
})
