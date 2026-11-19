import { turnCopyText } from '../../../lib/turns'
import { memo, useEffect, useMemo, useRef } from 'react'
import { ReadingColumn } from '../../../../../shared/ui/ReadingColumn'
import { useI18n } from '../../../../../shared/i18n'
import {
  useActiveSessionKey,
  useChatSession,
  useHasLiveReasoning,
  useHasLiveText,
  useLiveTextFor,
  useLiveTextKey,
  useTranscriptChanges
} from '../../../store/chatStore'
import { pruneDisclosures } from '../../../store/disclosureStore'
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
import { createOpenCodeBlockModel, type OpenCodeBlock } from './openCodeBlocks'
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
  const sessionKey = useActiveSessionKey()
  const transcriptChanges = useTranscriptChanges()
  // live 의 유무만 구독한다 — 본문 delta 는 행 리프(`OpenCodeTextSegment`)만 깨운다(0325 D-015).
  const hasLiveText = useHasLiveText()
  const hasLiveReasoning = useHasLiveReasoning()
  const liveTextKey = useLiveTextKey()
  const scroll = useTimelineScroll()
  const fallbackState = useMemo(() => new TimelineViewState(), [])
  const state = scroll?.state ?? fallbackState

  const model = useMemo(() => createOpenCodeBlockModel(), [])
  const snapshot = useMemo(
    () =>
      model.advance(
        { messages, transcriptChanges },
        {
          showAutomaticFeeds,
          liveText: inflight && hasLiveText,
          liveReasoning: inflight && hasLiveReasoning,
          liveTextKey,
          pending: inflight
        }
      ),
    [
      model,
      messages,
      transcriptChanges,
      showAutomaticFeeds,
      inflight,
      hasLiveText,
      hasLiveReasoning,
      liveTextKey
    ]
  )

  // EP-15 ⑥: prune disclosures only on complete reset
  const lastPrunedRevRef = useRef(-1)
  useEffect(() => {
    if (transcriptChanges.revision === lastPrunedRevRef.current) return
    const last = transcriptChanges.log[transcriptChanges.log.length - 1]
    if (last?.kind === 'reset' && last.complete) {
      lastPrunedRevRef.current = transcriptChanges.revision
      const liveKeys = new Set<string>()
      for (let i = 0; i < snapshot.count; i++) liveKeys.add(snapshot.keyAt(i))
      pruneDisclosures(sessionKey, liveKeys, true)
    }
  }, [sessionKey, snapshot, transcriptChanges])

  const empty = snapshot.count === 0 && !loadingSession && !inflight && !pendingSteer.length
  const footer = (
    <>
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
    </>
  )

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
            snapshot={snapshot}
            scrollRef={scrollRef}
            overscan={6}
            estimateSizePx={60}
            initialOffset={state.top}
            sizeCache={state.sizes}
            anchorKey={state.anchor?.key}
            footer={footer}
            itemClassName={(block: OpenCodeBlock) =>
              `group/msg min-w-0 text-[calc(14px*var(--transcript-text-scale,1))] ${gaps[block.gap]}`
            }
            renderBlock={(block: OpenCodeBlock, _index, selected) => (
              <div
                data-timeline-key={block.key}
                data-timeline-row={block.kind === 'segment' ? block.segment.kind : block.kind}
              >
                <OpenCodeTimelineRow row={block} selected={selected} />
              </div>
            )}
          />
        </ReadingColumn>
      </div>
    </TimelineDisclosureContext.Provider>
  )
})

export const OpenCodeTimelineRow = memo(function OpenCodeTimelineRow({
  row,
  selected = false
}: {
  row: OpenCodeBlock
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
