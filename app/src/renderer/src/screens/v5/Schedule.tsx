import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from '../../components/primitives/Icon'
import { ToggleSwitch } from '../../components/primitives/ToggleSwitch'
import { MessageBubble } from '../../components/chat/MessageBubble'
import { ToolBlock, CompletedTag, MsgFooter } from '../../components/chat/ToolBlock'
import { ChatHeader, TaskComposer } from './Task'

// ─── Shared chrome ────────────────────────────────────────────────────

function ScheduledHeader(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ flex: 1 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 32,
            letterSpacing: -0.4,
            color: 'var(--ink)'
          }}
        >
          Scheduled tasks
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--ink-3)' }}>
          Run tasks on a schedule or whenever you need them. Type{' '}
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: 'var(--rust-ink)',
              background: 'rgba(0,0,0,.04)',
              padding: '1px 5px',
              borderRadius: 4
            }}
          >
            /schedule
          </code>{' '}
          in any existing task to set one up.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconButton icon="sortUpDown" />
        <IconButton icon="search" />
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px 6px 12px',
            borderRadius: 999,
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            border: 0,
            cursor: 'pointer'
          }}
        >
          <Icon name="plus" size={14} color="#fff" stroke={2} />
          New task
          <Icon name="chevronD" size={12} color="rgba(255,255,255,.7)" />
        </button>
      </div>
    </div>
  )
}

function IconButton({ icon, onClick }: { icon: IconName; onClick?: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tb-icon-btn"
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
        border: 0,
        cursor: 'pointer'
      }}
    >
      <Icon name={icon} size={16} color="var(--ink-2)" />
    </button>
  )
}

function ScheduledInfoBar(): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 22,
        padding: '11px 18px',
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'var(--paper)',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
    >
      <Icon name="info" size={16} color="var(--ink-3)" />
      <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>
        예약된 작업은 컴퓨터가 깨어 있는 동안에만 실행됩니다.
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name="sunSimple" size={14} color="var(--ink-3)" />
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>절전 모드 방지</span>
        <ToggleSwitch on={false} />
      </span>
    </div>
  )
}

function StopwatchGlyph(): React.JSX.Element {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <rect x="50" y="14" width="20" height="6" rx="2" fill="#c9c4ba" />
      <rect x="56" y="20" width="8" height="8" fill="#c9c4ba" />
      <circle cx="60" cy="72" r="38" fill="#dcd6c7" />
      <circle cx="60" cy="72" r="32" fill="none" stroke="#9d9686" strokeWidth="2.5" />
      <line x1="60" y1="72" x2="60" y2="50" stroke="#5d574a" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="72" x2="76" y2="78" stroke="#5d574a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="72" r="3" fill="#5d574a" />
    </svg>
  )
}

function SuggestionPill({ icon, label }: { icon: IconName; label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className="suggest-row"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        borderRadius: 999,
        border: '1px solid var(--line)',
        background: 'var(--paper)',
        color: 'var(--ink)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer'
      }}
    >
      <Icon name={icon} size={15} color="var(--ink-3)" />
      {label}
    </button>
  )
}

function ScheduleCard({
  title,
  body,
  schedule,
  onOpen
}: {
  title: string
  body: string
  schedule: string
  onOpen?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="schedule-card"
      style={{
        width: 340,
        padding: '18px 20px',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--line)',
        background: 'var(--paper)',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer'
      }}
    >
      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55, minHeight: 36 }}>{body}</div>
      <SchedulePill>{schedule}</SchedulePill>
    </button>
  )
}

/** Green schedule pill used in detail header + cards. */
function SchedulePill({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: 'rgba(94, 158, 92, 0.16)',
        color: '#3a6e3a',
        fontSize: 11.5,
        fontWeight: 500
      }}
    >
      <Icon name="clockSm" size={11} color="#3a6e3a" />
      {children}
    </span>
  )
}

// ─── Screen 1: empty ──────────────────────────────────────────────────

export function ScheduleEmpty(): React.JSX.Element {
  return (
    <main style={mainStyle}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '40px 48px 32px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <ScheduledHeader />
          <ScheduledInfoBar />
          <div
            style={{
              marginTop: 88,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 18
            }}
          >
            <StopwatchGlyph />
            <div style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>Create your first scheduled task</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <SuggestionPill icon="coffee" label="Daily brief" />
              <SuggestionPill icon="listCheck" label="Weekly review" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Screen 2: list ───────────────────────────────────────────────────

export function ScheduleList({ onOpenTask }: { onOpenTask?: () => void }): React.JSX.Element {
  return (
    <main style={mainStyle}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '40px 48px 32px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <ScheduledHeader />
          <ScheduledInfoBar />
          <div style={{ marginTop: 28 }}>
            <ScheduleCard
              title="Weekday morning brief"
              body="Weekday 7am morning brief: calendar, important emails, today's action items"
              schedule="평일 ~오전 7:00"
              onOpen={onOpenTask}
            />
          </div>
          <div style={{ marginTop: 80, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>More ideas</div>
            <div style={{ display: 'inline-flex', gap: 12 }}>
              <SuggestionPill icon="coffee" label="Daily brief" />
              <SuggestionPill icon="listCheck" label="Weekly review" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Screen 3: detail ─────────────────────────────────────────────────

export function ScheduleDetail({ onBack }: { onBack?: () => void }): React.JSX.Element {
  return (
    <main style={mainStyle}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '34px 48px 60px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <button
            type="button"
            onClick={onBack}
            className="sb-nav-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px 4px 4px',
              borderRadius: 6,
              color: 'var(--ink-3)',
              fontSize: 13,
              background: 'transparent',
              border: 0,
              cursor: 'pointer'
            }}
          >
            <Icon name="chevronR" size={14} style={{ transform: 'rotate(180deg)' }} />
            모든 예약된 작업
          </button>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 600,
                  fontSize: 32,
                  letterSpacing: -0.4,
                  color: 'var(--ink)'
                }}
              >
                Weekday morning brief
              </h1>
              <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>
                Weekday 7am morning brief: calendar, important emails, today's action items
              </p>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <DetailIconBtn icon="pencil" />
              <DetailIconBtn icon="trash" />
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: 'var(--ink)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: 0,
                  cursor: 'pointer'
                }}
              >
                <Icon name="play" size={11} color="#fff" stroke={0} fill="#fff" />
                지금 실행
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ToggleSwitch on={true} />
            <SchedulePill>활성</SchedulePill>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              다음 실행: 내일 ~오전 <b style={{ color: 'var(--ink-2)' }}>7:00</b>에
            </span>
          </div>

          <div style={{ height: 1, background: 'var(--line-soft)', margin: '28px 0 32px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 28 }}>
            <DetailLabel>지침</DetailLabel>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
              <p style={{ margin: '0 0 14px' }}>
                Generate a concise morning brief for today. The user is <b>Dy</b> (rlaeodud13@gmail.com).
                Use Korean for the final output if the user's prior conversations are in Korean; otherwise use
                English. Default to English unless evidence suggests otherwise.
              </p>
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontWeight: 600,
                  fontSize: 16,
                  margin: '14px 0 8px'
                }}
              >
                What to pull
              </h3>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <li>
                  <b>Today's calendar</b> — Use the connected Google Calendar tools to list every event scheduled
                  for today (the local day this task runs). For each event include: time range, title, location
                  or video link if present, and other attendees.
                </li>
                <li>
                  <b>Important unread emails</b> — Use the connected Gmail tools to fetch unread emails from the
                  last ~24 hours. Filter to what's actually important: messages from real people, threads where
                  the user is the sole recipient. Cap at 7 emails.
                </li>
                <li>
                  <b>Today's action items</b> — Surface anything explicit from email or calendar that needs action
                  today.
                </li>
              </ol>
            </div>

            <DetailLabel>일정</DetailLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clockSm" size={14} color="var(--ink-3)" />
                <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>오전 7:00</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>· 월요일에서 금요일까지</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>시간대: Asia/Seoul</div>
            </div>

            <DetailLabel>모델</DetailLabel>
            <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>Sonnet 4.6</div>

            <DetailLabel>도구</DetailLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Google Calendar', 'Gmail', 'mcp-registry'].map((t) => (
                <span
                  key={t}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(0,0,0,.04)',
                    fontSize: 12,
                    color: 'var(--ink-2)',
                    fontWeight: 500
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function DetailLabel({ children }: { children: ReactNode }): React.JSX.Element {
  return <div style={{ fontSize: 13, color: 'var(--ink-3)', paddingTop: 4 }}>{children}</div>
}

function DetailIconBtn({ icon }: { icon: IconName }): React.JSX.Element {
  return (
    <button
      type="button"
      className="tb-icon-btn"
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
        border: 0,
        cursor: 'pointer'
      }}
    >
      <Icon name={icon} size={16} color="var(--ink-2)" />
    </button>
  )
}

// ─── Screen 4: chat (approval pending) ────────────────────────────────

export function ScheduleChat(): React.JSX.Element {
  return (
    <main style={chatMainStyle}>
      <ChatHeader title="Daily brief" panelOpen={false} />
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
            padding: '8px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24
          }}
        >
          <MessageBubble role="assistant">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
                좋아요. 매일 아침 브리프를 만들어 드리려면 몇 가지만 확인할게요.
              </p>
              <div
                style={{
                  marginTop: 4,
                  background: 'var(--paper-2)',
                  borderRadius: 'var(--r-md)',
                  padding: '14px 18px',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 14.5,
                  lineHeight: 1.7,
                  color: 'var(--ink)'
                }}
              >
                <div style={{ fontWeight: 700 }}>What time should the morning brief run on weekdays?</div>
                <div
                  style={{
                    color: 'var(--ink-2)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13.5,
                    marginTop: 2
                  }}
                >
                  7:00 AM
                </div>
                <div style={{ fontWeight: 700, marginTop: 14 }}>
                  Which services do you use for calendar and email? (I'll need to install connectors for these.)
                </div>
                <div
                  style={{
                    color: 'var(--ink-2)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13.5,
                    marginTop: 2
                  }}
                >
                  Google (Gmail + Calendar)
                </div>
              </div>

              <ToolBlock title="mcp-registry 통합 사용함, 로드된 도구" status="done" />
              <ToolBlock title="create_scheduled_task" status="done" />

              <ScheduleApprovalBlock />

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--ink-3)',
                  fontSize: 13
                }}
              >
                <div
                  className="spin"
                  style={{
                    width: 14,
                    height: 14,
                    border: '1.6px solid var(--rust)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%'
                  }}
                />
                작업 중...
              </div>
            </div>
          </MessageBubble>
        </div>
      </div>

      <div style={{ padding: '6px 20px 0', flex: '0 0 auto' }}>
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
            padding: '8px 14px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(0,0,0,.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            color: 'var(--ink-3)'
          }}
        >
          <Icon name="info" size={14} color="var(--ink-3)" />
          Opus는 한도를 더 빠르게 소진합니다. 더 긴 대화를 위해 다른 모델을 사용해 보세요.
        </div>
      </div>
      <TaskComposer busy queued />
    </main>
  )
}

/** Schedule approval card — surface for the create_scheduled_task tool.
 *  Same "card with primary/dismissive buttons" pattern as ApprovalGate but
 *  with schedule-specific content. */
function ScheduleApprovalBlock({ confirmed }: { confirmed?: boolean } = {}): React.JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        background: 'var(--paper)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="clockSm" size={16} color="var(--ink-3)" />
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>작업 예약</span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Weekday morning brief</span>
      </div>
      <div style={{ marginTop: 10, marginLeft: 26, fontSize: 13.5, color: 'var(--ink-2)' }}>
        Weekday 7am morning brief: calendar, important emails, today's action items
      </div>
      <div style={{ marginTop: 4, marginLeft: 26, fontSize: 12.5, color: 'var(--ink-3)' }}>
        시간 오전 07:00, 월요일에서 금요일까지
      </div>
      <div
        style={{
          marginTop: 14,
          marginLeft: 26,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--ink-4)',
          fontSize: 12.5
        }}
      >
        <Icon name="chevronR" size={11} />
        세부 정보
      </div>
      {!confirmed && (
        <div style={{ marginTop: 14, marginLeft: 26, display: 'flex', gap: 8 }}>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px 7px 16px',
              borderRadius: 8,
              background: 'var(--ink)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              border: 0,
              cursor: 'pointer'
            }}
          >
            일정
            <span className="kbd" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>
              Enter
            </span>
          </button>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px 7px 16px',
              borderRadius: 8,
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              color: 'var(--ink-2)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            취소
            <span className="kbd">Esc</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Screen 5: chat done ──────────────────────────────────────────────

export function ScheduleDone(): React.JSX.Element {
  return (
    <main style={chatMainStyle}>
      <ChatHeader title="Daily brief" panelOpen={false} />
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
            padding: '8px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24
          }}
        >
          <MessageBubble role="assistant">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ToolBlock title="search_mcp_registry" status="done" />
              <CompletedTag />
              <ScheduledCreatedToast />
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>
                Done — the morning brief is scheduled to run weekdays at <b>7:00 AM</b> local time. Next run is
                tomorrow morning.
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>
                Two things to do before it'll actually have content to read:
              </p>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  fontSize: 14,
                  lineHeight: 1.65
                }}
              >
                <li>
                  <b>Connect Gmail and Google Calendar.</b> The MCP registry didn't return Google connectors
                  yet — I marked them <i>required</i>; install them via Connectors when you're ready.
                </li>
                <li>
                  <b>Confirm 시간대.</b> 현재 Asia/Seoul 기준으로 잡혔어요. 다른 시간대를 쓰시면 알려주세요.
                </li>
              </ol>
              <MsgFooter />
            </div>
          </MessageBubble>
        </div>
      </div>
      <TaskComposer />
    </main>
  )
}

function ScheduledCreatedToast(): React.JSX.Element {
  return (
    <button
      type="button"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 18px',
        borderRadius: 'var(--r-md)',
        background: 'rgba(0,0,0,.025)',
        border: '1px solid var(--line-soft)',
        textAlign: 'left',
        cursor: 'pointer'
      }}
    >
      <Icon name="clockSm" size={16} color="var(--ink-3)" />
      <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>예약된 작업 생성됨:</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Weekday morning brief</span>
      <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-3)' }}>
        시간 오전 07:00, 월요일에서 금요일까지
      </span>
      <Icon name="chevronR" size={14} color="var(--ink-4)" />
    </button>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────

const mainStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: 'var(--bg)'
}

const chatMainStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  backgroundColor: 'var(--bg)'
}
