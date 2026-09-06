import { useRef, useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { MenuItem } from '../../../../shared/ui/MenuItem'
import { Modal, ModalActions } from '../../../../shared/ui/Modal'
import { Popover } from '../../../../shared/ui/Popover'
import { Dot } from '../../../../shared/ui/Status'
import { Toggle } from '../../../../shared/ui/Toggle'
import type { McpServer } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'

// MCP 서버 상세. 헤더 우측 구성은 SkillDetail 과 같다 — 활성 상태는 **토글**이 갖고,
// 그 밖의 동작(편집·제거)은 케밥 메뉴에 모은다. 버튼을 나란히 늘리면 파괴적 동작이
// 일상 동작과 같은 무게로 보인다.
export function McpDetail({
  server,
  onToggle,
  onEdit,
  onRemove
}: {
  server: McpServer
  onToggle: () => void
  onEdit: () => void
  onRemove: () => Promise<void>
}): React.JSX.Element {
  const { tr } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const summary =
    server.transport === 'http'
      ? server.url
      : [server.command, ...server.args].filter(Boolean).join(' ')

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
      <div className="flex items-center gap-g6">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-r4 bg-bg2 text-ink2">
          <Icon name={server.transport === 'http' ? 'link' : 'cpu'} size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 text-heading text-ink">{server.name}</h2>
          <div className="mt-g1 flex items-center gap-g3 text-footnote text-ink3">
            <span className="font-mono uppercase">{server.transport}</span>
            <span>·</span>
            <Dot tone={server.enabled ? 'green' : 'slate'} />
            <span>
              {server.enabled ? tr('skills.mcpDetail.active') : tr('skills.mcpDetail.inactive')}
            </span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Toggle
            on={server.enabled}
            onClick={onToggle}
            label={tr('skills.mcpDetail.toggleAria', { name: server.name })}
          />
          <button
            ref={menuRef}
            type="button"
            aria-label={tr('common.more')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
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
        <MenuItem
          role="menuitem"
          icon="edit"
          onClick={() => {
            setMenuOpen(false)
            onEdit()
          }}
        >
          {tr('skills.mcpDetail.edit')}
        </MenuItem>
        <MenuItem
          role="menuitem"
          icon="trash"
          danger
          onClick={() => {
            setMenuOpen(false)
            setConfirmOpen(true)
          }}
        >
          {tr('skills.mcpDetail.remove')}
        </MenuItem>
      </Popover>

      <p className="mt-p7 text-body leading-relaxed text-ink2">
        {server.description || summary || tr('common.noDescription')}
      </p>
      <div className="mt-p8 rounded-r5 border border-border bg-bg2 p-p7 text-footnote">
        <div className="mb-g4 text-caption text-ink3">{tr('skills.mcpDetail.configSummary')}</div>
        <pre className="m-0 whitespace-pre-wrap break-all font-mono text-ink2">
          {JSON.stringify(
            server.transport === 'http'
              ? { url: server.url, authEnvKey: server.authEnvKey }
              : { command: server.command, args: server.args, authEnvKey: server.authEnvKey },
            null,
            2
          )}
        </pre>
      </div>

      <Modal
        open={confirmOpen}
        title={tr('skills.mcpDetail.removeTitle')}
        onClose={() => setConfirmOpen(false)}
        width={560}
      >
        <p className="text-body leading-relaxed text-ink2">
          {tr('skills.mcpDetail.removeConfirmBody')}
        </p>
        <pre className="mt-p6 overflow-auto rounded-r4 bg-bg2 p-p6 font-mono text-code text-ink2">
          {server.name}
        </pre>
        <div className="mt-5 flex justify-end gap-2">
          <ModalActions
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => void remove()}
            confirmLabel={
              removing ? tr('skills.mcpDetail.removing') : tr('skills.mcpDetail.remove')
            }
            confirmDisabled={removing}
          />
        </div>
      </Modal>
    </div>
  )
}
