import { useRef, useState, type ReactNode } from 'react'

interface ChoiceOption<V> {
  value: V
  label: string
}

export interface FloatingPanelProps {
  title: string
  children: ReactNode
}

const PANEL_CLASS =
  'fixed z-[2147483646] flex max-h-[calc(100vh-32px)] w-[280px] flex-col overflow-hidden ' +
  'rounded-[14px] border-[0.5px] border-white/60 bg-floating-panel-bg ' +
  'text-floating-panel-text shadow-[var(--shadow-floating-panel)] ' +
  '[backdrop-filter:blur(24px)_saturate(160%)] [-webkit-backdrop-filter:blur(24px)_saturate(160%)] ' +
  'font-sans text-[11.5px] leading-[1.4]'

export function FloatingPanel({ title, children }: FloatingPanelProps): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const dragRef = useRef<HTMLDivElement | null>(null)
  const offsetRef = useRef({ x: 16, y: 16 })

  const onDragStart = (e: React.MouseEvent): void => {
    const panel = dragRef.current
    if (!panel) return
    const r = panel.getBoundingClientRect()
    const sx = e.clientX
    const sy = e.clientY
    const startRight = window.innerWidth - r.right
    const startBottom = window.innerHeight - r.bottom
    const move = (ev: MouseEvent): void => {
      const x = startRight - (ev.clientX - sx)
      const y = startBottom - (ev.clientY - sy)
      offsetRef.current = {
        x: Math.max(8, Math.min(window.innerWidth - 280 - 8, x)),
        y: Math.max(8, Math.min(window.innerHeight - 100 - 8, y))
      }
      panel.style.right = offsetRef.current.x + 'px'
      panel.style.bottom = offsetRef.current.y + 'px'
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[2147483646] cursor-pointer rounded-full border-[0.5px] border-white/60 bg-floating-panel-bg px-3 py-1.5 font-mono text-[11px] text-floating-panel-text shadow-[var(--shadow-floating-panel-closed)] [backdrop-filter:blur(24px)_saturate(160%)]"
      >
        {title}
      </button>
    )
  }

  return (
    <div ref={dragRef} className={PANEL_CLASS} style={{ right: 16, bottom: 16 }}>
      <div
        className="flex cursor-move select-none items-center justify-between pb-2.5 pl-3.5 pr-2 pt-2.5"
        onMouseDown={onDragStart}
      >
        <b className="text-[12px] font-semibold tracking-[0.01em]">{title}</b>
        <button
          className="h-[22px] w-[22px] cursor-default appearance-none rounded-md border-0 bg-transparent text-[13px] leading-none text-floating-panel-muted hover:bg-floating-panel-control-hover hover:text-floating-panel-text"
          aria-label="Close tweaks"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden px-3.5 pb-3.5 pt-0.5 [scrollbar-color:var(--color-floating-panel-toggle-off)_transparent] [scrollbar-width:thin]">
        {children}
      </div>
    </div>
  )
}

export function PanelSection({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="pt-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-floating-panel-label first:pt-0">
      {label}
    </div>
  )
}

export function PanelButton({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-default rounded-md border-[0.5px] border-floating-panel-border bg-floating-panel-control px-2.5 py-1.5 text-left font-medium text-floating-panel-text transition-colors hover:bg-floating-panel-control-hover"
    >
      {label}
    </button>
  )
}

export function PanelToggle({
  label,
  value,
  onChange
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-row items-center justify-between gap-2.5">
      <div className="flex items-baseline justify-between text-floating-panel-text">
        <span className="font-medium">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-[18px] w-8 cursor-default rounded-full border-0 p-0 transition-colors duration-150 ${
          value ? 'bg-toggle-on' : 'bg-floating-panel-toggle-off'
        }`}
      >
        <i
          className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow-[var(--shadow-floating-control)] transition-transform duration-150 ${
            value ? 'translate-x-[14px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export function PanelRadio<V extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: V
  options: ChoiceOption<V>[]
  onChange: (v: V) => void
}): React.JSX.Element {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  const n = options.length
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-floating-panel-text">
        <span className="font-medium">{label}</span>
      </div>
      <div
        className="relative flex select-none rounded-lg bg-floating-panel-radio-bg p-0.5"
        role="radiogroup"
      >
        <div
          className="absolute bottom-0.5 top-0.5 rounded-md bg-selected-soft shadow-[var(--shadow-floating-control)] transition-[left,width] duration-150 ease-[cubic-bezier(.3,.7,.4,1)]"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`
          }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className="relative z-[1] min-h-[22px] flex-1 cursor-default appearance-none rounded-md border-0 bg-transparent px-1.5 py-1 font-medium leading-[1.2] text-inherit [overflow-wrap:anywhere]"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PanelSelect<V extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: V
  options: ChoiceOption<V>[]
  onChange: (v: V) => void
}): React.JSX.Element {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-floating-panel-label">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
        className="w-full cursor-pointer rounded-lg border border-floating-panel-border bg-floating-panel-thumb px-2.5 py-1.5 text-[11px] font-medium text-floating-panel-text outline-none transition focus:border-selected"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PanelSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <label className="mb-3 block">
      <span className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-floating-panel-label">
        <span>{label}</span>
        <span className="font-mono text-floating-panel-text">{Math.round(value)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-selected"
      />
    </label>
  )
}
