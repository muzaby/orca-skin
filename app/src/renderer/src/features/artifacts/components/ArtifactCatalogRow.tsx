import { useEffect, useRef, useState } from 'react'
import type { ArtifactCatalogItem } from '../../../../../shared/artifacts'
import { formatRelativeDay, useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { CatalogListRow } from '../../../shared/ui/CatalogListRow'

interface ArtifactCatalogRowProps {
  item: ArtifactCatalogItem
  busy: boolean
  selected: boolean
  onOpen: (item: ArtifactCatalogItem, origin: HTMLElement) => void
  onPin: (item: ArtifactCatalogItem) => void
  onDelete: (item: ArtifactCatalogItem) => void
}

export function ArtifactCatalogRow({
  item,
  busy,
  selected,
  onOpen,
  onPin,
  onDelete
}: ArtifactCatalogRowProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const firstAction = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    // Popover first measures an invisible panel; focus after its positioned frame is visible.
    const frame = window.requestAnimationFrame(() =>
      firstAction.current?.focus({ preventScroll: true })
    )
    return () => window.cancelAnimationFrame(frame)
  }, [menuOpen])
  const closeMenu = (): void => {
    setMenuOpen(false)
    menuRef.current?.focus({ preventScroll: true })
  }
  return (
    <CatalogListRow
      data-artifact-catalog-row={item.publicationId}
      selected={selected}
      openProps={{
        ...{ 'data-artifact-catalog-open': item.publicationId },
        disabled: busy,
        onClick: (event) => onOpen(item, event.currentTarget)
      }}
      icon={
        <Icon
          name={
            item.kind === 'image'
              ? 'cam'
              : item.kind === 'html' || item.kind === 'text'
                ? 'code'
                : 'doc'
          }
          size={20}
          className="shrink-0 text-ink3"
        />
      }
      title={
        <>
          <span className="truncate text-[14px] font-medium text-ink" title={item.title}>
            {item.title}
          </span>
          {item.pinned && <Icon name="pin" size={13} className="shrink-0 text-ink3" />}
        </>
      }
      detail={
        <span
          className="truncate text-caption text-ink3"
          title={`${item.filename} · ${item.sessionTitle}`}
        >
          {item.filename}
          <span className="px-1.5">·</span>
          {item.sessionTitle}
        </span>
      }
      trailing={
        <span className="hidden shrink-0 text-caption text-ink3 @[560px]/catalog:block">
          {formatRelativeDay(item.publishedAt, locale)}
        </span>
      }
      actions={
        <>
          <Button
            ref={menuRef}
            iconOnly
            size="small"
            leadingIcon="kebab"
            title={tr('common.more')}
            disabled={busy}
            aria-label={tr('artifactCatalog.itemMenu', { title: item.title })}
            aria-haspopup="menu"
            expanded={menuOpen}
            data-artifact-catalog-menu={item.publicationId}
            onClick={() => setMenuOpen(!menuOpen)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setMenuOpen(true)
              }
            }}
            className="shrink-0"
          />
          <Popover
            open={menuOpen}
            anchorRef={menuRef}
            onClose={closeMenu}
            placement="bottom"
            align="end"
            className="min-w-36"
          >
            <div
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  const buttons = [
                    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]')
                  ]
                  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
                  buttons[
                    (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
                  ]?.focus()
                }
              }}
            >
              <MenuItem
                ref={firstAction}
                role="menuitem"
                icon="pin"
                disabled={busy}
                onClick={() => {
                  closeMenu()
                  onPin(item)
                }}
              >
                {tr(item.pinned ? 'common.unpin' : 'common.pin')}
              </MenuItem>
              <MenuItem
                role="menuitem"
                icon="trash"
                danger
                disabled={busy}
                onClick={() => {
                  closeMenu()
                  onDelete(item)
                }}
              >
                {tr('common.delete')}
              </MenuItem>
            </div>
          </Popover>
        </>
      }
    />
  )
}
