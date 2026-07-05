import type { ReactNode } from 'react'

// 설정 모달의 2depth "그룹" — 프로필 / 환경설정 / 알림 등. 헤더 + 세로 행 스택.
export function SettingsGroup({
  title,
  children
}: {
  title: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-[15px] font-semibold text-ink">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

// 그룹 내 한 행 — 좌측 라벨(+설명), 우측 컨트롤. label 만 있는 세로형(계정 지침 textarea)은
// stacked=true 로 라벨을 위, 컨트롤을 아래로 배치한다.
export function SettingsRow({
  label,
  description,
  stacked = false,
  children
}: {
  label: string
  description?: string
  stacked?: boolean
  children: ReactNode
}): React.JSX.Element {
  if (stacked) {
    return (
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <div className="text-[13px] text-ink">{label}</div>
          {description && (
            <div className="mt-0.5 text-[12px] leading-snug text-ink3">{description}</div>
          )}
        </div>
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13px] text-ink">{label}</div>
        {description && (
          <div className="mt-0.5 text-[12px] leading-snug text-ink3">{description}</div>
        )}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  )
}
