import { turnCopyText } from '../../../lib/turns'
import { memo, useMemo } from 'react'
import { defaultRangeExtractor } from '@tanstack/react-virtual'
import { ReadingColumn } from '../../../../../shared/ui/ReadingColumn'
import { useI18n } from '../../../../../shared/i18n'
import {
  useChatSession,
  useHasLiveReasoning,
  useHasLiveText,
  useLiveTextFor
} from '../../../store/chatStore'
import { transcriptPresentation } from '../../../lib/agentPresentation'
import { errorCategoryKey } from '../../../lib/errorLabels'
import { UserTurn } from '../../common/transcript/UserTurn'
import { MessageMeta } from '../../common/transcript/MessageMeta'
import { ArtifactCards } from '../../common/transcript/ArtifactCards'
import { TranscriptViewport } from '../../../components/transcript/TranscriptViewport'
import { PendingAssistantStatus } from '../../../components/transcript/PendingAssistantStatus'
import { PendingSteerTurn } from '../../common/transcript/PendingSteerTurn'
import { TurnErrorBanner } from '../../common/transcript/TurnErrorBanner'
import type { TranscriptTimelineProps } from '../../contracts'
import { OpenCodeAssistantSegment } from './AssistantSegment'
import { OpenCodeText } from './Text'
import {
  projectTimelineHead,
  projectTimelineTail,
  timelineRows,
  type TimelineRow
} from './projection'
import { useTimelineScroll } from './scrollContext'
import { TimelineDisclosureContext, TimelineViewState, useTimelineMarkdownMode } from './viewState'

const policy = transcriptPresentation('code', 'opencode')
const gaps = { 0: '', 8: 'pt-[8px]', 16: 'pt-[16px]', 24: 'pt-[24px]' } as const

export const OpenCodeTimeline = memo(function OpenCodeTimeline({
  messages,
  showAutomaticFeeds,
  inflight,
  loadingSession,
  pendingSteer,
  scrollRef,
  contentRef,
  onScroll,
  textScaleClassName,
  onRestoreSteerDraft,
  error
}: TranscriptTimelineProps): React.JSX.Element {
  const { tr } = useI18n()
  // live 의 유무만 구독한다 — 본문 delta 는 행 리프(`OpenCodeTextSegment`)만 깨운다(0325 D-015).
  const hasLiveText = useHasLiveText()
  const hasLiveReasoning = useHasLiveReasoning()
  const scroll = useTimelineScroll()
  const fallbackState = useMemo(() => new TimelineViewState(), [])
  const state = scroll?.state ?? fallbackState
  const head = useMemo(
    () => projectTimelineHead(messages, { showAutomaticFeeds }),
    [messages, showAutomaticFeeds]
  )
  const tail = useMemo(
    () =>
      projectTimelineTail(head, {
        text: inflight && hasLiveText,
        reasoning: inflight && hasLiveReasoning,
        pending: inflight
      }),
    [head, inflight, hasLiveText, hasLiveReasoning]
  )
  const rows = useMemo(() => timelineRows(head, tail), [head, tail])
  const rowIndex = (key?: string): number => (key === undefined ? -1 : rows.indexOf(key))
  const selectionIndexes = (scroll?.retained ?? [])
    .map((key) => rowIndex(key))
    .filter((index) => index >= 0)
  const viewportOptions: React.ComponentProps<typeof TranscriptViewport>['options'] = {
    count: rows.count,
    getItemKey: rows.keyAt,
    estimateSize: (index) => state.sizes.get(rows.at(index).key) ?? 60,
    initialOffset: state.top,
    overscan: 2,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range)
      const retain = (scroll?.retained ?? [])
        .map((key) => rowIndex(key))
        .filter((index) => index >= 0)
      if (retain.length) {
        for (let index = Math.min(...retain); index <= Math.max(...retain); index++)
          indexes.push(index)
      }
      const anchor = rowIndex(state.anchor?.key)
      if (anchor >= 0) indexes.push(anchor)
      return [...new Set(indexes)].sort((a, b) => a - b)
    },
    measureElement: (element, entry) => {
      const height = entry?.borderBoxSize[0]?.blockSize ?? element.getBoundingClientRect().height
      const key = element.getAttribute('data-timeline-key')
      if (key) state.sizes.set(key, height)
      return height
    }
  }
  const empty = !rows.count && !loadingSession && !inflight && !pendingSteer.length
  return (
    <TimelineDisclosureContext.Provider value={state}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        data-harness="opencode"
        data-behavior="virtualizable"
        data-timeline-scroll=""
        className={`app-frame-transcript flex-1 overflow-auto bg-bg py-5 outline-none [overflow-anchor:none] [--oc-sticky-top:0px] ${textScaleClassName}`}
      >
        <ReadingColumn ref={contentRef} className="flex min-h-full flex-col pb-[64px]">
          {(loadingSession || empty) && (
            <div className="m-auto text-center text-[calc(13px*var(--transcript-text-scale,1))] text-ink3">
              {tr(loadingSession ? 'chat.transcript.loading' : 'chat.transcript.emptyPrompt')}
            </div>
          )}
          <TranscriptViewport
            options={viewportOptions}
            scrollRef={scrollRef}
            manualAdjustment
            renderItem={(item, measure) => {
              const row = rows.at(item.index)
              return (
                <div
                  key={row.key}
                  ref={measure}
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
            }}
          />
          {pendingSteer.length > 0 && (
            <div className="pt-[24px]">
              <PendingSteerTurn items={pendingSteer} onRestoreDraft={onRestoreSteerDraft} />
            </div>
          )}
          {inflight && (
            <div className="pt-[16px]">
              <RetryStatus />
              <PendingAssistantStatus />
            </div>
          )}
          {error && (
            <div className="pt-[16px]">
              <TurnErrorBanner error={error} />
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
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const streaming = useTimelineMarkdownMode(row.kind === 'segment' && row.streaming, selected)
  switch (row.kind) {
    case 'user':
      return <UserTurn turn={row.turn} />
    case 'segment':
      if (row.segment.kind === 'text')
        return (
          <OpenCodeTextSegment
            prefix={row.segment.text}
            live={row.live === true}
            streaming={streaming}
          />
        )
      if (row.segment.kind === 'reasoning') return null
      return <OpenCodeAssistantSegment segment={row.segment} transcriptPolicy={policy} />
    case 'meta':
      return (
        <MessageMeta
          text={row.copyable ? () => turnCopyText(row.turn) : ''}
          createdAt={row.createdAt}
          align="left"
        />
      )
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
// live·확정 text 행의 공통 리프 — 같은 컴포넌트 형이라 live 행이 같은 key 의 확정 행이 될 때 DOM 이 남는다.
// live 행만 store 의 live text 를 구독하고(`useLiveTextFor(true)`), 확정 행은 언제나 `''` 를 받아 delta 에
// 깨어나지 않는다(0325 EP-2 ⑥⑦).
function OpenCodeTextSegment({
  prefix,
  live,
  streaming
}: {
  prefix: string
  live: boolean
  streaming: boolean
}): React.JSX.Element {
  const liveText = useLiveTextFor(live)
  return <OpenCodeText source={live ? prefix + liveText : prefix} streaming={streaming} />
}

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
