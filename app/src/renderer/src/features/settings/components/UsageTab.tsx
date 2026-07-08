// 설정 모달 '사용량' 탭(전역) — 사용량 한도 바/한도 설정은 provider 하위 탭(ProviderUsageTab)
// 으로 이관됐다(0081). 이 전역 탭은 Claude Code `/cost` 유사 요약(총비용·토큰·모델별 내역)의
// 자리로, 현재는 안내문구 + "추후 구현" 표시만 둔다(실집계 미구현).
// SyncRow/CostRefreshView 는 provider 서브탭이 재사용하므로 여기 정의를 유지한다.

import { Icon } from '../../../shared/ui/Icon'

export interface CostRefreshView {
  label: string | null
  refreshing: boolean
  onRefresh: () => void
}

// "마지막 업데이트: <라벨> <새로고침 버튼(inflight spin)>" (0080). provider 서브탭이 재사용.
export function SyncRow({ label, refreshing, onRefresh }: CostRefreshView): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink3">
      <span>마지막 업데이트: {label ?? '—'}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="사용량 새로고침"
        className="grid h-6 w-6 place-items-center rounded-r4 text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2 disabled:cursor-not-allowed"
      >
        <Icon name="refresh" size={13} className={refreshing ? 'animate-spin' : undefined} />
      </button>
    </div>
  )
}

// 전역 사용량 요약 — /cost 유사 기능 예고 + 추후 구현 안내(0081).
export function UsageTab(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">사용량 요약</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">
          Claude Code 의 <span className="font-mono text-[12px] text-ink">/cost</span> 처럼 총 사용
          비용, 토큰 사용량(입력·출력·캐시), 모델별 내역을 한눈에 볼 수 있는 요약을 제공할
          예정입니다.
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5 rounded-r4 border border-dashed border-border px-4 py-8 text-center">
        <Icon name="chart" size={20} className="text-ink3" />
        <div className="text-[13px] font-medium text-ink2">추후 구현 예정</div>
        <p className="text-[12px] text-ink3">
          provider별 사용량 한도와 지출 한도 설정은 좌측 하위 항목에서 확인할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
