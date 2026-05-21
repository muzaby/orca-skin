// Variation 1 — Claude Desktop classic
// Warm cream, serif headers, calm density. Sidebar left, dual-pane main:
// chat (left) + camera/control (right).

const V1 = {
  bg: '#fbf9f4',
  sidebar: '#f3eee3',
  panel: '#ffffff',
  border: '#ebe3d0',
  borderStrong: '#ddd2b6',
  ink: '#29261b',
  ink2: '#6b6452',
  ink3: '#a8a092',
  rust: '#c96442',
  rustSoft: '#f4dcc9',
};

function V1Frame({ children, label }) {
  return (
    <div className="app-frame" style={{ background: V1.bg, fontFamily: 'var(--sans)' }} data-screen-label={label}>
      {children}
    </div>
  );
}

function V1Titlebar({ project = 'cam-validation-v3', breadcrumb }) {
  return (
    <div className="titlebar" style={{ background: V1.sidebar, borderBottom: `1px solid ${V1.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: V1.rust, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 12 }}>O</div>
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 13, color: V1.ink, letterSpacing: -0.2 }}>Orca</span>
        <span style={{ color: V1.ink3, fontSize: 11 }}>—</span>
        <span style={{ color: V1.ink2, fontSize: 12 }}>{project}</span>
        {breadcrumb && <>
          <span style={{ color: V1.ink3, fontSize: 11, margin: '0 4px' }}>›</span>
          <span style={{ color: V1.ink2, fontSize: 12 }}>{breadcrumb}</span>
        </>}
      </div>
      <WinControls />
    </div>
  );
}

function V1Sidebar({ active = 'chat', collapsed = false }) {
  const projects = [
    { id: 'cam', name: 'cam-validation-v3', engine: 'claude', active: true },
    { id: 'snr', name: 'snr-regression-2026', engine: 'opencode' },
    { id: 'aec', name: 'aec-tuning-suite', engine: 'claude' },
    { id: 'bay', name: 'bayer-debug', engine: 'local' },
  ];
  const recent = [
    { id: 's1', t: 'Low-light SNR at G2 channel', time: '14m', active: true },
    { id: 's2', t: 'AE convergence delay analysis', time: '2h' },
    { id: 's3', t: 'Capture batch — 240 frames', time: 'Yesterday' },
    { id: 's4', t: 'IR cut filter verification', time: '2d' },
    { id: 's5', t: '센서 EVS 캘리브레이션', time: '4d' },
  ];

  if (collapsed) {
    return (
      <aside style={{ width: 56, background: V1.sidebar, borderRight: `1px solid ${V1.border}`, display: 'flex', flexDirection: 'column', padding: '12px 0', gap: 4, alignItems: 'center', flex: '0 0 auto' }}>
        {['plus','chat','folder','flask','cpu','settings'].map((n,i) => (
          <button key={n} style={{ width: 36, height: 36, border: 0, background: i === 1 ? V1.rustSoft : 'transparent', color: i === 1 ? V1.rust : V1.ink2, borderRadius: 8, cursor: 'pointer' }}>
            <Icon name={n} size={17}/>
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside style={{ width: 248, background: V1.sidebar, borderRight: `1px solid ${V1.border}`, display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
      <div style={{ padding: '10px 12px 6px' }}>
        <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${V1.border}`, background: V1.panel, borderRadius: 8, cursor: 'pointer', color: V1.ink, fontWeight: 500 }}>
          <Icon name="plus" size={14}/> 새 대화
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <span className="kbd" style={{ fontSize: 10 }}>⌘</span><span className="kbd" style={{ fontSize: 10 }}>N</span>
          </span>
        </button>
      </div>

      <nav style={{ padding: '4px 6px' }}>
        {[
          { i: 'chat', l: '채팅', count: 12, active: active === 'chat' },
          { i: 'folder', l: '프로젝트', count: 4, active: active === 'projects' },
          { i: 'flask', l: '캡처 & 분석', count: 38, active: active === 'capture' },
          { i: 'cpu', l: '엔진 & 모델', active: active === 'engine' },
          { i: 'bolt', l: 'Skills & MCP', count: 9, active: active === 'skills' },
        ].map(it => (
          <div key={it.i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 10px', borderRadius: 6, color: it.active ? V1.ink : V1.ink2, background: it.active ? 'rgba(0,0,0,.04)' : 'transparent', fontSize: 13, fontWeight: it.active ? 500 : 400, cursor: 'pointer' }}>
            <Icon name={it.i} size={14}/>
            <span>{it.l}</span>
            {it.count != null && <span style={{ marginLeft: 'auto', fontSize: 11, color: V1.ink3, fontVariantNumeric: 'tabular-nums' }}>{it.count}</span>}
          </div>
        ))}
      </nav>

      <div style={{ padding: '14px 12px 4px', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: V1.ink3, textTransform: 'uppercase' }}>프로젝트</div>
      <div style={{ padding: '0 6px' }}>
        {projects.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6, background: p.active ? V1.rustSoft : 'transparent', color: p.active ? V1.ink : V1.ink2, fontSize: 12.5, cursor: 'pointer' }}>
            <span className={`dot ${p.engine === 'claude' ? 'green' : p.engine === 'opencode' ? 'amber' : 'slate'}`}/>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 12px 4px', fontFamily: 'var(--serif)', fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: V1.ink3, textTransform: 'uppercase' }}>최근 대화</div>
      <div style={{ padding: '0 6px', flex: 1, overflow: 'hidden' }}>
        {recent.map(s => (
          <div key={s.id} style={{ padding: '6px 10px', borderRadius: 6, background: s.active ? 'rgba(0,0,0,.04)' : 'transparent', cursor: 'pointer' }}>
            <div style={{ fontSize: 12.5, color: s.active ? V1.ink : V1.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: s.active ? 500 : 400 }}>{s.t}</div>
            <div style={{ fontSize: 10.5, color: V1.ink3, marginTop: 1 }}>{s.time}</div>
          </div>
        ))}
      </div>

      {/* Engine status footer */}
      <div style={{ padding: 10, borderTop: `1px solid ${V1.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar kind="claude" size={24}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: V1.ink, fontWeight: 500 }}>Claude Code</div>
          <div style={{ fontSize: 10.5, color: V1.ink3, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="dot green"/> claude-sonnet-4.5
          </div>
        </div>
        <button style={{ width: 26, height: 26, border: 0, background: 'transparent', borderRadius: 6, color: V1.ink3, cursor: 'pointer' }}>
          <Icon name="settings" size={14}/>
        </button>
      </div>
    </aside>
  );
}

// Chat pane (left of dual-pane)
function V1ChatPane({ activeTool, onToolToggle }) {
  return (
    <section style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', background: V1.bg }}>
      {/* session header */}
      <div style={{ padding: '14px 24px 10px', borderBottom: `1px solid ${V1.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: V1.ink, fontWeight: 600, letterSpacing: -0.3 }}>Low-light SNR at G2 channel</div>
          <div style={{ fontSize: 11.5, color: V1.ink3, marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>cam-validation-v3</span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="dot green"/> Claude Code · sonnet-4.5
            </span>
            <span>·</span>
            <span>3 skills · 2 MCP</span>
          </div>
        </div>

        {/* toolbar — Claude-style: same chip family for hardware + artifacts.
            The button surface stays consistent regardless of which panel
            is currently mounted on the right; aria-pressed flips the state. */}
        <div style={{ display: 'flex', gap: 4 }}>
          <V1HeaderToolBtn icon="search" label="검색"/>
          <V1HeaderToolBtn icon="cam"     label="하드웨어"   active={activeTool === 'hardware'}  onClick={() => onToolToggle && onToolToggle('hardware')}/>
          <V1HeaderToolBtn icon="layers"  label="아티팩트"   active={activeTool === 'artifact'}  onClick={() => onToolToggle && onToolToggle('artifact')}/>
          <V1HeaderToolBtn icon="settings" label=""/>
        </div>
      </div>

      {/* messages */}
      <div className="scroll" style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <V1Msg kind="user">
          저조도 환경에서 G2 채널의 SNR이 G1보다 약 1.4dB 낮게 측정됩니다. 보드를 바꿔도 같은 패턴이라 디바이스 이슈는 아닌 것 같은데, 우선 캡처를 10장 받아서 채널별 통계를 봐줘.
        </V1Msg>
        <V1Msg kind="claude">
          <p>좋아요. 보드(<code>OV-9282 / Rev.C</code>)와 연결 상태 확인했습니다. 캡처 시퀀스 시작합니다.</p>
          <V1Tool name="hardware.capture" args="frames=10, exposure_ms=33, gain=4x" status="done" duration="3.2s"/>
          <V1Tool name="analysis.bayer_split" args="pattern=RGGB, dark_subtract=true" status="done" duration="0.8s"/>
          <p>통계가 나왔어요. 채널별 평균 / 표준편차입니다:</p>
          <V1Table/>
          <p>G1과 G2 차이가 <b>1.42 dB</b>로 일관되게 나타납니다. row-noise 패턴이 의심스러운데, 우측 <button onClick={() => onToolToggle && onToolToggle('hardware')} style={{ border: 0, background: 'transparent', color: V1.rust, fontWeight: 600, cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>하드웨어 패널</button>에서 G2-only 디버그 모드 켜고 같이 보시죠.</p>
        </V1Msg>
        <V1Msg kind="user">
          그래, 디버그 토글 켜줘. 그리고 노출을 50ms로 올리면 어떻게 되는지도 같이 보고싶어.
        </V1Msg>
        <V1Msg kind="claude" inProgress>
          <V1Tool name="hardware.set_exposure" args="value_ms=50" status="running"/>
        </V1Msg>
      </div>

      {/* composer */}
      <div style={{ padding: '12px 24px 18px' }}>
        <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 14, padding: '10px 12px', boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
          <div style={{ minHeight: 36, color: V1.ink3, fontSize: 13, padding: '6px 4px' }}>Orca에게 메시지 보내기…</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 4 }}>
            <button style={chip1}><Icon name="plus" size={12}/> 첨부</button>
            <button style={chip1}><Icon name="cam" size={12}/> 현재 프레임</button>
            <button style={chip1}><Icon name="bolt" size={12}/> Skill</button>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: V1.ink3 }}>claude-sonnet-4.5</span>
              <button style={{ width: 30, height: 30, borderRadius: 8, border: 0, background: V1.rust, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <Icon name="send" size={14} color="#fff"/>
              </button>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Header toolbar button — consistent surface; pressable state communicates
// "this panel is open on the right". Label collapses to icon-only at <= 800px.
function V1HeaderToolBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!!active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 28, padding: label ? '0 10px 0 8px' : '0 6px',
        border: `1px solid ${active ? V1.borderStrong : 'transparent'}`,
        background: active ? V1.panel : 'transparent',
        color: active ? V1.ink : V1.ink2,
        borderRadius: 7, cursor: 'pointer',
        fontSize: 11.5, fontWeight: active ? 600 : 500,
        boxShadow: active ? '0 1px 2px rgba(0,0,0,.04)' : 'none',
      }}
    >
      <Icon name={icon} size={13} color={active ? V1.rust : 'currentColor'}/>
      {label && <span>{label}</span>}
    </button>
  );
}

const iconBtn1 = { width: 28, height: 28, border: 0, background: 'transparent', borderRadius: 6, color: V1.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' };
const chip1 = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', border: `1px solid ${V1.border}`, background: V1.panel, borderRadius: 999, color: V1.ink2, fontSize: 11.5, cursor: 'pointer' };

function V1Msg({ kind, children, inProgress }) {
  if (kind === 'user') {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar kind="user" size={28}/>
        <div style={{ flex: 1, paddingTop: 3 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: V1.ink, marginBottom: 4 }}>김재훈</div>
          <div style={{ fontSize: 13.5, color: V1.ink, lineHeight: 1.6 }}>{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Avatar kind="claude" size={28}/>
      <div style={{ flex: 1, paddingTop: 3 }}>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: V1.ink, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          Claude
          {inProgress && <span style={{ fontSize: 11, color: V1.ink3, fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span className="dot amber"/> 응답 중
          </span>}
        </div>
        <div style={{ fontSize: 13.5, color: V1.ink, lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      </div>
    </div>
  );
}

function V1Tool({ name, args, status, duration }) {
  const colors = status === 'done'
    ? { dot: 'green', label: '완료' }
    : status === 'running'
      ? { dot: 'amber', label: '실행 중…' }
      : { dot: 'slate', label: status };
  return (
    <div style={{ border: `1px solid ${V1.border}`, borderRadius: 10, background: V1.panel, padding: '8px 12px', fontSize: 12.5, fontFamily: 'var(--mono)', color: V1.ink, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className={`dot ${colors.dot}`}/>
      <span style={{ fontWeight: 600, color: V1.rust }}>{name}</span>
      <span style={{ color: V1.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>({args})</span>
      <span style={{ fontSize: 11, color: V1.ink3, fontFamily: 'var(--sans)' }}>{colors.label}{duration ? ` · ${duration}` : ''}</span>
    </div>
  );
}

function V1Table() {
  const rows = [
    ['R',   '108.3', '4.21', '32.4', ''],
    ['G1',  '142.7', '4.04', '34.1', ''],
    ['G2',  '141.9', '4.79', '32.7', '−1.42 dB vs G1'],
    ['B',   '95.6',  '4.18', '31.9', ''],
  ];
  return (
    <div style={{ border: `1px solid ${V1.border}`, borderRadius: 10, overflow: 'hidden', fontSize: 12, fontFamily: 'var(--mono)', background: V1.panel }}>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1.6fr', padding: '8px 12px', background: 'var(--cream-50)', color: V1.ink2, fontSize: 11, borderBottom: `1px solid ${V1.border}` }}>
        <span>채널</span><span>μ (DN)</span><span>σ</span><span>SNR (dB)</span><span></span>
      </div>
      {rows.map((r,i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1.6fr', padding: '7px 12px', color: V1.ink, borderBottom: i < rows.length - 1 ? `1px solid ${V1.border}` : 'none', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>{r[0]}</span>
          <span>{r[1]}</span>
          <span>{r[2]}</span>
          <span style={{ color: r[0] === 'G2' ? V1.rust : V1.ink, fontWeight: r[0] === 'G2' ? 600 : 400 }}>{r[3]}</span>
          <span style={{ fontSize: 11, color: V1.rust, fontFamily: 'var(--sans)' }}>{r[4]}</span>
        </div>
      ))}
    </div>
  );
}

// Camera pane (right of dual-pane)
function V1CameraPane() {
  return (
    <section style={{ width: 480, flex: '0 0 auto', background: V1.sidebar, borderLeft: `1px solid ${V1.border}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${V1.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="cam" size={15}/>
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 14, color: V1.ink }}>하드웨어 제어</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: V1.ink2, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span className="dot green"/> COM7 · OV-9282
        </span>
      </div>

      {/* Live viewport */}
      <div style={{ padding: 12, background: '#0c0f12' }}>
        <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
          <BayerPattern width={456} height={258}/>
          {/* HUD overlays */}
          <div style={{ position: 'absolute', top: 8, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'rgba(255,255,255,.85)', textShadow: '0 1px 2px rgba(0,0,0,.5)' }}>
            <span>1280×720 · RGGB · 10-bit</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e44a3a' }}/> REC · 00:14
            </span>
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'rgba(255,255,255,.7)' }}>
            <span>EXP 50.0ms</span>
            <span>GAIN 4.0×</span>
            <span>FPS 19.8</span>
            <span>T 38.4°C</span>
          </div>
        </div>
        {/* tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, padding: 3, background: '#1a1d22', borderRadius: 6 }}>
          {[['RGB','active'],['Bayer'],['R'],['G1'],['G2'],['B']].map(([t, a], i) => (
            <button key={t} style={{ flex: 1, padding: '5px 0', border: 0, borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--mono)', background: a ? '#2a323d' : 'transparent', color: a ? '#fff' : 'rgba(255,255,255,.55)', cursor: 'pointer' }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Histogram */}
      <div style={{ padding: '10px 16px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: V1.ink2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Histogram</span>
          <span style={{ fontSize: 10.5, color: V1.ink3, fontFamily: 'var(--mono)' }}>0 – 1023 DN</span>
        </div>
        <Histogram width={448} height={56}/>
      </div>

      {/* Sliders */}
      <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <V1Slider label="노출 (Exposure)" unit="ms" value={50.0} min={1} max={120} pct={42}/>
        <V1Slider label="아날로그 게인" unit="×" value={4.0} min={1} max={16} pct={26}/>
        <V1Slider label="디지털 게인" unit="dB" value={0.0} min={0} max={24} pct={0}/>
      </div>

      {/* Quality metrics */}
      <div style={{ padding: '4px 16px 8px' }}>
        <div style={{ fontSize: 11.5, color: V1.ink2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>품질 메트릭</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <V1Metric label="SNR" value="32.7" unit="dB" tone="warn"/>
          <V1Metric label="Sharpness" value="0.84" tone="ok"/>
          <V1Metric label="DR" value="58.2" unit="dB" tone="ok"/>
          <V1Metric label="Δ G1−G2" value="1.42" unit="dB" tone="bad"/>
        </div>
      </div>

      {/* Capture buttons */}
      <div style={{ marginTop: 'auto', padding: 14, borderTop: `1px solid ${V1.border}`, display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, padding: '9px 0', border: 0, borderRadius: 8, background: V1.rust, color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="capture" size={14} color="#fff"/> 캡처
        </button>
        <button style={{ flex: 1, padding: '9px 0', border: `1px solid ${V1.border}`, borderRadius: 8, background: V1.panel, color: V1.ink, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="layers" size={14}/> 시퀀스
        </button>
        <button style={{ width: 36, padding: '9px 0', border: `1px solid ${V1.border}`, borderRadius: 8, background: V1.panel, color: V1.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <Icon name="history" size={14}/>
        </button>
      </div>
    </section>
  );
}

function V1Slider({ label, unit, value, min, max, pct }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: V1.ink2 }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', color: V1.ink, fontWeight: 600 }}>{value} {unit}</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: V1.panel, borderRadius: 3, border: `1px solid ${V1.border}` }}>
        <div style={{ position: 'absolute', left: 0, top: -1, bottom: -1, width: `${pct}%`, background: V1.rust, borderRadius: 3 }}/>
        <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: `2px solid ${V1.rust}`, boxShadow: '0 1px 3px rgba(0,0,0,.15)' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: V1.ink3, fontFamily: 'var(--mono)', marginTop: 3 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function V1Metric({ label, value, unit, tone = 'ok' }) {
  const colors = { ok: V1.ink, warn: '#c79431', bad: V1.rust };
  return (
    <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 8, padding: '7px 10px' }}>
      <div style={{ fontSize: 10, color: V1.ink3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 600, color: colors[tone], marginTop: 2 }}>
        {value}<span style={{ fontSize: 10, fontWeight: 400, color: V1.ink3, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

Object.assign(window, { V1, V1Frame, V1Titlebar, V1Sidebar, V1ChatPane, V1CameraPane, V1HeaderToolBtn, V1Slider, V1Metric });
