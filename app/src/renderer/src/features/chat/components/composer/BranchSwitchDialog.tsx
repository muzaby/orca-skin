import { useRef, useState } from 'react'
import type { GitDirtyResolution, GitDirtyStat } from '../../../../../../shared/ipc'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { MenuItem } from '../../../../shared/ui/MenuItem'
import { Modal } from '../../../../shared/ui/Modal'
import { Popover } from '../../../../shared/ui/Popover'
import { useI18n } from '../../../../shared/i18n'
import type { MessageKey } from '../../../../shared/i18n'

// 분할 버튼의 3선택지 — 순서가 곧 메뉴 순서고, 첫 항목이 기본값이다.
const RESOLUTIONS: Array<{ value: GitDirtyResolution; labelKey: MessageKey }> = [
  { value: 'stash', labelKey: 'chat.composer.dirtyStash' },
  { value: 'commit-wip', labelKey: 'chat.composer.dirtyCommitWip' },
  { value: 'discard', labelKey: 'chat.composer.dirtyDiscard' }
]

interface BranchSwitchDialogProps {
  open: boolean
  // 전환 출발 브랜치(현재). detached 면 null.
  from: string | null
  // 전환하려는 대상 브랜치.
  target: string
  stat: GitDirtyStat
  busy: boolean
  onCancel: () => void
  onConfirm: (resolution: GitDirtyResolution) => void
}

// 더티 트리에서 브랜치를 전환하려 할 때 뜨는 확인 모달. **무엇을 할지 고르기 전에는 아무것도
// 하지 않는다** — main 의 checkout 은 resolution 없이는 `reason:'dirty'` 로 되돌아온다.
export function BranchSwitchDialog({
  open,
  from,
  target,
  stat,
  busy,
  onCancel,
  onConfirm
}: BranchSwitchDialogProps): React.JSX.Element {
  const { tr } = useI18n()
  const [resolution, setResolution] = useState<GitDirtyResolution>('stash')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const activeLabel = tr(
    RESOLUTIONS.find((option) => option.value === resolution)?.labelKey ??
      'chat.composer.dirtyStash'
  )

  return (
    <Modal
      open={open}
      onClose={onCancel}
      busy={busy}
      width={480}
      ariaLabel={tr('chat.composer.branchDirtyAria')}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="contained" size="small" onClick={onCancel} disabled={busy}>
            {tr('common.cancel')}
          </Button>
          {/* 분할 버튼 — 왼쪽이 현재 선택된 처리 방식의 실행, 오른쪽 chevron 이 방식 선택. */}
          <div className="flex items-stretch">
            <Button
              variant="contained"
              size="small"
              busy={busy}
              onClick={() => onConfirm(resolution)}
              className="rounded-r-none"
            >
              {activeLabel}
            </Button>
            <Button
              ref={menuButtonRef}
              variant="contained"
              size="small"
              iconOnly
              leadingIcon="chevD"
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={tr('chat.composer.branchDirtyMenuAria')}
              onClick={() => setMenuOpen((value) => !value)}
              className="-ml-px rounded-l-none"
            />
          </div>
          <Popover
            open={menuOpen}
            anchorRef={menuButtonRef}
            onClose={() => setMenuOpen(false)}
            align="end"
          >
            <div role="none" className="flex w-[200px] flex-col">
              {RESOLUTIONS.map((option) => (
                <MenuItem
                  key={option.value}
                  role="menuitemradio"
                  aria-checked={option.value === resolution}
                  onClick={() => {
                    setResolution(option.value)
                    setMenuOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1">{tr(option.labelKey)}</span>
                  {option.value === resolution && (
                    <Icon name="check" size={12} className="shrink-0" />
                  )}
                </MenuItem>
              ))}
            </div>
          </Popover>
        </div>
      }
    >
      <p className="text-[13.5px] font-medium leading-relaxed text-ink">
        <code className="font-mono">{from ?? 'HEAD'}</code>
        {tr('chat.composer.branchDirtyTitleSuffix')}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink2">
        <code className="font-mono">{target}</code>
        {tr('chat.composer.branchDirtyTargetSuffix')}
      </p>
      <p className="mt-2 flex items-center gap-2 text-[12.5px] text-ink2">
        <span>{tr('chat.composer.branchDirtyStat', { files: stat.files })}</span>
        {/* diff 색은 DiffBody 와 같은 토큰(good/bad)을 쓴다 — 테마 전환이 함께 따라온다. */}
        <span className="font-mono text-[var(--color-good)]">+{stat.insertions}</span>
        <span className="font-mono text-[var(--color-bad)]">-{stat.deletions}</span>
      </p>
    </Modal>
  )
}
