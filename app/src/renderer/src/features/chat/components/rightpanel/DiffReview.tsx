import { useCallback, useRef } from 'react'
import type {
  DiffRequirementItem,
  GitDiffPatch,
  GitDiffSummary
} from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'
import type { DiffLine } from '../../lib/diffLines'
import { revealFileSection, type FileSectionOwner } from '../../lib/fileSectionScroll'
import type { DiffRequirementDraft, DiffViewOptions } from '../../reducer/chatReducer'
import { ChangedNavigationSidebar } from './ChangedNavigationSidebar'
import { FileDiffSection } from './FileDiffSection'
import { diffSections, type DiffComparison } from './diffComparison'

export interface DiffReviewProps {
  summary: GitDiffSummary | null
  patch: GitDiffPatch | null
  /** 이 세션에서 **한 번이라도 조회가 나갔는가** (0211 ΔV5 D-102). 거짓이면 미싱크다. */
  hasRequest: boolean
  error?: 'summary' | 'patch' | null
  onRefresh?: () => void
  comparison: DiffComparison
  expandedFiles: ReadonlySet<string>
  sidebarVisible: boolean
  view: DiffViewOptions
  requirements: readonly DiffRequirementItem[]
  draft: DiffRequirementDraft | null
  activeRequirementId?: string | null
  selectionVersion?: number
  onSelectRequirement?: (id: string) => void
  /**
   * 이동의 **소유자** (0211 ΔV5 D-110 · §10 EP-36 ③). 기본값은 아래 내부 ref 다.
   *
   * prop 으로 받는 이유는 관측이다 — SSR 렌더는 ref 를 채우지 않아, 내부에서만 만들면
   * `revealFileSection(null, path)` 가 되고 소유자를 통째로 지운 변이가 전건 green 이 된다
   * (ΔV4 r3 검증 D22). 테스트가 `{ current: fake }` 를 주입해 **첫 인자**를 단언한다.
   */
  scrollOwnerRef?: React.RefObject<FileSectionOwner | null>
  onToggleExpanded: (path: string) => void
  onExpandFile: (path: string) => void
  onOpenFile: (path: string) => void
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
 *
 * 본문 상태는 **여섯**이고 첫째는 `hasRequest` 가 단독으로 정한다(0211 ΔV5 D-102) — `patch`
 * 하나에 "아직 안 물어봄" 과 "묻고 기다림" 을 함께 실으면 그 둘이 같은 픽셀이 된다.
 */
export function DiffReview({
  summary,
  patch,
  hasRequest,
  error,
  onRefresh,
  comparison,
  expandedFiles,
  sidebarVisible,
  view,
  requirements,
  draft,
  activeRequirementId,
  selectionVersion,
  onSelectRequirement,
  scrollOwnerRef,
  onToggleExpanded,
  onExpandFile,
  onOpenFile,
  onPickComparison,
  onDraftChange,
  onAddRequirement,
  onRemoveRequirement
}: DiffReviewProps): React.JSX.Element {
  const { tr } = useI18n()
  const internalOwnerRef = useRef<HTMLDivElement>(null)
  const tailSpacerRef = useRef<HTMLDivElement>(null)
  const sections = diffSections(patch)

  // 트리에서 고른 파일은 **먼저 펼친 뒤** 이동한다 — 접혀 있으면 스크롤만 하고 아무 변화가
  // 없어 클릭이 "아무 일도 안 일어남" 으로 보인다(0211 ΔV4 §10 EP-36 ②). 기본이 접힘이
  // 된 뒤(D-105) 이 순서는 예외가 아니라 **정상 경로**다.
  const pickFile = useCallback(
    (path: string) => {
      onExpandFile(path)
      revealFileSection((scrollOwnerRef ?? internalOwnerRef).current, path)
    },
    [onExpandFile, scrollOwnerRef]
  )

  return (
    <div data-diff-review className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {sidebarVisible && (
        <ChangedNavigationSidebar
          sections={sections}
          summary={summary}
          comparison={comparison}
          onPickFile={pickFile}
          onPickComparison={onPickComparison}
        />
      )}
      <div
        ref={internalOwnerRef}
        data-diff-scroll-owner
        className="min-h-0 min-w-0 flex-1 overflow-y-auto"
      >
        {error ? (
          <div data-diff-error className="px-p5 py-p4 text-footnote text-t6">
            <p>{tr('chat.rightpanel.diffLoadFailed')}</p>
            <button type="button" onClick={onRefresh} className="mt-2 text-selected underline">
              {tr('chat.rightpanel.diffRefresh')}
            </button>
          </div>
        ) : !hasRequest ? (
          <p data-diff-not-synced className="px-p5 py-p4 text-footnote text-t6">
            {tr('chat.rightpanel.diffNotSynced')}
          </p>
        ) : patch === null ? (
          <p data-diff-loading className="px-p5 py-p4 text-footnote text-t6">
            {tr('chat.rightpanel.diffFileLoading')}
          </p>
        ) : !patch.isRepo ? (
          <p className="px-p5 py-p4 text-footnote text-t6">{tr('chat.rightpanel.diffNotRepo')}</p>
        ) : patch.unavailable ? (
          <p className="px-p5 py-p4 text-footnote text-t6">
            {tr('chat.rightpanel.diffPatchUnavailable')}
          </p>
        ) : sections.length === 0 ? (
          <div
            data-diff-empty
            className="flex h-full items-center justify-center px-p5 py-p4 text-center text-footnote text-t6"
          >
            {tr('chat.rightpanel.diffEmpty')}
          </div>
        ) : (
          <>
            {patch.contextLimited && (
              <p className="px-p5 py-p2 text-footnote text-ink3">
                {tr('chat.rightpanel.diffContextLimited')}
              </p>
            )}
            {sections.map((section) => (
              <FileDiffSection
                key={section.path}
                section={section}
                collapsed={!expandedFiles.has(section.path)}
                view={view}
                requirements={requirements}
                draft={draft}
                activeRequirementId={activeRequirementId}
                selectionVersion={selectionVersion}
                onSelectRequirement={onSelectRequirement}
                scrollOwnerRef={internalOwnerRef}
                tailSpacerRef={tailSpacerRef}
                onToggleCollapsed={onToggleExpanded}
                onOpenFile={onOpenFile}
                onDraftChange={onDraftChange}
                onAddRequirement={onAddRequirement}
                onRemoveRequirement={onRemoveRequirement}
              />
            ))}
            {patch.filesTruncated && (
              <p className="px-p5 py-p3 text-footnote text-ink3">
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
