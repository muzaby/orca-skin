import { useActiveSessionKey } from '../../store/chatStore'
import { useEffect, useState, useRef, useId, useMemo } from 'react'
import { computeClient, type ComputeHandle } from '../../../../shared/compute/client'
import { revisionOf } from '../../../../shared/compute/documents'
import { MARKDOWN_DOC_SEGMENT_MAX_CHARS } from '../../../../shared/compute/limits'
import type { ComputeResults } from '../../../../shared/compute/protocol'
import { MarkdownHast } from '../../../../shared/ui/markdown/MarkdownHast'
import {
  sliceSourceParts,
  type MarkdownSourcePart
} from '../../../../shared/ui/markdown/sourceParts'
import { MARKDOWN_TYPOGRAPHY } from '../../../../shared/ui/markdown/typography'

import { useMarkdownRows } from './useMarkdownRows'

type Result = ComputeResults['markdown']

// Keep only the newest waiting snapshot. An in-flight prefix remains useful as the tail grows.
interface TailProps {
  tail: string
  className?: string
  parts?: readonly MarkdownSourcePart[]
}
export function WorkerMarkdownTail(props: TailProps): React.JSX.Element {
  const sessionKey = useActiveSessionKey()
  if (props.tail.length <= MARKDOWN_DOC_SEGMENT_MAX_CHARS)
    return <SessionTail key={sessionKey} {...props} />
  return <SegmentedTail key={sessionKey} {...props} />
}
function SegmentedTail(props: TailProps): React.JSX.Element {
  const id = useId()
  const rows = useMarkdownRows(props.tail, id)
  const segments = useMemo(() => [...new Set(rows?.map((row) => row.segment))], [rows])
  if (!rows) return <span data-md-block-pending="" />
  if (!segments.length) return <pre data-md-block-error="">{props.tail}</pre>
  return (
    <div className={props.className}>
      {segments.map((segment) => (
        <SessionTail
          key={segment.start}
          {...props}
          tail={segment.text}
          parts={sliceSourceParts(props.parts, segment.start, segment.start + segment.text.length)}
        />
      ))}
    </div>
  )
}
function SessionTail({ tail, className, parts }: TailProps): React.JSX.Element {
  const id = useId()
  const [parsed, setParsed] = useState<{ text: string; result: Result } | null>(null)
  const submit = useRef<((text: string) => void) | undefined>(undefined)
  useEffect(() => {
    let mounted = true
    let running: ComputeHandle<Result> | undefined
    let latest: string | undefined
    let stopWaiting: (() => void) | undefined
    function pump(): void {
      if (!mounted || running || latest === undefined) return
      const text = latest
      latest = undefined
      const client = computeClient()
      const doc = { id: 'tail:' + id, revision: revisionOf({}) }
      const lease = client.openDocument(doc, { text }, 'markdown')
      function start(): void {
        stopWaiting = undefined
        running = client.request(
          { kind: 'markdown', doc, start: 0, end: text.length },
          { cacheable: false }
        )
        void running.promise
          .then(
            (result) => {
              if (mounted) setParsed({ text, result })
            },
            () => {}
          )
          .finally(() => {
            lease.release()
            running = undefined
            pump()
          })
      }
      if (lease.available) start()
      else {
        const unsubscribe = lease.onAvailable(start)
        stopWaiting = () => {
          unsubscribe()
          lease.release()
        }
      }
    }
    submit.current = (text) => {
      stopWaiting?.()
      stopWaiting = undefined
      latest = text
      pump()
    }
    return () => {
      mounted = false
      submit.current = undefined
      stopWaiting?.()
      running?.cancel()
    }
  }, [id])
  useEffect(() => {
    submit.current?.(tail)
  }, [tail])

  const covered = parsed && tail.startsWith(parsed.text) ? parsed : null
  const [painted, setPainted] = useState<typeof parsed>(null)
  const afterPaint = useMemo(() => () => setPainted(covered), [covered])
  const complete = !!covered && painted === covered
  const length = covered?.text.length ?? 0
  const raw = tail.slice(length)
  const rawParts = sliceSourceParts(parts, length, tail.length)
  return (
    <div
      className={className ?? MARKDOWN_TYPOGRAPHY + ' text-ink'}
      data-markdown-tail={complete ? 'parsed' : 'raw'}
      data-markdown-tail-parsed={complete ? length : undefined}
    >
      {covered && (
        <MarkdownHast
          hast={covered.result.hast}
          source={covered.text}
          parts={parts}
          onComplete={afterPaint}
        />
      )}
      {raw && (
        <span className="whitespace-pre-wrap">
          {rawParts?.length
            ? rawParts.map((part, index) => (
                <span key={part.key} data-part-key={part.key} data-markdown-part-fragment="">
                  {raw.slice(part.start, rawParts[index + 1]?.start)}
                </span>
              ))
            : raw}
        </span>
      )}
    </div>
  )
}
