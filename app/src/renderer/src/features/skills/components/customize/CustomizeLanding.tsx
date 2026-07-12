import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'

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
  const { tr } = useI18n()
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-[620px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 grid h-16 w-16 place-items-center text-ink2">
            <Icon name="briefcase" size={48} />
          </span>
          <h1 className="m-0 font-serif text-[26px] font-semibold text-ink">
            {tr('skills.landing.title')}
          </h1>
          <p className="mt-2 max-w-[440px] text-[13.5px] leading-[1.6] text-ink2">
            {tr('skills.landing.subtitle')}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <ActionCard
            icon="link"
            title={tr('skills.landing.mcpCardTitle')}
            desc={tr('skills.landing.mcpCardDesc')}
            onClick={onConnect}
          />
          <ActionCard
            icon="sparkle"
            title={tr('skills.landing.skillCardTitle')}
            desc={tr('skills.landing.skillCardDesc')}
            onClick={onCreateSkill}
          />
        </div>
      </div>
    </div>
  )
}
