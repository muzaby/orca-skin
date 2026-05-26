import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../components/atoms/Icon'
import { Dot } from '../components/atoms/Status'
import { Popover } from '../components/atoms/Popover'
import { HighlightedTextarea, type HighlightedTextareaHandle } from './composer/HighlightedTextarea'
import { SkillAutocomplete } from './composer/SkillAutocomplete'
import { FileAutocomplete } from './composer/FileAutocomplete'
import { ComposerChip } from './composer/ComposerChip'
import { SkillsMenu } from './composer/SkillsMenu'
import { AssistantMessage } from '../screens/chat/AssistantMessage'
import { UserMessage } from '../screens/chat/UserMessage'
import { PendingAssistant } from '../screens/chat/PendingAssistant'
import type { UseChat } from '../state/useChat'
import { useSkills } from '../state/useSkills'
import { useSkillAutocomplete } from '../state/useSkillAutocomplete'
import { useFileAutocomplete } from '../state/useFileAutocomplete'
import type { FileEntry, SkillInfo } from '../../../shared/ipc'

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2'

interface ChatTileProps {
  chat: UseChat
  backendLabel: string
}

export function ChatTile({ chat, backendLabel }: ChatTileProps): React.JSX.Element {
  const { state, send, cancel } = chat
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
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
      // (a) 닫는 `"` 재사용. caret 직후의 `"` 는 그대로 — replacement 가 그 직전
      // 까지 닿는다. 디렉토리는 닫는 quote 직전에 caret 두어 partial 매칭 유지,
      // 파일은 닫는 quote 뒤로 caret 이동 후 picker close.
      const replacement = `@"${body}`
      next = draft.slice(0, start) + replacement + draft.slice(caret)
      nextCaret = entry.isDirectory ? start + replacement.length : start + replacement.length + 1
    } else {
      // (b) 일반 — 공백 시 자동 wrapping, 미닫힘 quote 도 닫는 quote 새로 작성.
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

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.messages, state.pendingDelta])

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
      if (draft.trim() !== '') {
        send(draft)
        setDraft('')
        setCaret(0)
      }
    }
  }

  const isEmpty = state.messages.length === 0 && state.pendingDelta === '' && !state.loadingSession
  // 사이드바 메타 (state.title) 가 즉시 채워지므로 사용자가 세션을 선택한 순간부터
  // 헤더에 정확한 제목 표시. 메타가 없는 부팅 자동 복원 1회만 첫 user 메시지에서 fallback.
  const title =
    state.title?.trim() ||
    state.messages.find((m) => m.role === 'user')?.content.slice(0, 60) ||
    '새 대화'

  const showPendingAssistant = state.inflight

  return (
    <section className="app-frame-pane-host flex min-w-0 flex-1 flex-col bg-bg">
      <div className="app-frame-pane-row flex min-h-0 flex-1">
        <div className="app-frame-tile flex min-w-0 flex-1 flex-col" data-behavior="resizable">
          <div className="app-frame-titlebar flex items-center gap-3 border-b border-border px-6 pb-2.5 pt-3.5">
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap font-serif text-[17px] font-semibold tracking-tight text-ink">
                {title}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink3">
                <span className="inline-flex items-center gap-1">
                  <Dot tone="green" /> {backendLabel}
                </span>
                {state.sessionId && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-[10.5px]">{state.sessionId.slice(0, 8)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="ml-auto flex gap-1">
              <button className={ICON_BTN} title="검색">
                <Icon name="search" size={14} />
              </button>
              <button className={ICON_BTN} title="복사">
                <Icon name="copy" size={14} />
              </button>
              <button className={ICON_BTN} title="설정">
                <Icon name="settings" size={14} />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="app-frame-transcript flex flex-1 flex-col gap-[22px] overflow-auto px-6 py-5"
            data-behavior="virtualizable"
          >
            {state.loadingSession && (
              <div className="m-auto text-center text-[13px] text-ink3">대화 불러오는 중…</div>
            )}
            {isEmpty && (
              <div className="m-auto text-center text-[13px] text-ink3">
                Claude Code 에 첫 메시지를 보내보세요.
              </div>
            )}
            {state.messages.map((m, i) =>
              m.role === 'user' ? (
                <UserMessage key={i} message={m} />
              ) : (
                <AssistantMessage key={i} message={m} />
              )
            )}
            {showPendingAssistant && (
              <PendingAssistant
                turnStartedAt={state.turnStartedAt}
                pendingDelta={state.pendingDelta}
              />
            )}
            {state.error && (
              <div className="rounded-[10px] border border-rust bg-rust-soft px-3 py-2 text-[12.5px] text-ink">
                <div className="font-semibold">에러: {state.error.code}</div>
                <div className="mt-1 text-ink2">{state.error.message}</div>
              </div>
            )}
          </div>

          <div className="app-frame-composer px-6 pb-[18px] pt-3">
            <div className="rounded-[14px] border border-border bg-panel px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
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
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-ink3">{backendLabel}</span>
                  {state.inflight ? (
                    <button
                      onClick={cancel}
                      className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg border-0 bg-ink2 text-white"
                      title="중단"
                      data-behavior="action:cancel-turn"
                    >
                      <Icon name="pause" size={14} color="#fff" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (draft.trim() !== '') {
                          send(draft)
                          setDraft('')
                          setCaret(0)
                        }
                      }}
                      disabled={draft.trim() === ''}
                      className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg border-0 bg-rust text-white disabled:cursor-not-allowed disabled:opacity-40"
                      title="전송 (Enter)"
                      data-behavior="action:send"
                    >
                      <Icon name="send" size={14} color="#fff" />
                    </button>
                  )}
                </span>
              </div>
            </div>
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
        </div>
      </div>
    </section>
  )
}
