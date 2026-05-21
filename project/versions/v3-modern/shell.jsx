// Variation 3 — Modern hybrid (Linear/Vercel restraint + warm palette).
// Cleaner, less border-heavy, generous whitespace. Sidebar is a thin icon
// rail + a contextual second panel. Main pane is split chat / camera with
// a top "command bar" instead of breadcrumbs.

const V3 = {
  bg: '#fbf9f4',
  rail: '#1c1a14',
  panel2: '#f3eee3',
  card: '#ffffff',
  border: '#ece5d3',
  borderSoft: '#f3edde',
  ink: '#1c1a14',
  ink2: '#5d574a',
  ink3: '#9b9486',
  rust: '#c96442',
  rustSoft: '#f4dcc9',
};

function V3Frame({ children, label }) {
  return <div className="app-frame" style={{ background: V3.bg, fontFamily: 'var(--sans)' }} data-screen-label={label}>{children}</div>;
}

function V3Titlebar() {
  return (
    <div className="titlebar" style={{ background: 'transparent', borderBottom: 'none', height: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
        <Icon name="chevR" size={11} color={V3.ink3}/>
      </div>
      <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: V3.ink2 }}>
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, color: V3.ink }}>Orca</span>
        <span style={{ color: V3.ink3 }}>·</span>
        <span style={{ fontFamily: 'var(--mono)' }}>cam-validation-v3</span>
        <span className="kbd" style={{ marginLeft: 8, fontSize: 10 }}>⌘K</span>
      </div>
      <WinControls/>
    </div>
  );
}

function V3IconRail() {
  const items = [
    { i: 'chat', a: true },
    { i: 'folder' },
    { i: 'flask' },
    { i: 'cpu' },
    { i: 'bolt' },
  ];
  return (
    <aside style={{ width: 52, flex: '0 0 auto', background: V3.rail, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4 }}>
      <div style={{ width: 28, height: 28, background: V3.rust, borderRadius: 8, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>O</div>
      {items.map(it => (
        <button key={it.i} style={{ width: 36, height: 36, border: 0, background: it.a ? 'rgba(255,255,255,.12)' : 'transparent', color: it.a ? '#fff' : 'rgba(255,255,255,.5)', borderRadius: 8, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <Icon name={it.i} size={16}/>
        </button>
      ))}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <button style={{ width: 36, height: 36, border: 0, background: 'transparent', color: 'rgba(255,255,255,.5)', borderRadius: 8, cursor: 'pointer' }}><Icon name="settings" size={15}/></button>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#c96442', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 600, fontSize: 11 }}>JK</div>
      </div>
    </aside>
  );
}

function V3SecondPanel() {
  const sessions = [
    { t: 'Low-light SNR @ G2 channel', sub: '14m · 7 turns · in progress', a: true, status: 'amber' },
    { t: 'AE convergence delay analysis', sub: '2h · 12 turns', status: 'green' },
    { t: 'Capture batch — 240 frames', sub: 'Yesterday · 4 turns', status: 'green' },
    { t: 'IR cut filter verification', sub: '2d · 9 turns', status: 'green' },
    { t: '센서 EVS 캘리브레이션', sub: '4d · 23 turns', status: 'green' },
    { t: '전류 소비 vs FPS 트레이드오프', sub: '1w · 6 turns', status: 'green' },
  ];
  const pinned = [
    { t: '저조도 캡처 시퀀스', cmd: '/capture sweep --exposure=10..200ms --gain=4x', icon: 'capture' },
    { t: 'ColorChecker 검출', cmd: '/skill color-checker --auto', icon: 'sparkle' },
  ];
  return (
    <div style={{ width: 268, flex: '0 0 auto', background: V3.panel2, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 10px' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 600, color: V3.ink, letterSpacing: -0.3 }}>cam-validation-v3</div>
        <div style={{ fontSize: 11.5, color: V3.ink3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dot green"/> Claude · sonnet-4.5
          <span style={{ marginLeft: 'auto' }}>248 캡처</span>
        </div>
      </div>

      <div style={{ padding: '0 12px' }}>
        <button style={{ width: '100%', padding: '8px 12px', border: `1px solid ${V3.border}`, background: V3.card, borderRadius: 8, fontSize: 12.5, color: V3.ink, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="plus" size={13}/> 새 대화
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <span className="kbd" style={{ fontSize: 10 }}>⌘</span><span className="kbd" style={{ fontSize: 10 }}>N</span>
          </span>
        </button>
      </div>

      <div style={{ padding: '14px 16px 6px', fontSize: 10.5, fontWeight: 600, color: V3.ink3, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', justifyContent: 'space-between' }}>
        <span>고정된 명령</span>
      </div>
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pinned.map(p => (
          <div key={p.t} style={{ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={p.icon} size={13} color={V3.rust}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: V3.ink, fontWeight: 500 }}>{p.t}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: V3.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cmd}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 16px 6px', fontSize: 10.5, fontWeight: 600, color: V3.ink3, textTransform: 'uppercase', letterSpacing: 0.5 }}>대화</div>
      <div style={{ padding: '0 8px', flex: 1, overflow: 'hidden' }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: s.a ? V3.card : 'transparent', boxShadow: s.a ? '0 1px 3px rgba(0,0,0,.04)' : 'none', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`dot ${s.status}`}/>
              <span style={{ fontSize: 12.5, color: V3.ink, fontWeight: s.a ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.t}</span>
            </div>
            <div style={{ fontSize: 11, color: V3.ink3, marginTop: 2, paddingLeft: 13 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function V3ChatPane() {
  return (
    <section style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="scroll" style={{ flex: 1, padding: '24px 36px 12px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <V3Msg kind="user">저조도 환경에서 G2 채널의 SNR이 G1보다 약 1.4dB 낮게 측정됩니다. 우선 캡처를 10장 받아서 채널별 통계를 봐줘.</V3Msg>
        <V3Msg kind="claude">
          <p>OV-9282 / Rev.C 보드 연결 확인했습니다. 캡처 시퀀스 시작합니다.</p>
          <V3Tool name="hardware.capture" args="frames=10, exposure_ms=33, gain=4x" status="done" duration="3.2s"/>
          <V3Tool name="analysis.bayer_split" args="pattern=RGGB, dark_subtract=true" status="done" duration="0.8s"/>
          <p>채널별 평균 / 표준편차 / SNR입니다:</p>
          <V3Table/>
          <p>G2 노이즈가 G1 대비 <b>+1.42 dB</b>로 일관되게 측정됩니다. row-noise 패턴 의심. 라이브 뷰에서 G2-only 디버그 모드 켜고 같이 보시죠.</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button style={chip3}><Icon name="capture" size={11}/> 다시 캡처</button>
            <button style={chip3}><Icon name="copy" size={11}/> 데이터 복사</button>
            <button style={chip3}><Icon name="download" size={11}/> CSV</button>
          </div>
        </V3Msg>
        <V3Msg kind="user">디버그 모드 켜고 노출도 50ms로 올려봐.</V3Msg>
        <V3Msg kind="claude" running>
          <V3Tool name="hardware.set_debug_channel" args="channel=G2_only" status="done" duration="0.1s"/>
          <V3Tool name="hardware.set_exposure" args="value_ms=50" status="running"/>
        </V3Msg>
      </div>

      <div style={{ padding: '8px 36px 20px' }}>
        <div style={{ background: V3.card, border: `1px solid ${V3.border}`, borderRadius: 14, boxShadow: '0 4px 24px rgba(28,26,20,.05), 0 1px 3px rgba(28,26,20,.04)' }}>
          <div style={{ padding: '12px 14px 4px', minHeight: 40, color: V3.ink3, fontSize: 13.5 }}>Orca에게 메시지 보내기…</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px 10px' }}>
            <button style={chip3}><Icon name="plus" size={12}/></button>
            <button style={chip3}><Icon name="cam" size={12}/> 현재 프레임</button>
            <button style={chip3}><Icon name="bolt" size={12}/> Skill</button>
            <button style={chip3}>@</button>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: V3.ink2, padding: '3px 9px', border: `1px solid ${V3.border}`, borderRadius: 999 }}>
                <span className="dot green"/> claude-code · sonnet-4.5
                <Icon name="chevD" size={9} color={V3.ink3}/>
              </span>
              <button style={{ width: 32, height: 32, borderRadius: 8, border: 0, background: V3.ink, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <Icon name="send" size={14} color="#fff"/>
              </button>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const chip3 = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: `1px solid ${V3.border}`, background: 'transparent', borderRadius: 999, color: V3.ink2, fontSize: 11.5, cursor: 'pointer' };

function V3Msg({ kind, children, running }) {
  if (kind === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '78%', background: V3.rustSoft, color: V3.ink, padding: '10px 14px', borderRadius: '14px 14px 4px 14px', fontSize: 13.5, lineHeight: 1.55 }}>{children}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Avatar kind="claude" size={28}/>
      <div style={{ flex: 1, paddingTop: 2, fontSize: 13.5, color: V3.ink, lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {running && <span style={{ fontSize: 11, color: V3.ink3, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span className="dot amber"/> 도구 실행 중…</span>}
        {children}
      </div>
    </div>
  );
}

function V3Tool({ name, args, status, duration }) {
  const tone = status === 'done' ? 'green' : 'amber';
  return (
    <div style={{ background: V3.card, border: `1px solid ${V3.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: 'var(--mono)', borderBottom: status === 'done' ? `1px solid ${V3.borderSoft}` : 'none' }}>
        <span className={`dot ${tone}`}/>
        <span style={{ fontWeight: 600, color: V3.rust }}>{name}</span>
        <span style={{ color: V3.ink3 }}>({args})</span>
        <span style={{ marginLeft: 'auto', color: V3.ink3, fontFamily: 'var(--sans)', fontSize: 11 }}>
          {status === 'done' ? `완료 · ${duration}` : '실행 중…'}
        </span>
      </div>
    </div>
  );
}

function V3Table() {
  const rows = [['R',108.3,4.21,32.4],['G1',142.7,4.04,34.1],['G2',141.9,4.79,32.7],['B',95.6,4.18,31.9]];
  return (
    <div style={{ background: V3.card, border: `1px solid ${V3.border}`, borderRadius: 10, overflow: 'hidden', fontSize: 12, fontFamily: 'var(--mono)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', padding: '7px 14px', background: V3.borderSoft, color: V3.ink2, fontSize: 11, fontFamily: 'var(--sans)', fontWeight: 500 }}>
        <span>채널</span><span>μ (DN)</span><span>σ</span><span>SNR (dB)</span>
      </div>
      {rows.map((r,i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', padding: '7px 14px', color: V3.ink, borderTop: `1px solid ${V3.borderSoft}` }}>
          <span style={{ fontWeight: 600, color: r[0] === 'G2' ? V3.rust : V3.ink }}>{r[0]}</span>
          <span>{r[1].toFixed(1)}</span>
          <span>{r[2].toFixed(2)}</span>
          <span style={{ color: r[0] === 'G2' ? V3.rust : V3.ink, fontWeight: r[0] === 'G2' ? 600 : 400 }}>{r[3].toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function V3CameraPane() {
  return (
    <section style={{ width: 440, flex: '0 0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: V3.panel2 }}>
      <div style={{ background: V3.card, borderRadius: 12, overflow: 'hidden', border: `1px solid ${V3.border}` }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${V3.borderSoft}` }}>
          <Icon name="cam" size={14} color={V3.ink2}/>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: V3.ink }}>라이브 뷰</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: V3.ink3 }}>OV-9282 · COM7</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5a8a4f' }}>
            <span className="dot green"/> 19.8 fps
          </span>
        </div>
        <div style={{ position: 'relative' }}>
          <BayerPattern width={406} height={228}/>
          <div style={{ position: 'absolute', top: 8, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'rgba(255,255,255,.85)' }}>
            <span>1280×720 · RGGB · 10b</span>
            <span style={{ color: '#e44a3a' }}>● REC 00:14</span>
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'rgba(255,255,255,.7)' }}>
            <span>EXP 50.0ms</span><span>GAIN 4.0×</span><span>T 38.4°C</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${V3.borderSoft}` }}>
          {['RGB','Bayer','R','G1','G2','B'].map((t, i) => (
            <button key={t} style={{ flex: 1, padding: '7px 0', border: 0, background: i === 0 ? V3.borderSoft : 'transparent', color: i === 0 ? V3.ink : V3.ink3, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer', borderRight: i < 5 ? `1px solid ${V3.borderSoft}` : 0 }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ background: V3.card, borderRadius: 12, padding: 14, border: `1px solid ${V3.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <V3Slider label="노출" unit="ms" value="50.0" pct={42}/>
        <V3Slider label="아날로그 게인" unit="×" value="4.00" pct={26}/>
        <V3Slider label="디지털 게인" unit="dB" value="0.0" pct={0}/>
      </div>

      <div style={{ background: V3.card, borderRadius: 12, padding: 14, border: `1px solid ${V3.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: V3.ink }}>품질 메트릭</span>
          <span style={{ fontSize: 10.5, color: V3.ink3, marginLeft: 'auto', fontFamily: 'var(--mono)' }}>capture #0248</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[['SNR','32.7','dB','warn'],['ΔG','1.42','dB','bad'],['Sharp','0.84','','ok'],['DR','58.2','dB','ok']].map(m => (
            <div key={m[0]} style={{ background: V3.borderSoft, padding: '6px 8px', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: V3.ink3 }}>{m[0]}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: m[3] === 'bad' ? V3.rust : m[3] === 'warn' ? '#c79431' : V3.ink, marginTop: 1 }}>
                {m[1]}<span style={{ fontSize: 9, color: V3.ink3, marginLeft: 2 }}>{m[2]}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${V3.borderSoft}` }}>
          <Histogram width={384} height={48}/>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button style={{ flex: 1, padding: '10px 0', border: 0, borderRadius: 10, background: V3.ink, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Icon name="capture" size={14} color="#fff"/> 캡처
        </button>
        <button style={{ flex: 1, padding: '10px 0', border: `1px solid ${V3.border}`, borderRadius: 10, background: V3.card, color: V3.ink, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>시퀀스 ×10</button>
      </div>
    </section>
  );
}

function V3Slider({ label, unit, value, pct }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: V3.ink2 }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', color: V3.ink, fontWeight: 600 }}>{value}<span style={{ color: V3.ink3, marginLeft: 2 }}>{unit}</span></span>
      </div>
      <div style={{ height: 4, background: V3.borderSoft, borderRadius: 2, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: V3.ink, borderRadius: 2 }}/>
        <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 12, height: 12, background: V3.card, border: `2px solid ${V3.ink}`, borderRadius: '50%' }}/>
      </div>
    </div>
  );
}

Object.assign(window, { V3, V3Frame, V3Titlebar, V3IconRail, V3SecondPanel, V3ChatPane, V3CameraPane });
