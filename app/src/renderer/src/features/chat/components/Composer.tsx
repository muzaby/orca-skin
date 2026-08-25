import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { useI18n } from '../../../shared/i18n'
import { UsageCircle } from '../../../shared/ui/UsageCircle'
import { Popover } from '../../../shared/ui/Popover'
import { ReadingColumn } from '../../../shared/ui/ReadingColumn'
import { ComposerInputController } from './composer/ComposerInputController'
import { ComposerChip } from './composer/ComposerChip'
import { ModeMenu } from './composer/ModeMenu'
import { ModelMenu } from './composer/ModelMenu'
import { EffortMenu } from './composer/EffortMenu'
import { EFFORT_LABEL_KEYS } from './composer/effort'
import {
  defaultSelection,
  modelKey,
  selectionExists,
  selectionLabel
} from './composer/modelSelection'
import { steerBlockedByProviderBoundary } from '../lib/steerGate'
import { ConversationStatusLine } from './composer/ConversationStatusLine'
import { Button } from '../../../shared/ui/Button'
import { CwdButton } from './CwdButton'
import { Notice } from './Notice'
import { StatusPopover } from './composer/StatusPopover'
import { conversationStatusModel as conversationStatusModelFactory } from './composer/statusViewModel'
import { MODE_LABEL_KEYS } from './composer/modes'
import type { ConversationStatus } from './composer/statusCopy'
import { AskUserQuestionCard } from './AskUserQuestionCard'
import { ApprovalCard, ToolApprovalBody } from './ApprovalCard'
import { UsagePanel } from './UsagePanel'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'
import {
  chatActions,
  useChatBusy,
  useChatResidualSteer,
  useChatSession,
  useNewChatPending,
  useProjectConcurrencyCount
} from '../store/chatStore'
import { contextTokens } from '../lib/telemetry'
import { contextWindowOf, nearCompaction } from '../lib/contextWindow'
import { useAgents } from '../../../shared/hooks/useAgents'

interface ComposerProps {
  backendLabel: string
  // 활성 백엔드가 턴 중단(cancellation.sessionAbort)을 지원하는가(§15 사전 게이팅).
  // cross-feature 데이터라 backend feature 를 직접 import 하지 않고 page 가 props 로 주입한다.
  // claude 는 항상 true 라 오늘 실효 0 — 미래 백엔드(중단 미지원)를 위한 seam.
  canAbort: boolean
  // transcript 가 있는 ChatTile 에서만 주입 — auto-scroll pin 이 해제됐을 때 컴포저 상단
  // 중앙에 "맨 아래로" 버튼을 띄운다. 랜딩(NewChat/Project)은 미전달 → 버튼 미표시.
  showScrollToBottom?: boolean
  onScrollToBottom?: () => void
  // 사용량 한도 뷰모델(도넛 팝오버). Main 이 완성한 뷰이고, page 가 마지막 telemetry 시점
  // provider 의 것을 mirror 에서 읽어 주입한다(`pages/useUsageForTelemetryProvider.ts`).
  usageLimits?: UsageLimitsView | null
  // 도넛 `사용량 한도 >` — 현재 세션 provider 서브탭 열기(providerKey 전달, page 가 배선).
  onOpenUsageSettings?: (providerKey?: string) => void
  // 컴포저 초기 입력 시드 — Skills "채팅에서 사용해보기" 가 nav state → page 를 거쳐 주입한다.
  // 마운트/값 변경 시 1회 draft 에 채우고 포커스한다(사용자 입력 중에는 덮어쓰지 않음).
  initialDraft?: string
  restoredDraft?: { id: number; text: string }
  // 리딩-거터/최대폭(ReadingColumn)을 제거해 컴포저를 부모 컬럼 폭에 꽉 채운다.
  // 프로젝트 랜딩처럼 이미 컬럼이 폭을 제한하는 곳에서 hero/세션 목록과 좌우 라인을 맞춘다.
  // 채팅 뷰(ChatTile)는 transcript 와 폭을 공유해야 하므로 미전달(기본 ReadingColumn).
  flush?: boolean
  // 랜딩 페이지가 직접 주입하는 cwd 패널. sessionId null 같은 내부 상태가 아니라
  // page 컨텍스트로만 노출해 첫 전송 직후 ChatTile 전환 중에는 렌더하지 않는다.
  showLandingCwdPanel?: boolean
}

// 채팅 입력 composer — textarea + chip 행 + send/cancel 버튼 + skills/file 자동완성.
// ChatTile 과 NewChatLandingPage 양쪽에서 동일하게 재사용.
// 고빈도 draft/selection/IME는 항상 mount되는 ComposerInputController에 가두고,
// 이 shell은 chat selector와 저빈도 메뉴/상태만 조율한다.
export function Composer({
  backendLabel,
  canAbort,
  showScrollToBottom,
  onScrollToBottom,
  usageLimits,
  onOpenUsageSettings,
  initialDraft,
  restoredDraft,
  flush,
  showLandingCwdPanel = false
}: ComposerProps): React.JSX.Element {
  const { tr } = useI18n()
  const { send, cancel, answerAsk, skipAsk, setPermissionMode, setModel, setEffort } = chatActions
  // 0143 — listen 대기(백그라운드 서브에이전트 완료 대기)도 busy: 전송=steer 예약(feedbackMode),
  // 중단 버튼 노출, concurrency 자기-차감이 일반 턴과 동일하게 동작한다(정의는 useChatBusy).
  const inflight = useChatBusy()
  // Stop 잔여(0151 r2) — 중단했는데 이미 전달된 예약이 CLI 큐에 살아남았다. 수동 배지로 덮지 않고
  // 완전 정지 수단을 그 자리에서 제시한다(런타임 폐기 = 백그라운드 작업도 종료, 본문에 명시).
  const residualSteer = useChatResidualSteer()
  const sessionId = useChatSession((s) => s.sessionId)
  // 0064 handoff 가드 — 사용자 턴 2회 미만 세션 제외(값이 바뀔 때만 재렌더).
  const userTurnCount = useChatSession((s) =>
    s.messages.reduce((n, m) => (m.role === 'user' ? n + 1 : n), 0)
  )
  const cwd = useChatSession((s) => s.cwd)
  const lastTelemetry = useChatSession((s) => s.lastTelemetry)
  const sessionCostUsd = useChatSession((s) => s.sessionCostUsd)
  const permissionMode = useChatSession((s) => s.permissionMode)
  const backend = useChatSession((s) => s.backend)
  const providerKey = useChatSession((s) => s.providerKey)
  const modelFamily = useChatSession((s) => s.modelFamily)
  const turnProviderKey = useChatSession((s) => s.turnProviderKey)
  const effort = useChatSession((s) => s.effort)
  const pendingPlanReview = useChatSession((s) => s.pendingPlanReview)
  const projectId = useChatSession((s) => s.projectId ?? s.pendingProjectId)
  const pendingToolApprovals = useChatSession((s) => s.pendingToolApprovals)
  // 큐의 맨 앞 질문만 렌더(canUseTool 이 query 를 막아 보통 1개). 응답 시 다음 질문이 노출.
  const activeAsk = useChatSession((s) => s.pendingAsks[0])
  const modeButtonRef = useRef<HTMLButtonElement>(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const effortButtonRef = useRef<HTMLButtonElement>(null)
  const [effortMenuOpen, setEffortMenuOpen] = useState(false)
  const agents = useAgents()
  const telemetryButtonRef = useRef<HTMLButtonElement>(null)
  const [telemetryOpen, setTelemetryOpen] = useState(false)
  const conversationStatusButtonRef = useRef<HTMLButtonElement>(null)
  const [conversationStatusOpen, setConversationStatusOpen] = useState(false)
  const conversationStatusPopoverId = 'conversation-status-popover'
  const projectConcurrencyCount = useProjectConcurrencyCount(projectId)
  const newChatPending = useNewChatPending()
  // 같은 프로젝트에서 다른 작업이 실행 중인가(자기 턴 제외). × 닫기는 에피소드 단위 —
  // 카운트가 해소(0)되거나 프로젝트가 바뀌면 dismiss 를 리셋해 다음 에피소드에 재표시한다.
  // 리셋은 effect 가 아니라 렌더 중 이전값 비교로 조정한다(React 권장 패턴 — setState-in-effect 회피).
  const concurrencyActive = projectConcurrencyCount - (inflight ? 1 : 0) > 0
  const [concurrencyDismissed, setConcurrencyDismissed] = useState(false)
  const [noticeEpisode, setNoticeEpisode] = useState({ projectId, active: concurrencyActive })
  if (noticeEpisode.projectId !== projectId || noticeEpisode.active !== concurrencyActive) {
    setNoticeEpisode({ projectId, active: concurrencyActive })
    if (noticeEpisode.projectId !== projectId || !concurrencyActive) setConcurrencyDismissed(false)
  }
  const showConcurrencyNotice = concurrencyActive && !concurrencyDismissed

  const selectedModel = useMemo(() => {
    if (providerKey)
      return {
        providerKey,
        modelFamily,
        adapter: agents.find((a) => a.key === providerKey)?.adapter ?? backend ?? 'claude',
        provider: agents.find((a) => a.key === providerKey)?.provider
      }
    return defaultSelection(agents, backend)
  }, [agents, backend, providerKey, modelFamily])

  useEffect(() => {
    if (agents.length === 0) return
    if (
      providerKey &&
      !selectionExists(agents, {
        providerKey,
        modelFamily,
        adapter: backend ?? 'claude'
      })
    ) {
      const next = defaultSelection(agents, backend)
      if (next) setModel(next.providerKey, next.modelFamily, next.adapter)
      return
    }
    if (providerKey && modelFamily == null) {
      const agent = agents.find((a) => a.key === providerKey)
      const model = agent?.models.find((m) => m.isDefault) ?? agent?.models[0]
      if (agent && model) setModel(providerKey, modelKey(model), agent.adapter)
      return
    }
    if (providerKey) return
    const next = defaultSelection(agents, backend)
    if (next) setModel(next.providerKey, next.modelFamily, next.adapter)
  }, [agents, backend, modelFamily, providerKey, setModel])

  const conversationStatusModel = useMemo(() => {
    // TODO(후속 핸드오프): 정식 상태 판정 신호로 교체 — 현재는 임시 근사
    let conversationStatus: ConversationStatus = 'safe'
    let usage: { tokens: number; window: number } | undefined
    if (lastTelemetry) {
      const tokens = contextTokens(lastTelemetry)
      const window = contextWindowOf(lastTelemetry)
      const ratio = tokens / window
      usage = { tokens, window }
      if (nearCompaction(tokens, window) || ratio >= 0.85) {
        conversationStatus = 'danger'
      } else if (ratio >= 0.6) {
        conversationStatus = 'warn'
      }
    }
    return conversationStatusModelFactory(conversationStatus, usage, sessionCostUsd)
  }, [lastTelemetry, sessionCostUsd])

  const toggleConversationStatus = (): void => {
    if (!conversationStatusModel) return
    setConversationStatusOpen((v) => !v)
  }

  // warn 단계 권장 액션(0064 r2, 사용자 확정) — 현재 세션에 `/compact` 를 사용자 턴으로
  // 전송한다. SDK 네이티브 압축이 돌고 완료 시 session.compacted → 압축 경계 구분선 표시.
  const onCompact = (): void => {
    if (chatActions.send('/compact')) setConversationStatusOpen(false)
  }

  // 0064 handoff — 가드 3종: 확정 세션(sessionId) · mid-turn 거부(inflight) · 사용자 턴 2회
  // 미만 제외. 클릭 = 즉시 물질화(startHandoff, 재클릭은 activeKey 전환으로 자연 차단).
  const handoffDisabledReason =
    sessionId == null
      ? tr('chat.composer.handoffNoSession')
      : inflight
        ? tr('chat.composer.handoffWaitTurn')
        : userTurnCount < 2
          ? tr('chat.composer.handoffNeedMoreTurns')
          : null
  const onHandoff = (): void => {
    if (handoffDisabledReason != null) return
    if (chatActions.startHandoff()) {
      setConversationStatusOpen(false)
      setTelemetryOpen(false)
    }
  }

  // 0119: busy 중 provider 경계를 넘는 모델이 선택된 동안 steer 차단 — 진행 턴의 채널은
  // 낡은 provider env 라 경계 너머 메시지를 실을 수 없다. 본래 provider 로 되돌리면 해제.
  const steerBlocked = steerBlockedByProviderBoundary({
    inflight,
    turnProviderKey,
    selectedProviderKey: selectedModel?.providerKey
  })

  const toolApprovalPending = pendingToolApprovals.length > 0
  return (
    <div className="app-frame-composer relative pb-[18px] pt-3">
      {showScrollToBottom && (
        <button
          type="button"
          onClick={onScrollToBottom}
          aria-label={tr('chat.composer.scrollToBottom')}
          title={tr('chat.composer.scrollToBottom')}
          data-behavior="action:scroll-to-bottom"
          className="absolute bottom-full left-1/2 mb-2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-border bg-surface-primary-elevated text-ink2 effect-primary-elevated transition-colors hover:bg-fill-uncontained-hover hover:text-ink"
        >
          <Icon name="chevD" size={16} />
        </button>
      )}
      <ColumnWrap flush={flush}>
        <ConversationStatusLine
          ref={conversationStatusButtonRef}
          model={conversationStatusModel}
          open={conversationStatusOpen}
          onToggle={toggleConversationStatus}
          popoverId={conversationStatusPopoverId}
        />
        {conversationStatusModel && (
          <Popover
            open={conversationStatusOpen}
            anchorRef={conversationStatusButtonRef}
            onClose={() => setConversationStatusOpen(false)}
            placement="top"
            align="center"
            className="p-0"
          >
            <StatusPopover
              id={conversationStatusPopoverId}
              model={conversationStatusModel}
              onCompact={onCompact}
              onHandoff={onHandoff}
              handoffDisabledReason={handoffDisabledReason}
            />
          </Popover>
        )}
        {/* 패널 스택 — ask / 도구 승인 / 안내(<메시지>) / 입력 패널 / 컨트롤 패널을 일정 간격으로 쌓는다. */}
        <div className="flex flex-col gap-2">
          {activeAsk && (
            <AskUserQuestionCard
              key={activeAsk.requestId}
              ask={activeAsk}
              onSubmit={(answers, response) => answerAsk(activeAsk.requestId, answers, response)}
              onSkip={() => skipAsk(activeAsk.requestId)}
            />
          )}
          {pendingToolApprovals.map((p) => (
            <ToolApprovalBody
              key={p.approvalId}
              approvalId={p.approvalId}
              toolName={p.toolName}
              input={p.input}
            />
          ))}
          {showLandingCwdPanel && (
            <div
              className="app-frame-composer-directory flex rounded-r7 border border-transparent bg-transparent px-1 py-1"
              data-surface="cwd-panel"
              data-state="landing"
            >
              <CwdButton cwd={cwd} sessionStarted={false} inflight={inflight} />
            </div>
          )}
          {showConcurrencyNotice && (
            <Notice
              title={tr('chat.composer.concurrencyNoticeTitle')}
              onClose={() => setConcurrencyDismissed(true)}
            >
              {tr('chat.composer.concurrencyNoticeBody')}
            </Notice>
          )}
          {residualSteer > 0 && (
            <Notice title={tr('chat.steer.residualTitle', { count: residualSteer })}>
              <div>{tr('chat.steer.residualBody', { count: residualSteer })}</div>
              <Button
                size="small"
                variant="contained"
                className="mt-2"
                onClick={() => chatActions.discardSession()}
              >
                {tr('chat.steer.residualAction')}
              </Button>
            </Notice>
          )}
          {newChatPending && (
            <Notice title={tr('chat.composer.queuedNoticeTitle')} icon="sparkle">
              {tr('chat.composer.queuedNoticeBody')}
            </Notice>
          )}
          {pendingPlanReview && <ApprovalCard key={pendingPlanReview.requestId} />}
          <ComposerInputController
            active={!pendingPlanReview}
            backendLabel={backendLabel}
            canAbort={canAbort}
            inflight={inflight}
            steerBlocked={steerBlocked}
            toolApprovalPending={toolApprovalPending}
            cwd={cwd}
            initialDraft={initialDraft}
            restoredDraft={restoredDraft}
            onSend={send}
            onCancel={cancel}
            controlsStart={
              <ComposerChip
                ref={modeButtonRef}
                label={tr(MODE_LABEL_KEYS[permissionMode])}
                onClick={() => setModeMenuOpen((value) => !value)}
                ariaHasPopup
                ariaExpanded={modeMenuOpen}
                title={tr('chat.composer.permissionModeTitle')}
              />
            }
            controlsEnd={
              <>
                {agents.some((agent) => agent.supported) && (
                  <ComposerChip
                    ref={modelButtonRef}
                    label={selectionLabel(selectedModel) ?? tr('chat.composer.modelFallback')}
                    onClick={() => setModelMenuOpen((v) => !v)}
                    ariaHasPopup
                    ariaExpanded={modelMenuOpen}
                    title={tr('chat.composer.modelSelectTitle')}
                  />
                )}
                <ComposerChip
                  ref={effortButtonRef}
                  label={tr(EFFORT_LABEL_KEYS[effort])}
                  onClick={() => setEffortMenuOpen((v) => !v)}
                  ariaHasPopup
                  ariaExpanded={effortMenuOpen}
                  title={tr('chat.composer.effortTitle')}
                />
                {lastTelemetry &&
                  (() => {
                    // 컨텍스트 사용량 = (입력+캐시)/모델 윈도우(마지막 턴 기준). 세션 동안 lastTelemetry
                    // 가 유지·복원되므로 도넛도 세션 수명 동안 표시된다.
                    const tokens = contextTokens(lastTelemetry)
                    const window = contextWindowOf(lastTelemetry)
                    const pct = Math.round((tokens / window) * 100)
                    const warn = nearCompaction(tokens, window)
                    return (
                      <button
                        ref={telemetryButtonRef}
                        type="button"
                        onClick={() => setTelemetryOpen((v) => !v)}
                        className="flex items-center rounded-sm outline-none hide-focus-ring ring-focus"
                        aria-haspopup="menu"
                        aria-expanded={telemetryOpen}
                        title={`${tr('chat.composer.contextTitle', {
                          used: Math.round(tokens / 1000),
                          window: window / 1000
                        })}${warn ? ` · ${tr('chat.composer.contextLimitNear')}` : ''}`}
                        data-behavior="action:toggle-telemetry"
                      >
                        <UsageCircle
                          ratio={tokens / window}
                          warn={warn}
                          aria-label={tr('chat.composer.contextUsageAria', { pct })}
                        />
                      </button>
                    )
                  })()}
                {lastTelemetry && (
                  <Popover
                    open={telemetryOpen}
                    anchorRef={telemetryButtonRef}
                    onClose={() => setTelemetryOpen(false)}
                    align="end"
                  >
                    {/* 컨텍스트(프로그레스바) + 사용량 한도(주간/월간). 실사용은 여기서
                        계산하지 않고 주입된 usageLimits(공용 파생)를 참조만. 핸드오프 진입점은
                        StatusPopover(danger) 로 단일화(0064 r3). */}
                    <UsagePanel
                      telemetry={lastTelemetry}
                      usageLimits={usageLimits ?? null}
                      onOpenUsageSettings={() => {
                        setTelemetryOpen(false)
                        onOpenUsageSettings?.(providerKey ?? undefined)
                      }}
                    />
                  </Popover>
                )}
              </>
            }
          />
        </div>
      </ColumnWrap>
      <Popover open={modeMenuOpen} anchorRef={modeButtonRef} onClose={() => setModeMenuOpen(false)}>
        <ModeMenu
          mode={permissionMode}
          onPick={(mode) => {
            setPermissionMode(mode)
            setModeMenuOpen(false)
          }}
        />
      </Popover>
      <Popover
        open={effortMenuOpen}
        anchorRef={effortButtonRef}
        onClose={() => setEffortMenuOpen(false)}
        align="end"
      >
        <EffortMenu
          effort={effort}
          onPick={(nextEffort) => {
            setEffort(nextEffort)
            setEffortMenuOpen(false)
          }}
        />
      </Popover>
      <Popover
        open={modelMenuOpen}
        anchorRef={modelButtonRef}
        onClose={() => setModelMenuOpen(false)}
        align="end"
      >
        <ModelMenu
          agents={agents}
          sessionBackend={backend}
          selection={selectedModel}
          onPick={(selection) => {
            setModel(selection.providerKey, selection.modelFamily, selection.adapter)
            setModelMenuOpen(false)
          }}
        />
      </Popover>
    </div>
  )
}

// 컴포저 본문 폭 래퍼 — 기본은 ReadingColumn(중앙 정렬·리딩 거터, transcript 와 폭 공유),
// flush 면 부모 컬럼 폭에 꽉 채워 좌우 라인을 형제 콘텐츠와 정렬한다.
function ColumnWrap({
  flush,
  children
}: {
  flush?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  if (flush) return <div className="w-full min-w-0">{children}</div>
  return <ReadingColumn>{children}</ReadingColumn>
}
