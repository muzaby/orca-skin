// 선형 프로그레스바 원자 — 컨텍스트/사용량 한도 바에서 공용(도넛 팝오버 + 설정 사용량).
// ratio(0..1)로 폭을 채운다. tone 미지정 시 사용량 임계(0.6/0.85)로 info→warn→bad 자동 선택
// (파랑→노랑→빨강, UsageCircle 과 임계·색 일치 — 사용자 피드백 0080).

export type MeterTone = 'accent' | 'info' | 'good' | 'warn' | 'bad' | 'muted'

const TONE_BG: Record<MeterTone, string> = {
  accent: 'bg-accent',
  info: 'bg-indigo',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  muted: 'bg-t5'
}

// 사용량 비율 → 톤 (여유/주의/임박) = 파랑→노랑→빨강. warn 강제는 호출 측이 tone 으로 전달.
function meterToneForRatio(ratio: number): MeterTone {
  if (ratio >= 0.85) return 'bad'
  if (ratio >= 0.6) return 'warn'
  return 'info'
}

export function Meter({
  ratio,
  tone,
  className
}: {
  ratio: number
  tone?: MeterTone
  className?: string
}): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, ratio))
  const bar = TONE_BG[tone ?? meterToneForRatio(clamped)]
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-border ${className ?? ''}`}>
      <div
        className={`h-full rounded-full ${bar} transition-[width] duration-300`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
