import { memo, useMemo } from 'react'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { ReadingColumn } from '../../../../../shared/ui/ReadingColumn'
import { useI18n } from '../../../../../shared/i18n'
import { useChatSession, useLiveReasoning, useLiveText } from '../../../store/chatStore'
import { transcriptPresentation } from '../../../lib/agentPresentation'
import { errorCategoryKey } from '../../../lib/errorLabels'
import { UserTurn } from '../../../components/transcript/UserTurn'
import { MessageMeta } from '../../../components/transcript/MessageMeta'
import { ArtifactCards } from '../../../components/ArtifactCards'
import { PendingAssistantStatus } from '../../../components/transcript/PendingAssistant'
import { PendingSteerTurn } from '../../../components/transcript/PendingSteerTurn'
import { TurnErrorBanner } from '../../../components/transcript/Exchange'
import type { TranscriptViewProps } from '../../../components/transcript/TranscriptView'
import { OpenCodeAssistantSegment } from './AssistantSegment'
import { OpenCodeText, OpenCodeReasoning } from './Text'
import { projectTimeline, type TimelineRow } from './projection'
import { useTimelineScroll } from './scrollContext'
import { TimelineDisclosureContext, TimelineViewState, useTimelineMarkdownMode } from './viewState'

const policy = transcriptPresentation('code', 'opencode')
const gaps = { 0: '', 8: 'pt-[8px]', 16: 'pt-[16px]', 24: 'pt-[24px]' } as const

export const OpenCodeTimeline = memo(function OpenCodeTimeline(
  props: TranscriptViewProps
): React.JSX.Element {
  const { tr } = useI18n()
  const liveText = useLiveText()
  const liveReasoning = useLiveReasoning()
  const scroll = useTimelineScroll()
  const fallbackState = useMemo(() => new TimelineViewState(), [])
  const state = scroll?.state ?? fallbackState
  const rows = useMemo(
    () =>
      projectTimeline(props.messages, {
        text: props.inflight ? liveText : '',
        reasoning: props.inflight ? liveReasoning : '',
        pending: props.inflight
      }),
    [props.messages, props.inflight, liveText, liveReasoning]
  )
  const selectionIndexes = (scroll?.retained ?? [])
    .map((key) => rows.findIndex((row) => row.key === key))
    .filter((index) => index >= 0)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => props.scrollRef.current,
    getItemKey: (index) => rows[index].key,
    estimateSize: (index) => state.sizes.get(rows[index].key) ?? 60,
    initialOffset: state.top,
    overscan: 2,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range)
      const retain = (scroll?.retained ?? [])
        .map((key) => rows.findIndex((row) => row.key === key))
        .filter((index) => index >= 0)
      if (retain.length) {
        for (let index = Math.min(...retain); index <= Math.max(...retain); index++)
          indexes.push(index)
      }
      const anchor = rows.findIndex((row) => row.key === state.anchor?.key)
      if (anchor >= 0) indexes.push(anchor)
      return [...new Set(indexes)].sort((a, b) => a - b)
    },
    measureElement: (element, entry) => {
      const height = entry?.borderBoxSize[0]?.blockSize ?? element.getBoundingClientRect().height
      const key = element.getAttribute('data-timeline-key')
      if (key) state.sizes.set(key, height)
      return height
    }
  })
  // The controller restores a measured visible row, including dock/viewport
  // resizes. Disable the virtualizer's second, independent scroll correction.
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false
  const empty =
    !rows.length && !props.loadingSession && !props.inflight && !props.pendingSteer.length
  return (
    <TimelineDisclosureContext.Provider value={state}>
      <div
        ref={props.scrollRef}
        onScroll={props.onScroll}
        tabIndex={0}
        data-harness="opencode"
        data-behavior="virtualizable"
        data-timeline-scroll=""
        className="app-frame-transcript flex-1 overflow-auto bg-bg py-5 outline-none [overflow-anchor:none] [--oc-sticky-top:0px] [--transcript-text-scale:var(--chat-text-scale,1)]"
      >
        <ReadingColumn ref={props.contentRef} className="flex min-h-full flex-col pb-[64px]">
          {(props.loadingSession || empty) && (
            <div className="m-auto text-center text-[calc(13px*var(--transcript-text-scale,1))] text-ink3">
              {tr(props.loadingSession ? 'chat.transcript.loading' : 'chat.transcript.emptyPrompt')}
            </div>
          )}
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]
              return (
                <div
                  key={row.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  data-timeline-key={row.key}
                  data-timeline-row={row.kind === 'segment' ? row.segment.kind : row.kind}
                  className={`group/msg absolute left-0 w-full min-w-0 text-[calc(14px*var(--transcript-text-scale,1))] ${gaps[row.gap]}`}
                  style={{ top: item.start }}
                >
                  <OpenCodeTimelineRow
                    row={row}
                    selected={
                      selectionIndexes.length > 0 &&
                      item.index >= Math.min(...selectionIndexes) &&
                      item.index <= Math.max(...selectionIndexes)
                    }
                  />
                </div>
              )
            })}
          </div>
          {props.pendingSteer.length > 0 && (
            <div className="pt-[24px]">
              <PendingSteerTurn
                items={props.pendingSteer}
                onRestoreDraft={props.onRestoreSteerDraft}
              />
            </div>
          )}
          {props.inflight && (
            <div className="pt-[16px]">
              <RetryStatus />
              <PendingAssistantStatus />
            </div>
          )}
          {props.error && (
            <div className="pt-[16px]">
              <TurnErrorBanner error={props.error} />
            </div>
          )}
        </ReadingColumn>
      </div>
    </TimelineDisclosureContext.Provider>
  )
})

export const OpenCodeTimelineRow = memo(function OpenCodeTimelineRow({
  row,
  selected = false
}: {
  row: TimelineRow
  selected?: boolean
}): React.JSX.Element {
  const { tr } = useI18n()
  const streaming = useTimelineMarkdownMode(row.kind === 'segment' && row.streaming, selected)
  switch (row.kind) {
    case 'user':
      return <UserTurn turn={row.turn} openCode />
    case 'segment':
      if (row.segment.kind === 'text')
        return <OpenCodeText source={row.segment.text} streaming={streaming} />
      if (row.segment.kind === 'reasoning')
        return <OpenCodeReasoning items={row.segment.items} streaming={streaming} />
      return <OpenCodeAssistantSegment segment={row.segment} transcriptPolicy={policy} />
    case 'meta':
      return <MessageMeta text={row.text} createdAt={row.createdAt} align="left" />
    case 'artifacts':
      return <ArtifactCards artifacts={row.artifacts} />
    case 'incomplete':
      return (
        <div className="inline-flex w-fit rounded-full border border-border bg-bg2 px-2 py-1 text-[calc(0.75rem*var(--transcript-text-scale,1))] leading-none text-ink3">
          {tr('chat.transcript.incompleteResponse')}
        </div>
      )
  }
})
function RetryStatus(): React.JSX.Element | null {
  const { tr } = useI18n()
  const retry = useChatSession((session) => session.retry)
  if (!retry) return null
  const category = errorCategoryKey(retry.category)
  return (
    <div className="text-caption font-medium text-bad">
      {tr('errors.retrying', { attempt: retry.attempt, max: retry.max })} ·{' '}
      {category ? tr(category) : retry.category}
    </div>
  )
}
