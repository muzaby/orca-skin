import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { Popover } from '../../../../shared/ui/Popover'
import { GitIdentityMenu, type GitIdentityKind } from './GitIdentityMenu'
import { moveGitMenuFocus } from './gitIdentityMenuActions'

interface GitIdentityMenusProps {
  repo: string | null
  branch: string | null
  detached: boolean
  githubUrl: string | null
}

// GitRow keys this owner by identity; session/cwd changes also remount the entire row.
export function GitIdentityMenus({
  repo,
  branch,
  detached,
  githubUrl
}: GitIdentityMenusProps): React.JSX.Element {
  const { tr } = useI18n()
  const [menu, setMenu] = useState<{ kind: GitIdentityKind; epoch: number } | null>(null)
  const active = menu?.kind ?? null
  const [copyFailed, setCopyFailed] = useState(false)
  const repoRef = useRef<HTMLButtonElement>(null)
  const branchRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const firstFocus = useRef<'Home' | 'End'>('Home')
  const epoch = useRef(0)
  const menuId = useId()
  const anchorRef = active === 'repo' ? repoRef : branchRef
  const menuEpoch = menu?.epoch

  useEffect(
    () => () => {
      epoch.current += 1
    },
    []
  )
  useEffect(() => {
    if (!active) return
    // Popover first mounts hidden for measurement; focus after its position becomes visible.
    const frame = requestAnimationFrame(() => {
      if (!menuRef.current) return
      menuRef.current.focus()
      moveGitMenuFocus(menuRef.current, firstFocus.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, copyFailed])

  const close = (restoreFocus = true): void => {
    epoch.current += 1
    if (restoreFocus) anchorRef.current?.focus()
    setMenu(null)
    setCopyFailed(false)
  }
  const open = (kind: GitIdentityKind, last = false): void => {
    firstFocus.current = last ? 'End' : 'Home'
    if (active === kind && menuRef.current) {
      moveGitMenuFocus(menuRef.current, firstFocus.current)
    } else {
      epoch.current += 1
      setCopyFailed(false)
      setMenu({ kind, epoch: epoch.current })
    }
  }
  const triggerKey = (event: KeyboardEvent<HTMLButtonElement>, kind: GitIdentityKind): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    open(kind, event.key === 'ArrowUp')
  }
  const triggerClass = (kind: GitIdentityKind): string =>
    `cursor-default rounded-r3 border-0 px-1 py-0.5 text-left text-footnote text-t6 outline-none hide-focus-ring ring-focus transition-colors ${active === kind ? 'bg-fill-uncontained-active' : 'bg-transparent hover:bg-fill-uncontained-hover'}`

  return (
    <span className="flex min-w-0 flex-1 items-center gap-g6">
      {repo && (
        <button
          ref={repoRef}
          type="button"
          data-git-identity-trigger="repo"
          aria-haspopup="menu"
          aria-expanded={active === 'repo'}
          aria-controls={active === 'repo' ? menuId : undefined}
          title={repo}
          className={`max-w-[160px] shrink truncate ${triggerClass('repo')}`}
          onClick={() => (active === 'repo' ? close() : open('repo'))}
          onKeyDown={(event) => triggerKey(event, 'repo')}
        >
          {repo}
        </button>
      )}
      <button
        ref={branchRef}
        type="button"
        data-git-identity-trigger="branch"
        aria-haspopup="menu"
        aria-expanded={active === 'branch'}
        aria-controls={active === 'branch' ? menuId : undefined}
        title={detached || !branch ? tr('chat.gitRow.detached') : branch}
        className={`min-w-0 shrink-[9999] truncate ${triggerClass('branch')}`}
        onClick={() => (active === 'branch' ? close() : open('branch'))}
        onKeyDown={(event) => triggerKey(event, 'branch')}
      >
        {detached || !branch ? tr('chat.gitRow.detached') : branch}
      </button>
      <Popover
        // Error copy changes the menu size; remount to measure and flip it within the viewport.
        key={copyFailed ? 'copy-error' : 'menu'}
        open={active !== null}
        anchorRef={anchorRef}
        onClose={() => close(menuRef.current?.contains(document.activeElement) ?? false)}
        placement="bottom"
        align="start"
        className="min-w-[224px] max-w-[calc(100vw-16px)] rounded-r6!"
      >
        {active && (
          <div
            id={menuId}
            ref={menuRef}
            data-git-identity-menu={active}
            tabIndex={-1}
            className="outline-none"
            onKeyDown={(event) => {
              if (moveGitMenuFocus(event.currentTarget, event.key)) event.preventDefault()
              if (event.key === 'Tab') {
                // Resume normal tab order from the identity button after removing the portal.
                close()
              }
            }}
          >
            <GitIdentityMenu
              kind={active}
              githubUrl={githubUrl}
              branch={branch}
              detached={detached}
              copyFailed={copyFailed}
              onClose={() => close()}
              onCopyResult={(copied) => {
                // A late clipboard result cannot close or paint a newly opened menu.
                if (epoch.current !== menuEpoch) return
                if (copied) close()
                else setCopyFailed(true)
              }}
            />
          </div>
        )}
      </Popover>
    </span>
  )
}
