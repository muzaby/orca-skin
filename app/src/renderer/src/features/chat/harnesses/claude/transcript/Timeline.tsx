import { surfaces } from '../surfaces'
import { memo, useMemo } from 'react'
import { ReadingColumn } from '../../../../../shared/ui/ReadingColumn'
import { useI18n } from '../../../../../shared/i18n'
import { UserTurn } from '../../common/transcript/UserTurn'
import { MessageMeta } from '../../common/transcript/MessageMeta'
import { ArtifactCards } from '../../common/transcript/ArtifactCards'
import { TurnErrorBanner } from '../../common/transcript/TurnErrorBanner'
import { PendingAssistant } from './PendingAssistant'
import { PendingAssistantStatus } from '../../../components/transcript/PendingAssistantStatus'
import { PendingSteerTurn } from '../../common/transcript/PendingSteerTurn'
import { ClaudeAssistantSegment } from './AssistantSegment'
import { ActivityDisclosure } from './WorkActivity'
import { turnCopyText } from '../../../lib/turns'
import { TranscriptViewport } from '../../../components/transcript/TranscriptViewport'
import { agentPresentation } from '../presentation'
import {
  useActiveSessionKey,
  useHasLiveReasoning,
  useHasLiveText,
  useTranscriptChanges
} from '../../../store/chatStore'
import { usePruneDisclosures } from '../../common/transcript/usePruneDisclosures'
import { createClaudeBlockModel, type ClaudeBlock } from './claudeBlocks'

// 0256 D-009: both harness viewports accept the global scale at this shared boundary.

import type { TranscriptTimelineProps } from '../../contracts'

const gaps = { 0: '', 8: 'pt-[8px]', 16: 'pt-[16px]', 24: 'pt-[24px]' } as const

export const ClaudeTranscriptView = memo(function ClaudeTranscriptView({
  agentKind,
  backend = 'claude',
  messages,
  pendingSteer,
  onRestoreSteerDraft,
  inflight,
  loadingSession,
  error,
  anchored,
  scrollRef,
  contentRef,
  onScroll,
  isPinned,
  textScaleClassName,
  showAutomaticFeeds
}: TranscriptTimelineProps): React.JSX.Element {
  const { tr } = useI18n()
  const sessionKey = useActiveSessionKey()
  const transcriptChanges = useTranscriptChanges()
  const hasLiveText = useHasLiveText()
  const hasLiveReasoning = useHasLiveReasoning()
  const transcriptPolicy = agentPresentation[agentKind].transcript
  const mode = transcriptPolicy.turnProjection === 'work-activity' ? 'work' : 'code'

  const model = useMemo(() => createClaudeBlockModel({ mode, sessionKey }), [mode, sessionKey])

  const snapshot = useMemo(
    () =>
      model.advance(
        { messages, transcriptChanges },
        {
          showAutomaticFeeds,
          inflight,
          hasLive: inflight && (hasLiveText || hasLiveReasoning),
          reserve: anchored,
          forkable: true
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
      anchored
    ]
  )

  usePruneDisclosures(sessionKey, transcriptChanges, snapshot)

  const hasPending = (pendingSteer?.length ?? 0) > 0
  const isEmpty = snapshot.count === 0 && !loadingSession && !inflight && !hasPending

  const footer = (
    <>
      {hasPending && (
        <div className="pt-[24px]">
          <PendingSteerTurn items={pendingSteer!} onRestoreDraft={onRestoreSteerDraft} />
        </div>
      )}
      {inflight && (
        <div className="pt-[16px]">
          {snapshot.count === 0 ? <PendingAssistant /> : <PendingAssistantStatus />}
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
    <div
      ref={scrollRef}
      onScroll={onScroll}
      // 대화 내용 텍스트 크기(0256 D-009) — 전역 설정값을 이 루트만 범위 변수로 받아들인다.
      // 컴포저·우측 패널·포털 팝오버는 선언 밖이라 배율 1이다.
      className={`app-frame-transcript flex-1 overflow-auto py-5 [container-type:size] [overflow-anchor:none] ${textScaleClassName} ${surfaces.transcriptRoot}`}
      data-harness={backend ?? 'claude'}
      data-behavior="virtualizable"
    >
      <ReadingColumn ref={contentRef} className="flex min-h-full flex-col">
        {loadingSession && (
          <div className="m-auto text-center text-[calc(13px*var(--transcript-text-scale,1))] text-ink3">
            {tr('chat.transcript.loading')}
          </div>
        )}
        {isEmpty && (
          <div className="m-auto text-center text-[calc(13px*var(--transcript-text-scale,1))] text-ink3">
            {tr('chat.transcript.emptyPrompt')}
          </div>
        )}
        <TranscriptViewport
          snapshot={snapshot}
          blockModel={model}
          sessionKey={sessionKey}
          scrollRef={scrollRef}
          isPinned={isPinned}
          overscan={6}
          estimateSizePx={140}
          enableReserveGap={anchored}
          footer={footer}
          hasPartMarkers={(block) =>
            block.kind === 'user' ||
            block.kind === 'activity' ||
            (block.kind === 'segment' &&
              (block.segment.kind === 'tools' || (block.sourceParts?.length ?? 0) > 1))
          }
          itemClassName={(block: ClaudeBlock) =>
            `group/msg min-w-0 text-[calc(14px*var(--transcript-text-scale,1))] ${gaps[block.gap]}`
          }
          renderBlock={(block: ClaudeBlock) => {
            switch (block.kind) {
              case 'user':
                return <UserTurn turn={block.turn} />
              case 'segment':
                return (
                  <ClaudeAssistantSegment
                    partKeys={block.partKeys}
                    sourceParts={block.sourceParts}
                    segment={block.segment}
                    transcriptPolicy={transcriptPolicy}
                  />
                )
              case 'activity':
                return (
                  <ActivityDisclosure
                    node={{
                      kind: 'activity',
                      key: block.key,
                      items: block.items.map((item) => ({
                        kind: 'segment' as const,
                        key: item.key,
                        messageId: item.messageId,
                        segment: item.segment,
                        sourceParts: item.sourceParts
                      })),
                      toolCount: block.toolCount,
                      noteCount: block.noteCount
                    }}
                    transcriptPolicy={transcriptPolicy}
                  />
                )
              case 'status':
                if (block.outcome === 'ended' || block.outcome === 'unknown') return null
                return (
                  <span className="text-caption text-ink3" data-response-outcome={block.outcome}>
                    {tr(`chat.agent.${block.outcome}`)}
                  </span>
                )
              case 'artifacts':
                return <ArtifactCards artifacts={block.artifacts} />
              case 'meta':
                return (
                  <MessageMeta
                    text={block.copyable ? () => turnCopyText(block.turn) : ''}
                    createdAt={block.createdAt}
                    align="left"
                    forkable={block.forkable}
                  />
                )
              case 'live':
                return <PendingAssistant showStatus={false} />
            }
          }}
        />
      </ReadingColumn>
    </div>
  )
})
