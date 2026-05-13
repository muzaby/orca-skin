import { WinControls } from '../components/atoms/WinControls'

export interface TitlebarProps {
  project?: string
  breadcrumb?: string | null
}

export function Titlebar({
  project = 'cam-validation-v3',
  breadcrumb
}: TitlebarProps): React.JSX.Element {
  return (
    <div className="flex h-9 flex-none select-none items-center border-b border-border bg-sidebar pl-[14px] pr-[10px] text-[12px] text-ink2 [-webkit-app-region:drag]">
      <div className="flex items-center gap-2">
        <div className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-rust font-serif text-[12px] font-bold text-white">
          O
        </div>
        <span className="font-serif text-[13px] font-semibold tracking-tight text-ink">Orca</span>
        <span className="text-[11px] text-ink3">—</span>
        <span className="text-[12px] text-ink2">{project}</span>
        {breadcrumb && (
          <>
            <span className="mx-1 text-[11px] text-ink3">›</span>
            <span className="text-[12px] text-ink2">{breadcrumb}</span>
          </>
        )}
      </div>
      <WinControls />
    </div>
  )
}
