// electron-mockup.jsx — All UI for the Electron 구현 목업 page.
// One file (~1k lines) so edits stay in one place.

const E = {
  bg: '#fbf9f4',
  paper: '#ffffff',
  paper2: '#f7f3eb',
  border: '#ebe3d0',
  borderStrong: '#ddd2b6',
  ink: '#29261b',
  ink2: '#6b6452',
  ink3: '#a8a092',
  rust: '#c96442',
  rustSoft: '#f4dcc9',
  good: '#5a8a4f',
  warn: '#c79431',
  bad: '#b54a3a',
  code: '#231f1a',
  codeText: '#e8e1d0',
};

// ─── small primitives ──────────────────────────────────────────────────────

function Section({ id, num, title, sub, children }) {
  return (
    <section id={id} style={{ borderTop: `1px solid ${E.border}`, padding: '52px 0 8px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 40px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: E.rust, fontWeight: 600, letterSpacing: 1.2, marginBottom: 8 }}>§ {num}</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 600, color: E.ink, margin: 0, letterSpacing: -0.6 }}>{title}</h2>
        {sub && <p style={{ fontSize: 14.5, color: E.ink2, margin: '8px 0 0', maxWidth: 720, lineHeight: 1.55 }}>{sub}</p>}
        <div style={{ marginTop: 28 }}>{children}</div>
      </div>
    </section>
  );
}

function Pill({ tone = 'rust', children }) {
  const colors = {
    rust: { bg: E.rustSoft, fg: E.rust },
    ink: { bg: '#1c1a14', fg: '#fff' },
    moss: { bg: '#e3eadb', fg: '#5a8a4f' },
    slate: { bg: '#e8e3d4', fg: E.ink2 },
    blue: { bg: '#dde5f0', fg: '#3a5b8c' },
  }[tone];
  return <span style={{ display: 'inline-block', padding: '2px 8px', background: colors.bg, color: colors.fg, fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600, borderRadius: 4, letterSpacing: 0.3 }}>{children}</span>;
}

function K({ children }) {
  return <code style={{ fontFamily: 'var(--mono)', fontSize: '0.9em', padding: '1px 5px', background: E.paper2, border: `1px solid ${E.border}`, borderRadius: 3, color: E.ink }}>{children}</code>;
}

// ─── header / TOC ──────────────────────────────────────────────────────────

function Header() {
  return (
    <header style={{ padding: '64px 40px 48px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: E.rust, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 20 }}>O</div>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: E.ink, letterSpacing: -0.2 }}>Orca for Windows</div>
          <div style={{ fontSize: 12, color: E.ink2, marginTop: 1 }}>Electron 구현 목업 · v0.1 · 2026-05-08</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Pill tone="ink">Electron 32</Pill>
          <Pill tone="slate">Vite + React 18</Pill>
          <Pill tone="moss">TypeScript</Pill>
        </div>
      </div>

      <h1 style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 600, color: E.ink, margin: 0, letterSpacing: -1.6, lineHeight: 1.05 }}>
        검증 엔지니어를 위한<br/>
        <span style={{ color: E.rust }}>데스크톱 어시스턴트</span>의 구조
      </h1>
      <p style={{ fontSize: 16, color: E.ink2, marginTop: 18, maxWidth: 680, lineHeight: 1.6 }}>
        Claude Code / OpenCode CLI를 백엔드 엔진으로, 카메라 보드를 제어하는 네이티브 어댑터를 가진 Windows 데스크톱 앱.
        이 문서는 Electron 기반 프론트엔드의 <b>구현 목업</b>입니다 — 디렉터리 구조, 프로세스 분리, IPC 계약, 빌드 / 배포 흐름까지.
      </p>

      <div style={{ marginTop: 36, padding: 20, background: E.paper, border: `1px solid ${E.border}`, borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
        {[
          { k: '메인 프로세스', v: 'Node + Electron API · 윈도우 / 트레이 / 자동 업데이트' },
          { k: '엔진 어댑터', v: 'CLI를 자식 프로세스로 spawn · stdout JSONL 스트리밍' },
          { k: '하드웨어 어댑터', v: 'libusb / serialport · 네이티브 N-API 모듈' },
          { k: '렌더러', v: 'React + Vite · contextIsolation 안에서 동작' },
        ].map((it, i) => (
          <div key={i} style={{ padding: '0 16px', borderRight: i < 3 ? `1px solid ${E.border}` : 'none' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: E.rust, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>{it.k}</div>
            <div style={{ fontSize: 12.5, color: E.ink, marginTop: 5, lineHeight: 1.45 }}>{it.v}</div>
          </div>
        ))}
      </div>
    </header>
  );
}

// ─── 1. Architecture diagram ───────────────────────────────────────────────

function Arch() {
  return (
    <Section id="arch" num="01" title="아키텍처 한눈에" sub="Electron의 4-프로세스 모델 안에서 책임을 분리합니다. 렌더러는 UI만 그리고, 엔진과 하드웨어는 메인 프로세스의 어댑터를 통해서만 닿을 수 있습니다.">
      <div style={{ background: E.paper, border: `1px solid ${E.border}`, borderRadius: 14, padding: 32, position: 'relative' }}>
        <ArchSvg/>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { tag: '신뢰 경계', t: 'Renderer는 sandbox + contextIsolation. preload의 화이트리스트 외에는 Node API에 닿을 수 없습니다.' },
          { tag: '스트리밍', t: '엔진/카메라 모두 line-delimited JSON으로 흘립니다. 백프레셔는 메인 측 큐에서 처리.' },
          { tag: '권한', t: 'capture / set_exposure 같은 하드웨어 동작은 프로젝트 단위 ACL을 메인에서 검사 후에만 실행.' },
        ].map((c, i) => (
          <div key={i} style={{ padding: 14, background: E.paper2, borderRadius: 8 }}>
            <Pill tone="rust">{c.tag}</Pill>
            <div style={{ fontSize: 12.5, color: E.ink, marginTop: 8, lineHeight: 1.55 }}>{c.t}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ArchSvg() {
  // Layout: renderer (top) ↔ preload (bridge) ↔ main (mid) → engine subprocess (bottom-left) + hw native (bottom-right) + filesystem (bottom-mid)
  const W = 1000, H = 480;
  const box = (x, y, w, h, fill, stroke) => ({ x, y, w, h, fill, stroke });
  const rendererBox = box(40, 20, W - 80, 96, '#fff', E.borderStrong);
  const preloadBox = box(W / 2 - 130, 138, 260, 38, E.rustSoft, E.rust);
  const mainBox = box(40, 198, W - 80, 100, '#fff', E.borderStrong);
  const engineBox = box(40, 340, 280, 120, '#1c1a14', '#1c1a14');
  const hwBox = box(W - 320, 340, 280, 120, '#1c1a14', '#1c1a14');
  const fsBox = box(W / 2 - 130, 360, 260, 80, E.paper2, E.borderStrong);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', fontFamily: 'var(--sans)' }}>
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill={E.ink2}/>
        </marker>
        <pattern id="dotgrid" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.6" fill={E.border}/>
        </pattern>
      </defs>

      {/* Renderer */}
      <rect {...rendererBox} rx="10" strokeWidth="1.2"/>
      <text x="60" y="44" fontSize="12" fontFamily="var(--mono)" fontWeight="600" fill={E.rust}>RENDERER · Chromium · sandbox</text>
      <text x="60" y="64" fontSize="15" fontFamily="var(--serif)" fontWeight="600" fill={E.ink}>React UI (Vite)</text>
      <text x="60" y="84" fontSize="12" fill={E.ink2}>채팅 · 카메라 뷰어 · 슬라이더 · 캡처 히스토리 · Skill / MCP 패널</text>
      <text x="60" y="102" fontSize="11" fontFamily="var(--mono)" fill={E.ink3}>contextIsolation: true   nodeIntegration: false   sandbox: true</text>

      {/* Preload bridge */}
      <rect {...preloadBox} rx="6" strokeWidth="1.2"/>
      <text x={W/2} y="161" fontSize="12" fontFamily="var(--mono)" fontWeight="600" fill={E.rust} textAnchor="middle">preload.ts · contextBridge → window.orca</text>

      {/* Arrows renderer ↔ preload ↔ main */}
      <line x1={W/2} y1="116" x2={W/2} y2="138" stroke={E.ink2} strokeWidth="1.2" markerEnd="url(#arr)"/>
      <line x1={W/2 + 8} y1="176" x2={W/2 + 8} y2="198" stroke={E.ink2} strokeWidth="1.2" markerEnd="url(#arr)"/>
      <line x1={W/2 - 8} y1="198" x2={W/2 - 8} y2="176" stroke={E.ink2} strokeWidth="1.2" markerEnd="url(#arr)"/>
      <text x={W/2 + 14} y="190" fontSize="10" fontFamily="var(--mono)" fill={E.ink3}>ipcRenderer.invoke / on</text>

      {/* Main */}
      <rect {...mainBox} rx="10" strokeWidth="1.2"/>
      <text x="60" y="222" fontSize="12" fontFamily="var(--mono)" fontWeight="600" fill={E.rust}>MAIN · Node 20 · ipcMain handlers</text>
      <text x="60" y="246" fontSize="15" fontFamily="var(--serif)" fontWeight="600" fill={E.ink}>Window · Tray · IPC · Engine Pool · Hardware Pool · FS · Auto-update</text>
      <text x="60" y="266" fontSize="12" fill={E.ink2}>프로젝트 ACL · 비밀 키 보관(safeStorage) · 자식 프로세스 라이프사이클 관리</text>
      <text x="60" y="284" fontSize="11" fontFamily="var(--mono)" fill={E.ink3}>src/main/*.ts</text>

      {/* Engine subprocess */}
      <rect {...engineBox} rx="10"/>
      <text x="60" y="364" fontSize="11" fontFamily="var(--mono)" fontWeight="600" fill={E.rust}>ENGINE (자식 프로세스)</text>
      <text x="60" y="386" fontSize="14" fontFamily="var(--serif)" fontWeight="600" fill="#fff">claude-code · opencode · llama.cpp</text>
      <text x="60" y="406" fontSize="11" fill="#aab3c0" fontFamily="var(--mono)">spawn(cli, [...args])</text>
      <text x="60" y="422" fontSize="11" fill="#aab3c0" fontFamily="var(--mono)">stdout: JSONL events</text>
      <text x="60" y="438" fontSize="11" fill="#aab3c0" fontFamily="var(--mono)">stdin: tool_response, abort</text>

      {/* Filesystem */}
      <rect {...fsBox} rx="10" strokeWidth="1.2"/>
      <text x={W/2} y="386" fontSize="11" fontFamily="var(--mono)" fontWeight="600" fill={E.rust} textAnchor="middle">PROJECT WORKSPACE</text>
      <text x={W/2} y="408" fontSize="13" fontFamily="var(--serif)" fontWeight="600" fill={E.ink} textAnchor="middle">~/orca/projects/{'{name}'}</text>
      <text x={W/2} y="426" fontSize="11" fill={E.ink2} textAnchor="middle" fontFamily="var(--mono)">captures/ · skills/ · .mcp.json · sessions.db</text>

      {/* HW */}
      <rect {...hwBox} rx="10"/>
      <text x={W - 300} y="364" fontSize="11" fontFamily="var(--mono)" fontWeight="600" fill={E.rust}>HARDWARE (네이티브)</text>
      <text x={W - 300} y="386" fontSize="14" fontFamily="var(--serif)" fontWeight="600" fill="#fff">orca-board.node (N-API)</text>
      <text x={W - 300} y="406" fontSize="11" fill="#aab3c0" fontFamily="var(--mono)">libusb / serialport</text>
      <text x={W - 300} y="422" fontSize="11" fill="#aab3c0" fontFamily="var(--mono)">RAW Bayer frame stream</text>
      <text x={W - 300} y="438" fontSize="11" fill="#aab3c0" fontFamily="var(--mono)">control: exp / gain / awb</text>

      {/* Arrows main → engine / hw / fs */}
      <line x1="180" y1="298" x2="180" y2="340" stroke={E.ink2} strokeWidth="1.2" markerEnd="url(#arr)"/>
      <line x1="200" y1="340" x2="200" y2="298" stroke={E.ink2} strokeWidth="1.2" markerEnd="url(#arr)"/>
      <text x="206" y="324" fontSize="10" fontFamily="var(--mono)" fill={E.ink3}>JSONL</text>

      <line x1={W - 180} y1="298" x2={W - 180} y2="340" stroke={E.ink2} strokeWidth="1.2" markerEnd="url(#arr)"/>
      <line x1={W - 200} y1="340" x2={W - 200} y2="298" stroke={E.ink2} strokeWidth="1.2" markerEnd="url(#arr)"/>
      <text x={W - 184} y="324" fontSize="10" fontFamily="var(--mono)" fill={E.ink3}>frames</text>

      <line x1={W/2} y1="298" x2={W/2} y2="360" stroke={E.ink2} strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#arr)"/>
      <text x={W/2 + 6} y="332" fontSize="10" fontFamily="var(--mono)" fill={E.ink3}>r/w</text>
    </svg>
  );
}

// ─── 2. Project tree ───────────────────────────────────────────────────────

function FileTree() {
  const tree = [
    { d: 0, k: 'dir', n: 'orca/' },
    { d: 1, k: 'file', n: 'package.json', c: 'electron-builder · vite · ts' },
    { d: 1, k: 'file', n: 'electron-builder.yml', c: 'NSIS · MSIX · code-signing' },
    { d: 1, k: 'file', n: 'tsconfig.json' },
    { d: 1, k: 'file', n: 'vite.config.ts', c: '두 개의 빌드 — main / renderer' },
    { d: 1, k: 'dir', n: 'src/' },
    { d: 2, k: 'dir', n: 'main/', c: 'Node side — privileged' },
    { d: 3, k: 'file', n: 'index.ts', c: 'app.whenReady · createWindow · tray' },
    { d: 3, k: 'file', n: 'window.ts', c: 'BrowserWindow + frameless chrome' },
    { d: 3, k: 'file', n: 'ipc.ts', c: 'ipcMain.handle / on registry' },
    { d: 3, k: 'file', n: 'tray.ts' },
    { d: 3, k: 'file', n: 'updater.ts', c: 'electron-updater · GH releases' },
    { d: 3, k: 'file', n: 'safe-storage.ts', c: 'API 키, MCP 시크릿' },
    { d: 3, k: 'dir', n: 'engines/', c: '엔진 어댑터 — CLI subprocess' },
    { d: 4, k: 'file', n: 'engine.ts', c: 'EngineAdapter 인터페이스' },
    { d: 4, k: 'file', n: 'claude-code.ts' },
    { d: 4, k: 'file', n: 'opencode.ts' },
    { d: 4, k: 'file', n: 'openai-compat.ts', c: '로컬 / API URL 입력형' },
    { d: 4, k: 'file', n: 'pool.ts', c: '프로젝트당 1세션' },
    { d: 3, k: 'dir', n: 'hardware/', c: '카메라 보드 어댑터' },
    { d: 4, k: 'file', n: 'board.ts', c: 'BoardAdapter 인터페이스' },
    { d: 4, k: 'file', n: 'orca-board.ts', c: 'orca-board.node 래퍼' },
    { d: 4, k: 'file', n: 'frame-stream.ts', c: 'Bayer→RGB 디바이어' },
    { d: 4, k: 'file', n: 'metrics.ts', c: 'SNR · MTF · histogram' },
    { d: 3, k: 'dir', n: 'projects/', c: '워크스페이스 / DB' },
    { d: 4, k: 'file', n: 'store.ts', c: 'sessions.db (SQLite via better-sqlite3)' },
    { d: 4, k: 'file', n: 'acl.ts', c: '프로젝트별 권한 매트릭스' },
    { d: 2, k: 'dir', n: 'preload/', c: 'contextIsolation 브리지 (sandbox)' },
    { d: 3, k: 'file', n: 'preload.ts', c: 'window.orca = { ... }' },
    { d: 3, k: 'file', n: 'orca-api.d.ts', c: '렌더러용 타입 선언' },
    { d: 2, k: 'dir', n: 'renderer/', c: 'React UI — 우리가 디자인한 것' },
    { d: 3, k: 'file', n: 'main.tsx' },
    { d: 3, k: 'file', n: 'App.tsx' },
    { d: 3, k: 'dir', n: 'features/' },
    { d: 4, k: 'dir', n: 'chat/' },
    { d: 4, k: 'dir', n: 'camera/' },
    { d: 4, k: 'dir', n: 'projects/' },
    { d: 4, k: 'dir', n: 'engine-settings/' },
    { d: 4, k: 'dir', n: 'skills-mcp/' },
    { d: 4, k: 'dir', n: 'captures/' },
    { d: 3, k: 'dir', n: 'shared/', c: 'atoms · tokens · icons' },
    { d: 2, k: 'dir', n: 'shared/', c: '메인↔렌더러 공유 타입' },
    { d: 3, k: 'file', n: 'ipc-channels.ts' },
    { d: 3, k: 'file', n: 'engine-events.ts' },
    { d: 1, k: 'dir', n: 'native/', c: 'C++ 네이티브 모듈' },
    { d: 2, k: 'dir', n: 'orca-board/' },
    { d: 3, k: 'file', n: 'binding.gyp' },
    { d: 3, k: 'file', n: 'src/board.cc', c: 'libusb 캡처 + 콜백' },
    { d: 1, k: 'dir', n: 'resources/', c: '아이콘 · 트레이 · 설치 자산' },
    { d: 2, k: 'file', n: 'icon.ico' },
    { d: 2, k: 'file', n: 'tray.png' },
    { d: 2, k: 'file', n: 'splash.html' },
  ];

  return (
    <Section id="tree" num="02" title="프로젝트 구조" sub="모노레포 한 폴더. main / preload / renderer가 명확히 분리되고, 네이티브 모듈은 별도의 빌드 파이프라인을 가집니다.">
      <div style={{ background: E.code, color: E.codeText, borderRadius: 12, padding: '20px 0', fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.7, overflow: 'hidden' }}>
        {tree.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 360px', columnGap: 18, padding: '0 24px', alignItems: 'baseline', background: r.d === 0 ? 'rgba(255,255,255,.03)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ color: '#5a4f3a', whiteSpace: 'pre', userSelect: 'none' }}>{'│  '.repeat(Math.max(0, r.d - 1))}{r.d > 0 ? '├─ ' : ''}</span>
              <span style={{ color: r.k === 'dir' ? '#dcc69e' : E.codeText, fontWeight: r.k === 'dir' ? 600 : 400, whiteSpace: 'nowrap' }}>{r.n}</span>
            </div>
            {r.c ? (
              <span style={{ color: '#7a6f5a', fontSize: 11, fontFamily: 'var(--sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.c}</span>
            ) : <span/>}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── 3. Window state mockups ───────────────────────────────────────────────

function WindowMockups() {
  return (
    <Section id="windows" num="03" title="윈도우 상태" sub="Electron 앱은 BrowserWindow 한 개만 보여주는 게 아닙니다. 스플래시, 메인, 트레이, 컨텍스트 메뉴 — 각 상태가 어떻게 보일지 미리 잡아둡니다.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        <Mockup name="01 · 스플래시" desc="앱 부팅 — 엔진 / 보드 연결 검사">
          <SplashWin/>
        </Mockup>
        <Mockup name="02 · 메인 (frameless)" desc="custom titlebar, drag region 강조">
          <MainWin/>
        </Mockup>
        <Mockup name="03 · 시스템 트레이" desc="백그라운드 실행 · 빠른 캡처">
          <TrayWin/>
        </Mockup>
        <Mockup name="04 · 네이티브 컨텍스트 메뉴" desc="우클릭 — Menu.popup()">
          <ContextWin/>
        </Mockup>
      </div>
    </Section>
  );
}

function Mockup({ name, desc, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: E.rust, fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 11.5, color: E.ink3 }}>{desc}</span>
      </div>
      <div style={{ background: '#dad4c2', borderRadius: 6, padding: 24, position: 'relative', minHeight: 280 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top, rgba(255,255,255,.4) 0%, transparent 70%)', borderRadius: 6, pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center' }}>{children}</div>
      </div>
    </div>
  );
}

function SplashWin() {
  return (
    <div style={{ width: 380, height: 240, background: E.bg, borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,.25)', overflow: 'hidden', border: `1px solid ${E.borderStrong}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 32px', fontFamily: 'var(--sans)' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: E.rust, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 28 }}>O</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: E.ink, marginTop: 16, letterSpacing: -0.4 }}>Orca</div>
      <div style={{ fontSize: 11.5, color: E.ink3, marginTop: 2 }}>v0.1.0 · Windows</div>

      <div style={{ marginTop: 28, width: '100%', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: E.ink2, fontFamily: 'var(--mono)' }}>
        {[
          ['워크스페이스 로딩', 'done'],
          ['엔진 풀 초기화 · claude-code', 'done'],
          ['하드웨어 보드 검색 · COM7', 'running'],
          ['MCP 서버 연결', 'pending'],
        ].map(([t, s], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`dot ${s === 'done' ? 'green' : s === 'running' ? 'amber' : 'slate'}`}/>
            <span style={{ flex: 1 }}>{t}</span>
            <span style={{ color: E.ink3, fontSize: 10 }}>{s === 'done' ? '✓' : s === 'running' ? '…' : '○'}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', width: '100%', height: 2, background: E.border, borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ width: '64%', height: '100%', background: E.rust }}/>
      </div>
    </div>
  );
}

function MainWin() {
  return (
    <div style={{ width: 380, height: 240, background: E.bg, borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,.25)', overflow: 'hidden', border: `1px solid ${E.borderStrong}`, display: 'flex', flexDirection: 'column', fontFamily: 'var(--sans)' }}>
      {/* Custom titlebar with drag-region overlay */}
      <div style={{ height: 28, background: E.paper2, borderBottom: `1px solid ${E.border}`, display: 'flex', alignItems: 'center', padding: '0 6px 0 10px', fontSize: 10.5, color: E.ink2, position: 'relative' }}>
        <div style={{ width: 12, height: 12, borderRadius: 3, background: E.rust, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--serif)', fontSize: 8, fontWeight: 700, marginRight: 6 }}>O</div>
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, color: E.ink, fontSize: 11 }}>Orca</span>
        <span style={{ color: E.ink3, margin: '0 5px' }}>—</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>cam-validation-v3</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <span style={{ width: 22, height: 18, display: 'grid', placeItems: 'center', color: E.ink3, fontSize: 11 }}>—</span>
          <span style={{ width: 22, height: 18, display: 'grid', placeItems: 'center', color: E.ink3, fontSize: 8 }}>▢</span>
          <span style={{ width: 22, height: 18, display: 'grid', placeItems: 'center', color: E.ink3, fontSize: 9 }}>×</span>
        </div>

        {/* drag region annotation */}
        <div style={{ position: 'absolute', top: 4, left: 60, right: 80, height: 20, border: `1px dashed ${E.rust}`, background: 'rgba(201,100,66,.08)', borderRadius: 3, pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 32, left: 90, fontFamily: 'var(--mono)', fontSize: 9, color: E.rust, padding: '2px 5px', background: '#fff', border: `1px solid ${E.rust}`, borderRadius: 2 }}>-webkit-app-region: drag</div>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <div style={{ width: 70, background: E.paper2, borderRight: `1px solid ${E.border}`, padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {['＋','💬','📁','⚙'].map((c, i) => <div key={i} style={{ width: 26, height: 22, borderRadius: 4, background: i === 1 ? E.rustSoft : 'transparent', display: 'grid', placeItems: 'center', fontSize: 11, color: i === 1 ? E.rust : E.ink3 }}>{c}</div>)}
        </div>
        <div style={{ flex: 1, padding: '14px 12px', background: E.bg, position: 'relative' }}>
          <div style={{ height: 6, width: '60%', background: E.border, borderRadius: 3 }}/>
          <div style={{ height: 6, width: '85%', background: E.border, borderRadius: 3, marginTop: 6 }}/>
          <div style={{ height: 6, width: '40%', background: E.border, borderRadius: 3, marginTop: 6 }}/>
          <div style={{ marginTop: 14, padding: 8, background: E.paper, border: `1px solid ${E.border}`, borderRadius: 6 }}>
            <div style={{ height: 5, width: '70%', background: E.rustSoft, borderRadius: 2 }}/>
            <div style={{ height: 5, width: '50%', background: E.border, borderRadius: 2, marginTop: 4 }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrayWin() {
  return (
    <div style={{ width: 380, height: 240, position: 'relative', background: 'linear-gradient(180deg, #d8c8a8 0%, #b09870 100%)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
      {/* Windows-like taskbar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 38, background: 'rgba(40,38,36,.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {['🌐','📂','🔍'].map((c, i) => <div key={i} style={{ width: 26, height: 26, borderRadius: 4, background: 'rgba(255,255,255,.06)', display: 'grid', placeItems: 'center', fontSize: 12 }}>{c}</div>)}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#fff', fontSize: 9.5, opacity: .9 }}>
          <span>▲</span>
          <div style={{ width: 14, height: 14, background: E.rust, borderRadius: 3, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 9 }}>O</div>
          <span>14:42</span>
          <span style={{ fontSize: 8 }}>2026-05-08</span>
        </div>
      </div>

      {/* Tray context menu popping up */}
      <div style={{ position: 'absolute', right: 70, bottom: 50, width: 220, background: '#26241f', color: '#e8e1d0', borderRadius: 6, padding: 4, boxShadow: '0 8px 32px rgba(0,0,0,.4)', fontFamily: 'var(--sans)', fontSize: 11.5, border: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 11, color: '#aab3c0' }}>
          <span className="dot green" style={{ marginRight: 6 }}/>
          cam-validation-v3 · 활성
        </div>
        {[
          ['💬', 'Orca 열기', 'Ctrl+Shift+O'],
          ['＋', '새 대화', 'Ctrl+N'],
          ['📷', '빠른 캡처', 'Ctrl+Shift+C'],
          [null],
          ['📊', '캡처 폴더 열기'],
          ['⚙', '설정'],
          [null],
          ['⏻', '종료'],
        ].map((r, i) => r[0] === null ? (
          <div key={i} style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '3px 6px' }}/>
        ) : (
          <div key={i} style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 3, background: i === 1 ? 'rgba(201,100,66,.2)' : 'transparent' }}>
            <span style={{ fontSize: 11, width: 14 }}>{r[0]}</span>
            <span style={{ flex: 1 }}>{r[1]}</span>
            {r[2] && <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: '#7a8595' }}>{r[2]}</span>}
          </div>
        ))}
      </div>

      {/* tray icon highlighted */}
      <div style={{ position: 'absolute', right: 95, bottom: 8, width: 22, height: 22, border: `1px dashed ${E.rust}`, borderRadius: 3 }}/>
    </div>
  );
}

function ContextWin() {
  return (
    <div style={{ width: 380, height: 240, background: E.bg, borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,.25)', overflow: 'hidden', border: `1px solid ${E.borderStrong}`, position: 'relative', fontFamily: 'var(--sans)' }}>
      <div style={{ height: 24, background: E.paper2, borderBottom: `1px solid ${E.border}`, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 10, color: E.ink2 }}>
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, color: E.ink, fontSize: 10 }}>Orca</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <span style={{ width: 18, fontSize: 10, color: E.ink3, textAlign: 'center' }}>×</span>
        </span>
      </div>

      {/* Mock chat bubble */}
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: E.rust, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 8, fontFamily: 'var(--serif)', fontWeight: 700 }}>★</div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 4, width: '85%', background: E.border, borderRadius: 2, marginTop: 4 }}/>
            <div style={{ height: 4, width: '60%', background: E.border, borderRadius: 2, marginTop: 4 }}/>
          </div>
        </div>
        <div style={{ background: E.paper, border: `1px solid ${E.border}`, borderRadius: 6, padding: '8px 10px', fontFamily: 'var(--mono)', fontSize: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dot green"/>
            <span style={{ color: E.rust, fontWeight: 600 }}>analysis.bayer_split</span>
            <span style={{ color: E.ink3, marginLeft: 'auto', fontSize: 9 }}>완료 · 0.8s</span>
          </div>
        </div>
      </div>

      {/* Native context menu */}
      <div style={{ position: 'absolute', top: 80, left: 92, width: 180, background: '#fff', borderRadius: 6, padding: 4, boxShadow: '0 8px 32px rgba(0,0,0,.18)', fontSize: 11.5, color: E.ink, border: `1px solid ${E.border}` }}>
        {[
          ['결과 복사', 'Ctrl+C'],
          ['JSON으로 저장', ''],
          [null],
          ['도구 호출 다시 실행', ''],
          ['이 도구 비활성', ''],
          [null],
          ['Skill 정의 보기', ''],
          ['DevTools에서 검사', 'F12'],
        ].map((r, i) => r[0] === null ? (
          <div key={i} style={{ height: 1, background: E.border, margin: '3px 4px' }}/>
        ) : (
          <div key={i} style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', borderRadius: 3, background: i === 0 ? E.rustSoft : 'transparent' }}>
            <span style={{ flex: 1, color: i === 0 ? E.rust : E.ink }}>{r[0]}</span>
            {r[1] && <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: E.ink3 }}>{r[1]}</span>}
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 70, left: 50, fontFamily: 'var(--mono)', fontSize: 9, color: E.rust, padding: '2px 6px', background: '#fff', border: `1px solid ${E.rust}`, borderRadius: 2 }}>Menu.popup({'{'} window {'}'})</div>
    </div>
  );
}

// ─── 4. Code samples ───────────────────────────────────────────────────────

// Simple TS-ish syntax highlighter — regex pass, color only.
const SYN_COLORS = {
  cm: '#7a6f5a', str: '#9bbf72', kw: '#dcc69e', ty: '#9ab8d8',
  num: '#d99c5a', fn: '#e8a489',
};
const SYN_KEYWORDS = new Set([
  'import','export','from','const','let','var','function','class','extends','implements',
  'return','if','else','await','async','new','this','typeof','readonly','interface','type',
  'try','catch','throw','as','public','private','for','while','of','in','default'
]);
const SYN_TYPES = new Set([
  'string','number','boolean','any','void','Promise','Buffer','EventEmitter','BrowserWindow',
  'EngineAdapter','EngineEvent','EngineConfig','UserMessage','OrcaApi','FrameMeta',
  'CaptureOpts','CaptureResult','LineSplitter','ClaudeCodeAdapter','OrcaBoard','JSON'
]);

// HTML-string highlighter — operate on encoded text, return innerHTML.
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function highlightHtml(src) {
  if (src == null) return '';
  if (Array.isArray(src)) src = src.join('');
  if (typeof src !== 'string') src = String(src);
  return src.split('\n').map((line) => {
    // strip comment
    const cmIdx = line.indexOf('//');
    let head = line, tail = '';
    if (cmIdx >= 0) {
      const before = line.slice(0, cmIdx);
      const sq = (before.match(/'/g) || []).length;
      const dq = (before.match(/"/g) || []).length;
      if (sq % 2 === 0 && dq % 2 === 0) {
        head = line.slice(0, cmIdx);
        tail = line.slice(cmIdx);
      }
    }
    let out = '';
    const re = /('[^'\n]*'|"[^"\n]*"|`[^`\n]*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[^\w\s])/g;
    let m, lastIdx = 0;
    while ((m = re.exec(head)) !== null) {
      if (m.index > lastIdx) out += escapeHtml(head.slice(lastIdx, m.index));
      const tok = m[0];
      const eTok = escapeHtml(tok);
      if (/^['"`]/.test(tok)) {
        out += `<span style="color:${SYN_COLORS.str}">${eTok}</span>`;
      } else if (/^\d/.test(tok)) {
        out += `<span style="color:${SYN_COLORS.num}">${eTok}</span>`;
      } else if (SYN_KEYWORDS.has(tok)) {
        out += `<span style="color:${SYN_COLORS.kw}">${eTok}</span>`;
      } else if (SYN_TYPES.has(tok)) {
        out += `<span style="color:${SYN_COLORS.ty}">${eTok}</span>`;
      } else if (/^[A-Za-z_$][\w$]*$/.test(tok)) {
        const after = head.slice(m.index + tok.length);
        if (/^\s*\(/.test(after)) {
          out += `<span style="color:${SYN_COLORS.fn}">${eTok}</span>`;
        } else {
          out += eTok;
        }
      } else {
        out += eTok;
      }
      lastIdx = m.index + tok.length;
    }
    if (lastIdx < head.length) out += escapeHtml(head.slice(lastIdx));
    if (tail) out += `<span style="color:${SYN_COLORS.cm}">${escapeHtml(tail)}</span>`;
    return out;
  }).join('\n');
}

function Code({ lang, file, code }) {
  const raw = typeof code === 'string' ? code : '';
  return (
    <div style={{ background: E.code, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.06)', fontFamily: 'var(--mono)', fontSize: 11, color: '#aab3c0' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5a8a4f' }}/>
        <span style={{ color: '#dcc69e', fontWeight: 600 }}>{file}</span>
        <span style={{ marginLeft: 'auto', color: '#7a6f5a' }}>{lang}</span>
      </div>
      <pre
        style={{ margin: 0, padding: '14px 18px', fontFamily: 'var(--mono)', fontSize: 12, color: E.codeText, lineHeight: 1.65, overflow: 'auto' }}
        dangerouslySetInnerHTML={{ __html: highlightHtml(raw) }}
      />
    </div>
  );
}

function CodeSamples() {
  return (
    <Section id="code" num="04" title="핵심 코드" sub="컴파일 가능한 의사 코드. 실제 구현은 더 복잡하지만, 모양과 책임 경계는 그대로 가져갈 수 있습니다.">
      <Code lang="TypeScript" file="src/main/index.ts" code={`// 앱 부트스트랩 — 단일 인스턴스, 윈도우 / 트레이 / IPC 등록.
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { createMainWindow } from './window';
import { createTray } from './tray';
import { registerIpc } from './ipc';
import { EnginePool } from './engines/pool';
import { BoardManager } from './hardware/board';

if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(async () => {
  const engines = new EnginePool();
  const board   = new BoardManager();
  const win     = await createMainWindow();
  createTray(win);
  registerIpc({ win, engines, board });  // → window.orca.* 매핑

  app.on('second-instance', () => { win.show(); win.focus(); });
  app.on('window-all-closed', () => { /* 트레이 살려두기 */ });
});

app.on('before-quit', async () => {
  await EnginePool.instance?.shutdownAll();
  await BoardManager.instance?.disconnectAll();
});
`}/>

      <Code lang="TypeScript" file="src/main/window.ts" code={`// frameless + 커스텀 타이틀바. 디자인의 -webkit-app-region: drag 와 호환.
export async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820,
    minWidth: 960, minHeight: 640,
    show: false,
    backgroundColor: '#fbf9f4',      // 스플래시 색과 일치 → 깜빡임 방지
    titleBarStyle: 'hidden',         // frameless
    titleBarOverlay: { color: '#f3eee3', symbolColor: '#6b6452', height: 36 },
    icon: resolve(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: resolve(__dirname, '../preload/preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // 첫 paint 후에야 보이게 — 초기 흰 화면 제거
  win.once('ready-to-show', () => win.show());
  win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL ?? 'orca://renderer/index.html');
  return win;
}
`}/>

      <Code lang="TypeScript" file="src/preload/preload.ts" code={`// 화이트리스트 브리지. 렌더러는 이 표면 외에는 접근 불가.
import { contextBridge, ipcRenderer } from 'electron';
import type { OrcaApi } from './orca-api';

const api: OrcaApi = {
  engine: {
    list:        ()       => ipcRenderer.invoke('engine:list'),
    start:       (cfg)    => ipcRenderer.invoke('engine:start', cfg),
    send:        (msg)    => ipcRenderer.invoke('engine:send', msg),
    abort:       (id)     => ipcRenderer.invoke('engine:abort', id),
    onEvent:     (h)      => ipcRenderer.on('engine:event', (_, e) => h(e)),
  },
  board: {
    list:        ()       => ipcRenderer.invoke('board:list'),
    connect:     (port)   => ipcRenderer.invoke('board:connect', port),
    setExposure: (ms)     => ipcRenderer.invoke('board:setExposure', ms),
    setGain:     (g)      => ipcRenderer.invoke('board:setGain', g),
    capture:     (opts)   => ipcRenderer.invoke('board:capture', opts),
    onFrame:     (h)      => ipcRenderer.on('board:frame', (_, f) => h(f)),
  },
  project: {
    list:        ()       => ipcRenderer.invoke('project:list'),
    open:        (id)     => ipcRenderer.invoke('project:open', id),
  },
  skills: { list: () => ipcRenderer.invoke('skills:list') },
  mcp:    { list: () => ipcRenderer.invoke('mcp:list')    },
};

contextBridge.exposeInMainWorld('orca', api);
`}/>

      <Code lang="TypeScript" file="src/main/engines/claude-code.ts" code={`// Claude Code CLI를 자식 프로세스로 spawn하고 JSONL 이벤트를 해석.
import { spawn } from 'node:child_process';
import { EngineAdapter, EngineEvent } from './engine';

export class ClaudeCodeAdapter implements EngineAdapter {
  proc?: ReturnType<typeof spawn>;
  readonly kind = 'claude-code';

  async start(cfg: EngineConfig) {
    this.proc = spawn(cfg.bin ?? 'claude-code', [
      '--workdir', cfg.cwd,
      '--model',   cfg.model,
      '--output',  'jsonl',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    // stdout: 한 줄 = 한 이벤트. 라인 단위 분할기로 흘림.
    this.proc.stdout!
      .pipe(new LineSplitter())
      .on('data', (line: Buffer) => {
        try {
          const ev: EngineEvent = JSON.parse(line.toString());
          this.emit(ev);  // → ipcMain.send('engine:event', ev)
        } catch (e) { log.warn('invalid jsonl', line.toString()); }
      });

    this.proc.on('exit', (code) => this.emit({ type: 'engine.exit', code }));
  }

  send(msg: UserMessage) {
    this.proc?.stdin!.write(JSON.stringify(msg) + '\\n');
  }

  abort() { this.proc?.kill('SIGINT'); }
}
`}/>

      <Code lang="TypeScript" file="src/main/hardware/orca-board.ts" code={`// 네이티브 N-API 모듈 래퍼. 프레임 콜백을 main 프로세스 EventEmitter로 ↑.
import bindings from 'bindings';
const native = bindings('orca-board.node'); // native/orca-board/build/Release/...

export class OrcaBoard extends EventEmitter {
  handle?: Buffer;

  async connect(port: string) {
    this.handle = await native.open(port);
    native.startStream(this.handle, (raw: Buffer, meta: FrameMeta) => {
      // raw: Bayer 1280x720x10b packed. 디바이어는 렌더러가 GPU에서.
      this.emit('frame', { buf: raw, meta });
    });
  }

  setExposure(ms: number) { native.setReg(this.handle, REG_EXP,  msToReg(ms));   }
  setGain(x: number)      { native.setReg(this.handle, REG_GAIN, gainToReg(x)); }

  async capture(opts: CaptureOpts): Promise<CaptureResult> {
    const frames = await native.capture(this.handle, opts);
    // SQLite로 메타 저장 + 디스크에 RAW 보관
    return persistCapture(frames, opts);
  }
}
`}/>

      <Code lang="TypeScript" file="src/renderer/features/chat/useEngineStream.ts" code={`// 렌더러는 window.orca 만 본다. import도, fs 접근도 없음.
export function useEngineStream(sessionId: string) {
  const [events, setEvents] = useState<EngineEvent[]>([]);

  useEffect(() => {
    const off = window.orca.engine.onEvent((ev) => {
      if (ev.sessionId !== sessionId) return;
      setEvents((xs) => [...xs, ev]);
    });
    return off;
  }, [sessionId]);

  const send = useCallback((text: string) =>
    window.orca.engine.send({ sessionId, role: 'user', content: text }), [sessionId]);

  return { events, send, abort: () => window.orca.engine.abort(sessionId) };
}
`}/>
    </Section>
  );
}

// ─── 5. Build & dist ────────────────────────────────────────────────────────

function BuildDist() {
  return (
    <Section id="build" num="05" title="빌드 & 배포" sub="electron-builder 기반. 코드 사이닝, 자동 업데이트, 네이티브 모듈 prebuild까지 포함합니다.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ background: E.paper, border: `1px solid ${E.border}`, borderRadius: 12, padding: 20 }}>
          <Pill tone="rust">npm scripts</Pill>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: 12.5 }}>
            <tbody>
              {[
                ['dev', 'concurrently — vite(renderer) + tsc -w(main) + electron'],
                ['build', 'tsc + vite build + electron-builder build'],
                ['build:native', 'cmake-js · orca-board.node 컴파일 (x64 / arm64)'],
                ['rebuild', 'electron-rebuild — Electron ABI 맞춤'],
                ['dist', 'NSIS installer + MSIX + portable zip'],
                ['publish', 'GitHub releases — 자동 업데이트 채널과 동일'],
              ].map((r, i) => (
                <tr key={i} style={{ borderTop: i ? `1px solid ${E.border}` : 'none' }}>
                  <td style={{ padding: '7px 0', fontFamily: 'var(--mono)', color: E.rust, fontWeight: 600, width: 110 }}>{r[0]}</td>
                  <td style={{ padding: '7px 0', color: E.ink2 }}>{r[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: E.paper, border: `1px solid ${E.border}`, borderRadius: 12, padding: 20 }}>
          <Pill tone="rust">배포 채널</Pill>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { n: 'NSIS .exe', d: '내부 사용자 — 사내 CA로 사인, 수동 설치', tag: '주력' },
              { n: 'MSIX', d: 'Windows Store / Intune 배포', tag: '엔터프라이즈' },
              { n: 'Portable .zip', d: '오프라인 검증실 PC — 설치 권한 없는 환경', tag: '특수' },
              { n: 'Auto-update', d: 'electron-updater · GH Releases · staged rollout', tag: '백그라운드' },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderTop: i ? `1px solid ${E.border}` : 'none' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: E.ink, fontWeight: 600, width: 110 }}>{c.n}</span>
                <span style={{ flex: 1, fontSize: 12, color: E.ink2 }}>{c.d}</span>
                <Pill tone="slate">{c.tag}</Pill>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 18, background: E.paper2, borderRadius: 10, border: `1px solid ${E.border}` }}>
        <Pill tone="rust">주의할 것</Pill>
        <ul style={{ margin: '12px 0 0 18px', padding: 0, color: E.ink, fontSize: 13, lineHeight: 1.7 }}>
          <li><b>네이티브 모듈 ABI</b> — Electron 버전 업그레이드 때마다 <K>electron-rebuild</K>. CI에서 prebuild 캐시.</li>
          <li><b>libusb 드라이버</b> — Windows에선 WinUSB / libusbK 중 택1. 첫 실행에서 Zadig 안내가 필요할 수 있음.</li>
          <li><b>API 키 / MCP 시크릿</b> — <K>safeStorage</K> (DPAPI) 로 암호화. 평문 JSON 금지.</li>
          <li><b>크래시 리포팅</b> — Sentry 또는 Crashpad. 단, 사내 PC라면 외부 송신 정책 먼저 확인.</li>
          <li><b>대용량 RAW 캡처</b> — <K>captures/</K>는 사용자 폴더 밖(예: <K>D:\orca-data\</K>)으로 분리해서 자동 업데이트가 건드리지 않게.</li>
        </ul>
      </div>
    </Section>
  );
}

// ─── footer ────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${E.border}`, padding: '40px 40px 56px', maxWidth: 1080, margin: '60px auto 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: E.rust, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 13 }}>O</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 600, color: E.ink }}>Orca for Windows</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: E.ink3 }}>
          렌더러 디자인은 <a href="index.html" style={{ color: E.rust }}>index.html</a>에서 확인할 수 있습니다.
        </div>
      </div>
    </footer>
  );
}

function Page() {
  return (
    <div style={{ minHeight: '100vh', background: E.bg, color: E.ink }}>
      <Header/>
      <Arch/>
      <FileTree/>
      <WindowMockups/>
      <CodeSamples/>
      <BuildDist/>
      <Footer/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Page/>);
