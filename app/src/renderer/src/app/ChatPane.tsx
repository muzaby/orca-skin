import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../components/atoms/Icon'
import { Dot } from '../components/atoms/Status'
import { StatusLine } from '../components/atoms/StatusLine'
import { Markdown } from '../components/markdown/Markdown'
import type { UseChat } from '../state/useChat'
import type { Message, ToolCall } from '../state/chatReducer'

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

interface CopyIconButtonProps {
  text: string
}

function CopyIconButton({ text }: CopyIconButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const onClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — silent no-op
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-ink3 hover:bg-cream-100 hover:text-ink2"
      title={copied ? '복사됨' : '메시지 복사'}
      aria-label="메시지 복사"
    >
      <Icon name={copied ? 'check' : 'copy'} size={12} />
    </button>
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
      <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-[#F0EEE6] px-4 py-2.5 text-[14px] leading-[1.7] text-ink">
        {message.content}
      </div>
      <MessageMeta text={message.content} createdAt={message.createdAt} align="right" />
    </div>
  )
}

interface PendingAssistantProps {
  turnStartedAt: number | null
  approxFromText: string
  inputTokensFinal?: number
  pendingDelta: string
}

function PendingAssistant({
  turnStartedAt,
  approxFromText,
  inputTokensFinal,
  pendingDelta
}: PendingAssistantProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
      {pendingDelta && <Markdown source={pendingDelta} />}
      <StatusLine
        turnStartedAt={turnStartedAt}
        approxFromText={approxFromText}
        inputTokensFinal={inputTokensFinal}
        outputApproxFromText={pendingDelta}
      />
    </div>
  )
}

export function ChatPane({ chat, backendLabel }: ChatPaneProps): React.JSX.Element {
  const { state, send, cancel } = chat
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.messages, state.pendingDelta])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (draft.trim() !== '') {
        send(draft)
        setDraft('')
      }
    }
  }

  const isEmpty = state.messages.length === 0 && state.pendingDelta === ''
  const title = state.messages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? '새 대화'

  const showPendingAssistant = state.inflight
  const lastUserText = [...state.messages].reverse().find((m) => m.role === 'user')?.content ?? ''

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
          <PendingAssistant
            turnStartedAt={state.turnStartedAt}
            approxFromText={lastUserText}
            inputTokensFinal={state.pendingInputTokens}
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

      <div className="px-6 pb-[18px] pt-3">
        <div className="rounded-[14px] border border-border bg-panel px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Orca에게 메시지 보내기… (Enter 전송 / Shift+Enter 줄바꿈)"
            rows={1}
            className="block max-h-40 min-h-9 w-full resize-none border-0 bg-transparent px-1 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink3"
          />
          <div className="flex items-center gap-1.5 pt-1">
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
      </div>
    </section>
  )
}
