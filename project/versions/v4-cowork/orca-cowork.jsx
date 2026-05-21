// orca-cowork.jsx — Orca의 메인 셸 (Claude Cowork 패턴).
// 3-컬럼 레이아웃: 좌측 nav · 중앙 dot-grid 캔버스 · 우측 컨텍스트 패널(조건부).
// 이 파일은 셸 + 홈(SCR-01) + 프로젝트 드롭다운(SCR-02) + 4개 생성 모달(SCR-03~06)을
// 포함하고, 작업 진행(SCR-07~08)과 아티팩트 패널(SCR-09)은 별도 파일에서 import.

// ─── design tokens via CSS variables ──────────────────────────────────────
// data-theme="dark" 토글로 전환. 다크모드 첨부 (main-dark.jpg) 기준.
const ORCA_CW_STYLES = `
.orca-cw{
  --bg:#fbf9f4; --bg2:#f4f0e6; --bgInset:#efeadd;
  --panel:#ffffff; --panelHover:#faf6ec;
  --border:#e8e0cd; --borderSoft:#efe9da; --borderStrong:#d6c9aa;
  --ink:#1c1a14; --ink2:#5d574a; --ink3:#9b9486; --ink4:#c1baa3;
  --rust:#d97757; --rustDark:#c46544; --rustSoft:#f4dcc9;
  --accent:#1c1a14; --accentInk:#fff;
  --good:#3a7a5f; --goodSoft:#dfe9e1;
  --blue:#3a6fdb; --blueSoft:#dfe7f3;
  --kbd-bg:#2a2722; --kbd-ink:#f0eadd;
  --dot:rgba(28,26,20,.07);
  --shadow-card:0 1px 2px rgba(28,26,20,.05),0 8px 24px rgba(28,26,20,.06);
  --shadow-modal:0 20px 60px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.08);
  color:var(--ink); background:var(--bg);
  font-family:'Inter','Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  width:100%; height:100%; display:flex; flex-direction:column;
  overflow:hidden;
}
.orca-cw[data-theme="dark"]{
  --bg:#1c1a18; --bg2:#24211d; --bgInset:#1a1815;
  --panel:#2a2722; --panelHover:#322d27;
  --border:#3a352d; --borderSoft:#34302a; --borderStrong:#4a4339;
  --ink:#f0eadd; --ink2:#b9b09c; --ink3:#7a7363; --ink4:#4a4439;
  --rust:#e08868; --rustDark:#d97757; --rustSoft:#3a2820;
  --accent:#f0eadd; --accentInk:#1c1a14;
  --good:#7ab28d; --goodSoft:#1f2b25;
  --blue:#6da0ff; --blueSoft:#1d2738;
  --kbd-bg:#3a352d; --kbd-ink:#f0eadd;
  --dot:rgba(240,234,221,.06);
  --shadow-card:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.3);
  --shadow-modal:0 24px 80px rgba(0,0,0,.5),0 4px 12px rgba(0,0,0,.3);
}
.orca-cw *,.orca-cw *::before,.orca-cw *::after{ box-sizing:border-box; }

/* Titlebar — frameless Electron, draggable */
.cw-tb{
  height:44px; flex:0 0 auto;
  display:flex; align-items:center;
  padding:0 4px 0 8px; gap:2px;
  background:var(--bg); border-bottom:1px solid transparent;
  -webkit-app-region:drag;
}
.cw-tb-btn{
  -webkit-app-region:no-drag;
  appearance:none; border:0; background:transparent; cursor:pointer;
  width:32px; height:32px; border-radius:6px;
  display:grid; place-items:center; color:var(--ink2);
  padding:0;
}
.cw-tb-btn:hover{ background:var(--hover,rgba(0,0,0,.05)); color:var(--ink); }
.cw-tb-btn:disabled{ opacity:.4; cursor:default; }
.cw-tb-spacer{ flex:1; }
.cw-tb-win{ display:flex; gap:0; -webkit-app-region:no-drag; }
.cw-tb-win button{
  appearance:none; border:0; background:transparent; cursor:pointer;
  width:46px; height:34px; display:grid; place-items:center;
  color:var(--ink2);
}
.cw-tb-win button:hover{ background:rgba(0,0,0,.06); color:var(--ink); }
.cw-tb-win button.close:hover{ background:#e44a3a; color:#fff; }
.orca-cw[data-theme="dark"] .cw-tb-win button:hover{ background:rgba(255,255,255,.08); }

/* Body */
.cw-body{ flex:1; min-height:0; display:flex; background:var(--bg); }

/* Sidebar */
.cw-sidebar{
  width:220px; flex:0 0 auto;
  display:flex; flex-direction:column;
  padding:8px 12px 12px;
  border-right:0;
}
.cw-mode-switch{
  display:flex; padding:3px;
  background:var(--bgInset);
  border-radius:10px;
  gap:2px;
  margin-bottom:14px;
}
.cw-mode-switch button{
  flex:1; appearance:none; border:0; background:transparent;
  padding:5px 8px; border-radius:7px; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; gap:5px;
  font-size:12.5px; font-weight:500; color:var(--ink2);
  font-family:inherit;
}
.cw-mode-switch button.active{
  background:var(--panel); color:var(--ink); font-weight:600;
  box-shadow:0 1px 2px rgba(28,26,20,.08);
}
.cw-mode-switch button:hover:not(.active){ background:rgba(0,0,0,.03); color:var(--ink); }
.orca-cw[data-theme="dark"] .cw-mode-switch button:hover:not(.active){ background:rgba(255,255,255,.04); }
.cw-mode-switch button.active svg{ color:var(--rust); }

.cw-nav-item{
  display:flex; align-items:center; gap:10px;
  padding:7px 10px; border-radius:7px;
  font-size:13.5px; color:var(--ink); cursor:pointer;
  appearance:none; border:0; background:transparent; width:100%;
  font-family:inherit; text-align:left;
}
.cw-nav-item:hover{ background:rgba(0,0,0,.04); }
.orca-cw[data-theme="dark"] .cw-nav-item:hover{ background:rgba(255,255,255,.04); }
.cw-nav-item.active{ background:var(--bgInset); font-weight:600; }
.cw-nav-item .ico{ color:var(--ink2); flex:0 0 auto; }
.cw-nav-item.active .ico{ color:var(--ink); }
.cw-nav-item .label{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-badge-beta{
  font-size:10px; padding:1px 5px; border-radius:3px;
  background:var(--bgInset); color:var(--ink2); font-weight:600; letter-spacing:.3px;
}

.cw-recents-head{
  font-size:11.5px; color:var(--ink3); padding:4px 10px;
  margin-top:18px; margin-bottom:2px;
  font-weight:500;
}
.cw-recent{
  display:flex; align-items:center; gap:9px;
  padding:6px 10px; border-radius:6px; cursor:pointer;
  font-size:13px; color:var(--ink2);
  appearance:none; border:0; background:transparent; width:100%;
  font-family:inherit; text-align:left;
}
.cw-recent:hover{ background:rgba(0,0,0,.04); color:var(--ink); }
.orca-cw[data-theme="dark"] .cw-recent:hover{ background:rgba(255,255,255,.04); }
.cw-recent.active{ background:var(--bgInset); color:var(--ink); }
.cw-recent .dot{
  width:6px; height:6px; border-radius:50%;
  background:transparent; border:1px solid var(--ink4);
  flex:0 0 auto;
}
.cw-recent.active .dot{ background:var(--rust); border-color:var(--rust); }
.cw-recent .label{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.cw-account{
  margin-top:auto; padding:8px;
  display:flex; align-items:center; gap:10px;
  border-radius:8px;
}
.cw-account:hover{ background:rgba(0,0,0,.03); }
.cw-avatar{
  width:24px; height:24px; border-radius:50%;
  background:var(--rust); color:#fff;
  display:grid; place-items:center;
  font-size:11.5px; font-weight:600;
  flex:0 0 auto;
}
.cw-account .name{ font-size:12.5px; color:var(--ink); display:inline-flex; align-items:center; gap:5px; flex:1; }
.cw-account .name .tier{ color:var(--ink2); }
.cw-account .download{
  appearance:none; border:0; background:transparent; cursor:pointer;
  color:var(--ink3); padding:4px; border-radius:4px;
}
.cw-account .download:hover{ color:var(--ink); background:rgba(0,0,0,.04); }

/* Main canvas — dot grid */
.cw-main{
  flex:1; min-width:0;
  display:flex; flex-direction:column;
  background:var(--bg);
  background-image:radial-gradient(circle, var(--dot) 0.9px, transparent 0.9px);
  background-size:20px 20px;
  background-position:10px 10px;
  position:relative;
  overflow:hidden;
}

/* Home screen */
.cw-home{ flex:1; overflow:auto; display:flex; flex-direction:column; padding:40px 60px 60px; }
.cw-home-inner{ width:100%; max-width:880px; margin:0 auto; }
.cw-home-top-pad{ flex:0 0 80px; }
.cw-headline{
  display:inline-flex; align-items:center; gap:14px;
  font-family:'Source Serif 4','Pretendard',serif;
  font-weight:600; font-size:34px; letter-spacing:-0.8px;
  color:var(--ink); line-height:1.1;
}
.cw-safety-link{
  display:block; font-size:13px; color:var(--ink2);
  text-decoration:underline; text-underline-offset:3px; text-decoration-color:var(--ink4);
  margin-top:10px; cursor:pointer; width:fit-content;
}
.cw-safety-link:hover{ color:var(--ink); text-decoration-color:var(--ink2); }

/* Composer card */
.cw-composer{
  margin-top:28px;
  background:transparent; border:1px solid var(--border);
  border-radius:18px; padding:16px 18px;
  display:flex; flex-direction:column; gap:10px;
}
.cw-composer-input{
  min-height:88px; outline:0; border:0; resize:none;
  background:transparent; color:var(--ink);
  font:14px/1.55 inherit;
}
.cw-composer-input:empty::before{
  content:attr(data-placeholder);
  color:var(--ink3); pointer-events:none;
}
.cw-composer-bottom{
  display:flex; align-items:center; gap:10px;
}
.cw-composer-bottom .icon-btn{
  appearance:none; border:0; background:transparent; cursor:pointer;
  width:28px; height:28px; border-radius:6px;
  display:grid; place-items:center; color:var(--ink2);
}
.cw-composer-bottom .icon-btn:hover{ background:var(--bgInset); color:var(--ink); }
.cw-composer-bottom .grow{ flex:1; }

.cw-context-bar{
  display:flex; align-items:center; gap:12px;
  margin-top:10px;
}
.cw-context-chip{
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 10px; border-radius:999px;
  background:transparent;
  font-size:12.5px; color:var(--ink2);
  cursor:pointer; appearance:none; border:0;
  font-family:inherit;
}
.cw-context-chip:hover{ background:var(--bgInset); color:var(--ink); }
.cw-context-chip svg{ flex:0 0 auto; }
.cw-context-spacer{ flex:1; }
.cw-context-model{
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 10px; border-radius:999px;
  font-size:12.5px; color:var(--ink2);
  cursor:pointer; appearance:none; border:0; background:transparent;
}
.cw-context-model:hover{ background:var(--bgInset); color:var(--ink); }

/* Suggestions */
.cw-suggest{ margin-top:80px; }
.cw-suggest-head{
  display:flex; align-items:center; justify-content:center; gap:8px;
  font-size:13px; color:var(--ink2);
  margin-bottom:14px;
}
.cw-suggest-list{
  display:flex; flex-direction:column;
}
.cw-suggest-item{
  display:flex; align-items:center; gap:14px;
  padding:14px 4px;
  border-top:1px solid var(--borderSoft);
  font-size:14px; color:var(--ink);
  cursor:pointer;
  appearance:none; border-left:0; border-right:0; border-bottom:0;
  background:transparent; width:100%; font-family:inherit; text-align:left;
}
.cw-suggest-item:last-child{ border-bottom:1px solid var(--borderSoft); }
.cw-suggest-item:hover{ background:rgba(0,0,0,.02); }
.orca-cw[data-theme="dark"] .cw-suggest-item:hover{ background:rgba(255,255,255,.02); }
.cw-suggest-ico{
  width:36px; height:32px; border-radius:6px;
  background:var(--bgInset);
  display:grid; place-items:center; color:var(--ink2);
  flex:0 0 auto;
}
.cw-plugin-link{
  margin-top:24px; font-size:13px; color:var(--ink2);
  text-align:center; cursor:pointer;
}
.cw-plugin-link:hover{ color:var(--ink); text-decoration:underline; text-underline-offset:3px; }

/* Project dropdown — anchored popover */
.cw-pop-scrim{ position:fixed; inset:0; z-index:50; }
.cw-pop{
  position:absolute;
  background:var(--panel);
  border:1px solid var(--border);
  border-radius:10px;
  box-shadow:var(--shadow-card);
  padding:5px;
  min-width:280px;
  z-index:51;
}
.cw-pop-item{
  display:flex; align-items:center; gap:10px;
  padding:8px 10px; border-radius:6px; cursor:pointer;
  font-size:13px; color:var(--ink);
  appearance:none; border:0; background:transparent; width:100%;
  font-family:inherit; text-align:left;
}
.cw-pop-item:hover{ background:var(--bgInset); }
.cw-pop-item .ico{ color:var(--ink2); flex:0 0 auto; }
.cw-pop-item .body{ flex:1; min-width:0; }
.cw-pop-item .body .t{ font-size:13px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-pop-item .body .sub{ font-size:11.5px; color:var(--ink3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-pop-item .star{ color:var(--ink4); }
.cw-pop-item .star.on{ color:var(--rust); }
.cw-pop-divider{ height:1px; background:var(--borderSoft); margin:4px 0; }

/* Modal */
.cw-modal-scrim{
  position:fixed; inset:0; z-index:60;
  background:rgba(28,26,20,.18);
  backdrop-filter:blur(2px);
  -webkit-backdrop-filter:blur(2px);
  display:grid; place-items:center;
  animation:cwFadeIn .14s ease-out;
}
.orca-cw[data-theme="dark"] .cw-modal-scrim{ background:rgba(0,0,0,.55); }
.cw-modal{
  width:540px; max-width:calc(100% - 32px);
  background:var(--panel);
  border-radius:14px;
  box-shadow:var(--shadow-modal);
  padding:24px 28px;
  position:relative;
  animation:cwScaleIn .16s cubic-bezier(.2,.7,.3,1);
}
.cw-modal-back{
  appearance:none; border:0; background:transparent; cursor:pointer;
  width:30px; height:30px; border-radius:6px;
  display:grid; place-items:center; color:var(--ink2);
  margin:-4px 0 8px -4px;
}
.cw-modal-back:hover{ background:var(--bgInset); color:var(--ink); }
.cw-modal h2{
  font-family:'Source Serif 4',serif; font-weight:600; font-size:21px;
  letter-spacing:-0.4px; color:var(--ink); margin:0 0 8px;
}
.cw-modal p.lede{ font-size:13.5px; color:var(--ink2); line-height:1.55; margin:0 0 16px; }
.cw-modal-row{
  display:flex; align-items:center; gap:14px;
  padding:14px 16px; border:1px solid var(--border);
  border-radius:10px; cursor:pointer;
  margin-bottom:8px;
  background:var(--panel);
  appearance:none; width:100%; font-family:inherit; text-align:left;
}
.cw-modal-row:hover{ background:var(--bgInset); border-color:var(--borderStrong); }
.cw-modal-row .ico{
  width:36px; height:36px; border-radius:8px;
  background:var(--bgInset); display:grid; place-items:center; color:var(--ink);
  flex:0 0 auto;
}
.cw-modal-row .body{ flex:1; min-width:0; }
.cw-modal-row .body .t{ font-size:14px; color:var(--ink); font-weight:600; }
.cw-modal-row .body .sub{ font-size:12px; color:var(--ink2); margin-top:2px; }
.cw-modal-row .chev{ color:var(--ink3); flex:0 0 auto; }

.cw-field-label{ font-size:13px; color:var(--ink); font-weight:500; margin:14px 0 6px; display:flex; align-items:baseline; gap:4px; }
.cw-field-label .req{ color:var(--rust); }
.cw-field-label .info{ margin-left:auto; color:var(--ink3); cursor:pointer; }
.cw-input{
  width:100%; padding:10px 12px;
  border:1px solid var(--border); border-radius:8px;
  background:var(--panel); color:var(--ink);
  font:14px/1.5 inherit; outline:0;
}
.cw-input:focus{ border-color:var(--rust); box-shadow:0 0 0 3px rgba(217,119,87,.15); }
.cw-input::placeholder{ color:var(--ink3); }
.cw-textarea{ min-height:84px; resize:vertical; }
.cw-drop{
  border:1.5px dashed var(--border); border-radius:10px;
  padding:18px; text-align:center;
  font-size:13px; color:var(--ink2);
  background:var(--bg);
  display:flex; align-items:center; justify-content:center; gap:8px;
  cursor:pointer;
}
.cw-drop:hover{ border-color:var(--borderStrong); background:var(--bgInset); color:var(--ink); }
.cw-path-picker{
  width:100%; padding:10px 12px;
  border:1px solid var(--border); border-radius:8px;
  background:var(--bg); color:var(--ink);
  font:12.5px/1.5 'JetBrains Mono',ui-monospace,monospace;
  display:flex; align-items:center; gap:10px;
  cursor:pointer;
}
.cw-path-picker:hover{ background:var(--bgInset); }
.cw-path-picker .ico{ color:var(--ink2); flex:0 0 auto; }
.cw-path-picker .placeholder{ color:var(--ink3); }

.cw-modal-footer{
  display:flex; align-items:center; gap:8px;
  margin-top:22px;
}
.cw-memory-chip{
  display:inline-flex; align-items:center; gap:6px;
  font-size:12px; color:var(--ink2);
  cursor:pointer;
}
.cw-memory-chip:hover{ color:var(--ink); }
.cw-btn-secondary{
  appearance:none; border:1px solid var(--border); background:var(--panel);
  color:var(--ink); padding:8px 18px; border-radius:8px;
  font-size:13px; font-weight:500; cursor:pointer; font-family:inherit;
}
.cw-btn-secondary:hover{ background:var(--bgInset); }
.cw-btn-primary{
  appearance:none; border:0; background:var(--accent);
  color:var(--accentInk); padding:8px 22px; border-radius:8px;
  font-size:13px; font-weight:600; cursor:pointer; font-family:inherit;
}
.cw-btn-primary:hover{ filter:brightness(1.08); }
.cw-btn-primary:disabled{
  background:var(--bgInset); color:var(--ink3); cursor:default;
}

/* Keyboard kbd pills */
.cw-kbd{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:18px; height:18px; padding:0 5px;
  border-radius:4px;
  background:var(--kbd-bg); color:var(--kbd-ink);
  font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:10.5px; font-weight:500;
}
.cw-kbd-light{
  background:var(--bgInset); color:var(--ink2);
  border:1px solid var(--border);
}

/* misc anim */
@keyframes cwFadeIn{ from{opacity:0} to{opacity:1} }
@keyframes cwScaleIn{ from{opacity:0; transform:scale(.96)} to{opacity:1; transform:scale(1)} }
@keyframes cwPulse{ 0%,100%{opacity:1} 50%{opacity:.35} }
.cw-pulse{ animation:cwPulse 1.4s ease-in-out infinite; }
@keyframes cwSpin{ to{ transform:rotate(360deg) } }
.cw-spin{ animation:cwSpin 1s linear infinite; }
`;
if (typeof document !== 'undefined' && !document.getElementById('orca-cw-styles')) {
  const s = document.createElement('style'); s.id = 'orca-cw-styles';
  s.textContent = ORCA_CW_STYLES;
  document.head.appendChild(s);
}

// ─── icons ────────────────────────────────────────────────────────────────
// 모든 아이콘 stroke 1.6, viewBox 24, round join/cap.
function CWIcon({ n, size = 16, color = 'currentColor', stroke = 1.6 }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (n) {
    case 'hamburger':  return <svg {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case 'sidebar':    return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>;
    case 'search':     return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'arrowL':     return <svg {...props}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'arrowR':     return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'arrowLong':  return <svg {...props}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>;
    case 'min':        return <svg {...props} strokeWidth="1.3"><path d="M5 12h14"/></svg>;
    case 'max':        return <svg {...props} strokeWidth="1.3"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>;
    case 'close':      return <svg {...props} strokeWidth="1.4"><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'plus':       return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chat':       return <svg {...props}><path d="M21 12a8 8 0 1 1-3.6-6.7L21 4l-1.3 3.6A8 8 0 0 1 21 12z"/></svg>;
    case 'cowork':     return <svg {...props}><path d="M4 6h4M4 12h4M4 18h4M10 6l2 2 4-4M10 12l2 2 4-4M10 18l2 2 4-4"/></svg>;
    case 'code':       return <svg {...props}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></svg>;
    case 'projects':   return <svg {...props}><path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 7l2-4h14l2 4M9 11h6"/></svg>;
    case 'scheduled':  return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
    case 'live':       return <svg {...props}><path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0"/><circle cx="12" cy="12" r="1.5" fill={color} stroke="none"/></svg>;
    case 'dispatch':   return <svg {...props}><path d="M8 4h8l3 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8l3-4zM5 8h14M10 12h4"/></svg>;
    case 'customize':  return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'folder':     return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>;
    case 'folderPlus': return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 12v4M10 14h4"/></svg>;
    case 'doc':        return <svg {...props}><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3v4h4M9 13h6M9 17h4"/></svg>;
    case 'docPlus':    return <svg {...props}><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3v4h4M12 11v5M9.5 13.5h5"/></svg>;
    case 'send':       return <svg {...props}><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>;
    case 'mic':        return <svg {...props}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;
    case 'star':       return <svg {...props} fill={color === 'currentColor' ? 'none' : color}><path d="M12 3l2.6 6 6.4.6-4.8 4.4 1.4 6.5L12 17l-5.6 3.5 1.4-6.5L3 9.6l6.4-.6L12 3z"/></svg>;
    case 'chev':       return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevR':      return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevU':      return <svg {...props}><path d="M6 15l6-6 6 6"/></svg>;
    case 'shuffle':    return <svg {...props}><path d="M3 7h3l9 10h6M3 17h3l3-3M21 17l-3 3M21 7l-3-3M15 7h6"/></svg>;
    case 'sunrise':    return <svg {...props}><path d="M5 18h14M12 4v6M8 8l4-4 4 4M3 21h18M5 14a7 7 0 0 1 14 0"/></svg>;
    case 'insights':   return <svg {...props}><path d="M3 3v18h18M7 15l3-3 3 2 4-6M7 11V8M12 13v-3M16 9V6"/></svg>;
    case 'download':   return <svg {...props}><path d="M12 4v12M7 12l5 5 5-5M5 21h14"/></svg>;
    case 'check':      return <svg {...props}><path d="M5 12.5l4.5 4.5L19 7"/></svg>;
    case 'checkCirc':  return <svg {...props} fill={color} stroke="none"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.5 3.5L17 9" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case 'info':       return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8v.5"/></svg>;
    case 'eye':        return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'tag':        return <svg {...props}><path d="M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01"/></svg>;
    case 'refresh':    return <svg {...props}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4"/></svg>;
    case 'copy':       return <svg {...props}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>;
    case 'thumbUp':    return <svg {...props}><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2h-9"/></svg>;
    case 'thumbDown':  return <svg {...props}><path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3zM17 13l-4 8a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2l2-7a2 2 0 0 1 2-2h9"/></svg>;
    case 'wrench':     return <svg {...props}><path d="M14 7a5 5 0 0 1 7 5l-2-2-3 3 2 2a5 5 0 0 1-5-1L4 22l-2-2 9-9a5 5 0 0 1 3-4z"/></svg>;
    case 'stop':       return <svg {...props}><rect x="6" y="6" width="12" height="12" rx="1" fill={color}/></svg>;
    case 'queue':      return <svg {...props}><path d="M4 12h12M11 7l5 5-5 5M16 4v16"/></svg>;
    case 'panel':      return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>;
    case 'gDrive':     return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7.5 3h9L22 13.5h-9z" fill="#FFC107"/><path d="M16.5 3l5.5 10.5L17 21l-5.5-7.5z" fill="#1E88E5"/><path d="M7.5 3 2 13.5 7 21h10l-5.5-7.5z" fill="#43A047"/></svg>;
    case 'hand':       return <svg {...props}><path d="M9 11V5a1.5 1.5 0 0 1 3 0v6M12 11V4a1.5 1.5 0 0 1 3 0v7M15 11V6a1.5 1.5 0 0 1 3 0v9a6 6 0 0 1-6 6c-3 0-5-2-6-4l-3-6a1.5 1.5 0 0 1 2.5-2L7 12"/></svg>;
    default:           return null;
  }
}

// 8-pointed Anthropic-style asterisk/spark
function Spark({ size = 24, color = 'var(--rust)' }) {
  const r1 = (size / 24) * 11.5;  // long axis radius (vertical extent)
  const r2 = (size / 24) * 7.5;   // short diagonal radius
  const w1 = (size / 24) * 1.55;  // long axis thickness
  const w2 = (size / 24) * 1.1;   // short axis thickness
  return (
    <svg width={size} height={size} viewBox={`-${size/2} -${size/2} ${size} ${size}`} aria-hidden="true">
      <g fill={color}>
        <ellipse cx="0" cy="0" rx={w1} ry={r1}/>
        <ellipse cx="0" cy="0" rx={r1} ry={w1}/>
        <ellipse cx="0" cy="0" rx={w2} ry={r2} transform="rotate(45)"/>
        <ellipse cx="0" cy="0" rx={r2} ry={w2} transform="rotate(45)"/>
      </g>
    </svg>
  );
}

// ─── Titlebar ─────────────────────────────────────────────────────────────
function CWTitlebar({ canBack = false, canFwd = false, onBack, onFwd, onToggleSidebar }) {
  return (
    <div className="cw-tb">
      <button className="cw-tb-btn" title="메뉴"><CWIcon n="hamburger" size={18}/></button>
      <button className="cw-tb-btn" title="사이드바 토글" onClick={onToggleSidebar}><CWIcon n="sidebar" size={17}/></button>
      <button className="cw-tb-btn" title="검색"><CWIcon n="search" size={17}/></button>
      <button className="cw-tb-btn" title="뒤로" disabled={!canBack} onClick={onBack}><CWIcon n="arrowL" size={18}/></button>
      <button className="cw-tb-btn" title="앞으로" disabled={!canFwd} onClick={onFwd}><CWIcon n="arrowR" size={18}/></button>
      <div className="cw-tb-spacer"/>
      <div className="cw-tb-win">
        <button title="최소화"><CWIcon n="min" size={14}/></button>
        <button title="최대화"><CWIcon n="max" size={11}/></button>
        <button className="close" title="닫기"><CWIcon n="close" size={13}/></button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
function CWSidebar({ mode, onMode, active, onNav, recents, recentActive, onRecent, onNew }) {
  return (
    <aside className="cw-sidebar">
      <div className="cw-mode-switch">
        <button className={mode === 'chat' ? 'active' : ''} onClick={() => onMode('chat')}>
          <CWIcon n="chat" size={13}/> Chat
        </button>
        <button className={mode === 'cowork' ? 'active' : ''} onClick={() => onMode('cowork')}>
          <CWIcon n="cowork" size={13}/> Cowork
        </button>
        <button className={mode === 'code' ? 'active' : ''} onClick={() => onMode('code')}>
          <CWIcon n="code" size={13}/> Code
        </button>
      </div>

      <button className={`cw-nav-item ${active === 'new-task' ? 'active' : ''}`} onClick={() => { onNav('new-task'); onNew?.(); }}>
        <span className="ico"><CWIcon n="plus" size={15}/></span>
        <span className="label">New task</span>
      </button>
      <button className={`cw-nav-item ${active === 'projects' ? 'active' : ''}`} onClick={() => onNav('projects')}>
        <span className="ico"><CWIcon n="projects" size={15}/></span>
        <span className="label">Projects</span>
      </button>
      <button className={`cw-nav-item ${active === 'scheduled' ? 'active' : ''}`} onClick={() => onNav('scheduled')}>
        <span className="ico"><CWIcon n="scheduled" size={15}/></span>
        <span className="label">Scheduled</span>
      </button>
      <button className={`cw-nav-item ${active === 'live' ? 'active' : ''}`} onClick={() => onNav('live')}>
        <span className="ico"><CWIcon n="live" size={15}/></span>
        <span className="label">Live artifacts</span>
      </button>
      <button className={`cw-nav-item ${active === 'dispatch' ? 'active' : ''}`} onClick={() => onNav('dispatch')}>
        <span className="ico"><CWIcon n="dispatch" size={15}/></span>
        <span className="label">Dispatch</span>
        <span className="cw-badge-beta">베타</span>
      </button>
      <button className={`cw-nav-item ${active === 'customize' ? 'active' : ''}`} onClick={() => onNav('customize')}>
        <span className="ico"><CWIcon n="customize" size={15}/></span>
        <span className="label">Customize</span>
      </button>

      {recents && recents.length > 0 && (
        <>
          <div className="cw-recents-head">Recents</div>
          {recents.map((r) => (
            <button key={r.id} className={`cw-recent ${r.id === recentActive ? 'active' : ''}`} onClick={() => onRecent(r.id)}>
              <span className="dot"/>
              <span className="label">{r.title}</span>
            </button>
          ))}
        </>
      )}

      <div className="cw-account">
        <div className="cw-avatar">김</div>
        <span className="name">김재훈<span className="tier">· Pro</span><CWIcon n="chev" size={11} color="var(--ink3)"/></span>
        <button className="download" title="앱 다운로드"><CWIcon n="download" size={15}/></button>
      </div>
    </aside>
  );
}

// ─── Home (SCR-01) ────────────────────────────────────────────────────────
function CWHome({ onProjectDropdown, projectAnchorRef, onSuggest, currentProject }) {
  const [draft, setDraft] = React.useState('');

  return (
    <div className="cw-home">
      <div className="cw-home-top-pad"/>
      <div className="cw-home-inner">
        <h1 className="cw-headline">
          <Spark size={32}/>
          할 일을 처리해 볼까요?
        </h1>
        <a className="cw-safety-link">Orca를 안전하게 사용하는 방법 알아보기.</a>

        <div className="cw-composer">
          <div
            className="cw-composer-input"
            contentEditable suppressContentEditableWarning
            data-placeholder={draft ? '' : '스킬을 보려면 /를 입력하세요'}
            onInput={(e) => setDraft(e.currentTarget.textContent || '')}
          />
          <div className="cw-composer-bottom">
            <button className="icon-btn" title="첨부"><CWIcon n="plus" size={16}/></button>
            <span className="grow"/>
            <button className="icon-btn" title="음성 입력"><CWIcon n="mic" size={16}/></button>
          </div>
        </div>

        <div className="cw-context-bar">
          <button ref={projectAnchorRef} className="cw-context-chip" onClick={onProjectDropdown}>
            <CWIcon n="projects" size={14}/>
            {currentProject ? currentProject.name : '프로젝트에서 작업'}
            <CWIcon n="chev" size={11}/>
          </button>
          <button className="cw-context-chip">
            <CWIcon n="hand" size={14}/>
            질문
            <CWIcon n="chev" size={11}/>
          </button>
          <span className="cw-context-spacer"/>
          <button className="cw-context-model">
            Sonnet 4.6
            <CWIcon n="chev" size={11}/>
          </button>
        </div>

        <div className="cw-suggest">
          <div className="cw-suggest-head">
            <CWIcon n="shuffle" size={14}/>
            작업을 골라보세요, 어떤 것이든
          </div>
          <div className="cw-suggest-list">
            <button className="cw-suggest-item" onClick={() => onSuggest('optimize')}>
              <span className="cw-suggest-ico"><CWIcon n="sunrise" size={17}/></span>
              이번 주 최적화하기
            </button>
            <button className="cw-suggest-item" onClick={() => onSuggest('screenshots')}>
              <span className="cw-suggest-ico"><CWIcon n="folder" size={16}/></span>
              스크린샷 정리하기
            </button>
            <button className="cw-suggest-item" onClick={() => onSuggest('insights')}>
              <span className="cw-suggest-ico"><CWIcon n="insights" size={16}/></span>
              파일에서 인사이트 찾기
            </button>
          </div>
          <div className="cw-plugin-link">플러그인으로 맞춤 설정</div>
        </div>
      </div>
    </div>
  );
}

// ─── Project dropdown (SCR-02) ────────────────────────────────────────────
function CWProjectDropdown({ anchorEl, onClose, onCreate, onSelect, projects }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null);

  React.useEffect(() => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const wrap = anchorEl.closest('.orca-cw');
    const wr = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0 };
    setPos({ left: r.left - wr.left, top: r.bottom - wr.top + 6 });
  }, [anchorEl]);

  if (!pos) return null;
  return (
    <>
      <div className="cw-pop-scrim" onClick={onClose}/>
      <div ref={ref} className="cw-pop" style={{ left: pos.left, top: pos.top }}>
        {projects.map((p) => (
          <button key={p.id} className="cw-pop-item" onClick={() => onSelect(p)}>
            <span className="ico"><CWIcon n="folder" size={14}/></span>
            <span className="body">
              <span className="t">{p.name}</span>
              <span className="sub">{p.path}</span>
            </span>
            <span className={`star ${p.starred ? 'on' : ''}`} onClick={(e) => e.stopPropagation()}>
              <CWIcon n="star" size={13} color={p.starred ? 'var(--rust)' : 'currentColor'}/>
            </span>
          </button>
        ))}
        <div className="cw-pop-divider"/>
        <button className="cw-pop-item" onClick={onCreate}>
          <span className="ico"><CWIcon n="plus" size={14}/></span>
          <span className="body"><span className="t">새 프로젝트 생성</span></span>
        </button>
        <button className="cw-pop-item">
          <span className="ico"><CWIcon n="folderPlus" size={14}/></span>
          <span className="body"><span className="t">다른 폴더 선택</span></span>
        </button>
      </div>
    </>
  );
}

// ─── Modals (SCR-03 ~ SCR-06) ─────────────────────────────────────────────
function CWModal({ kind, onClose, onSwitch, onCreate }) {
  return (
    <div className="cw-modal-scrim" onClick={onClose}>
      <div className="cw-modal" onClick={(e) => e.stopPropagation()}>
        {kind === 'entry'    && <CWModalEntry onClose={onClose} onSwitch={onSwitch}/>}
        {kind === 'scratch'  && <CWModalScratch onBack={() => onSwitch('entry')} onClose={onClose} onCreate={onCreate}/>}
        {kind === 'import'   && <CWModalImport onBack={() => onSwitch('entry')} onClose={onClose} onCreate={onCreate}/>}
        {kind === 'existing' && <CWModalExisting onBack={() => onSwitch('entry')} onClose={onClose} onCreate={onCreate}/>}
      </div>
    </div>
  );
}

function CWModalEntry({ onSwitch }) {
  return (
    <>
      <h2>새 프로젝트 생성</h2>
      <p className="lede">진행 중인 작업을 위한 전용 공간으로, 시간이 지남에 따라 컨텍스트가 쌓입니다. 파일과 지침은 컴퓨터의 폴더에 보관됩니다.</p>
      <button className="cw-modal-row" onClick={() => onSwitch('scratch')} style={{ borderColor: 'var(--rust)' }}>
        <span className="ico"><CWIcon n="plus" size={16}/></span>
        <span className="body">
          <span className="t">처음부터 시작하기</span>
          <span className="sub">지침과 파일이 포함된 새 폴더를 설정합니다.</span>
        </span>
        <span className="chev"><CWIcon n="chevR" size={14}/></span>
      </button>
      <button className="cw-modal-row" onClick={() => onSwitch('import')}>
        <span className="ico"><CWIcon n="projects" size={16}/></span>
        <span className="body">
          <span className="t">프로젝트 가져오기</span>
          <span className="sub">채팅에서 만든 프로젝트를 Cowork로 가져오세요.</span>
        </span>
        <span className="chev"><CWIcon n="chevR" size={14}/></span>
      </button>
      <button className="cw-modal-row" onClick={() => onSwitch('existing')}>
        <span className="ico"><CWIcon n="folder" size={16}/></span>
        <span className="body">
          <span className="t">기존 폴더 사용</span>
          <span className="sub">이미 작업 중인 폴더를 Claude에 제공하세요.</span>
        </span>
        <span className="chev"><CWIcon n="chevR" size={14}/></span>
      </button>
    </>
  );
}

function CWModalScratch({ onBack, onClose, onCreate }) {
  const [name, setName] = React.useState('');
  return (
    <>
      <button className="cw-modal-back" onClick={onBack}><CWIcon n="arrowLong" size={17}/></button>
      <h2>새 프로젝트 시작하기</h2>
      <label className="cw-field-label">이름 <span className="req">*</span></label>
      <input className="cw-input" placeholder="프로젝트 이름" value={name} onChange={(e) => setName(e.target.value)} autoFocus/>
      <label className="cw-field-label">지침</label>
      <textarea className="cw-input cw-textarea" placeholder="이 프로젝트에서 작업하는 방법을 Claude에게 알려주세요(선택 사항)"/>
      <label className="cw-field-label">파일 추가</label>
      <div className="cw-drop">
        <CWIcon n="plus" size={14}/>
        파일을 여기에 드롭하거나 클릭하여 찾아보기
      </div>
      <label className="cw-field-label">
        프로젝트 위치 선택
        <span className="info"><CWIcon n="info" size={13}/></span>
      </label>
      <div className="cw-path-picker">
        <span className="ico"><CWIcon n="folderPlus" size={14}/></span>
        C:\Users\rlaeo\OneDrive\문서/Claude/Projects
      </div>
      <div className="cw-modal-footer">
        <span className="cw-memory-chip"><CWIcon n="info" size={12}/> 메모리 꺼짐</span>
        <span style={{ flex: 1 }}/>
        <button className="cw-btn-secondary" onClick={onClose}>취소</button>
        <button className="cw-btn-primary" onClick={onCreate} disabled={!name.trim()}>만들기</button>
      </div>
    </>
  );
}

function CWModalImport({ onBack, onClose, onCreate }) {
  return (
    <>
      <button className="cw-modal-back" onClick={onBack}><CWIcon n="arrowLong" size={17}/></button>
      <h2>프로젝트 가져오기</h2>
      <p className="lede">채팅에서 만든 프로젝트를 Cowork로 가져오세요. Cowork에서의 변경 사항은 채팅의 프로젝트에 영향을 주지 않습니다.</p>
      <label className="cw-field-label">채팅의 프로젝트</label>
      <input className="cw-input" placeholder="채팅에서 프로젝트 검색..."/>
      <div className="cw-modal-footer">
        <span className="cw-memory-chip"><CWIcon n="info" size={12}/> 메모리 꺼짐</span>
        <span style={{ flex: 1 }}/>
        <button className="cw-btn-secondary" onClick={onClose}>취소</button>
        <button className="cw-btn-primary" disabled>만들기</button>
      </div>
    </>
  );
}

function CWModalExisting({ onBack, onClose, onCreate }) {
  return (
    <>
      <button className="cw-modal-back" onClick={onBack}><CWIcon n="arrowLong" size={17}/></button>
      <h2>기존 폴더 사용</h2>
      <p className="lede">폴더를 선택하면 Claude가 해당 파일을 프로젝트 컨텍스트로 처리합니다. Claude가 작업에 접근하는 방식을 조정하려면 지침을 추가하세요.</p>
      <label className="cw-field-label">폴더 선택</label>
      <div className="cw-path-picker">
        <span className="ico"><CWIcon n="folderPlus" size={14}/></span>
        <span className="placeholder">폴더 선택...</span>
      </div>
      <div className="cw-modal-footer">
        <span className="cw-memory-chip"><CWIcon n="info" size={12}/> 메모리 꺼짐</span>
        <span style={{ flex: 1 }}/>
        <button className="cw-btn-secondary" onClick={onClose}>취소</button>
        <button className="cw-btn-primary" disabled>만들기</button>
      </div>
    </>
  );
}

Object.assign(window, {
  CWIcon, Spark, CWTitlebar, CWSidebar, CWHome, CWProjectDropdown, CWModal,
});
