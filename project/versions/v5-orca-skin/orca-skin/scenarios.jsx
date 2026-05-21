// Orca Skin — Scenarios for Schedule & Settings menus
//
// Exposes:
//   ScreenScheduledEmpty   — Scheduled empty state ("Create your first scheduled task")
//   ScreenScheduledList    — Scheduled with one Weekday morning brief card
//   ScreenScheduleDetail   — Task detail (Weekday morning brief)
//   ScreenScheduleChat     — Chat that includes the create_scheduled_task approval card
//   ScreenScheduleDone     — Chat after schedule is confirmed (toast + done msg)
//   ScreenAccountMenu      — Home with the account dropdown open (bottom-left)
//   ScreenLanguageMenu     — …same, with language submenu fly-out
//   ScreenSettings         — Settings page (일반 tab — profile + environment)

// ─────────────────────────────────────────────────────────────────────
// Scheduled list — shared chrome
// ─────────────────────────────────────────────────────────────────────
function ScheduledHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ flex: 1 }}>
        <h1 style={{
          margin: 0,
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic', fontWeight: 600,
          fontSize: 32, letterSpacing: -0.4,
          color: 'var(--ink)',
        }}>Scheduled tasks</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--ink-3)' }}>
          Run tasks on a schedule or whenever you need them. Type <code style={{
            fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--rust-ink)',
            background: 'rgba(0,0,0,.04)', padding: '1px 5px', borderRadius: 4,
          }}>/schedule</code> in any existing task to set one up.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="tb-icon-btn" style={{ width: 32, height: 32, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
          <Icon name="sortUpDown" size={16} color="var(--ink-2)"/>
        </button>
        <button className="tb-icon-btn" style={{ width: 32, height: 32, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
          <Icon name="search" size={16} color="var(--ink-2)"/>
        </button>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px 6px 12px', borderRadius: 999,
          background: 'var(--ink)', color: '#fff',
          fontSize: 13, fontWeight: 600,
        }}>
          <Icon name="plus" size={14} color="#fff" stroke={2}/>
          New task
          <Icon name="chevronD" size={12} color="rgba(255,255,255,.7)"/>
        </button>
      </div>
    </div>
  );
}

function ScheduledInfoBar() {
  return (
    <div style={{
      marginTop: 22,
      padding: '11px 18px',
      borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--paper)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Icon name="info" size={16} color="var(--ink-3)"/>
      <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>
        예약된 작업은 컴퓨터가 깨어 있는 동안에만 실행됩니다.
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name="sunSimple" size={14} color="var(--ink-3)"/>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>절전 모드 방지</span>
        <ToggleSwitch on={false}/>
      </span>
    </div>
  );
}

function ToggleSwitch({ on }) {
  return (
    <span style={{
      width: 30, height: 16, borderRadius: 999,
      background: on ? '#3a6ad9' : 'rgba(0,0,0,.18)',
      position: 'relative', display: 'inline-block',
      transition: 'background .15s',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 12, height: 12, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,.2)',
        transition: 'left .15s',
      }}/>
    </span>
  );
}

function StopwatchGlyph() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <rect x="50" y="14" width="20" height="6" rx="2" fill="#c9c4ba"/>
      <rect x="56" y="20" width="8" height="8" fill="#c9c4ba"/>
      <circle cx="60" cy="72" r="38" fill="#dcd6c7"/>
      <circle cx="60" cy="72" r="32" fill="none" stroke="#9d9686" strokeWidth="2.5"/>
      <line x1="60" y1="72" x2="60" y2="50" stroke="#5d574a" strokeWidth="3" strokeLinecap="round"/>
      <line x1="60" y1="72" x2="76" y2="78" stroke="#5d574a" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="60" cy="72" r="3" fill="#5d574a"/>
    </svg>
  );
}

function SuggestionPill({ icon, label }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 18px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'var(--paper)',
      color: 'var(--ink)',
      fontSize: 13, fontWeight: 500,
    }} className="suggest-row">
      <Icon name={icon} size={15} color="var(--ink-3)"/>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 12 — Scheduled empty
// ─────────────────────────────────────────────────────────────────────
function ScreenScheduledEmpty() {
  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '40px 48px 32px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <ScheduledHeader/>
          <ScheduledInfoBar/>

          <div style={{
            marginTop: 88,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
          }}>
            <StopwatchGlyph/>
            <div style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>Create your first scheduled task</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <SuggestionPill icon="coffee" label="Daily brief"/>
              <SuggestionPill icon="listCheck" label="Weekly review"/>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 13 — Scheduled with one card
// ─────────────────────────────────────────────────────────────────────
function ScheduleCard({ title, body, schedule, onOpen }) {
  return (
    <button onClick={onOpen} className="schedule-card" style={{
      width: 340, padding: '18px 20px',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--line)',
      background: 'var(--paper)',
      textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55, minHeight: 36 }}>{body}</div>
      <span style={{
        alignSelf: 'flex-start',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 999,
        background: 'rgba(94, 158, 92, 0.16)',
        color: '#3a6e3a',
        fontSize: 11.5, fontWeight: 500,
      }}>
        <Icon name="clockSm" size={11} color="#3a6e3a"/>
        {schedule}
      </span>
    </button>
  );
}

function ScreenScheduledList({ onOpenTask }) {
  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '40px 48px 32px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <ScheduledHeader/>
          <ScheduledInfoBar/>

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
              <SuggestionPill icon="coffee" label="Daily brief"/>
              <SuggestionPill icon="listCheck" label="Weekly review"/>
            </div>
          </div>
        </div>
      </div>
      <ScenariosCSS/>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 14 — Schedule task detail (Weekday morning brief)
// ─────────────────────────────────────────────────────────────────────
function ScreenScheduleDetail({ onBack }) {
  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: '34px 48px 60px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <button onClick={onBack} className="sb-nav-btn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 8px 4px 4px', borderRadius: 6,
            color: 'var(--ink-3)', fontSize: 13,
          }}>
            <Icon name="chevronR" size={14} style={{ transform: 'rotate(180deg)' }}/>
            모든 예약된 작업
          </button>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic', fontWeight: 600,
                fontSize: 32, letterSpacing: -0.4,
                color: 'var(--ink)',
              }}>Weekday morning brief</h1>
              <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--ink-2)' }}>
                Weekday 7am morning brief: calendar, important emails, today's action items
              </p>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button className="tb-icon-btn" style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                <Icon name="pencil" size={16} color="var(--ink-2)"/>
              </button>
              <button className="tb-icon-btn" style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                <Icon name="trash" size={16} color="var(--ink-2)"/>
              </button>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 999,
                background: 'var(--ink)', color: '#fff',
                fontSize: 13, fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                <Icon name="play" size={11} color="#fff" fill="#fff" stroke={0}/>
                지금 실행
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ToggleSwitch on={true}/>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 999,
              background: 'rgba(94, 158, 92, 0.16)',
              color: '#3a6e3a',
              fontSize: 11.5, fontWeight: 500,
            }}>
              <Icon name="clockSm" size={11} color="#3a6e3a"/>
              활성
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              다음 실행: 내일 ~오전 <b style={{ color: 'var(--ink-2)' }}>7:00</b>에
            </span>
          </div>

          <div style={{ height: 1, background: 'var(--line-soft)', margin: '28px 0 32px' }}/>

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 28 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', paddingTop: 4 }}>지침</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
              <p style={{ margin: '0 0 14px' }}>
                Generate a concise morning brief for today. The user is <b>Dy</b> (rlaeodud13@gmail.com).
                Use Korean for the final output if the user's prior conversations are in Korean; otherwise
                use English. Default to English unless evidence suggests otherwise.
              </p>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 600, fontSize: 16, margin: '14px 0 8px' }}>What to pull</h3>
              <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li>
                  <b>Today's calendar</b> — Use the connected Google Calendar tools to list every event
                  scheduled for today (the local day this task runs). For each event include: time range,
                  title, location or video link if present, and other attendees.
                </li>
                <li>
                  <b>Important unread emails</b> — Use the connected Gmail tools to fetch unread emails from
                  the last ~24 hours. Filter to what's actually important: messages from real people, threads
                  where the user is the sole recipient. Cap at 7 emails.
                </li>
                <li>
                  <b>Today's action items</b> — Surface anything explicit from email or calendar that needs
                  action today.
                </li>
              </ol>
            </div>

            <div style={{ fontSize: 13, color: 'var(--ink-3)', paddingTop: 4 }}>일정</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clockSm" size={14} color="var(--ink-3)"/>
                <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>오전 7:00</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>· 월요일에서 금요일까지</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>시간대: Asia/Seoul</div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--ink-3)', paddingTop: 4 }}>모델</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>Sonnet 4.6</div>

            <div style={{ fontSize: 13, color: 'var(--ink-3)', paddingTop: 4 }}>도구</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Google Calendar', 'Gmail', 'mcp-registry'].map((t) => (
                <span key={t} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 999,
                  background: 'rgba(0,0,0,.04)',
                  fontSize: 12, color: 'var(--ink-2)', fontWeight: 500,
                }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 15 — Schedule chat (create_scheduled_task awaiting approval)
// ─────────────────────────────────────────────────────────────────────
function ScheduleApprovalBlock({ confirmed }) {
  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)',
      padding: '14px 16px',
      background: 'var(--paper)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="clockSm" size={16} color="var(--ink-3)"/>
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

      <div style={{ marginTop: 14, marginLeft: 26, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-4)', fontSize: 12.5 }}>
        <Icon name="chevronR" size={11}/>
        세부 정보
      </div>

      {!confirmed && (
        <div style={{ marginTop: 14, marginLeft: 26, display: 'flex', gap: 8 }}>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 14px 7px 16px',
            borderRadius: 8,
            background: 'var(--ink)', color: '#fff',
            fontSize: 13, fontWeight: 600,
          }}>
            일정
            <span className="kbd" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>Enter</span>
          </button>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '7px 14px 7px 16px',
            borderRadius: 8,
            background: 'var(--paper)', border: '1px solid var(--line)',
            color: 'var(--ink-2)',
            fontSize: 13, fontWeight: 600,
          }}>
            취소
            <span className="kbd">Esc</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduledCreatedToast() {
  return (
    <button style={{
      width: '100%',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 18px',
      borderRadius: 'var(--r-md)',
      background: 'rgba(0,0,0,.025)',
      border: '1px solid var(--line-soft)',
      textAlign: 'left',
    }}>
      <Icon name="clockSm" size={16} color="var(--ink-3)"/>
      <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>예약된 작업 생성됨:</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Weekday morning brief</span>
      <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-3)' }}>시간 오전 07:00, 월요일에서 금요일까지</span>
      <Icon name="chevronR" size={14} color="var(--ink-4)"/>
    </button>
  );
}

function ScreenScheduleChat({ panelOpen, onTogglePanel }) {
  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ChatHeader title="Daily brief" panelOpen={panelOpen} onTogglePanel={onTogglePanel}/>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <ClaudeMsg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65 }}>
                좋아요. 매일 아침 브리프를 만들어 드리려면 몇 가지만 확인할게요.
              </p>

              <div style={{
                marginTop: 4,
                background: 'var(--paper-2)',
                borderRadius: 'var(--r-md)',
                padding: '14px 18px',
                fontFamily: 'var(--font-serif)',
                fontSize: 14.5, lineHeight: 1.7,
                color: 'var(--ink)',
              }}>
                <div style={{ fontWeight: 700 }}>What time should the morning brief run on weekdays?</div>
                <div style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontSize: 13.5, marginTop: 2 }}>7:00 AM</div>
                <div style={{ fontWeight: 700, marginTop: 14 }}>Which services do you use for calendar and email? (I'll need to install connectors for these.)</div>
                <div style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontSize: 13.5, marginTop: 2 }}>Google (Gmail + Calendar)</div>
              </div>

              <ToolBlock title="mcp-registry 통합 사용함, 로드된 도구" status="done" collapsible opened={false}/>
              <ToolBlock title="create_scheduled_task" status="done" collapsible opened={false}/>

              <ScheduleApprovalBlock/>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 13 }}>
                <div className="spin" style={{ width: 14, height: 14, border: '1.6px solid var(--rust)', borderTopColor: 'transparent', borderRadius: '50%' }}/>
                작업 중...
              </div>
            </div>
          </ClaudeMsg>
        </div>
      </div>

      <div style={{ padding: '6px 20px 0', flex: '0 0 auto' }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          padding: '8px 14px', borderRadius: 'var(--r-md)',
          background: 'rgba(0,0,0,.04)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12.5, color: 'var(--ink-3)',
        }}>
          <Icon name="info" size={14} color="var(--ink-3)"/>
          Opus는 한도를 더 빠르게 소진합니다. 더 긴 대화를 위해 다른 모델을 사용해 보세요.
        </div>
      </div>
      <TaskComposer busy queued/>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 16 — Schedule chat (after confirmation)
// ─────────────────────────────────────────────────────────────────────
function ScreenScheduleDone({ panelOpen, onTogglePanel }) {
  return (
    <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ChatHeader title="Daily brief" panelOpen={panelOpen} onTogglePanel={onTogglePanel}/>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <ClaudeMsg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ToolBlock title="search_mcp_registry" status="done" collapsible opened/>
              <CompletedTag/>

              <ScheduledCreatedToast/>

              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>
                Done — the morning brief is scheduled to run weekdays at <b>7:00 AM</b> local time. Next run
                is tomorrow morning.
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>
                Two things to do before it'll actually have content to read:
              </p>
              <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.65 }}>
                <li><b>Connect Gmail and Google Calendar.</b> The MCP registry didn't return Google connectors
                  yet — I marked them <i>required</i>; install them via Connectors when you're ready.</li>
                <li><b>Confirm 시간대.</b> 현재 Asia/Seoul 기준으로 잡혔어요. 다른 시간대를 쓰시면 알려주세요.</li>
              </ol>

              <MsgFooter/>
            </div>
          </ClaudeMsg>
        </div>
      </div>
      <TaskComposer/>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 17 — Account menu (drop-up from sidebar)
// 18 — …with Language submenu
// ─────────────────────────────────────────────────────────────────────
function AccountMenu({ withLang }) {
  return (
    <div style={{
      position: 'absolute',
      left: 8, bottom: 50,
      width: 256,
      background: 'var(--paper)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: 6,
      zIndex: 50,
    }}>
      <div style={{ padding: '8px 10px 6px', fontSize: 12, color: 'var(--ink-3)' }}>rlaeodud13@gmail.com</div>
      <div style={{ height: 1, background: 'var(--line-soft)', margin: '4px 2px' }}/>

      <MenuRow icon="cog" label="설정" right={<span className="kbd">Ctrl,</span>}/>
      <MenuRow icon="globe" label="언어" right={<Icon name="chevronR" size={13} color="var(--ink-4)"/>} active={withLang}/>
      <MenuRow icon="question" label="도움 받기"/>

      <div style={{ height: 1, background: 'var(--line-soft)', margin: '6px 2px' }}/>

      <MenuRow icon="list" label="모든 요금제 보기"/>
      <MenuRow icon="download" label="앱 및 확장 프로그램 받기"/>
      <MenuRow icon="gift" label="Claude 선물하기"/>
      <MenuRow icon="info" label="자세히 알아보기" right={<Icon name="chevronR" size={13} color="var(--ink-4)"/>}/>

      <div style={{ height: 1, background: 'var(--line-soft)', margin: '6px 2px' }}/>

      <MenuRow icon="logout" label="로그아웃"/>

      {withLang && <LanguageSubmenu/>}
    </div>
  );
}

function MenuRow({ icon, label, right, active }) {
  return (
    <button className="suggest-row" style={{
      width: '100%',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px', borderRadius: 7,
      background: active ? 'var(--press)' : 'transparent',
      color: 'var(--ink)',
      fontSize: 13.5,
      textAlign: 'left',
    }}>
      <Icon name={icon} size={15} color="var(--ink-3)"/>
      <span style={{ flex: 1 }}>{label}</span>
      {right && <span style={{ color: 'var(--ink-3)', fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>{right}</span>}
    </button>
  );
}

const LANGUAGES = [
  ['English (United States)'],
  ['Français (France)'],
  ['Deutsch (Deutschland)'],
  ['हिन्दी (भारत)'],
  ['Indonesia (Indonesia)'],
  ['Italiano (Italia)'],
  ['日本語 (日本)'],
  ['한국어(대한민국)', true],
  ['Português (Brasil)'],
  ['Español (Latinoamérica)'],
  ['Español (España)'],
];

function LanguageSubmenu() {
  return (
    <div style={{
      position: 'absolute',
      left: 'calc(100% + 8px)',
      bottom: 0,
      width: 248,
      background: 'var(--paper)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: 6,
    }}>
      {LANGUAGES.map(([label, sel]) => (
        <button key={label} className="suggest-row" style={{
          width: '100%',
          display: 'flex', alignItems: 'center',
          padding: '7px 10px', borderRadius: 7,
          background: sel ? 'var(--press)' : 'transparent',
          color: 'var(--ink)',
          fontSize: 13,
          textAlign: 'left',
        }}>
          <span style={{ flex: 1 }}>{label}</span>
          {sel && <Icon name="check" size={14} color="var(--info)" stroke={2.2}/>}
        </button>
      ))}
    </div>
  );
}

function ScreenAccountMenu({ withLang, onCreate, onOpenFolder }) {
  // Reuse the home screen content; overlay the menu near the bottom-left.
  return (
    <>
      <ScreenHome onCreate={onCreate} onOpenFolder={onOpenFolder} folderOpen={false}/>
      <div style={{
        position: 'fixed', left: 0, bottom: 0,
        width: 'var(--sidebar-w)',
        height: 'calc(100vh - var(--titlebar-h))',
        pointerEvents: 'none',
      }}>
        <AccountMenu withLang={withLang}/>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 19 — Settings page (일반 tab)
// ─────────────────────────────────────────────────────────────────────
const SETTINGS_NAV = [
  { id: 'general',  label: '일반', active: true },
  { id: 'account',  label: '계정' },
  { id: 'privacy',  label: '개인정보보호' },
  { id: 'billing',  label: '결제' },
  { id: 'usage',    label: '사용량' },
  { id: 'features', label: '기능' },
  { id: 'connect',  label: '커넥터' },
  { id: 'code',     label: 'Claude Code' },
  { id: 'cowork',   label: '협업' },
  { id: 'chrome',   label: 'Chrome용 Claude', badge: '베타' },
];
const SETTINGS_DESKTOP_NAV = [
  { id: 'd-general',  label: '일반' },
  { id: 'd-ext',      label: '확장 프로그램' },
  { id: 'd-dev',      label: '개발자' },
];

function SettingsField({ label, children, hint, action }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center', gap: 24,
      padding: '14px 0',
      borderBottom: '1px solid var(--line-soft)',
    }}>
      <div style={{ fontSize: 14, color: 'var(--ink)' }}>{label}</div>
      <div style={{ color: 'var(--ink-2)' }}>{children}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function AppearancePicker({ value = 'light' }) {
  const opts = [
    { v: 'system', icon: 'monitor' },
    { v: 'light',  icon: 'sunSimple' },
    { v: 'dark',   icon: 'moon' },
  ];
  return (
    <div style={{ display: 'inline-flex', padding: 2, background: 'rgba(0,0,0,.04)', borderRadius: 999 }}>
      {opts.map((o) => (
        <button key={o.v} style={{
          width: 30, height: 26, borderRadius: 999,
          background: o.v === value ? 'var(--paper)' : 'transparent',
          boxShadow: o.v === value ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
          display: 'grid', placeItems: 'center',
        }}>
          <Icon name={o.icon} size={14} color={o.v === value ? 'var(--ink)' : 'var(--ink-3)'}/>
        </button>
      ))}
    </div>
  );
}

function ScreenSettings({ onClose }) {
  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 32px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} className="tb-icon-btn" style={{ width: 30, height: 30, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
          <Icon name="arrowL" size={16}/>
        </button>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>설정</h1>
      </div>

      <div className="scroll" style={{ flex: 1, minHeight: 0, display: 'flex', gap: 36, padding: '20px 36px 64px' }}>
        {/* Settings sidebar */}
        <aside style={{ width: 200, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {SETTINGS_NAV.map((s) => (
            <button key={s.id} className="suggest-row" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8,
              background: s.active ? 'var(--press)' : 'transparent',
              color: 'var(--ink)',
              fontSize: 13.5, fontWeight: s.active ? 600 : 500,
              textAlign: 'left',
              border: s.active ? '1px solid var(--line)' : '1px solid transparent',
            }}>
              <span style={{ flex: 1 }}>{s.label}</span>
              {s.badge && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10, padding: '1px 5px',
                  background: 'rgba(0,0,0,.06)',
                  borderRadius: 4, color: 'var(--ink-3)',
                }}>{s.badge}</span>
              )}
            </button>
          ))}
          <div style={{ margin: '18px 14px 6px', fontSize: 11, color: 'var(--ink-4)', textTransform: 'none', letterSpacing: 0.2 }}>데스크톱 앱</div>
          {SETTINGS_DESKTOP_NAV.map((s) => (
            <button key={s.id} className="suggest-row" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8,
              color: 'var(--ink)',
              fontSize: 13.5,
              textAlign: 'left',
            }}>{s.label}</button>
          ))}
        </aside>

        {/* Settings body */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 880 }}>
          <h2 style={{ margin: '4px 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>프로필</h2>
          <div>
            <SettingsField label="아바타">
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: '#e8e3d6', color: 'var(--ink-2)',
                display: 'grid', placeItems: 'center',
                fontSize: 12, fontWeight: 700,
              }}>D</div>
            </SettingsField>
            <SettingsField label="성명">
              <input className="field-input" defaultValue="Dy" style={{ width: 200, padding: '6px 10px', fontSize: 13 }}/>
            </SettingsField>
            <SettingsField label="Claude가 어떻게 불러드릴까요?">
              <input className="field-input" defaultValue="Dy" style={{ width: 200, padding: '6px 10px', fontSize: 13 }}/>
            </SettingsField>
            <SettingsField label="귀하의 업무를 가장 잘 설명하는 것은 무엇입니까?">
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--paper)',
                fontSize: 13, color: 'var(--ink)',
                minWidth: 200, justifyContent: 'space-between',
              }}>
                엔지니어링
                <Icon name="chevronD" size={12} color="var(--ink-3)"/>
              </button>
            </SettingsField>
            <div style={{ padding: '18px 0 14px' }}>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>Claude 지침</div>
              <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-3)' }}>
                Claude는 <a href="#">Anthropic의 가이드라인</a> 내에서 채팅 및 Cowork 전반에 걸쳐 이를 기억합니다. <a href="#">자세히 알아보기</a>
              </div>
              <textarea className="field-input" style={{
                marginTop: 12, minHeight: 96,
                fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.6,
              }} defaultValue={
`- 질문의 맥락 확인이 어려울 때에는 질문의 의도를 명확히 하는 질문을 해야 함.
- 설명을 간단명료하게 유지하되 핵심 내용은 상세하게 설명
- 품질을 떨어뜨리는 행위 (추측하여 생성 등) 는 지양`
              }/>
            </div>
          </div>

          <h2 style={{ margin: '34px 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>환경설정</h2>
          <div>
            <SettingsField label="모양">
              <AppearancePicker value="light"/>
            </SettingsField>
            <SettingsField label="채팅 글꼴">
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--paper)',
                fontSize: 13, color: 'var(--ink)',
                minWidth: 160, justifyContent: 'space-between',
              }}>
                Anthropic Serif
                <Icon name="chevronD" size={12} color="var(--ink-3)"/>
              </button>
            </SettingsField>
            <SettingsField label="언어">
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--paper)',
                fontSize: 13, color: 'var(--ink)',
                minWidth: 160, justifyContent: 'space-between',
              }}>
                한국어
                <Icon name="chevronD" size={12} color="var(--ink-3)"/>
              </button>
            </SettingsField>
          </div>

          <h2 style={{ margin: '34px 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>알림</h2>
          <div>
            <SettingsField label="예약된 작업 완료 알림">
              <ToggleSwitch on={true}/>
            </SettingsField>
            <SettingsField label="승인 요청 시 알림">
              <ToggleSwitch on={true}/>
            </SettingsField>
            <SettingsField label="시스템 알림 소리">
              <ToggleSwitch on={false}/>
            </SettingsField>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// shared CSS
// ─────────────────────────────────────────────────────────────────────
function ScenariosCSS() {
  React.useEffect(() => {
    if (document.getElementById('scn-css')) return;
    const s = document.createElement('style');
    s.id = 'scn-css';
    s.textContent = `
      .schedule-card:hover { background: var(--hover); border-color: var(--line-strong); }
      .kbd {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 1px 6px;
        background: rgba(0,0,0,.06);
        border-radius: 4px;
        color: var(--ink-3);
        line-height: 1.4;
      }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

Object.assign(window, {
  ScreenScheduledEmpty,
  ScreenScheduledList,
  ScreenScheduleDetail,
  ScreenScheduleChat,
  ScreenScheduleDone,
  ScreenAccountMenu,
  ScreenSettings,
});
