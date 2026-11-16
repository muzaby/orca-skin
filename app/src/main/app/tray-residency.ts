// 트레이 상주 (0322) — Windows 에서 창 닫기를 종료가 아니라 숨김으로 바꾸고 트레이 아이콘을 둔다.
//
// ── 왜 index.ts 인라인이 아닌가 ─────────────────────────────────────────────────────────
// `index.ts` 는 모듈 부작용이 커서 import 하는 테스트가 없다. 여기는 electron 을 import 하지 않고
// 구조 포트만 받는다(`native-settings-lifecycle.ts` 와 같은 형상) — "언제 숨기고 언제 닫히게 두는가"
// 를 런타임 없이 단언할 수 있다. 조용히 실패하는 종류의 회귀(종료·업데이트 설치·로그오프가 숨김에
// 막힘)라 그 단언이 중요하다.
//
// ── 종료 중 판정 ────────────────────────────────────────────────────────────────────────
// 모든 종료 경로(트레이 '종료'·업데이트 설치·`window-all-closed`)는 `app.quit()` → `before-quit`
// 을 지난다. 그 뒤의 닫기와 OS 세션 종료(`session-end`) 뒤의 닫기는 숨기지 않는다. 플래그는
// 되돌리지 않는다 — `before-quit` 을 취소하는 유일한 리스너(`registerNativeSettingsQuit`)가
// 드레인 뒤 항상 `app.quit()` 을 다시 부른다.
//
// ── 트레이 생성 실패 ────────────────────────────────────────────────────────────────────
// 프로그램 오류다(0322 D-008). 잡지 않고 그대로 던진다 — 대체 동작을 두지 않는다.

export type TrayLocale = 'ko' | 'en'

// 메뉴 라벨. renderer i18n 리소스와 별개 사본이다 — main 은 renderer 리소스를 import 할 수 없다.
export const TRAY_MENU_LABELS: Record<TrayLocale, { open: string; quit: string }> = {
  ko: { open: '열기', quit: '종료' },
  en: { open: 'Open', quit: 'Quit' }
}

export interface TrayMenuItem {
  label: string
  click: () => void
}

export interface TrayPort<M> {
  setToolTip(text: string): void
  setContextMenu(menu: M): void
  on(event: 'click', listener: () => void): unknown
  destroy(): void
}

export interface ResidentWindowPort {
  on(event: 'close', listener: (event: { preventDefault(): void }) => void): unknown
  on(event: 'session-end', listener: () => void): unknown
  hide(): void
}

export interface TrayResidencyDeps<M> {
  platform: NodeJS.Platform
  app: {
    on(event: 'before-quit', listener: () => void): unknown
    on(event: 'will-quit', listener: () => void): unknown
    quit(): void
  }
  // 던지면 그대로 전파한다.
  createTray(): TrayPort<M>
  buildMenu(items: TrayMenuItem[]): M
  tooltip: string
  open(): void
  // `SettingsStore` 가 구조적으로 만족한다.
  settings: {
    getAll(): { uiLocale: TrayLocale }
    onPatch(listener: (next: unknown, changedKeys: readonly string[]) => void): void
  }
}

export function installTrayResidency<M>(deps: TrayResidencyDeps<M>): {
  attach(win: ResidentWindowPort): void
} {
  const resident = deps.platform === 'win32'
  let quitting = false

  if (resident) {
    // 참조를 이 클로저가 쥔다 — GC 되면 아이콘이 사라진다.
    const tray = deps.createTray()
    const applyMenu = (): void => {
      const labels = TRAY_MENU_LABELS[deps.settings.getAll().uiLocale]
      tray.setContextMenu(
        deps.buildMenu([
          { label: labels.open, click: () => deps.open() },
          { label: labels.quit, click: () => deps.app.quit() }
        ])
      )
    }
    tray.setToolTip(deps.tooltip)
    applyMenu()
    tray.on('click', () => deps.open())
    // UI 언어가 바뀌면 재시작 없이 라벨을 바꾼다. 다른 키에는 반응하지 않는다.
    deps.settings.onPatch((_next, changedKeys) => {
      if (changedKeys.includes('uiLocale')) applyMenu()
    })
    deps.app.on('before-quit', () => {
      quitting = true
    })
    // 종료 뒤 트레이에 유령 아이콘이 남지 않게 한다.
    deps.app.on('will-quit', () => tray.destroy())
  }

  return {
    attach(win) {
      if (!resident) return
      win.on('session-end', () => {
        quitting = true
      })
      win.on('close', (event) => {
        if (quitting) return
        event.preventDefault()
        win.hide()
      })
    }
  }
}
