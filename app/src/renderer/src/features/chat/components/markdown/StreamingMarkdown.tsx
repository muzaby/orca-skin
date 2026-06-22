import { memo, useMemo } from 'react'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { splitStableBlocks } from '../../lib/markdownBlocks'

// 스트리밍 본문 전용 마크다운 — 누적 소스를 "확정 블록들 + 꼬리"로 분할해(markdownBlocks),
// 확정 블록은 memo 된 <Markdown>(string shallow 비교)이 재파스를 건너뛰고 꼬리 블록만 매
// 델타 재파스한다. 프레임당 unified 파싱 비용 O(전문) → O(꼬리) (0008).
// 참조 링크 정의가 블록을 가로지르면 라이브 중 미해소될 수 있으나, message.completed 가
// 커밋한 단일 <Markdown> 렌더로 교체되며 자기교정된다.
export const StreamingMarkdown = memo(function StreamingMarkdown({
  source
}: {
  source: string
}): React.JSX.Element {
  const { stable, tail } = useMemo(() => splitStableBlocks(source), [source])
  return (
    // 분할된 블록 사이 간격은 Markdown 문단 마진(my-2)과 동형인 gap-2 로 근사.
    <div className="flex flex-col gap-2">
      {stable.map((block, i) => (
        <Markdown key={i} source={block} />
      ))}
      {tail !== '' && <Markdown source={tail} />}
    </div>
  )
})
