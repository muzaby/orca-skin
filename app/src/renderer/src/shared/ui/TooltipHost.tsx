import { useEffect, useMemo, useRef, useState } from 'react'
import { Popover } from './Popover'
import {
  createTooltipController,
  type TooltipController,
  type TooltipView
} from './tooltipController'

// 앱 전역 툴팁 호스트(0257 D-005) — 앱 루트에 1개. 마우스가 `title` 요소에 머물면 OS 툴팁 대신
// 검은 툴팁(TOOLTIP_SURFACE)을 그린다. 기존 `title=` 자리는 그대로 두고 여기서 가로챈다.
export function TooltipHost(): React.JSX.Element | null {
  const [view, setView] = useState<TooltipView<HTMLElement> | null>(null)
  const controller = useRef<TooltipController | null>(null)

  useEffect(() => {
    const created = createTooltipController<HTMLElement>({
      doc: document,
      win: window,
      contains: (anchor, other) => other instanceof Node && anchor.contains(other),
      observe: (anchor, onTitleChange, onDisconnect) => {
        const attributes = new MutationObserver(onTitleChange)
        attributes.observe(anchor, { attributes: true, attributeFilter: ['title'] })
        const tree = new MutationObserver(() => {
          if (!anchor.isConnected) onDisconnect()
        })
        tree.observe(document.body, { childList: true, subtree: true })
        return () => {
          attributes.disconnect()
          tree.disconnect()
        }
      },
      setTimeout: (run, ms) => window.setTimeout(run, ms),
      clearTimeout: (handle) => window.clearTimeout(handle as number),
      now: () => performance.now(),
      onChange: setView
    })
    controller.current = created
    return () => {
      controller.current = null
      created.dispose()
    }
  }, [])

  // 대상마다 새 ref 객체 — Popover 는 ref 객체가 바뀔 때 다시 배치한다(TaskProgressList 선례).
  const anchor = view?.anchor ?? null
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor])
  if (!view) return null
  return (
    <Popover
      open
      anchorRef={anchorRef}
      onClose={() => controller.current?.hide()}
      role="tooltip"
      placement="bottom"
      align="center"
    >
      {view.text}
    </Popover>
  )
}
