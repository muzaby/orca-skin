// 도넛 팝오버가 그릴 사용량 뷰 (0186) — page 레이어의 조립 훅.
//
// **기준은 마지막 telemetry 시점의 provider** 다(사용자 결정: "Composer 가 보여주는 기준은 항상
// 텔레메트리가 업데이트되는 시점"). 현재 선택 provider(`session.providerKey`)로 그리면 모델만
// 바꿔도 새 턴을 돌리기 전에 숫자가 갈아치워진다.
//
// 아직 그 provider 값을 받은 적이 없으면 한 번만 확보하고(delta push 가 이후 갱신을 맡는다),
// 그 사이에는 전역 뷰로 폴백한다 — 한도 섹션이 통째로 사라졌다 나타나며 팝오버 높이가 튀는
// 것보다 낫다.
//
// page 레이어에 두는 이유: `features/chat`(세션 상태)과 `shared/stores/usageStore` 를 함께 읽는
// 조립이라, 어느 feature 안에 두든 교차-feature 참조가 된다(renderer 4-layer 규칙).

import { useEffect } from 'react'
import { useChatSession } from '../features/chat'
import type { UsageLimitsView } from '../../../shared/usage/limits'
import { ensureProviderUsage, useGlobalUsage, useProviderUsage } from '../shared/stores/usageStore'

export function useUsageForTelemetryProvider(): UsageLimitsView | null {
  const providerKey = useChatSession((s) => s.lastTelemetryProviderKey ?? null)
  const global = useGlobalUsage()
  const provider = useProviderUsage(providerKey)

  useEffect(() => {
    if (!providerKey) return
    void ensureProviderUsage(providerKey)
  }, [providerKey])

  return provider ?? global
}
