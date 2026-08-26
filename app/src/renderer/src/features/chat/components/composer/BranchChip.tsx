import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GitBranchList,
  GitDirtyResolution,
  GitDirtyStat,
  GitStatus
} from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import { Button } from '../../../../shared/ui/Button'
import { Modal } from '../../../../shared/ui/Modal'
import { Popover } from '../../../../shared/ui/Popover'
import { useI18n } from '../../../../shared/i18n'
import { ComposerChip } from './ComposerChip'
import { BranchMenu } from './BranchMenu'
import { BranchSwitchDialog } from './BranchSwitchDialog'

interface BranchChipProps {
  cwd: string | null
  disabled?: boolean
}

interface DirtyPrompt {
  target: string
  from: string | null
  stat: GitDirtyStat
}

const EMPTY_LIST: GitBranchList = { current: null, branches: [] }

// 작업 경로의 현재 브랜치 칩. **git 저장소가 아니면 아무것도 그리지 않는다** — 누를 것이 없는
// 버튼을 자리만 잡아 두지 않는다(worktree 는 다루지 않는다).
//
// 전환은 두 단계다: 깨끗한 트리는 바로 checkout, 커밋되지 않은 변경이 있으면 main 이
// `reason:'dirty'` 로 되돌려 주고 그때 처리 방식을 묻는 모달을 띄운다.
export function BranchChip({ cwd, disabled = false }: BranchChipProps): React.JSX.Element | null {
  const { tr } = useI18n()
  // 상태는 **어느 경로의 것인지와 함께** 들고 있는다. 폴더를 빠르게 바꾸면 늦게 도착한 응답이
  // 새 경로의 상태를 덮는데, 경로를 같이 저장하면 아래 한 줄 비교로 그 값을 무시할 수 있다
  // (effect 안에서 동기 setState 를 하지 않아도 되는 이유이기도 하다).
  const [snapshot, setSnapshot] = useState<{ cwd: string | null; status: GitStatus | null }>({
    cwd: null,
    status: null
  })
  const status = snapshot.cwd === cwd ? snapshot.status : null
  const [list, setList] = useState<GitBranchList>(EMPTY_LIST)
  const [listLoading, setListLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dirty, setDirty] = useState<DirtyPrompt | null>(null)
  const [busy, setBusy] = useState(false)
  // 전환 실패 문구. 전역 toast 가 없는 앱이라 실패는 그 자리에서 모달로 보여준다.
  const [error, setError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // 전환 직후 재조회 — 라벨이 옛 브랜치에 머무르지 않게 한다.
  const refresh = useCallback(async (): Promise<void> => {
    if (!cwd) return
    setSnapshot({ cwd, status: await gitApi.status(cwd) })
  }, [cwd])

  useEffect(() => {
    if (!cwd) return
    let live = true
    void gitApi
      .status(cwd)
      .then((next) => {
        if (live) setSnapshot({ cwd, status: next })
      })
      .catch(() => {
        if (live) setSnapshot({ cwd, status: null })
      })
    return () => {
      live = false
    }
  }, [cwd])

  if (!cwd || !status?.isRepo) return null

  const openMenu = (): void => {
    setMenuOpen(true)
    setList(EMPTY_LIST)
    setListLoading(true)
    void gitApi
      .branches(cwd)
      .then(setList)
      .catch(() => setList(EMPTY_LIST))
      .finally(() => setListLoading(false))
  }

  const checkout = async (branch: string, resolution?: GitDirtyResolution): Promise<void> => {
    setBusy(true)
    try {
      const result = await gitApi.checkout({
        cwd,
        branch,
        ...(resolution ? { resolution } : {})
      })
      if (result.ok) {
        setDirty(null)
        await refresh()
        return
      }
      if (result.reason === 'dirty') {
        setDirty({ target: branch, from: result.from, stat: result.stat })
        return
      }
      // 전환 실패는 조용히 삼키지 않는다 — 왜 브랜치가 그대로인지 그 자리에서 보여야 한다.
      setDirty(null)
      setError(result.message)
    } catch {
      setDirty(null)
      setError(tr('chat.composer.branchSwitchFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ComposerChip
        ref={buttonRef}
        icon="fork"
        label={status.branch ?? tr('chat.composer.branchDetached')}
        variant="outlined"
        // `claude/composer-branch-and-add-dir` 같은 이름은 그냥 두면 행을 통째로 밀어낸다.
        className="max-w-[16rem]"
        disabled={disabled || busy}
        onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
        ariaHasPopup
        ariaExpanded={menuOpen}
        title={tr('chat.composer.branchTitle')}
      />
      <Popover open={menuOpen} anchorRef={buttonRef} onClose={() => setMenuOpen(false)}>
        <BranchMenu
          current={list.current ?? status.branch}
          branches={list.branches}
          loading={listLoading}
          onPick={(branch) => {
            setMenuOpen(false)
            if (branch !== (list.current ?? status.branch)) void checkout(branch)
          }}
        />
      </Popover>
      <Modal
        open={error != null}
        onClose={() => setError(null)}
        width={420}
        ariaLabel={tr('chat.composer.branchSwitchFailed')}
        footer={
          <Button variant="contained" size="small" onClick={() => setError(null)}>
            {tr('common.confirm')}
          </Button>
        }
      >
        <p className="text-[13.5px] font-medium text-ink">
          {tr('chat.composer.branchSwitchFailed')}
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] text-ink2">
          {error}
        </p>
      </Modal>
      {dirty && (
        <BranchSwitchDialog
          open
          from={dirty.from}
          target={dirty.target}
          stat={dirty.stat}
          busy={busy}
          onCancel={() => setDirty(null)}
          onConfirm={(resolution) => void checkout(dirty.target, resolution)}
        />
      )}
    </>
  )
}
