import { useComputePaint } from '../../../../shared/compute/diagnostics'
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { buildCodeIndex, codeWindow, type CodeIndex } from '../../../../shared/compute/codeView'
import { stripLineNumberGutter } from '../../../../shared/compute/gutter'
import { computeClient } from '../../../../shared/compute/client'
import { BODY_SYNC_MAX_CHARS, TOKENS_RANGE_MAX_LINES } from '../../../../shared/compute/limits'
import {
  requestKey,
  type CodeSource,
  type ComputeResults
} from '../../../../shared/compute/protocol'
import { useComputeDocument } from '../../../../shared/compute/useComputeDocument'
import { CodeBlock } from '../../../../shared/ui/markdown/CodeBlock'
import {
  VIRTUAL_BODY_MAX_HEIGHT_CLASS,
  VIRTUAL_ROW_ESTIMATE_PX
} from '../../../../shared/ui/virtual/limits'
import { useVirtualRows } from '../../../../shared/ui/virtual/useVirtualRows'
import { useWindowTokens } from '../../hooks/useWindowTokens'

type WindowResult = ComputeResults['codeView']
function useCodeWindow(
  source: CodeSource,
  index: CodeIndex | null,
  start: number,
  enabled: boolean
): WindowResult | null | undefined {
  const request = useMemo(
    () => ({ kind: 'codeView' as const, source, start, end: start + TOKENS_RANGE_MAX_LINES }),
    [source, start]
  )
  const key = requestKey(request)
  const [state, setState] = useState<{ key: string; result: WindowResult | null } | null>(null)
  const local = useMemo(
    () => (index ? codeWindow(index, start, request.end) : undefined),
    [index, start, request.end]
  )
  useEffect(() => {
    if (index || !enabled) return
    const task = computeClient().request(request)
    let current = true
    void task.promise.then(
      (result) => {
        if (current) setState({ key, result })
      },
      () => {
        if (current) setState({ key, result: null })
      }
    )
    return () => {
      current = false
      task.cancel()
    }
  }, [index, enabled, request, key])
  useComputePaint(!local && state?.key === key && state.result ? key : null)
  return local ?? (enabled && state?.key === key ? state.result : undefined)
}

interface WindowProps {
  source: CodeSource
  index: CodeIndex | null
  start: number
  first: number
  last: number
  ready: boolean
  visible: boolean
  lang?: string
  numbered?: boolean
  initial?: WindowResult
  onFailure: () => void
}
function CodeRows({
  source,
  index,
  start,
  first,
  last,
  ready,
  visible,
  lang,
  numbered,
  initial,
  onFailure
}: WindowProps): React.JSX.Element {
  const fetched = useCodeWindow(source, initial ? null : index, start, ready && !initial)
  const lines = initial ?? fetched
  useEffect(() => {
    if (lines === null) onFailure()
  }, [lines, onFailure])
  const tokens = useWindowTokens(source, lang, start, visible ? 'visible' : 'background', ready)
  return (
    <>
      {Array.from({ length: last - first + 1 }, (_, offset) => {
        const row = first + offset
        const line = lines?.lines[row - start] ?? ''
        const parts = tokens?.[row - start]
        return (
          <div
            data-index={row}
            data-virtual-index={row}
            key={row}
            aria-busy={lines === undefined || undefined}
            style={{ height: VIRTUAL_ROW_ESTIMATE_PX, lineHeight: VIRTUAL_ROW_ESTIMATE_PX + 'px' }}
          >
            {numbered && (
              <span
                data-transcript-chrome=""
                aria-hidden="true"
                className="mr-4 inline-block min-w-6 select-none text-right text-ink3"
              >
                {row + 1}
              </span>
            )}
            <span data-virtual-text="">
              {parts && parts.map((t) => t.content).join('') === line
                ? parts.map((token, i) => (
                    <span key={i} style={{ color: token.color }}>
                      {token.content}
                    </span>
                  ))
                : line}
            </span>
          </div>
        )
      })}
    </>
  )
}

export interface VirtualCodeProps {
  documentId?: string
  revisionSource?: object
  code: string
  lang?: string
  showLineNumbers?: boolean
  stripGutter?: boolean
  scrollElement?: RefObject<HTMLDivElement | null>
}
export function VirtualCodeView({
  code,
  lang,
  showLineNumbers,
  stripGutter = false,
  documentId,
  revisionSource,
  scrollElement
}: VirtualCodeProps): React.JSX.Element {
  const id = useId()
  const { ref, ready, unavailable } = useComputeDocument(
    documentId ?? id,
    code,
    'compute',
    revisionSource
  )
  const source = useMemo<CodeSource>(
    () => (stripGutter ? { view: { doc: ref, transform: 'stripGutter' } } : { doc: ref }),
    [ref, stripGutter]
  )
  const index = useMemo(
    () =>
      code.length <= BODY_SYNC_MAX_CHARS
        ? buildCodeIndex(stripGutter ? stripLineNumberGutter(code) : code)
        : null,
    [code, stripGutter]
  )
  const initial = useCodeWindow(source, index, 0, ready)
  const [failed, setFailed] = useState<CodeSource | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const own = useRef<HTMLDivElement>(null)
  const list = useVirtualRows(initial?.lineCount ?? 0, root, scrollElement ?? own)
  const rows = list.getVirtualItems()
  const first = rows[0]?.index ?? 0,
    last = rows.at(-1)?.index ?? -1
  const windows: React.JSX.Element[] = []
  if (initial)
    for (
      let start = Math.floor(first / TOKENS_RANGE_MAX_LINES) * TOKENS_RANGE_MAX_LINES;
      start <= last;
      start += TOKENS_RANGE_MAX_LINES
    ) {
      const visible = list.range
      windows.push(
        <CodeRows
          key={start}
          source={source}
          index={index}
          start={start}
          first={Math.max(first, start)}
          last={Math.min(last, start + TOKENS_RANGE_MAX_LINES - 1)}
          ready={ready}
          visible={
            !!visible &&
            start <= visible.endIndex &&
            start + TOKENS_RANGE_MAX_LINES > visible.startIndex
          }
          numbered={showLineNumbers}
          lang={lang}
          initial={start === 0 ? initial : undefined}
          onFailure={() => setFailed(source)}
        />
      )
    }
  if (initial === null || failed === source || (!index && unavailable))
    return (
      <CodeBlock
        code={stripGutter ? stripLineNumberGutter(code) : code}
        lang={lang}
        showLineNumbers={showLineNumbers}
        embedded
        showHeader={false}
      />
    )
  return (
    <div
      ref={own}
      className={
        scrollElement
          ? undefined
          : VIRTUAL_BODY_MAX_HEIGHT_CLASS + ' overflow-auto overscroll-contain'
      }
      tabIndex={scrollElement ? undefined : 0}
    >
      <div
        ref={root}
        aria-busy={!initial || undefined}
        data-virtual-code=""
        className="relative whitespace-pre font-mono text-code"
        style={{
          height: initial ? list.getTotalSize() : VIRTUAL_ROW_ESTIMATE_PX,
          minWidth: initial
            ? `calc(${initial.widthColumns}ch + ${showLineNumbers ? '4rem' : '0px'})`
            : undefined
        }}
      >
        <div style={{ position: 'absolute', top: first * VIRTUAL_ROW_ESTIMATE_PX }}>{windows}</div>
      </div>
    </div>
  )
}
