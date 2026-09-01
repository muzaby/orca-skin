import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  GitDiffCommit,
  GitDiffFileContent,
  GitDiffFileEntry
} from '../../../../../../shared/ipc'
import { gitApi } from '../../../../shared/api/ipc'
import { useI18n } from '../../../../shared/i18n'
import { chatActions, useChatSession } from '../../store/chatStore'
import { DiffTable } from '../DiffTable'
import {
  buildDiffTreeRows,
  diffSummaryState,
  splitFilePath,
  type DiffTreeRow
} from './diffTileData'
import { createDiffFileRequestOwner, resetDiffFileCache } from './diffFileCache'
import { visibleTreeRows } from './diffTileTree'

// diff 타일 본문 — 좌측(파일트리 + 커밋 목록) · 우측(파일별 항목) 3영역(0206 D-010).
//
// **데이터는 실제 저장소 diff 다**(0211). 0206 이 골격만 세운 이유("배선할 IPC 가 없다")가
// `orca:git:diffSummary`·`orca:git:diffFile` 로 끝났다. 비교 범위는 main 이 정한다 —
// managed row 가 있으면 `base_oid` 대비, 없으면 `HEAD` 대비(D-010·D-021).
//
// 아래 View 셋은 **props 만 읽는다**(0206 D-019). store 연결 컴포넌트를 `renderToStaticMarkup`
// 으로 돌리면 zustand 가 SSR 스냅샷을 돌려주어 시드가 반영되지 않기 때문이다(0204 선례).

const ROW_BASE =
  'flex items-center gap-g3 h-base pr-p6 rounded-r4 text-body text-left w-full outline-none hide-focus-ring ring-focus'

/** 동시에 본문을 들고 있을 수 있는 파일 수(0211 D-016). 넘으면 가장 오래 펼친 것을 접는다. */
export const MAX_EXPANDED_FILES = 20

interface DiffFileTreeProps {
  rows: readonly DiffTreeRow[]
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
  commits: readonly GitDiffCommit[]
  // null = `전체 변경` 선택. 그 외에는 sha.
  selected: string | null
  onSelect: (sha: string | null) => void
  formatWhen: (committedAt: number) => string
}

// 선택은 라디오 그룹이 아니라 `aria-pressed` 토글 배열이다(조사: epitaxy 02 §2). 정확히
// 하나만 참이라는 것이 계약이라 `전체 변경` 도 같은 축에 둔다.
//
// 목록이 비면 `전체 변경` 하나만 남는다 — 비격리 세션은 base 를 몰라 커밋을 셀 수 없다(D-013).
export function DiffCommitList({
  commits,
  selected,
  onSelect,
  formatWhen
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
            <span className="font-mono">{commit.sha.slice(0, 7)}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{commit.author}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{formatWhen(commit.committedAt)}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

interface DiffFileHeadersProps {
  files: readonly GitDiffFileEntry[]
  expanded: ReadonlySet<string>
  contents: ReadonlyMap<string, GitDiffFileContent>
  onToggle: (path: string) => void
}

// 파일 항목 — **기본 접힘**이고 펼치면 그 파일의 diff 가 그려진다(0206 D-017·D-018).
// 헤더는 sticky 라 긴 diff 를 스크롤해도 "지금 어느 파일인가" 가 남는다.
//
// 본문은 펼칠 때만 조회한다(0211 D-014) — 요약에 실으면 타일을 여는 순간 저장소 전체를 읽는다.
export function DiffFileHeaders({
  files,
  expanded,
  contents,
  onToggle
}: DiffFileHeadersProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div data-diff-region="files" className="pb-2">
      {files.map((file) => {
        const open = expanded.has(file.path)
        const content = contents.get(file.path)
        const { name, dir } = splitFilePath(file.path)
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
                <span className="shrink-0 truncate text-body text-t7">{name}</span>
                <span className="min-w-0 truncate text-caption text-t5">{dir}</span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-g1 text-body tabular-nums">
                <span className="text-git-added">+{file.added}</span>
                <span className="text-git-removed">−{file.removed}</span>
              </span>
            </button>
            {open && (
              <div className="overflow-auto">
                {content === undefined ? (
                  <p className="px-p5 py-1 text-caption text-t5">
                    {tr('chat.rightpanel.diffFileLoading')}
                  </p>
                ) : content.kind === 'text' ? (
                  <DiffTable oldValue={content.oldValue} newValue={content.newValue} />
                ) : (
                  <p className="px-p5 py-1 text-caption text-t5">
                    {tr(
                      content.kind === 'binary'
                        ? 'chat.rightpanel.diffFileBinary'
                        : content.reason === 'too-large'
                          ? 'chat.rightpanel.diffFileTooLarge'
                          : 'chat.rightpanel.diffFileUnavailable'
                    )}
                  </p>
                )}
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
  const cwd = useChatSession((s) => s.cwd)
  const sessionId = useChatSession((s) => s.sessionId)
  const summary = useChatSession((s) => s.gitSnapshot.summary)
  const selectedCommit = useChatSession((s) => s.gitSnapshot.selectedCommit)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [expanded, setExpanded] = useState<readonly string[]>([])
  const [contents, setContents] = useState<ReadonlyMap<string, GitDiffFileContent>>(() => new Map())
  const [fileRequestOwner] = useState(createDiffFileRequestOwner)
  const cacheIdentityReady = useRef(false)
  const state = diffSummaryState(summary)
  const selectedCommitSummary = useMemo(
    () => summary?.commits.find((commit) => commit.sha === selectedCommit) ?? null,
    [selectedCommit, summary]
  )
  const files = useMemo(
    () => selectedCommitSummary?.files ?? summary?.files ?? [],
    [selectedCommitSummary, summary]
  )
  const rows = useMemo(() => buildDiffTreeRows(files), [files])
  const expandedSet = useMemo(() => new Set(expanded), [expanded])

  useEffect(() => {
    if (cacheIdentityReady.current) resetDiffFileCache(setExpanded, setContents)
    else cacheIdentityReady.current = true
    return () => fileRequestOwner.invalidate()
  }, [cwd, fileRequestOwner, sessionId])

  const toggleDir = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])

  // 커밋 선택은 이미 받은 timeline 안에서 파일 목록만 바꾼다. 본문은 항상 session baseline
  // 대비 작업 트리라 선택에 무관하고, 같은 경로의 캐시도 그대로 재사용한다.
  const selectCommit = useCallback(
    (sha: string | null) => {
      chatActions.selectGitSnapshotCommit(sha)
    },
    []
  )

  const toggleFile = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        if (prev.includes(path)) return prev.filter((p) => p !== path)
        // 상한 도달 — 가장 오래 펼친 것을 접는다(D-016). 본문은 남겨 둔다: 다시 펼칠 때
        // 재조회하지 않아도 되고, 요약이 새로 오면 통째로 버려진다.
        const next = [...prev, path]
        return next.length > MAX_EXPANDED_FILES
          ? next.slice(next.length - MAX_EXPANDED_FILES)
          : next
      })
      if (!cwd || contents.has(path)) return
      fileRequestOwner.run(
        () =>
          gitApi.diffFile({
            cwd,
            path,
            ...(sessionId ? { sessionId } : {})
          }),
        (content) => {
          setContents((prev) => new Map(prev).set(path, content))
        },
        () => {
          setContents((prev) => new Map(prev).set(path, { kind: 'unavailable', reason: 'error' }))
        }
      )
    },
    [contents, cwd, fileRequestOwner, sessionId]
  )

  const formatWhen = useCallback(
    (committedAt: number) => new Date(committedAt).toLocaleDateString(),
    []
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {summary?.filesTruncated === true && (
        <p className="shrink-0 border-b border-t5 px-p5 py-1 text-caption text-t6">
          {tr('chat.rightpanel.diffTruncated', { count: files.length })}
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        {filesVisible && (
          <div className="flex w-[240px] shrink-0 flex-col border-r border-t5">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DiffFileTree rows={rows} collapsed={collapsed} onToggleDir={toggleDir} />
            </div>
            <div className="max-h-[40%] shrink-0 overflow-y-auto border-t border-t5 px-p3">
              <DiffCommitList
                commits={summary?.commits ?? []}
                selected={selectedCommit}
                onSelect={selectCommit}
                formatWhen={formatWhen}
              />
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {/* 빈 상태는 **요약이 도착한 뒤에만** 뜬다(§5 loading 규칙) — `loading` 에서 띄우면
              사용자가 첫 프레임에 "변경 없음" 이라는 거짓을 읽는다. */}
          {state.kind === 'empty' && (
            <p className="px-p5 py-2 text-body text-t6">{tr('chat.rightpanel.diffEmpty')}</p>
          )}
          {state.kind === 'not-repo' && (
            <p className="px-p5 py-2 text-body text-t6">{tr('chat.rightpanel.diffNotRepo')}</p>
          )}
          {/* 항목 영역은 **항상 그린다** — 세 영역의 존재가 0206 이 잠근 배치 계약이고,
              요약 대기 중에 통째로 빼면 그 프레임의 우측이 영역조차 없는 빈 칸이 된다.
              파일이 없으면 이 안이 비고, 무엇 때문에 비었는지는 위 문구가 말한다. */}
          <DiffFileHeaders
            files={files}
            expanded={expandedSet}
            contents={contents}
            onToggle={toggleFile}
          />
        </div>
      </div>
    </div>
  )
}
