import { useRef, useState } from 'react'
import type { SkillInfo } from '../../../../../../shared/ipc'
import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { Modal, ModalActions } from '../../../../shared/ui/Modal'
import { Popover } from '../../../../shared/ui/Popover'
import { Toggle } from '../../../../shared/ui/Toggle'
import { formatDateMedium, useI18n, type UiLocale } from '../../../../shared/i18n'

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11.5px] text-ink3">{label}</div>
      <div className="truncate text-[12.5px] text-ink2">{value}</div>
    </div>
  )
}

function formatDate(ms: number | undefined, locale: UiLocale, unknownLabel: string): string {
  if (!ms) return unknownLabel
  return formatDateMedium(ms, locale)
}

function MenuRow({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false
}: {
  icon: IconName
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] hover:bg-fill-uncontained-hover disabled:cursor-not-allowed disabled:opacity-45 ${danger ? 'text-rust' : 'text-ink'}`}
    >
      <Icon name={icon} size={14} color={danger ? 'var(--color-rust)' : 'var(--color-ink2)'} />
      <span>{label}</span>
    </button>
  )
}

export function SkillDetail({
  skill,
  onToggle,
  onTryInChat,
  onOpenDefault,
  onShowInFolder,
  onRemove
}: {
  skill: SkillInfo
  onToggle: () => void
  onTryInChat: () => void
  onOpenDefault: () => void
  onShowInFolder: () => void
  onRemove: () => Promise<void>
}): React.JSX.Element {
  const [plain, setPlain] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const { tr, locale } = useI18n()
  const body = skill.body?.trim() || tr('skills.detail.noBody')

  const remove = async (): Promise<void> => {
    setRemoving(true)
    try {
      await onRemove()
      setConfirmOpen(false)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="flex items-center gap-3">
        <h2 className="m-0 font-serif text-[22px] font-semibold text-ink">{skill.name}</h2>
        <div className="ml-auto flex items-center gap-2">
          {skill.canToggle && (
            <Toggle
              on={skill.enabled}
              onClick={onToggle}
              label={tr('skills.detail.toggleAria', { name: skill.name })}
            />
          )}
          <button
            ref={menuRef}
            type="button"
            aria-label={tr('common.more')}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
          >
            <Icon name="kebab" size={15} />
          </button>
        </div>
      </div>

      <Popover
        open={menuOpen}
        anchorRef={menuRef}
        onClose={() => setMenuOpen(false)}
        placement="bottom"
        align="end"
        className="min-w-[200px]"
      >
        <MenuRow
          icon="chat"
          label={tr('skills.detail.tryInChat')}
          onClick={() => {
            setMenuOpen(false)
            onTryInChat()
          }}
        />
        <MenuRow
          icon="doc"
          label={tr('skills.detail.openDefaultApp')}
          onClick={() => {
            setMenuOpen(false)
            onOpenDefault()
          }}
        />
        <MenuRow
          icon="folder"
          label={tr('skills.detail.showInFolder')}
          onClick={() => {
            setMenuOpen(false)
            onShowInFolder()
          }}
        />
        <MenuRow
          icon="trash"
          label={tr('skills.detail.remove')}
          danger
          disabled={!skill.canRemove}
          onClick={() => {
            setMenuOpen(false)
            setConfirmOpen(true)
          }}
        />
      </Popover>

      <div className="mt-4 grid grid-cols-1 gap-4 border-b border-border pb-4 sm:grid-cols-2">
        <Meta
          label={tr('skills.detail.lastUpdated')}
          value={formatDate(skill.createdAt, locale, tr('common.unknown'))}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 text-[11.5px] text-ink3">{tr('common.description')}</div>
        <p className="m-0 text-[13.5px] leading-[1.65] text-ink2">
          {skill.description || tr('common.noDescription')}
        </p>
      </div>

      <div className="relative mt-5 rounded-r5 border border-border bg-panel p-4">
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlain(false)}
            aria-label={tr('skills.detail.markdownAria')}
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${plain ? 'text-ink3' : 'text-t9'}`}
          >
            <Icon name="eye" size={14} />
          </button>
          <button
            type="button"
            onClick={() => setPlain(true)}
            aria-label={tr('skills.detail.plainTextAria')}
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${plain ? 'text-t9' : 'text-ink3'}`}
          >
            <Icon name="code" size={14} />
          </button>
        </div>
        <div className="pr-14">
          {plain ? (
            <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.7] text-ink2">
              {body}
            </pre>
          ) : (
            <Markdown
              source={body}
              className="min-w-0 break-words text-[13.5px] leading-[1.7] text-ink2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            />
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        title={tr('skills.detail.removeTitle')}
        onClose={() => setConfirmOpen(false)}
        width={560}
      >
        <p className="text-[13px] leading-[1.65] text-ink2">
          {tr('skills.detail.removeConfirmBody')}
        </p>
        <pre className="mt-3 overflow-auto rounded-r4 bg-bg2 p-3 font-mono text-[12px] text-ink2">
          {skill.skillDir}
        </pre>
        <div className="mt-5 flex justify-end gap-2">
          <ModalActions
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => void remove()}
            confirmLabel={removing ? tr('skills.detail.removing') : tr('skills.detail.remove')}
            confirmDisabled={removing}
          />
        </div>
      </Modal>
    </div>
  )
}
