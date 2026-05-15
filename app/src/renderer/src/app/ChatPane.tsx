import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '../components/atoms/Icon'
import { Avatar } from '../components/atoms/Avatar'
import { Dot } from '../components/atoms/Status'
import type { UseChat } from '../state/useChat'
import type { ToolCall } from '../state/chatReducer'

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2'

interface ChatPaneProps {
  chat: UseChat
  backendLabel: string
  authorName?: string
}

function ToolCard({ call }: { call: ToolCall }): React.JSX.Element {
  const done = call.result != null
  const isError = call.result?.isError === true
  const tone: 'green' | 'amber' | 'slate' = isError ? 'slate' : done ? 'green' : 'amber'
  const label = isError ? '실패' : done ? '완료' : '실행 중…'
  const args = (() => {
    try {
      return typeof call.input === 'string' ? call.input : JSON.stringify(call.input)
    } catch {
      return String(call.input)
    }
  })()
  const duration =
    call.result?.durationMs != null ? ` · ${(call.result.durationMs / 1000).toFixed(1)}s` : ''
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-panel px-3 py-2 font-mono text-[12.5px] text-ink">
      <Dot tone={tone} />
      <span className="font-semibold text-rust">{call.name}</span>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">
        ({args})
      </span>
      <span className="font-sans text-[11px] text-ink3">
        {label}
        {duration}
      </span>
    </div>
  )
}

interface MsgProps {
  kind: 'user' | 'claude'
  author: string
  inProgress?: boolean
  children: ReactNode
}

function Msg({ kind, author, inProgress, children }: MsgProps): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <Avatar kind={kind} size={28} />
      <div className="flex-1 pt-[3px]">
        <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          {author}
          {inProgress && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-ink3">
              <Dot tone="amber" /> 응답 중
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2.5 whitespace-pre-wrap text-[13.5px] leading-[1.65] text-ink">
          {children}
        </div>
      </div>
    </div>
  )
}

export function ChatPane({
  chat,
  backendLabel,
  authorName = '나'
}: ChatPaneProps): React.JSX.Element {
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

  // 마지막 어시스턴트 메시지가 비어있는 placeholder 인지 (inflight 중 첫 델타 도착 전)
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
        {state.messages.map((m, i) => (
          <Msg
            key={i}
            kind={m.role === 'user' ? 'user' : 'claude'}
            author={m.role === 'user' ? authorName : 'Claude'}
          >
            {m.toolCalls?.map((tc) => (
              <ToolCard key={tc.toolUseId} call={tc} />
            ))}
            {m.content && <p>{m.content}</p>}
          </Msg>
        ))}
        {showPendingAssistant && (
          <Msg kind="claude" author="Claude" inProgress>
            {state.pendingDelta ? <p>{state.pendingDelta}</p> : <p className="text-ink3">…</p>}
          </Msg>
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
                  <Icon name="settings" size={14} color="#fff" />
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
