// V1 secondary screens — Projects dashboard, Engine settings, Skills/MCP, Capture history.

function V1Projects() {
  const projects = [
    { id: 'cam', name: 'cam-validation-v3', desc: 'OV-9282 검증, 저조도 SNR 회귀 테스트', engine: 'Claude Code', model: 'sonnet-4.5', sessions: 12, captures: 248, last: '14분 전', active: true, tone: 'green' },
    { id: 'snr', name: 'snr-regression-2026', desc: 'IMX-415 야간 모드 SNR 추적, 주간 리그레션', engine: 'OpenCode', model: 'gpt-4.1', sessions: 5, captures: 96, last: '2시간 전', tone: 'amber' },
    { id: 'aec', name: 'aec-tuning-suite', desc: '자동 노출 수렴 시간 최적화 — 차량용 캠', engine: 'Claude Code', model: 'sonnet-4.5', sessions: 8, captures: 412, last: '어제', tone: 'green' },
    { id: 'bay', name: 'bayer-debug', desc: 'Bayer pattern 디버깅 / 채널 분리 도구', engine: 'Local (llama.cpp)', model: 'qwen-coder-30b', sessions: 3, captures: 18, last: '4일 전', tone: 'slate' },
  ];
  return (
    <section style={{ flex: 1, overflow: 'auto', padding: '24px 32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: V1.ink, margin: 0, letterSpacing: -0.6 }}>프로젝트</h1>
        <span style={{ color: V1.ink3, fontSize: 13 }}>4개의 활성 워크스페이스</span>
        <button style={{ marginLeft: 'auto', padding: '7px 14px', border: 0, borderRadius: 8, background: V1.rust, color: '#fff', fontWeight: 500, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={13} color="#fff"/> 새 프로젝트
        </button>
      </div>
      <p style={{ color: V1.ink2, fontSize: 13.5, marginTop: 6, marginBottom: 22 }}>각 프로젝트는 자체 엔진, 모델, Skill/MCP, 캡처 히스토리를 가집니다.</p>

      {/* filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['모두 (4)', 'Claude Code (2)', 'OpenCode (1)', '로컬 (1)', '보관'].map((c, i) => (
          <button key={c} style={{ padding: '5px 12px', borderRadius: 999, border: i === 0 ? `1px solid ${V1.borderStrong}` : `1px solid ${V1.border}`, background: i === 0 ? V1.panel : 'transparent', color: V1.ink2, fontSize: 12, cursor: 'pointer' }}>{c}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {projects.map(p => (
          <div key={p.id} style={{ background: V1.panel, border: `1px solid ${p.active ? V1.borderStrong : V1.border}`, borderRadius: 12, padding: 16, position: 'relative' }}>
            {p.active && <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 10.5, color: V1.rust, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>활성</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className={`dot ${p.tone}`}/>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: V1.ink }}>{p.name}</span>
            </div>
            <div style={{ fontSize: 12.5, color: V1.ink2, lineHeight: 1.5, marginBottom: 12 }}>{p.desc}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: V1.ink3, marginBottom: 10 }}>
              <span><Icon name="cpu" size={11} style={{ verticalAlign: -1, marginRight: 3 }}/> {p.engine}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{p.model}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11.5, color: V1.ink2, paddingTop: 10, borderTop: `1px solid ${V1.border}` }}>
              <span><b style={{ color: V1.ink }}>{p.sessions}</b> 대화</span>
              <span><b style={{ color: V1.ink }}>{p.captures}</b> 캡처</span>
              <span style={{ marginLeft: 'auto', color: V1.ink3 }}>{p.last}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function V1EngineSettings() {
  const engines = [
    { id: 'cc', name: 'Claude Code', kind: 'CLI · Anthropic', cmd: 'claude-code --workdir ./cam-validation-v3', status: 'connected', models: ['claude-sonnet-4.5', 'claude-opus-4.1', 'claude-haiku-4.5'], active: true, version: 'v0.42.1', tone: 'green' },
    { id: 'oc', name: 'OpenCode', kind: 'CLI · sst.dev', cmd: 'opencode run', status: 'connected', models: ['gpt-4.1', 'gpt-5-codex', 'gemini-2.5-pro'], version: 'v1.18.0', tone: 'green' },
    { id: 'lc', name: 'Local · llama.cpp', kind: 'OpenAI-compatible API', cmd: 'http://127.0.0.1:8080/v1', status: 'idle', models: ['qwen-coder-30b', 'devstral-24b'], version: 'b5024', tone: 'slate' },
    { id: 'cu', name: 'Custom endpoint', kind: 'OpenAI-compatible', cmd: 'https://api.together.xyz/v1', status: 'error', error: '401 Unauthorized — API 키 확인 필요', models: ['qwen-2.5-coder-72b'], version: '—', tone: 'red' },
  ];
  return (
    <section style={{ flex: 1, overflow: 'auto', padding: '24px 32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 4 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: V1.ink, margin: 0, letterSpacing: -0.6 }}>엔진 & 모델</h1>
        <span style={{ color: V1.ink3, fontSize: 13 }}>백엔드 CLI 및 API 엔드포인트</span>
        <button style={{ marginLeft: 'auto', padding: '7px 14px', border: `1px solid ${V1.borderStrong}`, borderRadius: 8, background: V1.panel, color: V1.ink, fontWeight: 500, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={13}/> 엔진 추가
        </button>
      </div>
      <p style={{ color: V1.ink2, fontSize: 13.5, marginTop: 6, marginBottom: 22 }}>프로젝트마다 엔진을 따로 지정할 수 있습니다. 세션 안에서 <span className="kbd">⌘</span> <span className="kbd">⇧</span> <span className="kbd">M</span>으로 전환됩니다.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {engines.map(e => (
          <div key={e.id} style={{ background: V1.panel, border: `1px solid ${e.active ? V1.borderStrong : V1.border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: e.tone === 'green' ? '#e8f1e3' : e.tone === 'red' ? '#f7dad4' : '#eee9dc', display: 'grid', placeItems: 'center' }}>
                <Icon name="cpu" size={16} color={e.tone === 'red' ? '#b54a3a' : e.tone === 'green' ? '#5a8a4f' : V1.ink2}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: V1.ink }}>{e.name}</span>
                  <span style={{ fontSize: 11, color: V1.ink3 }}>{e.kind}</span>
                  {e.active && <span style={{ fontSize: 10, color: V1.rust, fontWeight: 600, padding: '1px 6px', background: V1.rustSoft, borderRadius: 3, letterSpacing: 0.4 }}>현재 프로젝트</span>}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: V1.ink2, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.cmd}</div>
              </div>
              <Status tone={e.tone} label={e.status === 'connected' ? '연결됨' : e.status === 'idle' ? '대기' : '오류'}/>
              <span style={{ fontSize: 11, color: V1.ink3, fontFamily: 'var(--mono)' }}>{e.version}</span>
              <button style={{ ...iconBtn1 }}><Icon name="settings" size={13}/></button>
            </div>
            {e.error && <div style={{ marginTop: 10, padding: '7px 12px', background: '#fbe9e2', border: '1px solid #f0c9b8', borderRadius: 6, fontSize: 11.5, color: '#a0432e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="alert" size={11} color="#a0432e"/> {e.error}
            </div>}
            <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {e.models.map((m, i) => (
                <span key={m} style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 8px', background: i === 0 && e.active ? V1.rustSoft : 'var(--cream-50)', color: i === 0 && e.active ? V1.rust : V1.ink2, borderRadius: 4, fontWeight: i === 0 && e.active ? 600 : 400 }}>
                  {i === 0 && e.active ? '✓ ' : ''}{m}
                </span>
              ))}
              <button style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', border: `1px dashed ${V1.borderStrong}`, color: V1.ink3, borderRadius: 4, cursor: 'pointer' }}>+ 모델</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function V1SkillsMcp() {
  const skills = [
    { name: 'bayer-analysis', desc: 'RAW 프레임을 채널별로 분리하고 SNR/DR 계산', enabled: true, type: 'skill' },
    { name: 'mtf-sfr', desc: 'Slanted-edge MTF / SFR 계산 (ISO 12233)', enabled: true, type: 'skill' },
    { name: 'capture-batch', desc: '시퀀스 캡처 헬퍼 (노출 sweep, gain sweep)', enabled: true, type: 'skill' },
    { name: 'flat-field', desc: 'Flat field 보정 / vignetting 분석', enabled: false, type: 'skill' },
    { name: 'color-checker', desc: 'X-Rite 차트 자동 검출 + ΔE 계산', enabled: false, type: 'skill' },
  ];
  const mcps = [
    { name: 'cam-board-mcp', cmd: 'node ./mcp/board-server.js', tools: 14, status: 'green', enabled: true },
    { name: 'github', cmd: 'mcp-server-github', tools: 8, status: 'green', enabled: true },
    { name: 'jira-validation', cmd: 'mcp-jira --project=CAMVAL', tools: 6, status: 'amber', enabled: false },
  ];

  return (
    <section style={{ flex: 1, overflow: 'auto', padding: '24px 32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: V1.ink, margin: 0, letterSpacing: -0.6 }}>Skills & MCP</h1>
        <span style={{ color: V1.ink3, fontSize: 13 }}>Claude가 사용할 수 있는 도구</span>
      </div>
      <p style={{ color: V1.ink2, fontSize: 13.5, marginTop: 6, marginBottom: 22 }}><b>cam-validation-v3</b> 프로젝트에 설치된 항목입니다.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 22 }}>
        <div>
          <SectionHead1 title="Skills" count="3 / 5 활성" action="설치"/>
          <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {skills.map((s, i) => (
              <div key={s.name} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < skills.length - 1 ? `1px solid ${V1.border}` : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--cream-50)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="bolt" size={14} color={s.enabled ? V1.rust : V1.ink3}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: s.enabled ? V1.ink : V1.ink3 }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: V1.ink2, marginTop: 1 }}>{s.desc}</div>
                </div>
                <Toggle1 on={s.enabled}/>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHead1 title="MCP 서버" count="2 / 3 연결됨" action="추가"/>
          <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {mcps.map((m, i) => (
              <div key={m.name} style={{ padding: '12px 14px', borderBottom: i < mcps.length - 1 ? `1px solid ${V1.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`dot ${m.status}`}/>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: V1.ink }}>{m.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: V1.ink3 }}>{m.tools} 툴</span>
                  <Toggle1 on={m.enabled}/>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: V1.ink2, marginTop: 4, paddingLeft: 17 }}>{m.cmd}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <SectionHead1 title="권한" count="" action=""/>
            <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 12, padding: 14, fontSize: 12.5 }}>
              <PermRow1 label="하드웨어 보드 제어" desc="capture, set_exposure, set_gain"/>
              <PermRow1 label="파일 시스템 (워크스페이스)" desc="cam-validation-v3/ 안에서만"/>
              <PermRow1 label="네트워크" desc="회사 GitLab + 로컬 MCP만 허용"/>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHead1({ title, count, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: V1.ink }}>{title}</span>
      {count && <span style={{ fontSize: 12, color: V1.ink3 }}>{count}</span>}
      {action && <button style={{ marginLeft: 'auto', fontSize: 12, color: V1.rust, border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>+ {action}</button>}
    </div>
  );
}
function Toggle1({ on }) {
  return (
    <div style={{ width: 30, height: 17, background: on ? V1.rust : V1.borderStrong, borderRadius: 9, position: 'relative', flex: '0 0 auto', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 1.5, left: on ? 14.5 : 1.5, width: 14, height: 14, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s' }}/>
    </div>
  );
}
function PermRow1({ label, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <Icon name="check" size={13} color="#5a8a4f"/>
      <div style={{ flex: 1 }}>
        <div style={{ color: V1.ink, fontWeight: 500 }}>{label}</div>
        <div style={{ color: V1.ink3, fontSize: 11.5 }}>{desc}</div>
      </div>
      <button style={{ fontSize: 11, color: V1.ink3, border: 0, background: 'transparent', cursor: 'pointer' }}>편집</button>
    </div>
  );
}

function V1Captures() {
  const captures = [
    { id: '0248', t: '14:42:18', exp: 50.0, gain: 4.0, tag: 'low-light · G2-debug', metrics: { snr: 32.7, sharp: 0.84 } },
    { id: '0247', t: '14:42:11', exp: 33.0, gain: 4.0, tag: 'low-light · baseline', metrics: { snr: 30.4, sharp: 0.81 } },
    { id: '0246', t: '14:39:02', exp: 33.0, gain: 1.0, tag: 'reference', metrics: { snr: 41.2, sharp: 0.92 } },
    { id: '0245', t: '13:18:55', exp: 16.0, gain: 1.0, tag: 'daylight', metrics: { snr: 43.1, sharp: 0.94 } },
    { id: '0244', t: '13:18:48', exp: 16.0, gain: 1.0, tag: 'daylight · ref', metrics: { snr: 42.8, sharp: 0.93 } },
    { id: '0243', t: '11:02:14', exp: 16.0, gain: 2.0, tag: 'colorchecker', metrics: { snr: 38.9, sharp: 0.88 } },
  ];
  return (
    <section style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* List */}
      <div style={{ width: 320, borderRight: `1px solid ${V1.border}`, background: V1.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${V1.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="flask" size={15}/>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, color: V1.ink }}>캡처 히스토리</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: V1.ink3 }}>248개</span>
          </div>
          <div style={{ marginTop: 8, position: 'relative' }}>
            <Icon name="search" size={12} style={{ position: 'absolute', left: 8, top: 7 }} color={V1.ink3}/>
            <input placeholder="태그, ID, 날짜로 필터" style={{ width: '100%', padding: '5px 8px 5px 24px', border: `1px solid ${V1.border}`, borderRadius: 6, background: V1.panel, fontSize: 12, fontFamily: 'inherit' }}/>
          </div>
        </div>
        <div className="scroll" style={{ flex: 1 }}>
          {captures.map((c, i) => (
            <div key={c.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${V1.border}`, background: i === 0 ? V1.rustSoft : 'transparent', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: V1.ink }}>#{c.id}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: V1.ink3 }}>{c.t}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: V1.ink3, fontFamily: 'var(--mono)' }}>{c.exp}ms · {c.gain}×</span>
              </div>
              <div style={{ fontSize: 11.5, color: V1.ink2, marginTop: 2 }}>{c.tag}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10.5, color: V1.ink3, fontFamily: 'var(--mono)' }}>
                <span>SNR <b style={{ color: V1.ink2 }}>{c.metrics.snr}</b></span>
                <span>Sh <b style={{ color: V1.ink2 }}>{c.metrics.sharp}</b></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: V1.sidebar }}>
        <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${V1.border}`, background: V1.bg, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: V1.ink }}>capture #0248</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: V1.ink3 }}>2026-05-08 · 14:42:18 KST</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button style={chip1}><Icon name="download" size={12}/> RAW</button>
            <button style={chip1}><Icon name="copy" size={12}/> 채팅에 첨부</button>
            <button style={chip1}><Icon name="trash" size={12}/></button>
          </span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
          {/* Image + AI panel */}
          <div>
            <div style={{ background: '#0c0f12', borderRadius: 10, padding: 10, border: `1px solid ${V1.border}` }}>
              <BayerPattern width={520} height={300}/>
            </div>
            <div style={{ marginTop: 12, background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar kind="claude" size={20}/>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 13.5, fontWeight: 600, color: V1.ink }}>Claude의 분석</span>
                <span style={{ fontSize: 10.5, color: V1.ink3, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="sparkle" size={10}/> 4.2초 · sonnet-4.5
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: V1.ink, lineHeight: 1.6 }}>
                <p style={{ margin: '4px 0' }}>저조도 환경에서 캡처한 ColorChecker 차트입니다. 다음을 관찰했습니다:</p>
                <ul style={{ margin: '4px 0', paddingLeft: 18, color: V1.ink2 }}>
                  <li><b style={{ color: V1.ink }}>G2 채널의 노이즈가 G1 대비 1.42 dB 높음</b> — 행 단위 fixed-pattern noise 특성을 보입니다.</li>
                  <li>좌측 하단 그레이 패치(#19)에서 약간의 컬러 캐스트(파란 쪽으로 약 ΔE 2.1) 관찰됨.</li>
                  <li>중앙 sharpness는 양호, 코너에서 14% 저하 — 기대 범위 내.</li>
                </ul>
                <p style={{ margin: '6px 0 0' }}>다음 단계: gain을 1×로 낮춰서 동일 조건 캡처해 row-noise가 분석/디지털 게인에서 발생하는지 확인해보면 좋겠습니다.</p>
              </div>
            </div>
          </div>

          {/* Metrics column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: V1.ink2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>품질 메트릭</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <V1Metric label="SNR" value="32.7" unit="dB" tone="warn"/>
                <V1Metric label="Δ G1−G2" value="1.42" unit="dB" tone="bad"/>
                <V1Metric label="Sharpness" value="0.84" tone="ok"/>
                <V1Metric label="DR" value="58.2" unit="dB" tone="ok"/>
                <V1Metric label="ΔE avg" value="2.1" tone="warn"/>
                <V1Metric label="MTF50" value="0.31" tone="ok"/>
              </div>
            </div>
            <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: V1.ink2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>채널 히스토그램</div>
              <Histogram width={280} height={70}/>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: V1.ink3, fontFamily: 'var(--mono)' }}>
                <span>R 108.3</span><span>G1 142.7</span><span>G2 141.9</span><span>B 95.6</span>
              </div>
            </div>
            <div style={{ background: V1.panel, border: `1px solid ${V1.border}`, borderRadius: 10, padding: 12, fontSize: 11.5, color: V1.ink2, lineHeight: 1.6, fontFamily: 'var(--mono)' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: V1.ink2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>EXIF · 메타</div>
              exposure: 50.000ms<br/>
              gain_a: 4.0×<br/>
              gain_d: 0.0 dB<br/>
              pattern: RGGB<br/>
              bit_depth: 10<br/>
              sensor_temp: 38.4°C<br/>
              session: <span style={{ color: V1.rust }}>low-light SNR @ G2</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { V1Projects, V1EngineSettings, V1SkillsMcp, V1Captures });
