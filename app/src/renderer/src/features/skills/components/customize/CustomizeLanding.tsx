import { Icon, type IconName } from '../../../../shared/ui/Icon'

function ActionCard({
  icon,
  title,
  desc,
  onClick
}: {
  icon: IconName
  title: string
  desc: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3.5 rounded-r6 border border-border bg-panel px-5 py-4 text-left transition-colors hover:bg-fill-uncontained-hover"
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-r4 bg-bg2 text-ink2">
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        <span className="block text-[12.5px] text-ink2">{desc}</span>
      </span>
    </button>
  )
}

export function CustomizeLanding({
  onConnect,
  onCreateSkill
}: {
  onConnect: () => void
  onCreateSkill: () => void
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-[620px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 grid h-16 w-16 place-items-center text-ink2">
            <Icon name="briefcase" size={48} stroke={1.2} />
          </span>
          <h1 className="m-0 font-serif text-[26px] font-semibold text-ink">맞춤설정</h1>
          <p className="mt-2 max-w-[440px] text-[13.5px] leading-[1.6] text-ink2">
            스킬과 MCP는 Orca가 사용자와 함께 작업하는 방식을 결정합니다.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <ActionCard
            icon="link"
            title="MCP 연결"
            desc="Orca가 이미 사용 중인 도구를 읽고 쓸 수 있도록 허용하세요."
            onClick={onConnect}
          />
          <ActionCard
            icon="sparkle"
            title="새 스킬 만들기"
            desc="Orca에게 프로세스, 팀 규범, 전문 지식을 가르치세요."
            onClick={onCreateSkill}
          />
        </div>
      </div>
    </div>
  )
}
