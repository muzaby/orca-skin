// `/`·`@` 자동완성 섹션 헤더 — 두 목록이 같은 모양을 쓰는 SSOT(0259 D-004).
export function AutocompleteSectionHeader({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="border-b border-border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink3">
      {label}
    </div>
  )
}
