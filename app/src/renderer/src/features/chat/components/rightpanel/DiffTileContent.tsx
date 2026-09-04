import { useCallback } from 'react'
import type { DiffLine } from '../../lib/diffLines'
import { useGitPatch } from '../../hooks/useGitPatch'
import { fileApi } from '../../../../shared/api/ipc'
import { joinRepoPath } from '../../lib/repoPath'
import { chatActions, useChatSession } from '../../store/chatStore'
import { createDiffRequirementItem, diffRequirementMatchesComparison } from './diffRequirements'
import { DiffReview } from './DiffReview'

/**
 * 타일 컨테이너 (0211 ΔV4). 조회 소유와 store 배선만 갖고 그리기는 `DiffReview` 가 한다.
 *
 * **패치 조회가 이 컴포넌트의 수명에 묶인다**(D-078): 타일이 닫히면 언마운트라 조회가 0이고,
 * 같은 세대로 다시 열면 세션 상태에 패치가 남아 있어 증가가 0이다.
 */
export function DiffTileContent(): React.JSX.Element {
  useGitPatch()
  const summary = useChatSession((state) => state.gitSnapshot.summary)
  const patch = useChatSession((state) => state.gitSnapshot.patch)
  const error = useChatSession((state) => state.gitSnapshot.error)
  const request = useChatSession((state) => state.gitSnapshotRequest)
  const comparison = useChatSession((state) => state.gitSnapshot.comparison)
  const expandedFiles = useChatSession((state) => state.gitSnapshot.expandedFiles)
  const sidebarVisible = useChatSession((state) => state.gitSnapshot.sidebarVisible)
  const view = useChatSession((state) => state.gitSnapshot.view)
  const sessionId = useChatSession((state) => state.sessionId)
  const cwd = useChatSession((state) => state.cwd)
  const requirements = useChatSession((state) => state.diffRequirements)
  const draft = useChatSession((state) => state.diffRequirementDraft)
  const activeRequirementId = useChatSession((state) => state.activeDiffRequirementId)
  const selectionVersion = useChatSession((state) => state.diffRequirementSelectionVersion)

  const onAddRequirement = useCallback(
    ({
      lines,
      lineIndex,
      comment
    }: {
      lines: readonly DiffLine[]
      lineIndex: number
      comment: string
    }) => {
      if (!patch || !sessionId || !draft) return
      chatActions.addDiffRequirement(
        createDiffRequirementItem({
          id: crypto.randomUUID(),
          sessionId,
          base: patch.base,
          ...(comparison.kind === 'commit' ? { commitSha: comparison.sha } : {}),
          filePath: draft.filePath,
          lines,
          lineIndex,
          comment,
          createdAt: Date.now()
        })
      )
      chatActions.setDiffRequirementDraft(null)
    },
    [draft, sessionId, patch, comparison]
  )

  // 트리 선택은 그 파일이 접혀 있으면 펼친다 — 기본이 접힘이라(D-105) 이것이 정상 경로다.
  const expandFile = useCallback(
    (path: string) => {
      if (!expandedFiles.includes(path)) chatActions.toggleDiffFileExpanded(path)
    },
    [expandedFiles]
  )

  // `↗` — 그 파일을 OS 탐색기에서 **선택해** 연다 (0211 ΔV5 D-108).
  // 실패는 값으로 접는다: 삭제된 파일·범위 밖 경로는 main 이 거부하고 화면은 그대로 남는다.
  const openFile = useCallback(
    (path: string) => {
      if (!cwd) return
      void fileApi.openPath({ path: joinRepoPath(cwd, path), mode: 'reveal' }).catch(() => {})
    },
    [cwd]
  )

  return (
    <DiffReview
      summary={summary}
      patch={patch}
      hasRequest={request !== null}
      error={error}
      onRefresh={chatActions.refreshGitSnapshot}
      comparison={comparison}
      expandedFiles={new Set(expandedFiles)}
      sidebarVisible={sidebarVisible}
      view={view}
      requirements={requirements.filter((item) =>
        diffRequirementMatchesComparison(item, comparison)
      )}
      draft={draft}
      activeRequirementId={activeRequirementId}
      selectionVersion={selectionVersion}
      onSelectRequirement={chatActions.selectDiffRequirement}
      onToggleExpanded={chatActions.toggleDiffFileExpanded}
      onExpandFile={expandFile}
      onOpenFile={openFile}
      onPickComparison={chatActions.setDiffComparison}
      onDraftChange={chatActions.setDiffRequirementDraft}
      onAddRequirement={onAddRequirement}
      onRemoveRequirement={chatActions.removeDiffRequirement}
    />
  )
}
