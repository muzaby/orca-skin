// Variation 2 — Engineering dense.
// Compact monospace data, more grid lines, three-column layout (sidebar + chat + camera).
// Still warm cream base but with denser data presentation.

const V2 = {
  bg: '#f6f3ec',
  sidebar: '#ebe4d2',
  panel: '#fbf9f4',
  panelDark: '#1a1d22',
  border: '#d6c9aa',
  borderSoft: '#ebe3d0',
  ink: '#1f1c14',
  ink2: '#544c38',
  ink3: '#857c64',
  rust: '#c96442',
  teal: '#3a7872',
  good: '#5a8a4f',
  warn: '#c79431',
};

function V2Frame({ children, label }) {
  return <div className="app-frame" style={{ background: V2.bg, fontFamily: 'var(--sans)', fontSize: 12.5 }} data-screen-label={label}>{children}</div>;
}

function V2Titlebar() {
  return (
    <div className="titlebar" style={{ height: 32, background: V2.sidebar, borderBottom: `1px solid ${V2.border}`, fontFamily: 'var(--mono)', fontSize: 11, padding: '0 6px 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 14, height: 14, background: V2.rust, borderRadius: 2, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--sans)' }}>O</div>
        <span style={{ color: V2.ink, fontWeight: 600 }}>orca</span>
        <span style={{ color: V2.ink3 }}>:</span>
        <span style={{ color: V2.ink2 }}>~/cam-validation-v3</span>
        <span style={{ color: V2.ink3, marginLeft: 16 }}>● claude-code · sonnet-4.5</span>
        <span style={{ color: V2.ink3, marginLeft: 12 }}>⚡ COM7 OV-9282 · 19.8 fps</span>
      </div>
      <WinControls/>
    </div>
  );
}

function V2Sidebar() {
  const tabs = ['cam-validation-v3', 'snr-regression-2026', 'aec-tuning-suite'];
  const sessions = [
    { t: 'Low-light SNR @ G2', tag: 'snr', a: true },
    { t: 'AE convergence delay', tag: 'aec' },
    { t: 'IR cut filter check', tag: 'ir' },
    { t: 'Capture batch 240f', tag: 'cap' },
    { t: 'Sensor temp regression', tag: 'thr' },
    { t: 'Bayer pattern verify', tag: 'bay' },
    { t: 'EVS calibration', tag: 'evs' },
  ];
  return (
    <aside style={{ width: 220, flex: '0 0 auto', background: V2.sidebar, borderRight: `1px solid ${V2.border}`, display: 'flex', flexDirection: 'column' }}>
      {/* project tabs */}
      <div style={{ padding: '8px 6px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {tabs.map((t, i) => (
          <button key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: i === 0 ? V2.bg : 'transparent', border: 0, borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 11.5, color: i === 0 ? V2.ink : V2.ink2, fontWeight: i === 0 ? 600 : 400, cursor: 'pointer', justifyContent: 'flex-start' }}>
            <span className={`dot ${i === 0 ? 'green' : i === 1 ? 'amber' : 'slate'}`}/>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
          </button>
        ))}
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'transparent', border: 0, fontSize: 11, color: V2.ink3, cursor: 'pointer', justifyContent: 'flex-start' }}>
          <Icon name="plus" size={11}/> new project
        </button>
      </div>

      <div style={{ marginTop: 12, padding: '0 10px', fontFamily: 'var(--mono)', fontSize: 10, color: V2.ink3, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', justifyContent: 'space-between' }}>
        <span>sessions</span>
        <span>+ new</span>
      </div>
      <div style={{ padding: '4px 6px', flex: 1, overflow: 'hidden' }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ padding: '4px 8px', borderRadius: 3, background: s.a ? V2.bg : 'transparent', cursor: 'pointer', fontSize: 11.5, color: s.a ? V2.ink : V2.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: V2.ink3, padding: '1px 4px', background: 'rgba(0,0,0,.04)', borderRadius: 2 }}>{s.tag}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.t}</span>
          </div>
        ))}
      </div>

      {/* Hardware status block */}
      <div style={{ borderTop: `1px solid ${V2.border}`, padding: 10, fontFamily: 'var(--mono)', fontSize: 10.5, color: V2.ink2, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>BOARD</span><span style={{ color: V2.good }}>● OK</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SENSOR</span><span>OV-9282</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PORT</span><span>COM7 · 12M</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>FPS</span><span>19.8</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TEMP</span><span>38.4°C</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>ENGINE</span><span style={{ color: V2.good }}>● cc·s4.5</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SKILLS</span><span>3 / 5</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>MCP</span><span>2 / 3</span></div>
      </div>
    </aside>
  );
}

// V2 chat — denser, monospace tool blocks
function V2ChatPane() {
  return (
    <section style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', background: V2.bg, borderRight: `1px solid ${V2.border}` }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${V2.border}`, display: 'flex', alignItems: 'center', gap: 10, background: V2.sidebar }}>
        <Icon name="chat" size={13}/>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: V2.ink }}>low-light SNR @ G2</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: V2.ink3 }}>turn 7 · 14m</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button style={chip2}>plan</button>
          <button style={{ ...chip2, background: V2.bg, color: V2.ink, fontWeight: 600 }}>edit</button>
          <button style={chip2}>review</button>
        </span>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--sans)' }}>
        <V2Msg kind="user">G1/G2 채널 SNR 차이가 의심스러워. 캡처 10장 받고 채널 통계 봐줘.</V2Msg>
        <V2Msg kind="claude">
          <p>OV-9282 / COM7 연결 확인. 시퀀스 시작합니다.</p>
          <V2Tool name="hardware.capture" status="done">frames=10  exposure_ms=33  gain=4x   →  10 frames @ 1280×720 RGGB-10bit</V2Tool>
          <V2Tool name="analysis.bayer_split" status="done">pattern=RGGB  dark_subtract=true  →  per-channel μ, σ, SNR</V2Tool>
          <V2DataTable/>
          <p>G2 노이즈가 G1 대비 <b>+1.42 dB</b>. row-noise 패턴 같습니다. 라이브 뷰 G2 디버그 모드 켜고 보시죠.</p>
        </V2Msg>
        <V2Msg kind="user">디버그 켜고 노출도 50ms로.</V2Msg>
        <V2Msg kind="claude" running>
          <V2Tool name="hardware.set_debug_channel" status="done">channel=G2_only  →  view updated</V2Tool>
          <V2Tool name="hardware.set_exposure" status="running">value_ms=50</V2Tool>
        </V2Msg>
      </div>

      <div style={{ padding: '8px 16px 12px', borderTop: `1px solid ${V2.border}`, background: V2.sidebar }}>
        <div style={{ background: V2.panel, border: `1px solid ${V2.border}`, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--mono)', color: V2.ink3, marginBottom: 4 }}>
            <span style={{ color: V2.rust }}>{">"}</span>
            <span>edit mode · auto-context: current frame, last 3 captures, board state</span>
          </div>
          <div style={{ minHeight: 32, color: V2.ink3, fontSize: 12.5, padding: '2px 0' }}>메시지를 입력하거나 <span className="kbd" style={{ fontSize: 10 }}>/</span> 로 명령어…</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <button style={chip2}>/capture</button>
            <button style={chip2}>/analyze</button>
            <button style={chip2}>/snapshot</button>
            <button style={chip2}>@board</button>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: V2.ink3, fontFamily: 'var(--mono)' }}>4.2k / 200k tok</span>
            <button style={{ padding: '4px 9px', border: `1px solid ${V2.rust}`, background: V2.rust, color: '#fff', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              run <Icon name="send" size={10} color="#fff"/>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const chip2 = { padding: '3px 8px', border: `1px solid ${V2.border}`, background: V2.bg, borderRadius: 3, fontSize: 11, fontFamily: 'var(--mono)', color: V2.ink2, cursor: 'pointer' };

function V2Msg({ kind, children, running }) {
  const sender = kind === 'user' ? 'jaehoon@local' : 'claude · sonnet-4.5';
  return (
    <div style={{ borderLeft: `2px solid ${kind === 'user' ? V2.ink3 : V2.rust}`, paddingLeft: 10 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: V2.ink3, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: kind === 'user' ? V2.ink2 : V2.rust, fontWeight: 600 }}>{sender}</span>
        {running && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: V2.warn }}>● running</span>}
      </div>
      <div style={{ fontSize: 12.5, color: V2.ink, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function V2Tool({ name, status, children }) {
  const tone = status === 'done' ? V2.good : status === 'running' ? V2.warn : V2.ink3;
  return (
    <div style={{ background: V2.panel, border: `1px solid ${V2.border}`, borderRadius: 4, padding: '6px 9px', fontFamily: 'var(--mono)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: V2.ink2 }}>
        <span style={{ color: tone, fontWeight: 700 }}>●</span>
        <span style={{ color: V2.rust, fontWeight: 600 }}>{name}</span>
        <span style={{ marginLeft: 'auto', color: tone, fontSize: 10 }}>{status}</span>
      </div>
      {children && <div style={{ color: V2.ink2, marginTop: 4, paddingLeft: 14, fontSize: 11 }}>{children}</div>}
    </div>
  );
}

function V2DataTable() {
  const rows = [['R',108.3,4.21,32.4,''],['G1',142.7,4.04,34.1,''],['G2',141.9,4.79,32.7,'-1.42 vs G1'],['B',95.6,4.18,31.9,'']];
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, background: V2.panel, border: `1px solid ${V2.border}`, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 60px 50px 60px 1fr', padding: '4px 9px', background: V2.sidebar, color: V2.ink3, fontSize: 10, borderBottom: `1px solid ${V2.border}` }}>
        <span>ch</span><span>μ</span><span>σ</span><span>snr/dB</span><span>note</span>
      </div>
      {rows.map((r,i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 60px 50px 60px 1fr', padding: '3px 9px', color: V2.ink, borderBottom: i < rows.length - 1 ? `1px solid ${V2.borderSoft}` : 0 }}>
          <span style={{ color: r[0] === 'G2' ? V2.rust : V2.ink, fontWeight: 600 }}>{r[0]}</span>
          <span>{r[1].toFixed(1)}</span>
          <span>{r[2].toFixed(2)}</span>
          <span style={{ color: r[0] === 'G2' ? V2.rust : V2.ink }}>{r[3].toFixed(1)}</span>
          <span style={{ color: V2.rust }}>{r[4]}</span>
        </div>
      ))}
    </div>
  );
}

function V2CameraPane() {
  return (
    <section style={{ width: 380, flex: '0 0 auto', display: 'flex', flexDirection: 'column', background: V2.panelDark, color: '#d8dce3' }}>
      {/* tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a323d', fontFamily: 'var(--mono)', fontSize: 11 }}>
        {['LIVE','HIST','METR','LOG'].map((t, i) => (
          <button key={t} style={{ flex: 1, padding: '8px 0', background: i === 0 ? '#1f262e' : 'transparent', border: 0, color: i === 0 ? '#fff' : '#7a8595', cursor: 'pointer', borderTop: i === 0 ? `2px solid ${V2.rust}` : '2px solid transparent', borderRight: i < 3 ? '1px solid #2a323d' : 0 }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ position: 'relative' }}>
          <BayerPattern width={360} height={206}/>
          <div style={{ position: 'absolute', top: 6, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,.85)' }}>
            <span>1280×720 RGGB·10b</span>
            <span style={{ color: '#e44a3a' }}>● REC 00:14</span>
          </div>
          <div style={{ position: 'absolute', bottom: 6, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,.7)' }}>
            <span>EXP 50.0</span><span>GAIN 4.0x</span><span>FPS 19.8</span>
          </div>
        </div>

        {/* channel pills */}
        <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
          {[['RGB',true],['BAY'],['R'],['G1'],['G2'],['B']].map(([t,a]) => (
            <button key={t} style={{ flex: 1, padding: '4px 0', border: 0, borderRadius: 2, fontSize: 10, fontFamily: 'var(--mono)', background: a ? V2.rust : '#2a323d', color: a ? '#fff' : '#aab3c0', cursor: 'pointer' }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--mono)', fontSize: 11 }}>
        <V2Slider label="exposure" unit="ms" value="50.000" pct={42}/>
        <V2Slider label="gain.a" unit="x" value="4.00" pct={26}/>
        <V2Slider label="gain.d" unit="dB" value="0.0" pct={0}/>
        <V2Slider label="awb.r" unit="" value="1.42" pct={48}/>
        <V2Slider label="awb.b" unit="" value="1.83" pct={62}/>
      </div>

      {/* Histogram */}
      <div style={{ padding: '0 12px 8px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#7a8595', marginBottom: 4 }}>HISTOGRAM · 0-1023</div>
        <Histogram width={356} height={50}/>
      </div>

      {/* Metrics grid */}
      <div style={{ padding: '0 12px 8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontFamily: 'var(--mono)', fontSize: 10 }}>
        {[['SNR','32.7','warn'],['ΔG','1.42','bad'],['SHARP','0.84','ok'],['DR','58.2','ok'],['MTF50','0.31','ok'],['ΔE','2.1','warn'],['SAT','0.7%','ok'],['BLK','0.0%','ok']].map(([l,v,t]) => {
          const c = t === 'bad' ? V2.rust : t === 'warn' ? V2.warn : '#5fb05a';
          return (
            <div key={l} style={{ background: '#1f262e', padding: '5px 7px', borderRadius: 3, borderLeft: `2px solid ${c}` }}>
              <div style={{ color: '#7a8595', fontSize: 9 }}>{l}</div>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginTop: 1 }}>{v}</div>
            </div>
          );
        })}
      </div>

      {/* Capture log */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px', fontFamily: 'var(--mono)', fontSize: 10.5, color: '#aab3c0', borderTop: '1px solid #2a323d' }}>
        <div style={{ color: '#7a8595', marginBottom: 4 }}>CAPTURE LOG</div>
        {[
          ['#0248','14:42:18','50.0ms · 4.0x · low-light·G2-debug', V2.rust],
          ['#0247','14:42:11','33.0ms · 4.0x · low-light·base'],
          ['#0246','14:39:02','33.0ms · 1.0x · reference'],
          ['#0245','13:18:55','16.0ms · 1.0x · daylight'],
          ['#0244','13:18:48','16.0ms · 1.0x · daylight·ref'],
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, padding: '2px 0', color: r[3] || '#aab3c0' }}>
            <span style={{ color: '#fff', width: 38 }}>{r[0]}</span>
            <span style={{ color: '#7a8595' }}>{r[1]}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[2]}</span>
          </div>
        ))}
      </div>

      {/* Capture buttons */}
      <div style={{ padding: 10, borderTop: '1px solid #2a323d', display: 'flex', gap: 6 }}>
        <button style={{ flex: 1, padding: '7px 0', border: 0, borderRadius: 3, background: V2.rust, color: '#fff', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>● CAPTURE</button>
        <button style={{ flex: 1, padding: '7px 0', border: '1px solid #3a4452', borderRadius: 3, background: 'transparent', color: '#d8dce3', fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer' }}>SEQ ×10</button>
      </div>
    </section>
  );
}

function V2Slider({ label, unit, value, pct }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aab3c0', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{value}<span style={{ color: '#7a8595', marginLeft: 2 }}>{unit}</span></span>
      </div>
      <div style={{ height: 4, background: '#2a323d', borderRadius: 2, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: V2.rust, borderRadius: 2 }}/>
        <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, background: '#fff', borderRadius: '50%' }}/>
      </div>
    </div>
  );
}

Object.assign(window, { V2, V2Frame, V2Titlebar, V2Sidebar, V2ChatPane, V2CameraPane });
