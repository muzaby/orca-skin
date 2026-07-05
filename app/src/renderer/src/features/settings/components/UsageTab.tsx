// 설정 모달 '사용량' 탭 — 첨부 3번 이미지의 정적 목업(실데이터 미연동).
// 플랜 한도/주간 한도/사용 크레딧을 토큰 스타일로 재현한다.

function Meter({ pct, tone }: { pct: number; tone: 'accent' | 'bad' }): React.JSX.Element {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full ${tone === 'bad' ? 'bg-bad' : 'bg-accent'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function UsageRow({
  label,
  sub,
  pct,
  tone = 'accent'
}: {
  label: string
  sub?: string
  pct: number
  tone?: 'accent' | 'bad'
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] text-ink">{label}</div>
          {sub && <div className="mt-0.5 text-[12px] text-ink3">{sub}</div>}
        </div>
        <div className="flex-none text-[12.5px] text-ink2">{pct}% 사용됨</div>
      </div>
      <Meter pct={pct} tone={tone} />
    </div>
  )
}

export function UsageTab(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
          플랜 사용량 한도
          <span className="rounded-r4 border border-border px-1.5 py-0.5 text-[11px] font-medium text-ink2">
            Pro
          </span>
        </h3>
        <UsageRow label="현재 세션" sub="메시지를 보낼 때 시작됩니다" pct={0} />
      </section>

      <section>
        <h3 className="mb-1 text-[15px] font-semibold text-ink">주간 한도</h3>
        <p className="mb-4 text-[12.5px] text-accent">사용량 한도에 대해 자세히 알아보기</p>
        <div className="flex flex-col gap-5">
          <UsageRow label="모든 모델" sub="(토) 오전 2:00에 재설정" pct={67} />
          <UsageRow label="Fable" sub="(토) 오전 2:00에 재설정" pct={94} tone="bad" />
        </div>
        <p className="mt-4 text-[12px] text-ink3">마지막 업데이트: 1분 전</p>
      </section>

      <section>
        <h3 className="mb-3 text-[15px] font-semibold text-ink">사용 크레딧</h3>
        <p className="mb-3 text-[12.5px] leading-snug text-ink2">
          한도에 도달했을 때 Claude를 계속 사용하려면 사용 크레딧을 켜세요.
        </p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[13px] text-ink">US$0.00 사용</div>
            <div className="mt-0.5 text-[12px] text-ink3">Aug 1에 재설정</div>
          </div>
          <span className="text-[13px] font-medium text-accent">무제한</span>
        </div>
      </section>
    </div>
  )
}
