import { useActiveSessionKey } from '../../store/chatStore'
import { useEffect, useState, useRef, useId } from 'react'
import { computeClient, type ComputeHandle } from '../../../../shared/compute/client'
import { revisionOf } from '../../../../shared/compute/documents'
import { MARKDOWN_BLOCK_MAX_CHARS } from '../../../../shared/compute/limits'
import type { ComputeResults } from '../../../../shared/compute/protocol'
import { MarkdownHast } from '../../../../shared/ui/markdown/MarkdownHast'
import {
  sliceSourceParts,
  type MarkdownSourcePart
} from '../../../../shared/ui/markdown/sourceParts'
import { MARKDOWN_TYPOGRAPHY } from '../../../../shared/ui/markdown/typography'

type Result = ComputeResults['markdown']

// Keep only the newest waiting snapshot. An in-flight prefix remains useful as the tail grows.
interface TailProps {
  tail: string
  className?: string
  parts?: readonly MarkdownSourcePart[]
}
export function WorkerMarkdownTail(props: TailProps): React.JSX.Element {
  const sessionKey = useActiveSessionKey()
  return <SessionTail key={sessionKey} {...props} />
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
      latest = text.length <= MARKDOWN_BLOCK_MAX_CHARS ? text : undefined
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

  const matching = parsed && tail.startsWith(parsed.text) ? parsed : null
  const covered =
    tail.length <= MARKDOWN_BLOCK_MAX_CHARS && matching && 'hast' in matching.result
      ? matching
      : null
  const length = covered?.text.length ?? 0
  const raw = tail.slice(length)
  const rawParts = sliceSourceParts(parts, length, tail.length)
  const final =
    tail.length > MARKDOWN_BLOCK_MAX_CHARS ||
    (matching?.text === tail && 'tooLarge' in matching.result)
  return (
    <div
      className={className ?? MARKDOWN_TYPOGRAPHY + ' text-ink'}
      data-markdown-tail={covered ? 'parsed' : final ? 'final' : 'raw'}
      data-markdown-tail-parsed={covered ? length : undefined}
    >
      {covered && 'hast' in covered.result && (
        <MarkdownHast hast={covered.result.hast} source={covered.text} parts={parts} />
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
