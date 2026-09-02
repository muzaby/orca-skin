import { useCallback } from 'react'
import type { DiffLine } from '../../lib/diffLines'
import { useGitPatch } from '../../hooks/useGitPatch'
import { chatActions, useChatSession } from '../../store/chatStore'
import { createDiffRequirementItem } from './diffRequirements'
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
  const comparison = useChatSession((state) => state.gitSnapshot.comparison)
  const collapsedFiles = useChatSession((state) => state.gitSnapshot.collapsedFiles)
  const sidebarVisible = useChatSession((state) => state.gitSnapshot.sidebarVisible)
  const view = useChatSession((state) => state.gitSnapshot.view)
  const sessionId = useChatSession((state) => state.sessionId)
  const requirements = useChatSession((state) => state.diffRequirements)
  const draft = useChatSession((state) => state.diffRequirementDraft)

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
      if (!summary || !sessionId) return
      chatActions.addDiffRequirement(
        createDiffRequirementItem({
          id: crypto.randomUUID(),
          sessionId,
          base: summary.base,
          filePath: draft?.filePath ?? '',
          lines,
          lineIndex,
          comment,
          createdAt: Date.now()
        })
      )
      chatActions.setDiffRequirementDraft(null)
    },
    [draft?.filePath, sessionId, summary]
  )

  // 트리 선택은 그 파일이 접혀 있으면 먼저 펼친다 — 접힘 집합에서 빼는 것이 곧 펼침이다.
  const expandFile = useCallback(
    (path: string) => {
      if (collapsedFiles.includes(path)) chatActions.toggleDiffFileCollapsed(path)
    },
    [collapsedFiles]
  )

  return (
    <DiffReview
      summary={summary}
      patch={patch}
      comparison={comparison}
      collapsedFiles={new Set(collapsedFiles)}
      sidebarVisible={sidebarVisible}
      view={view}
      requirements={requirements}
      draft={draft}
      onToggleCollapsed={chatActions.toggleDiffFileCollapsed}
      onExpandFile={expandFile}
      onPickComparison={chatActions.setDiffComparison}
      onDraftChange={chatActions.setDiffRequirementDraft}
      onAddRequirement={onAddRequirement}
      onRemoveRequirement={chatActions.removeDiffRequirement}
    />
  )
}
