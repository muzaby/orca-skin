import { useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { AutoGrowTextarea } from '@renderer/shared/ui/AutoGrowTextarea'
import { PlanCommentPopover } from '@renderer/features/chat/harnesses/common/rightpanel/PlanCommentPopover'
import { createPlanCommentIndex } from '@renderer/features/chat/lib/planCommentDom'
import appCss from '@renderer/styles/app.css?inline'

import { editInput, frame } from './domInput'
const noop = (): void => {}
// eslint-disable-next-line react-refresh/only-export-components -- isolated Electron probe, mounted once per fixture.
function SettingsInput(): React.JSX.Element {
  const [text, setText] = useState('')
  return <AutoGrowTextarea value={text} onChange={setText} className="max-h-48" />
}
export async function measurePanelInputs(): Promise<unknown> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;width:480px'
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  document.body.append(host)
  const root = createRoot(host)
  const results: unknown[] = []
  let saved = ''
  try {
    for (const kind of ['settings', 'comment']) {
      const render = (width: number): void =>
        flushSync(() =>
          root.render(
            kind === 'settings' ? (
              <SettingsInput />
            ) : (
              <PlanCommentPopover
                mode="create"
                quote="인용"
                anchor={{
                  x: 80,
                  top: window.innerHeight - 155,
                  bottom: window.innerHeight - 139,
                  containerWidth: width
                }}
                onSave={(body) => {
                  saved = body
                }}
                onClose={noop}
              />
            )
          )
        )
      render(480)
      await frame()
      const area = host.querySelector('textarea')!
      const height = (): number => area.getBoundingClientRect().height
      const empty = height()
      const heights: Array<{ size: number; height: number; paintUpperBoundMs: number }> = []
      for (const size of [2000, 20000]) {
        const value = '한글 입력 '.repeat(Math.ceil(size / 6)).slice(0, size)
        const start = performance.now()
        flushSync(() => editInput(area, value))
        area.setSelectionRange(size, size)
        area.scrollTop = area.scrollHeight
        await frame()
        const paint = await frame()
        if (
          area.selectionStart !== size ||
          area.scrollHeight - area.scrollTop - area.clientHeight > 1
        )
          throw Error(kind + ' lost caret or tail')
        heights.push({ size, height: height(), paintUpperBoundMs: paint - start })
      }
      const panel = host.querySelector<HTMLElement>('[role=dialog]')
      if (panel && panel.getBoundingClientRect().bottom > window.innerHeight - 155)
        throw Error('comment anchor did not flip')
      area.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'ㅎ' }))
      flushSync(() => editInput(area, '한글'))
      area.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Enter',
          ctrlKey: true,
          isComposing: true
        })
      )
      if (saved) throw Error('comment submitted during composition')
      area.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한글' }))
      await frame()
      const short = height()
      if (panel) {
        await frame()
        await frame()
        panel.style.minHeight = '240px'
        await frame()
        await frame()
        await frame()
        if (panel.getBoundingClientRect().bottom > window.innerHeight - 155)
          throw Error('panel resize did not reposition comment')
        panel.style.minHeight = ''
        await frame()
        await frame()
        await frame()
        if (panel.getBoundingClientRect().top < window.innerHeight - 139)
          throw Error('panel shrink did not restore comment')
      }
      if (short >= heights[1].height || Math.abs(short - empty) > 2)
        throw Error(kind + ' did not shrink ' + JSON.stringify({ empty, short, heights }))
      const wrap = '넓이 조절 '.repeat(6)
      flushSync(() => editInput(area, wrap))
      await frame()
      const wide = height()
      host.style.display = 'none'
      host.style.width = '155px'
      render(155)
      if (height() !== 0) throw Error('hidden textarea has a box')
      host.style.display = ''
      await frame()
      await frame()
      const narrow = height()
      if (narrow <= wide || area.value !== wrap)
        throw Error(kind + ' reveal width ' + JSON.stringify({ wide, narrow }))
      host.style.width = '480px'
      render(480)
      await frame()
      if (Math.abs(wide - height()) > 1) throw Error(kind + ' width cycle')
      if (panel) {
        area.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', ctrlKey: true })
        )
        if (saved !== wrap.trim()) throw Error('comment commit mismatch')
      }
      results.push({ kind, empty, heights, short, wide, narrow })
    }
    return results
  } finally {
    root.unmount()
    host.remove()
    style.remove()
  }
}

export function measureCommentIndex(): Record<string, number | boolean> {
  const host = document.createElement('div')
  const body = document.createElement('div')
  const sibling = document.createElement('aside')
  sibling.textContent = 'outside quote'
  host.append(body, sibling)
  document.body.append(host)
  const markup = '<p>🐬<a>반복</a> 끝</p><p>🐬<a>반복</a> 끝</p>'
  const selection = window.getSelection()!
  try {
    for (let revision = 0; revision < 2; revision++) {
      body.innerHTML = markup
      const idx = createPlanCommentIndex(body)
      const links = body.querySelectorAll('a')
      const second = links[1].parentElement!
      selection.setBaseAndExtent(second, 2, second, 1)
      const selected = idx.selection(selection)
      const offset = idx.text.lastIndexOf('반복')
      if (selected?.start !== offset || selected?.end !== offset + 2 || selected?.quote !== '반복')
        throw Error('reverse element selection')
      const restored = idx.range(offset, offset + 2)
      if (
        restored?.startContainer !== links[1].firstChild ||
        restored.toString() !== '반복' ||
        idx.range(0, idx.text.length)?.toString() !== body.textContent
      )
        throw Error('stored UTF-16 range')
      selection.setBaseAndExtent(body, 0, sibling, 1)
      if (idx.selection(selection) !== null) throw Error('overlay text entered selection')
      host.prepend(sibling)
      selection.setBaseAndExtent(sibling, 0, links[1].firstChild!, 1)
      if (idx.selection(selection) !== null) throw Error('external anchor entered selection')
      selection.setBaseAndExtent(links[1].firstChild!, 1, links[1].firstChild!, 2)
      if (idx.selection(selection)?.start !== offset + 1) throw Error('local text offset')
      if (idx.rects(0, idx.text.length, body.getBoundingClientRect(), []).length)
        throw Error('offscreen range measured')
      if (idx.rects(offset, offset + 2, body.getBoundingClientRect(), idx.blocks).length !== 1)
        throw Error('visible quote missing')
    }
    return { revisions: 2, duplicateQuotes: 2, reverseSelection: true, overlayExcluded: true }
  } finally {
    selection.removeAllRanges()
    host.remove()
  }
}
