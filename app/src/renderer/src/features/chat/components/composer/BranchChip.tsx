import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitBranchList, GitDirtyResolution } from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import { Button } from '../../../../shared/ui/Button'
import { Modal } from '../../../../shared/ui/Modal'
import { Popover } from '../../../../shared/ui/Popover'
import { useI18n } from '../../../../shared/i18n'
import { ComposerChip } from './ComposerChip'
import { BranchMenu } from './BranchMenu'
import { BranchSwitchDialog } from './BranchSwitchDialog'
import { CheckoutErrorBody } from './CheckoutErrorBody'
import {
  branchChipView,
  checkoutErrorLines,
  checkoutOutcome,
  statusForCwd,
  type BranchSnapshot,
  type DirtyPrompt
} from './branchChipState'

interface BranchChipProps {
  cwd: string | null
  disabled?: boolean
  // 격리가 켜져 있으면 전환을 **유예**한다 (0210 D-101) — 선택은 다음 worktree 의 base ref 가
  // 되고 사용자의 작업 트리는 그대로다. 부재하면 기존 동작(즉시 checkout).
  deferTo?: ((branch: string) => void) | undefined
  // 유예 중 사용자가 고른 값. 라벨이 선택을 따라가지 않으면 눌러도 아무 일 없어 보인다.
  deferred?: string | null | undefined
}

const EMPTY_LIST: GitBranchList = { current: null, branches: [] }

// 작업 경로의 현재 브랜치 칩. **git 저장소가 아니면 아무것도 그리지 않는다** — 누를 것이 없는
// 버튼을 자리만 잡아 두지 않는다(worktree 는 다루지 않는다).
//
// 전환은 두 단계다: 깨끗한 트리는 바로 checkout, 커밋되지 않은 변경이 있으면 main 이
// `reason:'dirty'` 로 되돌려 주고 그때 처리 방식을 묻는 모달을 띄운다.
export function BranchChip({
  cwd,
  disabled = false,
  deferTo,
  deferred
}: BranchChipProps): React.JSX.Element | null {
  const { tr } = useI18n()
  // 상태는 **어느 경로의 것인지와 함께** 들고 있는다. 폴더를 빠르게 바꾸면 늦게 도착한 응답이
  // 새 경로의 상태를 덮는데, 경로를 같이 저장하면 아래 한 줄 비교로 그 값을 무시할 수 있다
  // (effect 안에서 동기 setState 를 하지 않아도 되는 이유이기도 하다).
  const [snapshot, setSnapshot] = useState<BranchSnapshot>({ cwd: null, status: null })
  const status = statusForCwd(cwd, snapshot)
  const [list, setList] = useState<GitBranchList>(EMPTY_LIST)
  const [listLoading, setListLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dirty, setDirty] = useState<DirtyPrompt | null>(null)
  const [busy, setBusy] = useState(false)
  // 전환 실패 문구. 전역 toast 가 없는 앱이라 실패는 그 자리에서 모달로 보여준다.
  // `applied` 가 있으면 해소만 적용된 **부분 실패** 라 변경이 어디로 갔는지도 함께 말한다.
  const [error, setError] = useState<{ message: string; applied?: GitDirtyResolution } | null>(null)
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

  const view = branchChipView(cwd, status)
  // `branchChipView` 가 이미 cwd null 을 걸러 냈지만 그 좁히기는 함수 경계를 넘지 못한다 —
  // 아래 gitApi 호출들이 string 을 요구하므로 여기서 한 번 더 명시한다.
  if (!view.visible || cwd == null) return null

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
    // **유예 중에는 어떤 경로로도 작업 트리를 바꾸지 않는다** (0210 EP-14). 메뉴 선택과 dirty
    // 모달의 확인이 둘 다 이 함수로 들어오므로 한 곳에서 막는다 — 메뉴만 막으면 모달 확인이
    // 남고, 그 경로는 이미 dirty 인 트리를 stash/commit 하는 쪽이라 더 나쁘다.
    if (deferTo) {
      setDirty(null)
      deferTo(branch)
      return
    }
    setBusy(true)
    try {
      const outcome = checkoutOutcome(
        await gitApi.checkout({ cwd, branch, ...(resolution ? { resolution } : {}) }),
        branch
      )
      if (outcome.kind === 'switched') {
        setDirty(null)
        await refresh()
        return
      }
      if (outcome.kind === 'ask') {
        setDirty(outcome.prompt)
        return
      }
      // 전환 실패는 조용히 삼키지 않는다 — 왜 브랜치가 그대로인지 그 자리에서 보여야 한다.
      setDirty(null)
      setError({
        message: outcome.message,
        ...(outcome.applied ? { applied: outcome.applied } : {})
      })
    } catch {
      setDirty(null)
      setError({ message: tr('chat.composer.branchSwitchFailed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ComposerChip
        ref={buttonRef}
        icon="fork"
        label={deferred ?? view.branch ?? tr('chat.composer.branchDetached')}
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
          current={deferred ?? list.current ?? view.branch}
          branches={list.branches}
          loading={listLoading}
          onPick={(branch) => {
            setMenuOpen(false)
            if (branch !== (deferred ?? list.current ?? view.branch)) void checkout(branch)
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
        {/* 구성·순서는 `checkoutErrorLines`, 그리기는 `CheckoutErrorBody` 가 갖는다 —
            둘 다 훅 없는 순수부라 렌더 하네스 없이 잠긴다. */}
        <CheckoutErrorBody lines={checkoutErrorLines(error)} translate={tr} />
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
