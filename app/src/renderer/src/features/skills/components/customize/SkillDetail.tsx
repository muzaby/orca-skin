import { useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { Toggle } from '../../../../shared/ui/Toggle'
import type { SkillItem } from './data'

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11.5px] text-ink3">{label}</div>
      <div className="truncate text-[12.5px] text-ink2">{value}</div>
    </div>
  )
}

// 맞춤설정 우측 — 스킬 상세(첨부 2). 이름 + 활성 토글 + kebab, 메타 3열, 설명,
// Version/Triggers 카드(eye/code 토글은 시각 전용), 본문.
export function SkillDetail({
  skill,
  onToggle
}: {
  skill: SkillItem
  onToggle: () => void
}): React.JSX.Element {
  const [raw, setRaw] = useState(false)

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="flex items-center gap-3">
        <h2 className="m-0 font-serif text-[22px] font-semibold text-ink">{skill.name}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Toggle on={skill.enabled} onClick={onToggle} label={`${skill.name} 활성화`} />
          <button
            type="button"
            aria-label="더 보기"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
          >
            <Icon name="kebab" size={15} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-b border-border pb-4">
        <Meta label="추가한 사람" value={skill.addedBy} />
        <Meta label="마지막 업데이트" value={skill.updatedAt} />
        <Meta label="트리거" value={skill.trigger} />
      </div>

      <div className="mt-4">
        <div className="mb-1 text-[11.5px] text-ink3">설명</div>
        <p className="m-0 text-[13.5px] leading-[1.65] text-ink2">{skill.desc}</p>
      </div>

      <div className="relative mt-5 rounded-r5 border border-border bg-panel p-4">
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRaw(false)}
            aria-label="미리보기"
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${
              raw ? 'text-ink3' : 'text-rust'
            }`}
          >
            <Icon name="eye" size={14} />
          </button>
          <button
            type="button"
            onClick={() => setRaw(true)}
            aria-label="원문"
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${
              raw ? 'text-rust' : 'text-ink3'
            }`}
          >
            <Icon name="code" size={14} />
          </button>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-3 text-[12.5px]">
          <span className="text-ink3">Version</span>
          <span className="font-mono text-ink">{skill.version}</span>
          <span className="text-ink3">Triggers</span>
          <span className="font-mono text-ink2">{skill.triggers}</span>
        </div>
      </div>

      <div className="mt-6 space-y-3 text-[13.5px] leading-[1.7] text-ink2">
        {skill.body.split('\n\n').map((para, i) => (
          <p key={i} className="m-0">
            {para}
          </p>
        ))}
      </div>
    </div>
  )
}
