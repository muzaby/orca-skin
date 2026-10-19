import type { ButtonHTMLAttributes, KeyboardEventHandler, ReactNode } from 'react'

// Desktop DockPrompt geometry; adapted from OpenCode (resources/OPENCODE-LICENSE.txt).
export function DockPrompt({
  kind,
  header,
  children,
  footer,
  onKeyDown,
  label
}: {
  kind: 'question' | 'permission'
  header: ReactNode
  children?: ReactNode
  footer?: ReactNode
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
  label: string
}): React.JSX.Element {
  return (
    <div
      data-component="opencode-dock-prompt"
      data-kind={kind}
      data-surface="prompt"
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-col text-[13px] font-[440] leading-[20px] text-oc-ink"
    >
      <div className="relative z-10 flex min-h-0 flex-col gap-[16px] rounded-[10px] bg-oc-surface p-[8px] shadow-oc-raised">
        {header}
        {children}
      </div>
      {footer && (
        <div className="-mt-[9px] flex shrink-0 flex-wrap items-center justify-between gap-[8px] rounded-b-[10px] border-[0.5px] border-oc-border bg-oc-layer-1 px-[12px] pb-[8px] pt-[16px]">
          {footer}
        </div>
      )}
    </div>
  )
}

export function DockButton({
  tone = 'ghost',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'ghost' | 'neutral' | 'submit'
}): React.JSX.Element {
  const surface =
    tone === 'submit'
      ? 'bg-oc-button text-oc-button-ink shadow-oc-raised'
      : tone === 'neutral'
        ? 'bg-oc-surface text-oc-ink shadow-oc-raised'
        : 'bg-transparent text-oc-muted'
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-[32px] shrink-0 items-center justify-center gap-[8px] rounded-[6px] px-[10px] text-[13px] font-[530] leading-[20px] outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-oc-focus disabled:pointer-events-none disabled:opacity-40 ${surface} ${className}`}
    />
  )
}
