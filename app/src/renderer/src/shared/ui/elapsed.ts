import { useEffect, useState } from 'react'

const ELAPSED_INTERVAL_MS = 1000

// 경과초 포맷 — 60s 미만: `Ns`, 60m(3600s) 미만: `Nm Ns`, 그 이상: `Nh Nm Ns`.
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}h ${m}m ${s}s`
}

// startedAt(epoch ms)으로부터의 경과초를 1초 틱으로 갱신한다. startedAt 이 null 이면 0(틱 없음).
// 메인 턴 상태줄(StatusLine)과 서브에이전트 진행 중 메타가 같은 메커니즘을 공유한다.
// 콜백 안의 setState 라 react-hooks/set-state-in-effect 를 통과한다(StatusLine 패턴 동일).
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState<number>(() => startedAt ?? 0)

  // 1초 틱은 콜백 안의 setState 라 react-hooks/set-state-in-effect 를 통과한다. startedAt 가
  // 바뀌어도 lazy initializer 는 재실행되지 않으므로 첫 틱(≤1s)까지는 직전 now 를 쓰지만,
  // 아래 Math.max(now, startedAt) 가 하한을 보장한다(StatusLine 기존 동작과 동일).
  useEffect(() => {
    if (startedAt == null) return
    const t = setInterval(() => setNow(Date.now()), ELAPSED_INTERVAL_MS)
    return () => clearInterval(t)
  }, [startedAt])

  if (startedAt == null) return 0
  return Math.max(0, Math.floor((Math.max(now, startedAt) - startedAt) / 1000))
}
