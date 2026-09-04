import { useI18n } from '../../../../shared/i18n'
import { MenuItem } from '../../../../shared/ui/MenuItem'
import { githubBranchUrl } from './gitIdentityMenuActions'

export type GitIdentityKind = 'repo' | 'branch'

interface GitIdentityMenuProps {
  kind: GitIdentityKind
  githubUrl: string | null
  branch: string | null
  detached: boolean
  copyFailed: boolean
  onClose: () => void
  onCopyResult: (copied: boolean) => void
}

export function GitIdentityMenu({
  kind,
  githubUrl,
  branch,
  detached,
  copyFailed,
  onClose,
  onCopyResult
}: GitIdentityMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  const branchAvailable = !detached && !!branch
  const branchReason = branchAvailable ? null : tr('chat.gitRow.noBranch')
  const openReason =
    (kind === 'branch' ? branchReason : null) ??
    (githubUrl ? null : tr('chat.gitRow.noGithubRemote'))
  const destination = kind === 'repo' ? githubUrl : githubBranchUrl(githubUrl, branch)

  const copy = async (): Promise<void> => {
    if (!branchAvailable || !branch) return
    try {
      await navigator.clipboard.writeText(branch)
      onCopyResult(true)
    } catch {
      onCopyResult(false)
    }
  }

  return (
    <>
      {kind === 'branch' && (
        <MenuItem
          role="menuitem"
          disabled={!branchAvailable}
          title={branchReason ?? undefined}
          onClick={copy}
        >
          <span>
            <span className="block">{tr('chat.gitRow.copyBranch')}</span>
            {branchReason && <span className="block text-caption text-ink3">{branchReason}</span>}
          </span>
        </MenuItem>
      )}
      <MenuItem
        role="menuitem"
        disabled={!!openReason}
        title={openReason ?? undefined}
        onClick={() => {
          if (openReason || !destination) return
          window.open(destination, '_blank', 'noopener,noreferrer')
          onClose()
        }}
      >
        <span>
          <span className="block">
            {tr(kind === 'repo' ? 'chat.gitRow.openRepo' : 'chat.gitRow.openBranch')}
          </span>
          {openReason && <span className="block text-caption text-ink3">{openReason}</span>}
        </span>
      </MenuItem>
      {copyFailed && (
        <p role="alert" className="px-2.5 py-1.5 text-caption text-bad">
          {tr('chat.gitRow.copyFailed')}
        </p>
      )}
    </>
  )
}
