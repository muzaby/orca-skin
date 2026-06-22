import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SkillInfo } from '../../../../../../shared/ipc'
import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { Modal, ModalActions } from '../../../../shared/ui/Modal'
import { Popover } from '../../../../shared/ui/Popover'
import { Toggle } from '../../../../shared/ui/Toggle'

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[11.5px] text-ink3">{label}</div>
      <div className="truncate text-[12.5px] text-ink2">{value}</div>
    </div>
  )
}

function formatDate(ms?: number): string {
  if (!ms) return '알 수 없음'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(ms))
}

function MarkdownBody({ source }: { source: string }): React.JSX.Element {
  return (
    <div className="min-w-0 break-words text-[13.5px] leading-[1.7] text-ink2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:break-words [&_code]:rounded-r3 [&_code]:bg-cream-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:rounded-r4 [&_pre]:bg-cream-50 [&_pre]:p-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  )
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
  const body = skill.body?.trim() || '본문이 없습니다.'

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
            <Toggle on={skill.enabled} onClick={onToggle} label={`${skill.name} 활성화`} />
          )}
          <button
            ref={menuRef}
            type="button"
            aria-label="더 보기"
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
          label="채팅에서 사용해보기"
          onClick={() => {
            setMenuOpen(false)
            onTryInChat()
          }}
        />
        <MenuRow
          icon="doc"
          label="기본 앱에서 보기"
          onClick={() => {
            setMenuOpen(false)
            onOpenDefault()
          }}
        />
        <MenuRow
          icon="folder"
          label="폴더에서 보기"
          onClick={() => {
            setMenuOpen(false)
            onShowInFolder()
          }}
        />
        <MenuRow
          icon="trash"
          label="제거"
          danger
          disabled={!skill.canRemove}
          onClick={() => {
            setMenuOpen(false)
            setConfirmOpen(true)
          }}
        />
      </Popover>

      <div className="mt-4 grid grid-cols-1 gap-4 border-b border-border pb-4 sm:grid-cols-2">
        <Meta label="마지막 업데이트" value={formatDate(skill.createdAt)} />
      </div>

      <div className="mt-4">
        <div className="mb-1 text-[11.5px] text-ink3">설명</div>
        <p className="m-0 text-[13.5px] leading-[1.65] text-ink2">
          {skill.description || '설명이 없습니다.'}
        </p>
      </div>

      <div className="relative mt-5 rounded-r5 border border-border bg-panel p-4">
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlain(false)}
            aria-label="마크다운"
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${plain ? 'text-ink3' : 'text-rust'}`}
          >
            <Icon name="eye" size={14} />
          </button>
          <button
            type="button"
            onClick={() => setPlain(true)}
            aria-label="plain text"
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-r3 border-0 bg-transparent ${plain ? 'text-rust' : 'text-ink3'}`}
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
            <MarkdownBody source={body} />
          )}
        </div>
      </div>

      <Modal open={confirmOpen} title="스킬 제거" onClose={() => setConfirmOpen(false)} width={560}>
        <p className="text-[13px] leading-[1.65] text-ink2">
          이 작업은 Orca 스킬 sources에서 다음 폴더를 제거합니다. 계속하려면 한 번 더 확인하세요.
        </p>
        <pre className="mt-3 overflow-auto rounded-r4 bg-cream-50 p-3 font-mono text-[12px] text-ink2">
          {skill.skillDir}
        </pre>
        <div className="mt-5 flex justify-end gap-2">
          <ModalActions
            onCancel={() => setConfirmOpen(false)}
            onConfirm={() => void remove()}
            confirmLabel={removing ? '제거 중…' : '제거'}
            confirmDisabled={removing}
          />
        </div>
      </Modal>
    </div>
  )
}
