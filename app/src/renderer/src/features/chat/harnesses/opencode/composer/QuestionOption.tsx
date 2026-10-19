import type { ReactNode } from 'react'
import { OpenCodeIcon } from '../Icon'

export function QuestionMark({
  selected,
  multiple
}: {
  selected: boolean
  multiple: boolean
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`mt-[2px] grid size-[16px] shrink-0 place-items-center border-[0.5px] ${multiple ? 'rounded-[4px]' : 'rounded-full'} ${selected ? 'border-oc-control-accent bg-oc-control-accent text-white' : 'border-oc-border bg-oc-surface'}`}
    >
      {selected &&
        (multiple ? (
          <OpenCodeIcon name="check" size={12} />
        ) : (
          <span className="size-[6px] rounded-full bg-white" />
        ))}
    </span>
  )
}

export function QuestionOption({
  selected,
  multiple,
  label,
  description,
  onClick,
  children
}: {
  selected: boolean
  multiple: boolean
  label: string
  description?: string
  onClick: () => void
  children?: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      data-slot="question-option"
      data-picked={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-[8px] rounded-[6px] border-[0.5px] p-[10px] text-left outline-none focus-visible:ring-2 focus-visible:ring-oc-focus ${selected ? 'border-oc-focus bg-oc-selected' : 'border-oc-border bg-oc-layer-1 hover:bg-oc-layer-2'}`}
    >
      <QuestionMark selected={selected} multiple={multiple} />
      <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <span className="break-words font-[530] text-oc-ink">{label}</span>
        {description && <span className="break-words text-oc-muted">{description}</span>}
      </span>
      {children}
    </button>
  )
}
