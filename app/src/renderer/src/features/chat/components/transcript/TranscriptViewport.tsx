import type { ReactNode } from 'react'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'

type Options = Parameters<typeof useVirtualizer<HTMLDivElement, Element>>[0]
type MeasureElement = ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>['measureElement']

interface TranscriptViewportProps {
  options: Omit<Options, 'getScrollElement'>
  scrollRef: React.RefObject<HTMLDivElement | null>
  manualAdjustment?: boolean
  renderItem(item: VirtualItem, measure: MeasureElement): ReactNode
}

// Scroll controllers also use this writer while their positioning policies are active.
// eslint-disable-next-line react-refresh/only-export-components
export function writeScrollTop(element: HTMLElement, top: number, behavior?: 'smooth'): void {
  if (behavior === 'smooth') element.scrollTo({ top, behavior })
  else element.scrollTop = top
}

export function TranscriptViewport({
  options,
  scrollRef,
  manualAdjustment = false,
  renderItem
}: TranscriptViewportProps): React.JSX.Element {
  const virtualizer = useVirtualizer({ ...options, getScrollElement: () => scrollRef.current })
  if (manualAdjustment) virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false
  return (
    <div
      data-transcript-viewport=""
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => renderItem(item, virtualizer.measureElement))}
    </div>
  )
}
