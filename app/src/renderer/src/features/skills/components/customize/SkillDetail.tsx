import { useState } from 'react'
import type { SkillInfo } from '../../../../../../shared/ipc'
import { Icon } from '../../../../shared/ui/Icon'
import { Toggle } from '../../../../shared/ui/Toggle'

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11.5px] text-ink3">{label}</div>
      <div className="truncate text-[12.5px] text-ink2">{value}</div>
    </div>
  )
}

function formatDate(ms?: number): string {
  if (!ms) return '알 수 없음'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(ms))
}

export function SkillDetail({
  skill,
  onToggle
}: {
  skill: SkillInfo
  onToggle: () => void
}): React.JSX.Element {
  const [raw, setRaw] = useState(false)
  const body = skill.body || skill.description || '본문을 읽을 수 없습니다.'
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
        <Meta label="소스" value={skill.sourceLabel} />
        <Meta label="마지막 업데이트" value={formatDate(skill.updatedAt)} />
        <Meta label="호출 힌트" value={skill.argumentHint ?? skill.name} />
      </div>
      <div className="mt-4">
        <div className="mb-1 text-[11.5px] text-ink3">설명</div>
        <p className="m-0 text-[13.5px] leading-[1.65] text-ink2">
          {skill.description || '설명이 없습니다.'}
        </p>
      </div>
      <div className="relative mt-5 rounded-r5 border border-border bg-panel p-4">
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRaw(false)}
            aria-label="미리보기"
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${raw ? 'text-ink3' : 'text-rust'}`}
          >
            <Icon name="eye" size={14} />
          </button>
          <button
            type="button"
            onClick={() => setRaw(true)}
            aria-label="원문"
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${raw ? 'text-rust' : 'text-ink3'}`}
          >
            <Icon name="code" size={14} />
          </button>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-3 text-[12.5px]">
          <span className="text-ink3">Source</span>
          <span className="font-mono text-ink">{skill.sourceId}</span>
          <span className="text-ink3">Enabled</span>
          <span className="font-mono text-ink2">{String(skill.enabled)}</span>
        </div>
      </div>
      <div className="mt-6 space-y-3 text-[13.5px] leading-[1.7] text-ink2">
        {body.split('\n\n').map((para, i) => (
          <p key={i} className="m-0">
            {para}
          </p>
        ))}
      </div>
    </div>
  )
}
