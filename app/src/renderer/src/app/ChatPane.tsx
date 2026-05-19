import { forwardRef, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../components/atoms/Icon'
import { Dot } from '../components/atoms/Status'
import { CopyIconButton } from '../components/atoms/CopyIconButton'
import { StatusLine } from '../components/atoms/StatusLine'
import { Popover } from '../components/atoms/Popover'
import {
  HighlightedTextarea,
  type HighlightedTextareaHandle
} from '../components/composer/HighlightedTextarea'
import { SkillAutocomplete } from '../components/composer/SkillAutocomplete'
import { FileAutocomplete } from '../components/composer/FileAutocomplete'
import { Markdown } from '../components/markdown/Markdown'
import type { UseChat } from '../state/useChat'
import type { Message, ToolCall } from '../state/chatReducer'
import { useSkills } from '../state/useSkills'
import { useSkillAutocomplete } from '../state/useSkillAutocomplete'
import { useFileAutocomplete } from '../state/useFileAutocomplete'
import type { FileEntry, SkillInfo } from '../../../shared/ipc'

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2'

interface ChatPaneProps {
  chat: UseChat
  backendLabel: string
}

// 표시용 짧은 형식: 오늘이면 '오전 11:44', 다른 날이면 '5월 13일'
function formatTimeShort(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d)
  }
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(d)
}

// 툴팁용 전체 형식: '2026. 5. 12. 오전 11:03:09'
function formatTimeFull(ms: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(ms))
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function ToolCard({ call }: { call: ToolCall }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const done = call.result != null
  const isError = call.result?.isError === true
  const tone: 'green' | 'amber' | 'slate' = isError ? 'slate' : done ? 'green' : 'amber'
  const label = isError ? '실패' : done ? '완료' : '실행 중…'
  const args = stringify(call.input).replace(/\n/g, ' ')
  const duration =
    call.result?.durationMs != null ? ` · ${(call.result.durationMs / 1000).toFixed(1)}s` : ''
  return (
    <div
      className={`rounded-[10px] border ${
        isError ? 'border-rust bg-rust-soft' : 'border-border bg-panel'
      } overflow-hidden font-mono text-[12.5px] text-ink`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span aria-hidden className="w-3 text-[10px] text-ink3">
          {open ? '▼' : '▶'}
        </span>
        <Dot tone={tone} />
        <span className="font-semibold text-rust">{call.name}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">
          ({args})
        </span>
        <span className="font-sans text-[11px] text-ink3">
          {label}
          {duration}
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-bg/50 px-3 py-2 text-[12px]">
          <div className="mb-1 font-sans text-[10.5px] uppercase tracking-wide text-ink3">
            input
          </div>
          <pre className="m-0 mb-2 overflow-auto whitespace-pre-wrap break-words text-ink">
            {stringify(call.input)}
          </pre>
          {call.result && (
            <>
              <div className="mb-1 font-sans text-[10.5px] uppercase tracking-wide text-ink3">
                output
              </div>
              {typeof call.result.output === 'string' ? (
                <Markdown source={call.result.output} />
              ) : (
                <pre className="m-0 overflow-auto whitespace-pre-wrap break-words text-ink">
                  {stringify(call.result.output)}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface MessageMetaProps {
  text: string
  createdAt: number
  align: 'left' | 'right'
}

function MessageMeta({ text, createdAt, align }: MessageMetaProps): React.JSX.Element {
  return (
    <div
      className={`mt-1 flex items-center gap-1 text-ink3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      {text && <CopyIconButton text={text} />}
      <span className="font-mono text-[10.5px]" title={formatTimeFull(createdAt)}>
        {formatTimeShort(createdAt)}
      </span>
    </div>
  )
}

interface AssistantMessageProps {
  message: Message
}

function AssistantMessage({ message }: AssistantMessageProps): React.JSX.Element {
  return (
    <div className="group flex flex-col">
      <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
        {message.toolCalls?.map((tc) => (
          <ToolCard key={tc.toolUseId} call={tc} />
        ))}
        {message.content && <Markdown source={message.content} />}
      </div>
      <MessageMeta text={message.content} createdAt={message.createdAt} align="left" />
    </div>
  )
}

interface UserMessageProps {
  message: Message
}

function UserMessage({ message }: UserMessageProps): React.JSX.Element {
  return (
    <div className="group flex flex-col items-end">
      <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-bubble-user px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
        {message.content}
      </div>
      <MessageMeta text={message.content} createdAt={message.createdAt} align="right" />
    </div>
  )
}

interface PendingAssistantProps {
  turnStartedAt: number | null
  pendingDelta: string
}

function PendingAssistant({
  turnStartedAt,
  pendingDelta
}: PendingAssistantProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
      {pendingDelta && <Markdown source={pendingDelta} />}
      <StatusLine turnStartedAt={turnStartedAt} outputApproxFromText={pendingDelta} />
    </div>
  )
}

export function ChatPane({ chat, backendLabel }: ChatPaneProps): React.JSX.Element {
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
  // - 디렉토리: `@<dir>/<name>/` 로 치환, picker 유지 (다음 단계 진입).
  // - 파일: `@<dir>/<name> ` 로 치환, picker 닫음.
  // path 에 공백이 있으면 `@"<path>"` 로 자동 quoting. quoted partial 도중 진입
  // 한 경우 tokenStart 가 `@"` 직전을 가리키므로 닫는 quote 까지 새로 작성한다.
  const applyFileAutocomplete = (entry: FileEntry): void => {
    const start = fileAutocomplete.tokenStart
    if (start < 0) return
    const dir = fileAutocomplete.dirPath
    const full = dir === '' ? entry.name : `${dir}/${entry.name}`
    const body = entry.isDirectory ? `${full}/` : full
    const needsQuote = /\s/.test(body)
    const wrapped = needsQuote ? `"${body}"` : body
    const replacement = entry.isDirectory ? `@${wrapped}` : `@${wrapped} `
    // quoted partial 진행 중이라면 caret 이 quote 안에 있고 그 뒤에 닫는 quote 가
    // 없다 — caret 까지만 잘라내면 자연스럽게 새 토큰으로 대체.
    const next = draft.slice(0, start) + replacement + draft.slice(caret)
    const nextCaret = start + replacement.length
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

  const isEmpty = state.messages.length === 0 && state.pendingDelta === ''
  const title = state.messages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? '새 대화'

  const showPendingAssistant = state.inflight

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <div className="flex items-center gap-3 border-b border-border px-6 pb-2.5 pt-3.5">
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

      <div ref={scrollRef} className="flex flex-1 flex-col gap-[22px] overflow-auto px-6 py-5">
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
          <PendingAssistant turnStartedAt={state.turnStartedAt} pendingDelta={state.pendingDelta} />
        )}
        {state.error && (
          <div className="rounded-[10px] border border-rust bg-rust-soft px-3 py-2 text-[12.5px] text-ink">
            <div className="font-semibold">에러: {state.error.code}</div>
            <div className="mt-1 text-ink2">{state.error.message}</div>
          </div>
        )}
      </div>

      <div className="px-6 pb-[18px] pt-3">
        <div className="rounded-[14px] border border-border bg-panel px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
          <div ref={textareaWrapRef}>
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
          <div className="flex items-center gap-1.5 pt-1">
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
            <span className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-ink3">{backendLabel}</span>
              {state.inflight ? (
                <button
                  onClick={cancel}
                  className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg border-0 bg-ink2 text-white"
                  title="중단"
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
    </section>
  )
}

const MENU_ITEM =
  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-ink hover:bg-sidebar disabled:cursor-not-allowed disabled:text-ink3'

// mockup `project/variations/v1-shell.jsx:186-188` 의 chip1 — composer 좌측 하단의
// 행위 chip. 시맨틱 토큰으로 재현.
interface ComposerChipProps {
  icon: IconName
  label: string
  disabled?: boolean
  title?: string
  onClick?: () => void
  ariaHasPopup?: boolean
  ariaExpanded?: boolean
}

const ComposerChip = forwardRef<HTMLButtonElement, ComposerChipProps>(function ComposerChip(
  { icon, label, disabled, title, onClick, ariaHasPopup, ariaExpanded },
  ref
): React.JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-haspopup={ariaHasPopup ? 'menu' : undefined}
      aria-expanded={ariaHasPopup ? ariaExpanded : undefined}
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg px-2 text-[12px] text-ink2 hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name={icon} size={12} />
      <span>{label}</span>
    </button>
  )
})

interface SkillsMenuProps {
  skills: SkillInfo[]
  onPick: (name: string) => void
}

function SkillsMenu({ skills, onPick }: SkillsMenuProps): React.JSX.Element {
  return (
    <div role="none" className="flex flex-col">
      <div className="max-h-[280px] overflow-y-auto">
        {skills.length === 0 ? (
          <div className="px-2 py-2 text-[11.5px] leading-relaxed text-ink3">
            스킬이 없습니다. <span className="font-mono">~/.claude/skills/</span> 또는 프로젝트의{' '}
            <span className="font-mono">.claude/skills/</span> 에 SKILL.md 를 두세요.
          </div>
        ) : (
          skills.map((s) => (
            <button
              key={s.name}
              type="button"
              role="menuitem"
              onClick={() => onPick(s.name)}
              className={`group/skillrow relative ${MENU_ITEM}`}
            >
              <span className="flex-1 font-mono text-[12.5px]">/{s.name}</span>
              {s.argumentHint && (
                <span className="font-mono text-[10.5px] text-ink3">{s.argumentHint}</span>
              )}
              {s.description && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-0 z-10 ml-2 hidden w-[240px] rounded-md border border-border bg-panel p-2 text-[11.5px] leading-relaxed text-ink2 shadow-lg group-hover/skillrow:block"
                >
                  {s.description}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
