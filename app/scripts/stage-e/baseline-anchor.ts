// Exercise the inherited header ResizeObserver on the real transcript in Chromium.
// Deliver the second wheel after header layout and before the queued anchor restoration.
const frame = (): Promise<number> =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve))

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await frame()
}
interface LineShift {
  partKey: string | undefined
  scrollTopBefore: number
  scrollTopAfter: number
  lineTopBefore: number
  lineTopAfter: number
  wheelGapMs?: number
  deltaPx: number
}
export async function baselineAnchor(): Promise<{
  headerPx: number
  resizeOnly: LineShift
  resizeWithWheel: LineShift
}> {
  const scroll = document.querySelector<HTMLElement>('[data-behavior="virtualizable"]')!
  const header = scroll.querySelector<HTMLElement>('[data-transcript-header]')!
  await document.fonts.ready
  async function shift(wheelDuringResize: boolean): Promise<LineShift> {
    header.style.height = ''
    scroll.scrollTop = 0
    await settle()
    const firstWheelAt = performance.now()
    scroll.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }))
    await frame()
    await frame()
    const bounds = scroll.getBoundingClientRect()
    const part = Array.from(scroll.querySelectorAll<HTMLElement>('[data-part-key]')).find((el) => {
      const box = el.getBoundingClientRect()
      return box.height > 0 && box.top >= bounds.top && box.bottom < bounds.bottom
    })
    if (!part) throw Error('No visible part at the top of the transcript')
    const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT)
    let text: Node | null
    while ((text = walker.nextNode()) && !text.textContent?.includes('fixture message ')) {
      // Skip buttons and other decorative text sharing the message container.
    }
    if (!text) throw Error('Fixture line missing from reading part')
    const line = document.createRange()
    line.setStart(text, text.textContent!.indexOf('fixture message '))
    line.setEnd(text, line.startOffset + 1)
    const before = line.getBoundingClientRect().top
    const scrollTopBefore = scroll.scrollTop
    let wheelGapMs: number | undefined
    let delivered = false
    const observer = new ResizeObserver(() => {
      if (delivered || header.offsetHeight !== 35) return
      delivered = true
      if (wheelDuringResize) {
        wheelGapMs = performance.now() - firstWheelAt
        scroll.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true }))
      }
    })
    observer.observe(header)
    try {
      header.style.height = '35px'
      await settle()
      if (!delivered || !part.isConnected) throw Error('Header or reading part was not observed')
      const after = line.getBoundingClientRect().top
      return {
        partKey: part.dataset.partKey,
        scrollTopBefore,
        scrollTopAfter: scroll.scrollTop,
        wheelGapMs,
        lineTopBefore: before,
        lineTopAfter: after,
        deltaPx: after - before
      }
    } finally {
      observer.disconnect()
      header.style.height = ''
      await settle()
    }
  }
  return { headerPx: 35, resizeOnly: await shift(false), resizeWithWheel: await shift(true) }
}
