// 선형 프로그레스바 원자 — 컨텍스트/사용량 한도 바에서 공용(도넛 팝오버 + 설정 사용량).
// ratio(0..1)로 폭을 채운다. tone 미지정 시 사용량 임계(usageToneForRatio, 0.6/0.85)로
// info→warn→bad 자동 선택 (파랑→노랑→빨강, UsageCircle 과 임계·색 공유 — 사용자 피드백 0080).

import { usageToneForRatio } from './usageTone'

export type MeterTone = 'accent' | 'info' | 'good' | 'warn' | 'bad' | 'muted'

const TONE_BG: Record<MeterTone, string> = {
  accent: 'bg-accent',
  info: 'bg-indigo',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  muted: 'bg-t5'
}

export function Meter({
  ratio,
  tone,
  className,
  title
}: {
  ratio: number
  tone?: MeterTone
  className?: string
  /** 트랙에 거는 네이티브 호버 툴팁. 문구는 호출자가 소유한다(shared 는 도메인을 모른다). */
  title?: string
}): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, ratio))
  const bar = TONE_BG[tone ?? usageToneForRatio(clamped)]
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-border ${className ?? ''}`}
      title={title}
    >
      <div
        className={`h-full rounded-full ${bar} transition-[width] duration-300`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
