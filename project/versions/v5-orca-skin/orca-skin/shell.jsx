// Orca Skin — shell chrome (titlebar + sidebar + main canvas)
// Matches the layout in the uploaded Cowork reference.

// ─────────────────────────────────────────────────────────────────────
// Titlebar — frameless window chrome.
// Left: hamburger, sidebar toggle, search, back, forward.
// Right: minimize, maximize, close.
// Whole bar is a drag region except for the controls.
// ─────────────────────────────────────────────────────────────────────
function Titlebar({ title, onSidebarToggle, sidebarOpen = true, right }) {
  return (
    <div
      className="titlebar"
      style={{
        height: 'var(--titlebar-h)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 0 0 8px',
        background: 'var(--bg)',
        position: 'relative',
        flex: '0 0 auto',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      {/* Left rail of window-level icons */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
        <TBIconBtn name="hamburger"/>
        <TBIconBtn name="sidebar" active={sidebarOpen} onClick={onSidebarToggle}/>
        <TBIconBtn name="search"/>
        <TBIconBtn name="arrowL"/>
        <TBIconBtn name="arrowR" muted/>
      </div>

      {/* Centered title (absolutely placed so window-drag still works) */}
      {title && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--ink)', fontWeight: 500, fontSize: 13.5,
          maxWidth: '50%',
          pointerEvents: 'none',
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          <Icon name="chevronD" size={14} color="var(--ink-3)"/>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
        {right && <div style={{ WebkitAppRegion: 'no-drag', display: 'flex', marginRight: 8 }}>{right}</div>}
        <WinControls/>
      </div>
      <TitlebarCSS/>
    </div>
  );
}

function TBIconBtn({ name, active, muted, onClick }) {
  const color = muted ? 'var(--ink-4)' : active ? 'var(--ink)' : 'var(--ink-2)';
  return (
    <button
      onClick={onClick}
      className="tb-icon-btn"
      style={{
        width: 32, height: 32, borderRadius: 6,
        display: 'grid', placeItems: 'center',
        color,
      }}
    >
      <Icon name={name} size={18}/>
    </button>
  );
}

function TitlebarCSS() {
  React.useEffect(() => {
    if (document.getElementById('tb-css')) return;
    const s = document.createElement('style');
    s.id = 'tb-css';
    s.textContent = `
      .tb-icon-btn:hover { background: var(--hover); }
      .winctrl {
        width: 46px; height: var(--titlebar-h);
        display: grid; place-items: center;
        color: var(--ink-2);
        transition: background .12s;
      }
      .winctrl:hover { background: var(--hover); }
      .winctrl.close:hover { background: #e44a3a; color: #fff; }
      .winctrl:focus-visible { outline: none; background: var(--hover); }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Sidebar
// Top: Chat / Cowork / Code segmented tabs
// Mid: nav items (New task, Projects, Scheduled, Live artifacts, Dispatch, Customize)
// Sub: Recents
// Bottom: account chip + download icon
// ─────────────────────────────────────────────────────────────────────

const SIDEBAR_NAV = [
  { id: 'newTask',     icon: 'plus',     label: 'New task', primary: true },
  { id: 'projects',    icon: 'projects', label: 'Projects' },
  { id: 'scheduled',   icon: 'schedule', label: 'Scheduled' },
  { id: 'artifacts',   icon: 'fish',     label: 'Live artifacts' },
  { id: 'dispatch',    icon: 'dispatch', label: 'Dispatch', badge: '베타' },
  { id: 'customize',   icon: 'customize',label: 'Customize' },
];

function Sidebar({ active = 'newTask', mode = 'cowork', recents = [], onNav, onModeChange, onRecent }) {
  return (
    <aside
      style={{
        width: 'var(--sidebar-w)', flex: '0 0 auto',
        background: 'var(--bg-2)',
        display: 'flex', flexDirection: 'column',
        height: '100%', minHeight: 0,
      }}
    >
      {/* Nav items */}
      <nav style={{ padding: '12px 8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {SIDEBAR_NAV.map((it) => {
          const isActive = it.id === active;
          return (
            <button
              key={it.id}
              onClick={() => onNav && onNav(it.id)}
              className="sb-nav-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px',
                borderRadius: 7,
                background: isActive ? 'var(--press)' : 'transparent',
                color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                fontSize: 13.5,
                fontWeight: isActive || it.primary ? 600 : 500,
              }}
            >
              <Icon name={it.icon} size={16}
                color={isActive ? 'var(--ink)' : it.primary ? 'var(--ink-2)' : 'var(--ink-3)'}/>
              <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10, padding: '1px 6px',
                  background: 'rgba(0,0,0,.06)',
                  borderRadius: 4, color: 'var(--ink-3)', letterSpacing: 0.3,
                }}>{it.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Recents */}
      {recents.length > 0 && (
        <div style={{ marginTop: 14, padding: '0 18px 6px', fontSize: 11, color: 'var(--ink-4)', fontWeight: 500 }}>
          Recents
        </div>
      )}
      <div className="scroll" style={{ padding: '0 8px', flex: 1, minHeight: 0 }}>
        {recents.map((r) => (
          <button
            key={r.id}
            onClick={() => onRecent && onRecent(r.id)}
            className="sb-nav-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', padding: '5px 10px',
              borderRadius: 6,
              background: r.active ? 'var(--press)' : 'transparent',
              color: r.active ? 'var(--ink)' : 'var(--ink-2)',
              fontSize: 12.5,
              textAlign: 'left',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: r.active ? 'var(--rust)' : 'transparent',
              border: r.active ? 'none' : '1px solid var(--ink-4)',
              flex: '0 0 auto',
            }}/>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
          </button>
        ))}
      </div>

      {/* Account footer */}
      <div style={{
        padding: 8,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button className="sb-nav-btn" style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 9,
          padding: '6px 8px', borderRadius: 7,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#2d8a6a', color: '#fff',
            display: 'grid', placeItems: 'center',
            fontWeight: 700, fontSize: 11,
          }}>D</div>
          <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Dy</span>
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>· Pro</span>
          <Icon name="chevronD" size={12} color="var(--ink-4)" style={{ marginLeft: 'auto' }}/>
        </button>
        <button className="sb-nav-btn" style={{ width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
          <Icon name="cloudDown" size={15} color="var(--ink-3)"/>
        </button>
      </div>

      <SidebarCSS/>
    </aside>
  );
}

function SidebarCSS() {
  React.useEffect(() => {
    if (document.getElementById('sb-css')) return;
    const s = document.createElement('style');
    s.id = 'sb-css';
    s.textContent = `
      .sb-nav-btn:hover { background: var(--hover); }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Composer — the big rounded input at the center of the home screen
// and at the bottom of the chat screen.
// ─────────────────────────────────────────────────────────────────────
function Composer({
  placeholder = '오늘 어떤 도움을 드릴까요?',
  large = false,
  rows = 2,
  leftChips,
  rightChips,
  modelLabel = 'Sonnet 4.6',
  showSend = false,
}) {
  return (
    <div
      style={{
        background: 'var(--paper)',
        borderRadius: 'var(--r-xl)',
        boxShadow: '0 1px 0 rgba(0,0,0,.02), 0 1px 2px rgba(0,0,0,.04)',
        border: '1px solid var(--line)',
      }}
    >
      <div style={{
        padding: large ? '18px 22px 0' : '14px 18px 0',
        color: 'var(--ink-4)',
        fontSize: large ? 15 : 14,
        minHeight: large ? rows * 26 + 16 : rows * 22,
        lineHeight: 1.5,
      }}>
        {placeholder}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: large ? '10px 14px 14px' : '8px 12px 10px',
      }}>
        <button className="cm-btn"><Icon name="plus" size={18} color="var(--ink-3)"/></button>
        {leftChips}
        <span style={{ marginLeft: 'auto' }}/>
        {rightChips}
        {showSend ? (
          <button style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--ink)', color: 'var(--paper)',
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name="arrowUp" size={15} color="var(--paper)"/>
          </button>
        ) : (
          <button className="cm-btn" title="Voice"><Icon name="mic" size={17} color="var(--ink-3)"/></button>
        )}
      </div>

      <ComposerCSS/>
    </div>
  );
}

function ComposerCSS() {
  React.useEffect(() => {
    if (document.getElementById('cm-css')) return;
    const s = document.createElement('style');
    s.id = 'cm-css';
    s.textContent = `
      .cm-btn {
        width: 30px; height: 30px; border-radius: 6px;
        display: grid; place-items: center;
        color: var(--ink-3);
      }
      .cm-btn:hover { background: var(--hover); color: var(--ink); }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

// Pill chip (used under the composer for project/role/model)
function Pill({ icon, label, dropdown, ghost, onClick }) {
  return (
    <button
      onClick={onClick}
      className="pill-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 11px',
        borderRadius: 999,
        background: ghost ? 'transparent' : 'rgba(0,0,0,.035)',
        color: 'var(--ink-2)',
        fontSize: 12.5,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        wordBreak: 'keep-all',
      }}
    >
      {icon && <Icon name={icon} size={14} color="var(--ink-3)"/>}
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      {dropdown && <Icon name="chevronD" size={12} color="var(--ink-4)"/>}
    </button>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('pill-css')) {
  const s = document.createElement('style');
  s.id = 'pill-css';
  s.textContent = `
    .pill-btn:hover { background: rgba(0,0,0,.06); color: var(--ink); }
    [data-theme="dark"] .pill-btn:hover { background: rgba(255,255,255,.08); }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { Titlebar, Sidebar, Composer, Pill });
