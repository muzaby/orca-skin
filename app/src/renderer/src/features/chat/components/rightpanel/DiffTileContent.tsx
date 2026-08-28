import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { useChatSession } from '../../store/chatStore'
import { DiffTable } from '../DiffTable'
import {
  MOCK_COMMITS,
  MOCK_FILES,
  MOCK_TREE,
  type MockCommit,
  type MockDiffFile,
  type MockTreeRow
} from './diffTileMock'
import { visibleTreeRows } from './diffTileTree'

// diff 타일 본문 — 좌측(파일트리 + 커밋 목록) · 우측(파일별 항목) 3영역(0206 D-010).
//
// **데이터는 전부 예시다**(`diffTileMock`). 배선할 IPC 가 없어 골격만 세우되, 조사한 배치를
// 실물로 확인할 수 있어야 하므로 *데이터가 필요 없는 상호작용* — 디렉토리 접기 · 커밋 선택 ·
// 파일 펼치기 — 은 실제로 동작한다(D-011).
//
// 아래 View 셋은 **props 만 읽는다**. store 연결 컴포넌트를 `renderToStaticMarkup` 으로 돌리면
// zustand 가 SSR 스냅샷을 돌려주어 시드가 반영되지 않기 때문이다(0204 선례).

const ROW_BASE =
  'flex items-center gap-g3 h-base pr-p6 rounded-r4 text-body text-left w-full outline-none hide-focus-ring ring-focus'

interface DiffFileTreeProps {
  rows: readonly MockTreeRow[]
  collapsed: ReadonlySet<string>
  onToggleDir: (key: string) => void
}

// 평탄 버튼 목록 + 계산된 들여쓰기(8 + depth×12). 파일 행은 chevron 자리에 스페이서를 둬
// 같은 깊이의 디렉토리와 이름 시작점이 어긋나지 않게 한다(조사: epitaxy 02 §2).
export function DiffFileTree({
  rows,
  collapsed,
  onToggleDir
}: DiffFileTreeProps): React.JSX.Element {
  const visible = useMemo(() => visibleTreeRows(rows, collapsed), [rows, collapsed])
  return (
    <div data-diff-region="tree" className="h-full overflow-y-auto px-p3 py-p3">
      {visible.map((row) =>
        row.kind === 'dir' ? (
          <button
            key={row.key}
            type="button"
            aria-expanded={!collapsed.has(row.key)}
            onClick={() => onToggleDir(row.key)}
            className={`${ROW_BASE} text-t6 hover:bg-fill-uncontained-hover hover:text-t7`}
            style={{ paddingLeft: 8 + row.depth * 12 }}
          >
            <span aria-hidden="true" className="w-3 shrink-0 text-center text-t5">
              {collapsed.has(row.key) ? '›' : '⌄'}
            </span>
            <span className="truncate">{row.label}</span>
          </button>
        ) : (
          <div
            key={row.key}
            className={`${ROW_BASE} text-t6`}
            style={{ paddingLeft: 8 + row.depth * 12 }}
          >
            <span aria-hidden="true" className="w-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <span className="flex shrink-0 items-center gap-g1 text-caption tabular-nums">
              <span className="text-git-added">+{row.added ?? 0}</span>
              <span className="text-git-removed">−{row.removed ?? 0}</span>
            </span>
          </div>
        )
      )}
    </div>
  )
}

interface DiffCommitListProps {
  commits: readonly MockCommit[]
  // null = `전체 변경` 선택. 그 외에는 sha.
  selected: string | null
  onSelect: (sha: string | null) => void
}

// 선택은 라디오 그룹이 아니라 `aria-pressed` 토글 배열이다(조사: epitaxy 02 §2). 정확히
// 하나만 참이라는 것이 계약이라 `전체 변경` 도 같은 축에 둔다.
export function DiffCommitList({
  commits,
  selected,
  onSelect
}: DiffCommitListProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div data-diff-region="commits" className="flex flex-col gap-[2px] py-p3">
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={`rounded-r4 px-p3 py-1 text-left text-body outline-none hide-focus-ring ring-focus ${
          selected === null ? 'bg-fill-selected text-t9' : 'text-t6 hover:bg-fill-uncontained-hover'
        }`}
      >
        {tr('chat.rightpanel.diffAllChanges')}
      </button>
      {commits.map((commit) => (
        <button
          key={commit.sha}
          type="button"
          aria-pressed={selected === commit.sha}
          onClick={() => onSelect(commit.sha)}
          title={commit.subject}
          className={`flex w-full flex-col items-start gap-[2px] rounded-r3 px-p3 py-1 text-left outline-none hide-focus-ring ring-focus ${
            selected === commit.sha
              ? 'bg-fill-selected text-t9'
              : 'text-t6 hover:bg-fill-uncontained-hover'
          }`}
        >
          <span className="w-full truncate text-body">{commit.subject}</span>
          <span className="flex w-full items-center gap-g3 text-caption text-t5">
            <span className="font-mono">{commit.sha}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{commit.author}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{commit.when}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

interface DiffFileHeadersProps {
  files: readonly MockDiffFile[]
  expanded: ReadonlySet<string>
  onToggle: (path: string) => void
}

// 파일 항목 — **기본 접힘**이고 펼치면 그 파일의 diff 가 그려진다(0206 D-017·D-018).
// 헤더는 sticky 라 긴 diff 를 스크롤해도 "지금 어느 파일인가" 가 남는다.
export function DiffFileHeaders({
  files,
  expanded,
  onToggle
}: DiffFileHeadersProps): React.JSX.Element {
  return (
    <div data-diff-region="files" className="pb-2">
      {files.map((file) => {
        const open = expanded.has(file.path)
        return (
          <div key={file.path} data-diff-file-path={file.path} className="relative">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggle(file.path)}
              className="sticky top-0 z-[4] flex w-full items-center gap-g3 border-b border-t5 bg-panel px-p5 py-1 text-left outline-none hide-focus-ring ring-focus hover:bg-fill-uncontained-hover"
            >
              <span aria-hidden="true" className="w-3 shrink-0 text-center text-t5">
                {open ? '⌄' : '›'}
              </span>
              <span className="flex min-w-0 items-baseline gap-g3">
                <span className="shrink-0 truncate text-body text-t7">{file.name}</span>
                <span className="min-w-0 truncate text-caption text-t5">{file.dir}</span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-g1 text-body tabular-nums">
                <span className="text-git-added">+{file.added}</span>
                <span className="text-git-removed">−{file.removed}</span>
              </span>
            </button>
            {open && (
              <div className="overflow-auto">
                <DiffTable oldValue={file.oldValue} newValue={file.newValue} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function DiffTileContent(): React.JSX.Element {
  const { tr } = useI18n()
  const filesVisible = useChatSession((s) => s.diffFilesVisible)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)

  const toggleIn = useCallback((set: ReadonlySet<string>, key: string): ReadonlySet<string> => {
    const next = new Set(set)
    if (!next.delete(key)) next.add(key)
    return next
  }, [])

  const toggleDir = useCallback(
    (key: string) => setCollapsed((prev) => toggleIn(prev, key)),
    [toggleIn]
  )
  const toggleFile = useCallback(
    (path: string) => setExpanded((prev) => toggleIn(prev, path)),
    [toggleIn]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 border-b border-t5 px-p5 py-1 text-caption text-t6">
        {tr('chat.rightpanel.diffMockNotice')}
      </p>
      <div className="flex min-h-0 flex-1">
        {filesVisible && (
          <div className="flex w-[240px] shrink-0 flex-col border-r border-t5">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DiffFileTree rows={MOCK_TREE} collapsed={collapsed} onToggleDir={toggleDir} />
            </div>
            <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-t5 px-p3">
              <DiffCommitList
                commits={MOCK_COMMITS}
                selected={selectedCommit}
                onSelect={setSelectedCommit}
              />
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <DiffFileHeaders files={MOCK_FILES} expanded={expanded} onToggle={toggleFile} />
        </div>
      </div>
    </div>
  )
}
