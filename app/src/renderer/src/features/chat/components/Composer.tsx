import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../../../shared/ui/Button'
import { UsageCircle } from '../../../shared/ui/UsageCircle'
import { Popover } from '../../../shared/ui/Popover'
import { ReadingColumn } from '../../../shared/ui/ReadingColumn'
import { HighlightedTextarea, type HighlightedTextareaHandle } from './composer/HighlightedTextarea'
import { SkillAutocomplete } from './composer/SkillAutocomplete'
import { FileAutocomplete } from './composer/FileAutocomplete'
import { ComposerChip } from './composer/ComposerChip'
import { SkillsMenu } from './composer/SkillsMenu'
import { ModeMenu } from './composer/ModeMenu'
import { MODE_LABELS } from './composer/modes'
import { AskUserQuestionCard } from './AskUserQuestionCard'
import { PlanApprovalCard } from './PlanApprovalCard'
import type { UseChat } from '../hooks/useChat'
import { useSkills } from '../../../shared/hooks/useSkills'
import { useSkillAutocomplete } from '../hooks/useSkillAutocomplete'
import { useFileAutocomplete } from '../hooks/useFileAutocomplete'
import type { FileEntry, SkillInfo } from '../../../../../shared/ipc'

interface ComposerProps {
  chat: UseChat
  backendLabel: string
}

// Claude 컨텍스트 윈도우(토큰). usage 도넛 비율 산출용 — 마지막 result 의
// 실측 inputTokens 를 이 값으로 나눈다(가짜 수치 아님).
const CONTEXT_WINDOW = 200_000

// 채팅 입력 composer — textarea + chip 행 + send/cancel 버튼 + skills/file 자동완성.
// ChatTile 과 NewChatLandingPage 양쪽에서 동일하게 재사용.
// 자체 local state (draft / caret / menuOpen) 는 컴포넌트 내부에 가두고, 외부에는
// 오직 `chat` 도메인 액션 (send / cancel) 만 의존한다.
export function Composer({ chat, backendLabel }: ComposerProps): React.JSX.Element {
  const { state, send, cancel, answerAsk, skipAsk, setPermissionMode } = chat
  // 큐의 맨 앞 질문만 렌더(canUseTool 이 query 를 막아 보통 1개). 응답 시 다음 질문이 노출.
  const activeAsk = state.pendingAsks[0]
  const modeButtonRef = useRef<HTMLButtonElement>(null)
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const skills = useSkills()
  const knownSkillNames = useMemo(() => new Set(skills.map((s) => s.name)), [skills])
  const skillButtonRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HighlightedTextareaHandle>(null)
  const textareaWrapRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = (): void => setMenuOpen(false)

  const autocomplete = useSkillAutocomplete(draft, caret, skills)
  const fileAutocomplete = useFileAutocomplete(draft, caret, state.cwd)

  // Skill chip / popover 선택: 항상 draft 끝에 `/name ` 삽입 (기존 동작 유지).
  const insertSkillFromMenu = (name: string): void => {
    const token = `/${name} `
    setDraft((d) => {
      const next = d === '' || d.endsWith(' ') || d.endsWith('\n') ? d + token : d + ' ' + token
      queueMicrotask(() => {
        const el = textareaRef.current?.element
        if (!el) return
        el.focus()
        el.setSelectionRange(next.length, next.length)
        setCaret(next.length)
      })
      return next
    })
    closeMenu()
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

  const submit = (): void => {
    if (draft.trim() === '') return
    send(draft)
    setDraft('')
    setCaret(0)
  }

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
    <div className="app-frame-composer pb-[18px] pt-3">
      <ReadingColumn>
        {activeAsk && (
          <AskUserQuestionCard
            key={activeAsk.requestId}
            ask={activeAsk}
            onSubmit={(answers, response) => answerAsk(activeAsk.requestId, answers, response)}
            onSkip={() => skipAsk(activeAsk.requestId)}
          />
        )}
        {state.pendingPlanReview ? (
          <PlanApprovalCard key={state.pendingPlanReview.requestId} chat={chat} />
        ) : (
          <div
            className="epitaxy-prompt rounded-r7 bg-surface-prompt-blur effect-prompt-blur px-3 py-2.5"
            data-surface="prompt"
          >
            <div
              ref={textareaWrapRef}
              className="app-frame-composer-input"
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
                placeholder="Orca에게 메시지 보내기… (Enter 전송 / Shift+Enter 줄바꿈)"
                ariaLabel="메시지 입력"
              />
            </div>
            <div className="app-frame-composer-controls flex items-center gap-1.5 pt-1">
              {/* repo zone — 첨부 후보들 (파일/현재 프레임/Skill). 명세 §3.3.2 의
              app-frame-composer-repo 슬롯. data-behavior="dismissible" 은 향후 칩
              제거 UX 도입 시점에 각 칩 element 로 내려간다. */}
              <div
                className="app-frame-composer-repo flex items-center gap-1.5"
                data-behavior="dismissible"
              >
                <ComposerChip
                  ref={modeButtonRef}
                  icon="board"
                  label={MODE_LABELS[state.permissionMode]}
                  onClick={() => setModeMenuOpen((v) => !v)}
                  ariaHasPopup
                  ariaExpanded={modeMenuOpen}
                  title="권한 모드"
                />
                <ComposerChip icon="plus" label="첨부" disabled title="준비 중" />
                <ComposerChip icon="cam" label="현재 프레임" disabled title="준비 중" />
                <ComposerChip
                  ref={skillButtonRef}
                  icon="bolt"
                  label="Skill"
                  onClick={() => setMenuOpen((v) => !v)}
                  ariaHasPopup
                  ariaExpanded={menuOpen}
                />
              </div>
              <span className="ml-auto flex items-center gap-g4">
                <span className="text-caption text-t6">{backendLabel}</span>
                {state.pendingInputTokens != null && (
                  <UsageCircle
                    ratio={state.pendingInputTokens / CONTEXT_WINDOW}
                    aria-label={`컨텍스트 사용량: ${Math.round((state.pendingInputTokens / CONTEXT_WINDOW) * 100)}%`}
                    title={`컨텍스트 ~${Math.round(state.pendingInputTokens / 1000)}k 토큰 / ${CONTEXT_WINDOW / 1000}k`}
                  />
                )}
                {state.inflight ? (
                  <Button
                    iconOnly
                    variant="uncontained"
                    leadingIcon="pause"
                    onClick={cancel}
                    title="중단"
                    aria-label="중단"
                    data-behavior="action:cancel-turn"
                  />
                ) : (
                  <Button
                    iconOnly
                    variant="primary"
                    leadingIcon="send"
                    onClick={submit}
                    disabled={draft.trim() === ''}
                    title="전송 (Enter)"
                    aria-label="전송"
                    data-behavior="action:send"
                  />
                )}
              </span>
            </div>
          </div>
        )}
      </ReadingColumn>
      <Popover open={modeMenuOpen} anchorRef={modeButtonRef} onClose={() => setModeMenuOpen(false)}>
        <ModeMenu
          mode={state.permissionMode}
          onPick={(mode) => {
            setPermissionMode(mode)
            setModeMenuOpen(false)
          }}
        />
      </Popover>
      <Popover open={menuOpen} anchorRef={skillButtonRef} onClose={closeMenu}>
        <SkillsMenu skills={skills} onPick={insertSkillFromMenu} />
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
