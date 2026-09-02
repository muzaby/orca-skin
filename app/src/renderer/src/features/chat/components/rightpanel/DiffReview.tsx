import { useCallback, useRef } from 'react'
import type {
  DiffRequirementItem,
  GitDiffPatch,
  GitDiffSummary
} from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import type { DiffLine } from '../../lib/diffLines'
import { revealFileSection } from '../../lib/fileSectionScroll'
import type { DiffRequirementDraft, DiffViewOptions } from '../../reducer/chatReducer'
import { ChangedNavigationSidebar } from './ChangedNavigationSidebar'
import { FileDiffSection } from './FileDiffSection'
import { diffSections, type DiffComparison } from './diffComparison'

export interface DiffReviewProps {
  summary: GitDiffSummary | null
  patch: GitDiffPatch | null
  comparison: DiffComparison
  collapsedFiles: ReadonlySet<string>
  sidebarVisible: boolean
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  onToggleCollapsed: (path: string) => void
  onExpandFile: (path: string) => void
  onPickComparison: (comparison: DiffComparison) => void
  onDraftChange?: (draft: DiffRequirementDraft | null) => void
  onAddRequirement?: (input: {
    lines: readonly DiffLine[]
    lineIndex: number
    comment: string
  }) => void
  onRemoveRequirement?: (id: string) => void
}

/**
 * 변경사항 패널의 **한 화면** (0211 ΔV4 D-073).
 *
 * 좌측 사이드바(조건부) + 우측 연속 diff 본문이고, 그 사이에 화면 전환이 없다. 스크롤 소유자를
 * 여기 한 곳에 두는 이유는 문맥 확장 보정 때문이다 — 파일마다 스크롤 컨테이너를 두면 위쪽 확장이
 * 어느 컨테이너를 보정해야 하는지가 파일마다 갈린다.
 */
export function DiffReview({
  summary,
  patch,
  comparison,
  collapsedFiles,
  sidebarVisible,
  view,
  requirements,
  draft,
  onToggleCollapsed,
  onExpandFile,
  onPickComparison,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: DiffReviewProps): React.JSX.Element {
  const { tr } = useI18n()
  const scrollOwnerRef = useRef<HTMLDivElement>(null)
  const tailSpacerRef = useRef<HTMLDivElement>(null)
  const sections = diffSections(patch, summary, comparison)

  // 트리에서 고른 파일은 **먼저 펼친 뒤** 이동한다 — 접혀 있으면 스크롤만 하고 아무 변화가
  // 없어 클릭이 "아무 일도 안 일어남" 으로 보인다(0211 ΔV4 §10 EP-36 ②).
  const pickFile = useCallback(
    (path: string) => {
      onExpandFile(path)
      revealFileSection(scrollOwnerRef.current, path)
    },
    [onExpandFile]
  )

  return (
    <div data-diff-review className="flex min-h-0 flex-1">
      {sidebarVisible && (
        <ChangedNavigationSidebar
          sections={sections}
          summary={summary}
          comparison={comparison}
          onPickFile={pickFile}
          onPickComparison={onPickComparison}
        />
      )}
      <div ref={scrollOwnerRef} data-diff-scroll-owner className="min-h-0 flex-1 overflow-y-auto">
        {patch === null ? (
          <p className="px-p5 py-p4 text-body text-t6">{tr('chat.rightpanel.diffFileLoading')}</p>
        ) : !patch.isRepo ? (
          <p className="px-p5 py-p4 text-body text-t6">{tr('chat.rightpanel.diffNotRepo')}</p>
        ) : patch.unavailable ? (
          <p className="px-p5 py-p4 text-body text-t6">
            {tr('chat.rightpanel.diffPatchUnavailable')}
          </p>
        ) : sections.length === 0 ? (
          <p className="px-p5 py-p4 text-body text-t6">{tr('chat.rightpanel.diffEmpty')}</p>
        ) : (
          <>
            {patch.contextLimited && (
              <p className="px-p5 py-p2 text-caption text-t5">
                {tr('chat.rightpanel.diffContextLimited')}
              </p>
            )}
            {sections.map((section) => (
              <FileDiffSection
                key={section.path}
                section={section}
                collapsed={collapsedFiles.has(section.path)}
                view={view}
                requirements={requirements}
                draft={draft}
                scrollOwnerRef={scrollOwnerRef}
                tailSpacerRef={tailSpacerRef}
                onToggleCollapsed={onToggleCollapsed}
                onDraftChange={onDraftChange}
                onAddRequirement={onAddRequirement}
                onRemoveRequirement={onRemoveRequirement}
              />
            ))}
            {patch.filesTruncated && (
              <p className="px-p5 py-p3 text-caption text-t5">
                {tr('chat.rightpanel.diffSessionFilesTruncated')}
              </p>
            )}
          </>
        )}
        <div ref={tailSpacerRef} aria-hidden="true" className="pointer-events-none shrink-0" />
      </div>
    </div>
  )
}
