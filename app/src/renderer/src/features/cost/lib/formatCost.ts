import type { TFunction } from 'i18next'

// 근사 비용 라벨 — 렌더가 tr 을 주입해 로케일에 맞게 포맷한다(0097).
export function formatApproxCost(tr: TFunction, usd: number): string {
  return tr('cost.approx', { usd: usd.toFixed(2) })
}
