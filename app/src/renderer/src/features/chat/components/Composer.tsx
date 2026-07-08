import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { UsageCircle } from '../../../shared/ui/UsageCircle'
import { Popover } from '../../../shared/ui/Popover'
import { ReadingColumn } from '../../../shared/ui/ReadingColumn'
import { HighlightedTextarea, type HighlightedTextareaHandle } from './composer/HighlightedTextarea'
import { SkillAutocomplete } from './composer/SkillAutocomplete'
import { FileAutocomplete } from './composer/FileAutocomplete'
import { ComposerChip } from './composer/ComposerChip'
import { ModeMenu } from './composer/ModeMenu'
import { ModelMenu } from './composer/ModelMenu'
import { EffortMenu } from './composer/EffortMenu'
import { EFFORT_LABELS } from './composer/effort'
import { AttachMenu } from './composer/AttachMenu'
import { defaultSelection, modelKey, selectionLabel } from './composer/modelSelection'
import { ConversationStatusLine } from './composer/ConversationStatusLine'
import { AttachmentTray } from './composer/AttachmentTray'
import { CwdButton } from './CwdButton'
import { Notice } from './Notice'
import { StatusPopover } from './composer/StatusPopover'
import { conversationStatusModel as conversationStatusModelFactory } from './composer/statusViewModel'
import { MODE_LABELS } from './composer/modes'
import type { ConversationStatus } from './composer/statusCopy'
import { AskUserQuestionCard } from './AskUserQuestionCard'
import { ApprovalCard, ToolApprovalBody } from './ApprovalCard'
import { UsagePanel } from './UsagePanel'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'
import {
  chatActions,
  useChatSession,
  useNewChatPending,
  useProjectConcurrencyCount
} from '../store/chatStore'
import { contextTokens } from '../lib/telemetry'
import { contextWindowFor, nearCompaction } from '../lib/contextWindow'
import { useSkills } from '../../../shared/hooks/useSkills'
import { useAgents } from '../../../shared/hooks/useAgents'
import { useSkillAutocomplete } from '../hooks/useSkillAutocomplete'
import { useFileAutocomplete } from '../hooks/useFileAutocomplete'
import { useAttachments } from '../hooks/useAttachments'
import type { FileEntry, SkillInfo } from '../../../../../shared/ipc'

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
  // cross-feature 비용 summary 는 page/app 계층에서 문자열로 포맷해 주입한다.
  costToday?: string
  // 사용량 한도 뷰모델(도넛 팝오버). page 가 실사용 SSOT(costStore)+월 한도로 공용 파생해 주입.
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
// 자체 local state (draft / caret) 는 컴포넌트 내부에 가두고, 채팅 상태는
// chatStore selector 로 필요한 슬라이스만 구독한다 — 스트리밍 델타/transcript 커밋
// (messages 교체)에는 깨어나지 않는다 (0008).
export function Composer({
  backendLabel,
  canAbort,
  showScrollToBottom,
  onScrollToBottom,
  costToday,
  usageLimits,
  onOpenUsageSettings,
  initialDraft,
  restoredDraft,
  flush,
  showLandingCwdPanel = false
}: ComposerProps): React.JSX.Element {
  const { send, cancel, answerAsk, skipAsk, setPermissionMode, setModel, setEffort } = chatActions
  const inflight = useChatSession((s) => s.inflight)
  const sessionId = useChatSession((s) => s.sessionId)
  // 0064 handoff 가드 — 사용자 턴 2회 미만 세션 제외(값이 바뀔 때만 재렌더).
  const userTurnCount = useChatSession((s) =>
    s.messages.reduce((n, m) => (m.role === 'user' ? n + 1 : n), 0)
  )
  const cwd = useChatSession((s) => s.cwd)
  const lastTelemetry = useChatSession((s) => s.lastTelemetry)
  const permissionMode = useChatSession((s) => s.permissionMode)
  const backend = useChatSession((s) => s.backend)
  const providerKey = useChatSession((s) => s.providerKey)
  const modelFamily = useChatSession((s) => s.modelFamily)
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
  const attachButtonRef = useRef<HTMLButtonElement>(null)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const {
    attachments,
    attachmentPreviews,
    draggingAttachment,
    setDraggingAttachment,
    pickAttachments,
    removeAttachment,
    addDroppedFiles,
    onPaste,
    buildAttachmentViews,
    reset: resetAttachments
  } = useAttachments()
  const skills = useSkills()
  const agents = useAgents()
  const knownSkillNames = useMemo(() => new Set(skills.map((s) => s.name)), [skills])
  const textareaRef = useRef<HighlightedTextareaHandle>(null)
  const textareaWrapRef = useRef<HTMLDivElement>(null)
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

  // initialDraft 시드 — page 가 nav state 로 같은 값을 다시 넘겨도 1회만 적용(seededRef).
  // 적용 후 캐럿을 끝으로 두고 포커스해 사용자가 바로 이어 입력할 수 있게 한다.
  const seededRef = useRef<string | null>(null)
  useEffect(() => {
    if (initialDraft === undefined || seededRef.current === initialDraft) return
    seededRef.current = initialDraft
    setDraft(initialDraft)
    setCaret(initialDraft.length)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(initialDraft.length, initialDraft.length)
    })
  }, [initialDraft])

  useEffect(() => {
    if (!restoredDraft) return
    queueMicrotask(() => {
      setDraft(restoredDraft.text)
      setCaret(restoredDraft.text.length)
      const el = textareaRef.current?.element
      el?.focus()
      el?.setSelectionRange(restoredDraft.text.length, restoredDraft.text.length)
    })
  }, [restoredDraft])

  const autocomplete = useSkillAutocomplete(draft, caret, skills)
  const fileAutocomplete = useFileAutocomplete(draft, caret, cwd)

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
    if (lastTelemetry) {
      const tokens = contextTokens(lastTelemetry)
      const window = contextWindowFor(lastTelemetry.model)
      const ratio = tokens / window
      if (nearCompaction(tokens, window) || ratio >= 0.85) {
        conversationStatus = 'danger'
      } else if (ratio >= 0.6) {
        conversationStatus = 'warn'
      }
    }
    return conversationStatusModelFactory(conversationStatus, costToday)
  }, [lastTelemetry, costToday])

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
      ? '핸드오프할 세션이 없습니다'
      : inflight
        ? '응답 완료 후 시도하세요'
        : userTurnCount < 2
          ? '대화가 더 진행된 뒤 사용할 수 있습니다'
          : null
  const onHandoff = (): void => {
    if (handoffDisabledReason != null) return
    if (chatActions.startHandoff()) {
      setConversationStatusOpen(false)
      setTelemetryOpen(false)
    }
  }

  // "+" 메뉴의 Skill 진입 — 입력란에 `/` 를 넣어 `/` 자동완성(SkillAutocomplete)을 연다.
  // PARTIAL_RE 가 줄 시작/공백 뒤의 `/` 만 매칭하므로, 끝이 공백/개행이 아니면 ` /` 로 공백을 끼운다.
  const openSkillPicker = (): void => {
    setAttachMenuOpen(false)
    setDraft((d) => {
      const next = d === '' || d.endsWith(' ') || d.endsWith('\n') ? d + '/' : d + ' /'
      queueMicrotask(() => {
        const el = textareaRef.current?.element
        if (!el) return
        el.focus()
        el.setSelectionRange(next.length, next.length)
        setCaret(next.length)
      })
      return next
    })
  }

  // 자동완성 선택: caret 직전 `/partial` 을 `/name ` 으로 치환.
  const applyAutocomplete = (skill: SkillInfo): void => {
    const start = autocomplete.tokenStart
    if (start < 0) return
    const replacement = `/${skill.name} `
    const next = draft.slice(0, start) + replacement + draft.slice(caret)
    const nextCaret = start + replacement.length
    setDraft(next)
    autocomplete.close()
    queueMicrotask(() => {
      const el = textareaRef.current?.element
      if (!el) return
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
      setCaret(nextCaret)
    })
  }

  // 파일 picker 선택: caret 직전 토큰을 새 토큰으로 치환.
  // - 디렉토리: picker 유지 (다음 단계 진입).
  // - 파일: picker 닫고 caret 을 토큰 뒤로.
  // quoting 케이스 분기:
  //   (a) quote 쌍 안 (`hasClosingQuote`): 기존 닫는 `"` 를 재사용. 열린 quote
  //       와 body 만 작성, draft.slice(caret) 의 `"` 가 그대로 닫음.
  //   (b) 미닫힘 quote 안 또는 새 토큰: 공백 포함이면 `@"<body>"` 로 wrap.
  const applyFileAutocomplete = (entry: FileEntry): void => {
    const start = fileAutocomplete.tokenStart
    if (start < 0) return
    const dir = fileAutocomplete.dirPath
    const full = dir === '' ? entry.name : `${dir}/${entry.name}`
    const body = entry.isDirectory ? `${full}/` : full

    let next: string
    let nextCaret: number
    if (fileAutocomplete.quoted && fileAutocomplete.hasClosingQuote) {
      const replacement = `@"${body}`
      next = draft.slice(0, start) + replacement + draft.slice(caret)
      nextCaret = entry.isDirectory ? start + replacement.length : start + replacement.length + 1
    } else {
      const needsQuote = /\s/.test(body)
      const wrapped = needsQuote ? `"${body}"` : body
      const replacement = entry.isDirectory ? `@${wrapped}` : `@${wrapped} `
      next = draft.slice(0, start) + replacement + draft.slice(caret)
      nextCaret = start + replacement.length
    }

    setDraft(next)
    if (!entry.isDirectory) fileAutocomplete.close()
    queueMicrotask(() => {
      const el = textareaRef.current?.element
      if (!el) return
      el.focus()
      el.setSelectionRange(nextCaret, nextCaret)
      setCaret(nextCaret)
    })
  }

  // 단일 send(0067) — busy/idle 판정은 main 소관: 진행 중이면 예약(held, pending 버블),
  // 유휴면 즉시 flush. renderer 는 분기하지 않는다.
  const submit = (): void => {
    if (draft.trim() === '') return
    const text = draft
    const items = attachments
    void buildAttachmentViews(items).then((views) => {
      if (!send(text, items, views)) return
      setDraft('')
      setCaret(0)
      resetAttachments()
    })
  }

  const toolApprovalPending = pendingToolApprovals.length > 0
  const feedbackMode = inflight && draft.trim() !== ''
  const showCancelButton = !feedbackMode && (inflight || toolApprovalPending)

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    // 자동완성 open 시 키 우선 처리 — Enter/Tab/Arrow/Escape 는 picker 가 소비.
    // 스킬과 파일은 trigger 가 배타적이라 동시에 open 될 수 없다.
    if (autocomplete.open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        autocomplete.setActiveIndex(
          (autocomplete.activeIndex + 1) % autocomplete.suggestions.length
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const len = autocomplete.suggestions.length
        autocomplete.setActiveIndex((autocomplete.activeIndex - 1 + len) % len)
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) {
        e.preventDefault()
        const pick = autocomplete.suggestions[autocomplete.activeIndex]
        if (pick) applyAutocomplete(pick)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        autocomplete.close()
        return
      }
    }

    if (fileAutocomplete.open) {
      // suggestions 가 비어 있으면 (로딩 중 또는 결과 없음) Arrow/Enter/Tab 은
      // preventDefault 만 — Enter 가 메시지 전송으로 흘러 picker 가 닫히지 않게.
      const len = fileAutocomplete.suggestions.length
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (len > 0) fileAutocomplete.setActiveIndex((fileAutocomplete.activeIndex + 1) % len)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (len > 0) fileAutocomplete.setActiveIndex((fileAutocomplete.activeIndex - 1 + len) % len)
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) {
        e.preventDefault()
        if (len > 0) {
          const pick = fileAutocomplete.suggestions[fileAutocomplete.activeIndex]
          if (pick) applyFileAutocomplete(pick)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        fileAutocomplete.close()
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      className="app-frame-composer relative pb-[18px] pt-3"
      onPaste={onPaste}
      onDragOver={(event) => {
        event.preventDefault()
        setDraggingAttachment(true)
      }}
      onDragLeave={() => setDraggingAttachment(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDraggingAttachment(false)
        void addDroppedFiles(event.dataTransfer.files)
      }}
    >
      {showScrollToBottom && (
        <button
          type="button"
          onClick={onScrollToBottom}
          aria-label="맨 아래로"
          title="맨 아래로"
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
              title="같은 프로젝트에서 다른 작업이 실행 중입니다."
              onClose={() => setConcurrencyDismissed(true)}
            >
              파일 충돌 가능성이 있습니다. Orca는 작업을 차단하지 않으며, 동시 실행 여부는 사용자가
              판단합니다.
            </Notice>
          )}
          {newChatPending && (
            <Notice title="연결 대기 중입니다." icon="sparkle">
              이전 새 대화의 세션이 준비되는 대로 이 메시지를 순서대로 전송합니다.
            </Notice>
          )}
          {pendingPlanReview ? (
            <ApprovalCard key={pendingPlanReview.requestId} />
          ) : (
            <div
              className={`epitaxy-prompt rounded-r7 border bg-panel px-3 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-colors ${
                draggingAttachment ? 'border-accent ring-2 ring-accent/40' : 'border-border'
              }`}
              data-surface="prompt"
              data-state={draggingAttachment ? 'drag-over' : undefined}
              title={`백엔드: ${backendLabel}`}
            >
              <AttachmentTray
                attachments={attachments}
                previews={attachmentPreviews}
                onRemove={removeAttachment}
              />
              <div className="flex items-end gap-2">
                <div
                  ref={textareaWrapRef}
                  className="app-frame-composer-input min-w-0 flex-1"
                  data-behavior="interactive"
                >
                  <HighlightedTextarea
                    ref={textareaRef}
                    value={draft}
                    onChange={setDraft}
                    onCaretChange={setCaret}
                    onKeyDown={onKeyDown}
                    knownSkillNames={knownSkillNames}
                    validFilePaths={fileAutocomplete.validPaths}
                    placeholder={
                      inflight
                        ? '피드백 보내기… (Enter 전송 / Shift+Enter 줄바꿈)'
                        : '스킬을 보려면 /를 입력하세요.'
                    }
                    ariaLabel="메시지 입력"
                  />
                </div>
                {showCancelButton ? (
                  <Button
                    iconOnly
                    variant="uncontained"
                    leadingIcon="stop"
                    onClick={cancel}
                    disabled={!canAbort}
                    title={canAbort ? '중단' : '이 백엔드는 중단을 지원하지 않습니다'}
                    aria-label="중단"
                    data-behavior="action:cancel-turn"
                    className="mb-1 shrink-0 rounded-full"
                  />
                ) : (
                  <Button
                    iconOnly
                    variant="uncontained"
                    leadingIcon="enter"
                    onClick={submit}
                    disabled={draft.trim() === ''}
                    title={feedbackMode ? '피드백 보내기 (Enter)' : '전송 (Enter)'}
                    aria-label={feedbackMode ? '피드백 보내기' : '전송'}
                    data-behavior={feedbackMode ? 'action:send-feedback' : 'action:send'}
                    className="mb-1 shrink-0 rounded-full"
                  />
                )}
              </div>
            </div>
          )}
          {/* 컨트롤 패널 — 입력 패널에서 분리한 칩 행. 이 패널만 bg 투명·borderless. */}
          {!pendingPlanReview && (
            <div className="app-frame-composer-controls flex items-center gap-1.5 px-1">
              {/* repo zone — 첨부 후보들 (파일/Skill). 명세 §3.3.2 의
              app-frame-composer-repo 슬롯. data-behavior="dismissible" 은 향후 칩
              제거 UX 도입 시점에 각 칩 element 로 내려간다. */}
              <div
                className="app-frame-composer-repo flex items-center gap-1.5"
                data-behavior="dismissible"
              >
                <ComposerChip
                  ref={modeButtonRef}
                  label={MODE_LABELS[permissionMode]}
                  onClick={() => setModeMenuOpen((v) => !v)}
                  ariaHasPopup
                  ariaExpanded={modeMenuOpen}
                  title="권한 모드"
                />
                <ComposerChip
                  ref={attachButtonRef}
                  icon="plus"
                  onClick={() => setAttachMenuOpen((v) => !v)}
                  ariaHasPopup
                  ariaExpanded={attachMenuOpen}
                  title="추가 메뉴"
                />
              </div>
              <span className="ml-auto flex items-center gap-g4">
                {agents.some((agent) => agent.supported) && (
                  <ComposerChip
                    ref={modelButtonRef}
                    label={selectionLabel(selectedModel)}
                    onClick={() => setModelMenuOpen((v) => !v)}
                    ariaHasPopup
                    ariaExpanded={modelMenuOpen}
                    title="모델 선택"
                  />
                )}
                <ComposerChip
                  ref={effortButtonRef}
                  label={EFFORT_LABELS[effort]}
                  onClick={() => setEffortMenuOpen((v) => !v)}
                  ariaHasPopup
                  ariaExpanded={effortMenuOpen}
                  title="작업량"
                />
                {lastTelemetry &&
                  (() => {
                    // 컨텍스트 사용량 = (입력+캐시)/모델 윈도우(마지막 턴 기준). 세션 동안 lastTelemetry
                    // 가 유지·복원되므로 도넛도 세션 수명 동안 표시된다.
                    const tokens = contextTokens(lastTelemetry)
                    const window = contextWindowFor(lastTelemetry.model)
                    const pct = Math.round((tokens / window) * 100)
                    const warn = nearCompaction(tokens, window)
                    return (
                      <button
                        ref={telemetryButtonRef}
                        type="button"
                        onClick={() => setTelemetryOpen((v) => !v)}
                        className="flex items-center rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                        aria-haspopup="menu"
                        aria-expanded={telemetryOpen}
                        title={`컨텍스트 ~${Math.round(tokens / 1000)}k / ${window / 1000}k 토큰 · 사용량 보기${
                          warn ? ' · 컨텍스트 한계 임박' : ''
                        }`}
                        data-behavior="action:toggle-telemetry"
                      >
                        <UsageCircle
                          ratio={tokens / window}
                          warn={warn}
                          aria-label={`컨텍스트 사용량: ${pct}%`}
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
              </span>
            </div>
          )}
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
        open={attachMenuOpen}
        anchorRef={attachButtonRef}
        onClose={() => setAttachMenuOpen(false)}
      >
        <AttachMenu
          onPickAttachment={() => {
            setAttachMenuOpen(false)
            void pickAttachments()
          }}
          onPickSkill={openSkillPicker}
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
      <SkillAutocomplete
        open={autocomplete.open}
        anchorRef={textareaWrapRef}
        suggestions={autocomplete.suggestions}
        activeIndex={autocomplete.activeIndex}
        onHover={autocomplete.setActiveIndex}
        onPick={applyAutocomplete}
      />
      <FileAutocomplete
        open={fileAutocomplete.open}
        loading={fileAutocomplete.loading}
        anchorRef={textareaWrapRef}
        dirPath={fileAutocomplete.dirPath}
        suggestions={fileAutocomplete.suggestions}
        activeIndex={fileAutocomplete.activeIndex}
        onHover={fileAutocomplete.setActiveIndex}
        onPick={applyFileAutocomplete}
      />
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
