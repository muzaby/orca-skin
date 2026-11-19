import type { Message } from '../../../reducer/chatReducer'
import { hasSegmentReasoning, hasSegmentText } from '../../../lib/parts'
import type { TranscriptProjectionOptions } from '../../../lib/turns'
import { newTranscriptChanges, recordChange } from '../../../lib/transcript/changeLog'
import { createOpenCodeBlockModel, type OpenCodeBlock } from './openCodeBlocks'

export type TimelineRow = OpenCodeBlock

export interface TimelineLivePresence {
  text: boolean
  reasoning: boolean
  pending: boolean
}

export function materializeTimelineRows(
  rows: readonly TimelineRow[],
  liveText: string
): TimelineRow[] {
  return rows.map((row) => {
    if (row.kind !== 'segment' || !row.live || row.segment.kind !== 'text') return row
    const { live: _live, ...committed } = row
    void _live
    return { ...committed, segment: { kind: 'text', text: row.segment.text + liveText } }
  })
}

export function projectTimeline(
  messages: Message[],
  live: { text: string; reasoning: string; pending: boolean },
  options: TranscriptProjectionOptions = {}
): TimelineRow[] {
  const model = createOpenCodeBlockModel()
  const changes = recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
  const snap = model.advance(
    { messages, transcriptChanges: changes },
    {
      showAutomaticFeeds: options.showAutomaticFeeds,
      liveText: hasSegmentText(live.text),
      liveReasoning: hasSegmentReasoning(live.reasoning),
      pending: live.pending
    }
  )
  const rows: TimelineRow[] = []
  for (let i = 0; i < snap.count; i++) rows.push(snap.blockAt(i))
  return materializeTimelineRows(rows, live.text)
}
