import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import type { Exchange } from '../lib/turns'

// transcript 과거(확정) exchange 가상화 (0102). "virtualized head + unvirtualized tail" —
// 마지막(스트리밍) 교환은 호출부(TranscriptView)가 비가상 tail 로 따로 렌더해 0008 예약공간
// 앵커(min-h-[50cqh]) + useScrollAnchor 계약을 그대로 보존한다. 여기서는 head 만 다룬다.
//
// 화면 밖 exchange 는 언마운트되어 shiki 하이라이트/DOM 상주 비용이 시야 범위로 제한된다.
// 높이는 exchange 마다 크게 달라 estimateSize 는 대략치이고, measureElement(ResizeObserver)가
// 실측으로 교체한다. 뷰포트 위 아이템의 크기 변동은 TanStack 기본 보정
// (shouldAdjustScrollPositionOnItemSizeChange)이 scrollTop 을 맞춰 tail(가시) 위치를 유지한다.

// 초기 추정 높이(px) — 측정 전 스페이서 크기 근사. 측정으로 수렴하므로 정밀할 필요는 없다.
const ESTIMATE_PX = 240
// 뷰포트 밖 선렌더 개수(양방향) — 스크롤 여유.
const OVERSCAN = 6

export function useTranscriptVirtualizer(
  head: Exchange[],
  scrollRef: React.RefObject<HTMLDivElement | null>
): Virtualizer<HTMLDivElement, Element> {
  return useVirtualizer({
    count: head.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATE_PX,
    // exchange.startIndex = append 사이 불변 identity(turns.ts §45) → 측정 캐시 안정.
    getItemKey: (index) => head[index]?.startIndex ?? index,
    overscan: OVERSCAN
  })
}
