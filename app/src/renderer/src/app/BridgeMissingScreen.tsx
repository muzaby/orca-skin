import type { CSSProperties } from 'react'
import { useI18n } from '../shared/i18n'
import { PRODUCT_DISPLAY_NAME } from '../../../shared/product'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅(FullFrameShell 과 동일).
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

// preload 다리가 없을 때의 고정 실패 화면 (0324 D-059 · AC53 · EP-29 ③).
//
// preload 가 죽으면 `window.ooBridge`·`window.oo` 가 없다 — 이 화면은 그 둘을 읽지 않고, provider·라우터
// 없이 그린다. 창 조작 단추가 없다(창 API 를 부를 다리가 없다, B43) — 창 이동은 위쪽 끌기 영역, 끝내기는
// OS(작업 표시줄 · 트레이)다.
export function BridgeMissingScreen(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={`${PRODUCT_DISPLAY_NAME} · ${tr('boot.bridgeMissingTitle')}`}
    >
      <header
        className="app-frame-header h-9 flex-none select-none bg-bg"
        style={DRAG_STYLE}
        data-behavior="drag-region"
        aria-hidden
      />
      <main className="flex min-h-0 flex-1 items-center justify-center bg-bg px-6">
        <div
          role="alert"
          className="w-full max-w-[360px] rounded-r4 border border-bad/30 bg-bad/10 p-3 text-center text-[12.5px] text-bad"
        >
          <p className="mb-2 font-semibold">{tr('boot.bridgeMissingTitle')}</p>
          <p className="break-words text-ink2">{tr('boot.bridgeMissingBody')}</p>
        </div>
      </main>
    </div>
  )
}
