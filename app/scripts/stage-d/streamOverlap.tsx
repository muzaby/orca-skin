import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { DiffReview } from '@renderer/features/chat/harnesses/common/rightpanel/DiffReview'
import { hunksToDiffLines } from '@renderer/shared/compute/diffModel'
import { computeClient } from '@renderer/shared/compute/client'
import { frame } from './domInput'

export async function measureStreamOverlap(images: string[]): Promise<unknown> {
  history.replaceState(null, '', '?screen=claude-code')
  await import('../transcript-streaming/probe')
  const stream = (
    window as unknown as {
      probe: {
        advance(step: string): Promise<void>
        observe(step: string): { missing: string[]; duplicated: string[]; latestPresent: boolean }
      }
    }
  ).probe
  const path = 'large.ts'
  const text = Array.from({ length: 5001 }, (_, i) => 'const row' + i + ' = ' + i).join('\n')
  const file = {
    path,
    status: 'modified' as const,
    kind: 'text' as const,
    added: 5001,
    removed: 0,
    lines: hunksToDiffLines([{ value: text, added: true }])
  }
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;right:0;top:0;width:440px;height:480px;display:flex;flex-direction:column'
  document.body.append(host)
  const root = createRoot(host)
  const noop = (): void => {}
  try {
    flushSync(() =>
      root.render(
        <DiffReview
          summary={null}
          hasRequest
          patch={{
            files: [file],
            base: { kind: 'none' },
            isRepo: true,
            filesTruncated: false,
            contextLimited: false,
            unavailable: false
          }}
          comparison={{ kind: 'all' }}
          expandedFiles={new Set([path])}
          sidebarVisible={false}
          view={{
            layout: 'inline',
            wrapLines: false,
            highlightWords: true,
            ignoreWhitespace: false
          }}
          draft={null}
          onDraftChange={noop}
          activeRequirementId={null}
          requirements={[]}
          onToggleExpanded={noop}
          onExpandFile={noop}
          onOpenFile={noop}
          onPickComparison={noop}
        />
      )
    )
    for (let tick = 0; tick < 20; tick++) await frame()
    const scroller = host.querySelector<HTMLElement>('[data-diff-scroll-owner]')!
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight)
      throw Error('diff did not mount')
    let finished = 0
    const jobs = images.map((data, index) =>
      computeClient()
        .request(
          {
            kind: 'imageThumb',
            attachmentId: 'overlap-' + index,
            mimeType: 'image/png',
            data,
            pixels: 4032 * 3024
          },
          { priority: 'background', cacheable: false }
        )
        .promise.then((result) => {
          if (result.thumbnail) finished++
        })
    )
    const pendingAtScroll = images.length - finished
    scroller.scrollTop = scroller.scrollHeight / 2
    const scrollAtDispatch = scroller.scrollTop
    const started = performance.now()
    const pendingAtDelta = images.length - finished
    await stream.advance('sync@4000')
    await frame()
    await frame()
    const observed = stream.observe('sync@4000')
    const tailPaintMs = performance.now()
    await Promise.all(jobs)
    if (
      finished !== 5 ||
      !observed.latestPresent ||
      observed.missing.length ||
      observed.duplicated.length ||
      scroller.scrollTop <= 0 ||
      !pendingAtDelta ||
      !pendingAtScroll
    )
      throw Error(
        'overlap ' +
          JSON.stringify({
            finished,
            pendingAtDelta,
            pendingAtScroll,
            scrollAtDispatch,
            scroll: scroller.scrollTop,
            client: scroller.clientHeight,
            height: scroller.scrollHeight,
            latest: observed.latestPresent,
            missing: observed.missing.length,
            duplicated: observed.duplicated.length
          })
      )
    return {
      thumbnails: finished,
      pendingAtScroll,
      pendingAtDelta,
      scrollTop: scroller.scrollTop,
      latestPresent: observed.latestPresent,
      paintAfterDeltaMs: tailPaintMs - started
    }
  } finally {
    root.unmount()
    host.remove()
  }
}
