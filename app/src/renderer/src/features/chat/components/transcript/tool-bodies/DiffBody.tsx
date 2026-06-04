import ReactDiffViewer from 'react-diff-viewer-continued'
import { diffLines as jsDiffLines } from 'diff'
import { stringify } from '../../../format'
import type { ToolCall } from '../../../reducer/chatReducer'

interface DiffPair {
  oldValue: string
  newValue: string
}

// Write/Edit/MultiEdit input → 비교 쌍(들). Write 는 신규 생성('' → content),
// Edit 은 단일 쌍, MultiEdit 은 edit 별로 분리.
function buildPairs(call: ToolCall): DiffPair[] {
  const rec = call.input as Record<string, unknown> | null
  if (!rec || typeof rec !== 'object') return []
  if (call.name === 'Write') {
    const content = typeof rec.content === 'string' ? rec.content : ''
    return [{ oldValue: '', newValue: content }]
  }
  if (call.name === 'Edit') {
    const oldValue = typeof rec.old_string === 'string' ? rec.old_string : ''
    const newValue = typeof rec.new_string === 'string' ? rec.new_string : ''
    return [{ oldValue, newValue }]
  }
  if (call.name === 'MultiEdit' && Array.isArray(rec.edits)) {
    return rec.edits.map((e) => {
      const er = (e ?? {}) as Record<string, unknown>
      return {
        oldValue: typeof er.old_string === 'string' ? er.old_string : '',
        newValue: typeof er.new_string === 'string' ? er.new_string : ''
      }
    })
  }
  return []
}

// 색 변수는 light/dark 동형 — 테마는 `data-theme` 의 CSS 변수가 자동 재정의하므로
// 라이브러리의 light/dark 분기와 무관하게 같은 토큰 var() 를 양쪽에 매핑한다.
const DIFF_VARS = {
  diffViewerBackground: 'transparent',
  diffViewerColor: 'var(--color-t9)',
  addedBackground: 'color-mix(in srgb, var(--color-good) 14%, transparent)',
  addedColor: 'var(--color-t9)',
  removedBackground: 'color-mix(in srgb, var(--color-bad) 14%, transparent)',
  removedColor: 'var(--color-t9)',
  wordAddedBackground: 'color-mix(in srgb, var(--color-good) 32%, transparent)',
  wordRemovedBackground: 'color-mix(in srgb, var(--color-bad) 32%, transparent)',
  addedGutterBackground: 'color-mix(in srgb, var(--color-good) 18%, transparent)',
  removedGutterBackground: 'color-mix(in srgb, var(--color-bad) 18%, transparent)',
  gutterBackground: 'transparent',
  gutterColor: 'var(--color-t6)',
  addedGutterColor: 'var(--color-t6)',
  removedGutterColor: 'var(--color-t6)',
  codeFoldBackground: 'var(--color-bg)',
  codeFoldGutterBackground: 'var(--color-bg)',
  codeFoldContentColor: 'var(--color-t6)',
  emptyLineBackground: 'transparent',
  highlightBackground: 'transparent',
  highlightGutterBackground: 'transparent'
}

const DIFF_STYLES = {
  variables: { light: DIFF_VARS, dark: DIFF_VARS },
  contentText: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-code)' },
  lineNumber: { color: 'var(--color-t6)' },
  gutter: { padding: '0 0.5em', minWidth: '1.6em' }
}

// Write/Edit/MultiEdit 본문 — jsdiff + react-diff-viewer-continued 통합(inline) diff.
export function DiffBody({ call }: { call: ToolCall }): React.JSX.Element {
  const rec = call.input as { file_path?: unknown } | null
  const filePath = typeof rec?.file_path === 'string' ? rec.file_path : null
  const pairs = buildPairs(call)

  return (
    <div className="flex flex-col gap-2">
      {filePath && <div className="text-caption text-t6">{filePath}</div>}
      {pairs.length === 0 ? (
        <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-code text-t9">
          {stringify(call.input)}
        </pre>
      ) : (
        pairs.map((p, i) => (
          <div key={i} className="overflow-auto rounded-r4 border border-t5">
            <ReactDiffViewer
              oldValue={p.oldValue}
              newValue={p.newValue}
              splitView={false}
              showDiffOnly
              hideSummary
              disableWorker
              compareMethod={jsDiffLines}
              useDarkTheme={false}
              styles={DIFF_STYLES}
            />
          </div>
        ))
      )}
    </div>
  )
}
