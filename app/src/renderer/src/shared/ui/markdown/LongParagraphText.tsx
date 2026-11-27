import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { scheduleMarkdownCommit } from './commitQueue'

interface LineGroup {
  end: number
  height?: number
}

const ParagraphGroup = memo(function ParagraphGroup({
  value,
  start,
  group
}: {
  value: string
  start: number
  group: LineGroup
}): React.JSX.Element {
  const run = value.slice(start, group.end)
  // At an inline-block edge Blink removes a collapsed wrap separator from a selection.
  const separator = group.height && run.endsWith(' ')
  return (
    <span
      data-markdown-prose-group={group.height ? '' : undefined}
      style={
        group.height
          ? {
              display: 'inline-block',
              width: '100%',
              verticalAlign: 'top',
              contentVisibility: 'auto',
              containIntrinsicSize: 'auto ' + group.height + 'px'
            }
          : undefined
      }
    >
      {separator ? (
        <>
          {run.slice(0, -1)}
          <span style={{ whiteSpace: 'pre-wrap' }}> </span>
        </>
      ) : (
        run
      )}
    </span>
  )
})

// Blink shapes a single enormous inline formatting context even when nearly all of it is
// offscreen. Partition a leading prose run on its actual soft wraps. Each inline box keeps
// its original text (including the separator) for selection and uses the measured height.
export function LongParagraphText({
  value,
  onComplete
}: {
  value: string
  onComplete?: () => void
}): React.JSX.Element {
  const probe = useRef<HTMLSpanElement>(null)
  const [layout, setLayout] = useState<{ value: string; groups: LineGroup[] }>()
  useLayoutEffect(() => {
    const measure = probe.current
    const paragraph = measure?.closest('p')
    if (!paragraph || !measure) return
    let cancel: (() => void) | undefined
    let groups: LineGroup[] = []
    let offset = 0
    let signature = ''
    let lineHeight = 1
    const previousWraps = new Map<string, { length: number; height: number }>()
    const range = document.createRange()
    const text = document.createTextNode('')
    function next(): void {
      if (!measure) return
      const deadline = performance.now() + 3
      const frameLimit = groups.length + 4
      do {
        if (value.length - offset <= 4096) {
          groups.push({ end: value.length })
          offset = value.length
          break
        }
        // Measure a small sample. Keep its incomplete last line for the following group
        // so emphasis or a link after the final run still flows on that line.
        const sample = value.slice(offset, offset + 4096)
        const known = previousWraps.get(sample)
        if (known) {
          offset += known.length
          groups.push({ end: offset, height: known.height })
          continue
        }
        text.data = sample
        measure.appendChild(text)
        const top = (at: number): number => {
          range.setStart(text, at)
          range.setEnd(text, at + 1)
          return range.getBoundingClientRect().top
        }
        const last = top(text.length - 1)
        let lo = 0,
          hi = text.length - 1
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (top(mid) < last - lineHeight / 2) lo = mid + 1
          else hi = mid
        }
        if (!lo) {
          // An indivisible word or a non-wrapping container must keep its inline layout.
          groups.push({ end: value.length })
          offset = value.length
          text.remove()
          break
        }
        const height = Math.round((last - top(0)) / lineHeight) * lineHeight
        text.remove()
        if (previousWraps.size >= 8) previousWraps.delete(previousWraps.keys().next().value!)
        previousWraps.set(sample, { length: lo, height })
        offset += lo
        groups.push({ end: offset, height })
      } while (offset < value.length && groups.length < frameLimit && performance.now() < deadline)
      setLayout({ value, groups: groups.slice() })
      if (offset < value.length) cancel = scheduleMarkdownCommit(next)
    }
    function resize(): void {
      if (!paragraph || !measure) return
      const width = paragraph.getBoundingClientRect().width
      const css = getComputedStyle(paragraph)
      const nextSignature = [
        width,
        css.font,
        css.letterSpacing,
        css.wordSpacing,
        css.direction
      ].join('|')
      if (width === 0 || nextSignature === signature) return
      signature = nextSignature
      lineHeight = Number.parseFloat(css.lineHeight) || Number.parseFloat(css.fontSize)
      measure.style.width = width + 'px'
      groups = []
      previousWraps.clear()
      offset = 0
      cancel?.()
      cancel = scheduleMarkdownCommit(next)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(paragraph)
    const fontsChanged = (): void => {
      signature = ''
      resize()
    }
    document.fonts?.addEventListener('loadingdone', fontsChanged)
    return () => {
      cancel?.()
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', fontsChanged)
      text.remove()
    }
  }, [value])
  const groups = layout?.value === value ? layout.groups : []
  const complete = groups.at(-1)?.end === value.length
  useEffect(() => {
    if (complete) onComplete?.()
  }, [complete, onComplete])
  return (
    <>
      <span
        ref={probe}
        aria-hidden="true"
        style={{
          position: 'absolute',
          display: 'block',
          visibility: 'hidden',
          pointerEvents: 'none',
          userSelect: 'none',
          contain: 'layout style paint'
        }}
      />
      {groups.map((group, i) => (
        <ParagraphGroup key={i} value={value} start={groups[i - 1]?.end ?? 0} group={group} />
      ))}
      {!complete && <span hidden data-md-block-pending="" />}
    </>
  )
}
