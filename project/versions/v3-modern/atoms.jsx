// Shared icons + small atoms used across variations.
// Loaded as Babel module — exports to window.

const I = {
  size: 16,
};

// SVG path-only icons. Stroke 1.6, line caps/joins round, viewBox 16.
const ICONS = {
  chat: 'M3 4h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5V12H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  plus: 'M8 3v10M3 8h10',
  search: 'M11.5 11.5L14 14M7 12.5A5.5 5.5 0 1 1 7 1.5a5.5 5.5 0 0 1 0 11z',
  folder: 'M2 5a1 1 0 0 1 1-1h3l1.5 1.5h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z',
  settings: 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm5.4 2.5l1.3-.8-1-1.7-1.4.6a4.4 4.4 0 0 0-1-.6L11 4h-2l-.3 1.5a4.4 4.4 0 0 0-1 .6l-1.4-.6-1 1.7L6.6 8a4.4 4.4 0 0 0 0 1l-1.3.8 1 1.7 1.4-.6c.3.2.6.4 1 .6L9 13h2l.3-1.5c.4-.2.7-.4 1-.6l1.4.6 1-1.7-1.3-.8a4.4 4.4 0 0 0 0-1z',
  send: 'M2 8l12-5-3.5 12-3-5L2 8z',
  cpu: 'M5 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM6 6h4v4H6zM3 6h-1M3 10h-1M14 6h-1M14 10h-1M6 3v-1M10 3v-1M6 14v-1M10 14v-1',
  bolt: 'M9 1L3 9h4l-1 6 6-8H8l1-6z',
  cam: 'M2 5a1 1 0 0 1 1-1h2.5l1-1.5h3l1 1.5H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5zm6 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  board: 'M2 3h12v10H2zM5 6h6M5 9h4M5 12h2',
  flask: 'M6 1h4M6.5 1v4.5L3 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2L9.5 5.5V1',
  history: 'M3 8a5 5 0 1 0 1.5-3.5L3 6M3 3v3h3M8 5v3l2 2',
  user: 'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 14c0-2.5 2.2-4 5-4s5 1.5 5 4',
  check: 'M3 8.5L6.5 12 13 4.5',
  x: 'M3 3l10 10M13 3L3 13',
  chevR: 'M6 3l5 5-5 5',
  chevD: 'M3 6l5 5 5-5',
  chevU: 'M3 10l5-5 5 5',
  panelL: 'M2 3h12v10H2zM6 3v10',
  download: 'M8 2v9M4 8l4 4 4-4M2 14h12',
  copy: 'M5 5h7v7H5zM3 3h7v2',
  pause: 'M5 3v10M11 3v10',
  play: 'M4 2l9 6-9 6V2z',
  capture: 'M8 5v6M5 8h6M14 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
  link: 'M9 4.5l2-2a2.5 2.5 0 1 1 3.5 3.5l-2 2M7 11.5l-2 2a2.5 2.5 0 1 1-3.5-3.5l2-2M5.5 10.5l5-5',
  power: 'M5 4a5 5 0 1 0 6 0M8 1v6',
  refresh: 'M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3',
  alert: 'M8 1.5L15 13H1L8 1.5zM8 6v3M8 11v.5',
  sparkle: 'M8 2v4M8 10v4M2 8h4M10 8h4M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2',
  mic: 'M8 2a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V4a2 2 0 0 0-2-2zM4 8a4 4 0 0 0 8 0M8 12v2',
  doc: 'M4 2h6l3 3v9H4V2zM10 2v3h3',
  trash: 'M3 4h10M5 4V2.5h6V4M6 7v5M10 7v5M4 4l1 10h6l1-10',
  layers: 'M8 2L1 6l7 4 7-4-7-4zM2 9l6 3.5L14 9M2 12l6 3.5L14 12',
};

function Icon({ name, size = 16, color = 'currentColor', stroke = 1.6, fill = 'none', style }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke={color}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}

// Window controls (custom titlebar). Minimize / Maximize / Close.
function WinControls({ tone = 'warm' }) {
  return (
    <div className="tb-controls">
      <button className="tb-btn" aria-label="Minimize">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </button>
      <button className="tb-btn" aria-label="Maximize">
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
      </button>
      <button className="tb-btn close" aria-label="Close">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

// Avatar bubble (user / claude)
function Avatar({ kind = 'user', size = 28 }) {
  if (kind === 'claude') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#c96442',
        display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--serif)',
        fontWeight: 600, fontSize: size * 0.42, flex: '0 0 auto' }}>★</div>
    );
  }
  if (kind === 'opencode') {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, background: 'var(--ink-900)',
        display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--mono)',
        fontWeight: 600, fontSize: size * 0.36, flex: '0 0 auto', letterSpacing: -0.5 }}>oc</div>
    );
  }
  // user
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--cream-200)',
      display: 'grid', placeItems: 'center', color: 'var(--ink-700)', fontWeight: 600,
      fontSize: size * 0.4, flex: '0 0 auto' }}>JK</div>
  );
}

// Colored dot + label
function Status({ tone = 'green', label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-500)' }}>
      <span className={`dot ${tone}`}></span>
      {label}
    </span>
  );
}

// Bayer mosaic placeholder for camera viewport
function BayerPattern({ width = 480, height = 360, debug = false }) {
  // Create a soft Bayer pattern that looks like RG/GB mosaic
  const cell = 2;
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  // Use a CSS background so it stays cheap
  if (debug) {
    return (
      <div style={{ width, height, position: 'relative', background: '#0a0d10',
        backgroundImage: `
          repeating-conic-gradient(from 0deg at 0 0, #b03a3a 0 90deg, #4a8a3a 90deg 180deg, #4a8a3a 180deg 270deg, #3a5a8a 270deg 360deg)
        `,
        backgroundSize: `${cell*2}px ${cell*2}px`,
        imageRendering: 'pixelated',
        filter: 'brightness(.45) contrast(1.2)',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%, transparent 0%, rgba(0,0,0,0.5) 80%)' }}/>
      </div>
    );
  }
  // RGB-decoded "live" preview placeholder — a simulated lab scene.
  return (
    <div style={{ width, height, position: 'relative', background: '#1a1d22', overflow: 'hidden' }}>
      {/* Backdrop gradient = test scene */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg, #4a5666 0%, #2a323d 55%, #1a1d22 100%)' }}/>
      {/* Simulated test target — color checker */}
      <div style={{ position: 'absolute', left: '18%', top: '28%', width: '64%', height: '44%',
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: 4,
        boxShadow: '0 4px 18px rgba(0,0,0,.5)', padding: 6, background: '#0a0d10' }}>
        {[
          '#7b5340','#c2a48f','#5a78a0','#5d7042','#7c7ab2','#73beb2',
          '#c87e3a','#465a9a','#b45f6a','#5e3e6a','#a3b840','#d99c3a',
          '#3a4a85','#4d8a4a','#a83b3a','#dbc63a','#a64b9c','#0e7eaa',
          '#f3f3f3','#c8c8c8','#9b9b9b','#6e6e6e','#444','#1f1f1f'
        ].map((c, i) => <div key={i} style={{ background: c }}/>)}
      </div>
      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(0,0,0,.55) 100%)' }}/>
      {/* HUD crosshair */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 28, height: 28,
        transform: 'translate(-50%,-50%)', border: '1px solid rgba(255,255,255,.5)' }}/>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1,
        background: 'rgba(255,255,255,.12)' }}/>
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1,
        background: 'rgba(255,255,255,.12)' }}/>
    </div>
  );
}

// Mini histogram (RGB)
function Histogram({ width = 240, height = 64, kind = 'rgb' }) {
  const bins = 64;
  const data = React.useMemo(() => {
    const r = [], g = [], b = [];
    for (let i = 0; i < bins; i++) {
      const x = i / bins;
      // Pseudo distributions
      const rv = Math.exp(-Math.pow((x - 0.45) * 3.2, 2)) * 0.9 + Math.exp(-Math.pow((x - 0.78) * 8, 2)) * 0.3;
      const gv = Math.exp(-Math.pow((x - 0.5) * 3.6, 2)) * 1.0;
      const bv = Math.exp(-Math.pow((x - 0.4) * 3.4, 2)) * 0.8 + Math.exp(-Math.pow((x - 0.15) * 6, 2)) * 0.4;
      r.push(rv); g.push(gv); b.push(bv);
    }
    return { r, g, b };
  }, []);
  const path = (arr, max) => {
    const w = width / bins;
    return arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * w).toFixed(1)},${(height - v / max * height).toFixed(1)}`).join(' ') +
      ` L${width},${height} L0,${height} Z`;
  };
  const max = Math.max(...data.r, ...data.g, ...data.b);
  return (
    <svg width={width} height={height} style={{ display: 'block', background: '#11151a' }}>
      <path d={path(data.r, max)} fill="rgba(220,80,70,.7)" />
      <path d={path(data.g, max)} fill="rgba(110,180,90,.7)" />
      <path d={path(data.b, max)} fill="rgba(90,140,220,.7)" />
    </svg>
  );
}

Object.assign(window, { Icon, WinControls, Avatar, Status, BayerPattern, Histogram });
