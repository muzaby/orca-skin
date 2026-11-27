import { memo, useMemo, useRef } from 'react'
import { CodeBlock } from '../../../../shared/ui/markdown/CodeBlock'
import {
  markSourceText,
  sliceSourceParts,
  type MarkdownSourcePart,
  type MarkedText
} from '../../../../shared/ui/markdown/sourceParts'
import { WorkerMarkdownTail } from './WorkerMarkdownTail'
import { MARKDOWN_WORKER_MIN_CHARS } from '../../../../shared/compute/limits'
import { TranscriptMarkdown } from './MarkdownDocument'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { MarkdownStreamingContext } from '../../../../shared/ui/markdown/streamingContext'
import { MARKDOWN_TYPOGRAPHY } from '../../../../shared/ui/markdown/typography'
import {
  advanceStableBlocks,
  type OpenFenceTail,
  type StableBlocksCache
} from '../../../../shared/markdown/markdownBlocks'

const DEFAULT_WRAPPER = `${MARKDOWN_TYPOGRAPHY} text-ink`

export const StreamingFence = memo(function StreamingFence({
  fence,
  markedText,
  className
}: {
  fence: OpenFenceTail
  markedText?: readonly MarkedText[]
  className?: string
}): React.JSX.Element {
  return (
    <div className={className ?? DEFAULT_WRAPPER}>
      <CodeBlock code={fence.code} lang={fence.lang} markedText={markedText} />
    </div>
  )
})

// 스트리밍 본문 전용 마크다운 — 누적 소스를 "확정 블록들 + 꼬리"로 분할해(markdownBlocks),
// 확정 블록은 memo 된 <Markdown>(string shallow 비교)이 재파스를 건너뛰고 꼬리 블록만 매
// 델타 재파스한다. 프레임당 unified 파싱 비용 O(전문) → O(꼬리) (0008). 분할 자체도 증분
// 스캐너 상태(advanceStableBlocks, 0326 EP-19)로 새로 완결된 줄만 스캔한다.
// 꼬리가 닫히지 않은 펜스 하나뿐이면 remark 파싱을 생략하고 StreamingFence 로 직접 그린다.
export const StreamingMarkdown = memo(function StreamingMarkdown({
  source,
  sourceParts,
  className
}: {
  source: string
  sourceParts?: readonly MarkdownSourcePart[]
  className?: string
}): React.JSX.Element {
  const cacheRef = useRef<StableBlocksCache | null>(null)
  const { stable, tail, openFence, scanState } = useMemo(() => {
    const next = advanceStableBlocks(cacheRef.current, source)
    cacheRef.current = next.cache
    return next
  }, [source])
  const stableParts = useMemo(() => {
    if (!sourceParts) return undefined
    let offset = 0
    const prefix = cacheRef.current!.source
    return stable.map((block) => {
      const start = prefix.indexOf(block, offset)
      offset = start + block.length
      return sliceSourceParts(sourceParts, start, offset)
    })
  }, [stable, sourceParts])
  const tailParts = sliceSourceParts(sourceParts, scanState.blockStart, source.length)
  const fenceParts =
    sourceParts && openFence && scanState.fence
      ? markSourceText(
          openFence.code,
          source,
          scanState.fence.bodyStart,
          source.length,
          sourceParts,
          { fenceIndent: scanState.fence.indent }
        )
      : undefined
  return (
    // 분할된 블록 사이 간격은 Markdown 문단 마진(my-2)과 동형인 gap-2 로 근사.
    <div className="flex flex-col gap-2">
      {stable.map((block, i) => (
        <TranscriptMarkdown
          key={i}
          source={block}
          sourceParts={stableParts?.[i]}
          className={className}
        />
      ))}
      {tail !== '' && (
        <MarkdownStreamingContext.Provider value={true}>
          {openFence ? (
            <StreamingFence fence={openFence} className={className} markedText={fenceParts} />
          ) : tail.length > MARKDOWN_WORKER_MIN_CHARS ? (
            <WorkerMarkdownTail tail={tail} parts={tailParts} className={className} />
          ) : (
            <Markdown source={tail} sourceParts={tailParts} className={className} />
          )}
        </MarkdownStreamingContext.Provider>
      )}
    </div>
  )
})
