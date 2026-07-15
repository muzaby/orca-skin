import { memo, useMemo, useRef } from 'react'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { MarkdownStreamingContext } from '../../../../shared/ui/markdown/streamingContext'
import { advanceStableBlocks, type StableBlocksCache } from '../../lib/markdownBlocks'

// 스트리밍 본문 전용 마크다운 — 누적 소스를 "확정 블록들 + 꼬리"로 분할해(markdownBlocks),
// 확정 블록은 memo 된 <Markdown>(string shallow 비교)이 재파스를 건너뛰고 꼬리 블록만 매
// 델타 재파스한다. 프레임당 unified 파싱 비용 O(전문) → O(꼬리) (0008). 분할 자체도 증분
// 캐시(advanceStableBlocks, 0108)로 확정 prefix 재스캔을 생략한다.
// 꼬리는 MarkdownStreamingContext 로 감싸 CodeBlock 이 열린 펜스의 프레임당 전체
// 재하이라이트(O(n²))를 건너뛰게 한다(0108) — 블록 확정/커밋 렌더 시 1회 하이라이트.
// 참조 링크 정의가 블록을 가로지르면 라이브 중 미해소될 수 있으나, message.completed 가
// 커밋한 단일 <Markdown> 렌더로 교체되며 자기교정된다.
export const StreamingMarkdown = memo(function StreamingMarkdown({
  source
}: {
  source: string
}): React.JSX.Element {
  const cacheRef = useRef<StableBlocksCache | null>(null)
  const { stable, tail } = useMemo(() => {
    const next = advanceStableBlocks(cacheRef.current, source)
    cacheRef.current = next.cache
    return next
  }, [source])
  return (
    // 분할된 블록 사이 간격은 Markdown 문단 마진(my-2)과 동형인 gap-2 로 근사.
    <div className="flex flex-col gap-2">
      {stable.map((block, i) => (
        <Markdown key={i} source={block} />
      ))}
      {tail !== '' && (
        <MarkdownStreamingContext.Provider value={true}>
          <Markdown source={tail} />
        </MarkdownStreamingContext.Provider>
      )}
    </div>
  )
})
