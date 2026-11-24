import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { AutoGrowTextarea } from '@renderer/shared/ui/AutoGrowTextarea'
import appCss from '@renderer/styles/app.css?inline'

const beforePaint = (): Promise<number> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

export async function measureHeight(runs: number): Promise<unknown[]> {
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed; top:0; left:0; width:480px;'
  document.body.append(host)
  const root = createRoot(host)
  const results: unknown[] = []
  const ignore = (): void => {}
  try {
    for (let run = 0; run <= runs; run++) {
      for (const characters of [2_000, 20_000]) {
        flushSync(() =>
          root.render(<AutoGrowTextarea className="max-h-48" value="" onChange={ignore} />)
        )
        await beforePaint()
        const value = '한글 입력 '.repeat(Math.ceil(characters / 6)).slice(0, characters)
        const started = performance.now()
        flushSync(() =>
          root.render(<AutoGrowTextarea className="max-h-48" value={value} onChange={ignore} />)
        )
        const commitMs = performance.now() - started
        const followingFrame = await beforePaint()
        const textarea = host.querySelector('textarea')!
        if (run !== 0)
          results.push({
            run,
            characters,
            commitMs,
            paintUpperBoundMs: followingFrame - started,
            height: textarea.getBoundingClientRect().height,
            fieldSizing: CSS.supports('field-sizing', 'content')
          })
      }
    }
    return results
  } finally {
    root.unmount()
    host.remove()
    style.remove()
  }
}
