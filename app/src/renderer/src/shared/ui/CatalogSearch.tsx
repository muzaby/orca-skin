import type { ReactNode } from 'react'
import type { CatalogSearchControls } from '../hooks/useCatalogSearch'
import { Button } from './Button'
import { Icon } from './Icon'

interface CatalogSearchProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  controls: CatalogSearchControls
  children: ReactNode
  toggleBehavior?: string
  inputMarker?: `data-${string}`
}

/** Catalog tabs and search share one toolbar while filtering stays with the feature. */
export function CatalogSearch({
  id,
  label,
  placeholder,
  value,
  onChange,
  controls: { open, inputRef, triggerRef, close, toggle },
  children,
  toggleBehavior,
  inputMarker
}: CatalogSearchProps): React.JSX.Element {
  return (
    <>
      <div className="mb-4 mt-6 flex items-center justify-between gap-3">
        {children}
        <Button
          ref={triggerRef}
          iconOnly
          leadingIcon="search"
          pressed={open}
          aria-label={label}
          title={label}
          aria-expanded={open}
          aria-controls={`${id}-search`}
          data-behavior={toggleBehavior}
          onClick={toggle}
        />
      </div>
      {open && (
        <div className="mb-4 flex items-center gap-2 rounded-r4 border border-border bg-panel px-3 focus-within:border-border-strong">
          <Icon name="search" size={16} className="shrink-0 text-ink3" />
          <input
            ref={inputRef}
            id={`${id}-search`}
            type="search"
            value={value}
            {...(inputMarker ? { [inputMarker]: '' } : {})}
            aria-label={label}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                close()
              }
            }}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-footnote text-ink outline-none placeholder:text-ink3"
          />
        </div>
      )}
    </>
  )
}
