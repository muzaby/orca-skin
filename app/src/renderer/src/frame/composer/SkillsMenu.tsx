import type { SkillInfo } from '../../../../shared/ipc'

const MENU_ITEM =
  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-ink hover:bg-sidebar disabled:cursor-not-allowed disabled:text-ink3'

interface SkillsMenuProps {
  skills: SkillInfo[]
  onPick: (name: string) => void
}

export function SkillsMenu({ skills, onPick }: SkillsMenuProps): React.JSX.Element {
  return (
    <div role="none" className="flex flex-col">
      <div className="max-h-[280px] overflow-y-auto">
        {skills.length === 0 ? (
          <div className="px-2 py-2 text-[11.5px] leading-relaxed text-ink3">
            스킬이 없습니다. <span className="font-mono">~/.claude/skills/</span> 또는 프로젝트의{' '}
            <span className="font-mono">.claude/skills/</span> 에 SKILL.md 를 두세요.
          </div>
        ) : (
          skills.map((s) => (
            <button
              key={s.name}
              type="button"
              role="menuitem"
              onClick={() => onPick(s.name)}
              className={`group/skillrow relative ${MENU_ITEM}`}
            >
              <span className="flex-1 font-mono text-[12.5px]">/{s.name}</span>
              {s.argumentHint && (
                <span className="font-mono text-[10.5px] text-ink3">{s.argumentHint}</span>
              )}
              {s.description && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-0 z-10 ml-2 hidden w-[240px] rounded-md border border-border bg-panel p-2 text-[11.5px] leading-relaxed text-ink2 shadow-lg group-hover/skillrow:block"
                >
                  {s.description}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
