// Orca Skin — Icons
// Single Icon component + sparkle logo.
// All icons share a 24×24 viewBox, stroke-based, line-cap round.

const ICONS = {
  // ── Window chrome / nav rail
  hamburger:   'M3 6h18M3 12h18M3 18h18',
  sidebar:     'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5zM10 5.5v13',
  search:      'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5.5-5.5',
  arrowL:      'M15 6l-6 6 6 6',
  arrowR:      'M9 6l6 6-6 6',
  minimize:    'M5 12h14',
  maximize:    'M5.5 5.5h13v13h-13z',
  close:       'M6 6l12 12M18 6L6 18',
  // ── Sidebar tabs
  chat:        'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 4v-4H6a2 2 0 0 1-2-2V6z',
  cowork:      'M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h7',
  code:        'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14',
  // ── Sidebar nav
  plus:        'M12 5v14M5 12h14',
  projects:    'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  schedule:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v4l3 2',
  fish:        'M3 12c3-5 8-7 12-7 4 0 6 3 6 7s-2 7-6 7c-4 0-9-2-12-7zM6 12l-3-2v4l3-2zM16 11.5a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4z',
  dispatch:    'M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4v4h4M8 13h7M8 17h5M8 9h3',
  customize:   'M4 6h11M4 12h7M4 18h11M19 4v6M19 14v6M16 7h6M16 17h6',
  // ── Empty state / suggestions
  shuffle:     'M3 6h4l10 12h4M3 18h4l3-4M14 8l3-2h4M17 3l4 3-4 3M17 15l4 3-4 3',
  mic:         'M12 4a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3zM5 12a7 7 0 0 0 14 0M12 19v3',
  hand:        'M9 10V5a1.5 1.5 0 1 1 3 0v5M12 10V4a1.5 1.5 0 1 1 3 0v6M15 10V5a1.5 1.5 0 1 1 3 0v8a7 7 0 0 1-7 7c-3 0-5-2-6-4l-3-5a1.5 1.5 0 0 1 2.5-1.7L7 12V7a1.5 1.5 0 1 1 3 0v3',
  folder:      'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
  folderPlus:  'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6zM12 11v5M9.5 13.5h5',
  folderImp:   'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6zM12 16V9M9 12l3-3 3 3',
  package:     'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10M7.5 5l9 4',
  sun:         'M12 5v2M12 17v2M5 12h2M17 12h2M7 7l1.5 1.5M15.5 15.5L17 17M7 17l1.5-1.5M15.5 8.5L17 7M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  screenshot:  'M3 7a2 2 0 0 1 2-2h2l1.5-2h7L17 5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  insight:     'M4 5h16v12H4zM4 17l5-5 3 3 4-4 4 4M16 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  // ── Composer / chips
  chevronD:    'M6 9l6 6 6-6',
  chevronR:    'M9 6l6 6-6 6',
  chevronU:    'M6 15l6-6 6 6',
  star:        'M12 4v3M12 17v3M4 12h3M17 12h3M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2',
  starFill:    'M12 3l2 5 5 1-4 4 1 5-4-3-4 3 1-5-4-4 5-1z',
  arrowUp:     'M12 5v14M5 12l7-7 7 7',
  arrowDown:   'M12 5v14M5 12l7 7 7-7',
  refresh:     'M21 12a9 9 0 1 1-3.5-7.1M21 4v5h-5',
  // ── Artifact / preview chrome
  eye:         'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  codeSlash:   'M8 8l-4 4 4 4M16 8l4 4-4 4',
  rightPane:   'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5zM14 5.5v13',
  share:       'M12 4v12M7 9l5-5 5 5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',
  // ── Common
  check:       'M5 12l5 5L20 7',
  checkCircle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12l3 3 5-6',
  alert:       'M12 3l10 18H2L12 3zM12 10v5M12 17.5v.5',
  download:    'M12 4v12M6 12l6 6 6-6M4 20h16',
  cloudDown:   'M7 18a4 4 0 1 1 .5-7.9A5 5 0 0 1 17 11a4 4 0 0 1-2 7.9M12 13v5M9.5 16l2.5 2.5L14.5 16',
  copy:        'M9 9h9v9H9zM6 6h9v3M6 6v9h3',
  thumbUp:     'M6 11h2v10H6zM8 11l4-7a2 2 0 0 1 4 0v5h4a1 1 0 0 1 1 1l-2 8a2 2 0 0 1-2 1.5H8',
  thumbDown:   'M6 13h2V3H6zM8 13l4 7a2 2 0 0 0 4 0v-5h4a1 1 0 0 0 1-1l-2-8a2 2 0 0 0-2-1.5H8',
  history:     'M3 12a9 9 0 1 0 2-5.5L3 8M3 4v4h4M12 7v5l3 2',
  doc:         'M6 3h8l4 4v14H6zM14 3v4h4',
  docMd:       'M6 3h8l4 4v14H6zM14 3v4h4M9 14v-4l1.5 2 1.5-2v4M15 14v-4M13.5 12.5L15 14l1.5-1.5',
  trash:       'M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12',
  terminal:    'M3 4h18v16H3zM6 9l3 3-3 3M11 16h6',
  tool:        'M14 4a4 4 0 1 0 4 4 4 4 0 0 0-4-4zM11 11l-7 7 2 2 7-7',
  cog:         'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  drive:       'M8 3l4 7-4 7H4l-4-7zM12 3h8l4 7-4 7h-8l4-7z',
  // ── Schedule / settings additions
  coffee:      'M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8zM16 9h2.5a2.5 2.5 0 0 1 0 5H16M4 4c0 1 1 1 1 2M9 4c0 1 1 1 1 2M14 4c0 1 1 1 1 2',
  listCheck:   'M4 7l2 2 3-3M4 14l2 2 3-3M12 8h8M12 15h6',
  info:        'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 11v5M12 7.5v.5',
  play:        'M7 5l12 7-12 7V5z',
  edit:        'M4 20h4l10-10-4-4L4 16v4zM14 6l4 4',
  globe:       'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  question:    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1 1.2-1 2.2M12 17v.5',
  list:        'M4 6h2v2H4zM4 11h2v2H4zM4 16h2v2H4zM9 7h11M9 12h11M9 17h7',
  gift:        'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M9 8a2.5 2.5 0 1 1 3-3.5A2.5 2.5 0 1 1 15 8',
  ext:         'M4 8h4V4H4zM8 8v4h4V8M12 4h4v4M12 12h4v4M16 8h4v4h-4M12 16h4v4h-4M4 12h4v4H4zM4 16h4v4H4z',
  billing:     'M4 6h16v12H4zM4 10h16M8 14h4',
  logout:      'M14 16l4-4-4-4M18 12H8M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6',
  monitor:     'M3 5h18v12H3zM8 21h8M12 17v4',
  moon:        'M20 14.5A8 8 0 1 1 9.5 4 7 7 0 0 0 20 14.5z',
  sunSimple:   'M12 4v2M12 18v2M4 12h2M18 12h2M6 6l1.5 1.5M16.5 16.5L18 18M6 18l1.5-1.5M16.5 7.5L18 6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  sortUpDown:  'M7 4v16M4 8l3-4 3 4M17 4v16M14 16l3 4 3-4',
  pencil:      'M5 19l3-1 10-10-2-2L6 16l-1 3zM14 7l2 2',
  pinFill:     'M14 4l6 6-4 2 1 5-3-2-5 5v-5l-3-3 5-5 3 1z',
  clockSm:     'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  brief:       'M5 7h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7zM9 7V5a3 3 0 1 1 6 0v2M3 11h18',
  doc2:        'M6 3h8l4 4v14H6zM14 3v4h4M9 11h6M9 14h6M9 17h4',
  arrowLong:   'M5 12h14M14 7l5 5-5 5',
  toggleOn:    'M3 12a5 5 0 0 1 5-5h8a5 5 0 0 1 0 10H8a5 5 0 0 1-5-5zM16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0z',
  toggleOff:   'M3 12a5 5 0 0 1 5-5h8a5 5 0 0 1 0 10H8a5 5 0 0 1-5-5zM8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0z',
  ctrlKbd:     'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
};

function Icon({ name, size = 18, color = 'currentColor', stroke = 1.6, fill = 'none', style }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}
         aria-hidden="true">
      <path d={d}/>
    </svg>
  );
}

// Claude-style sparkle / asterisk used as the brand mark and as message avatar.
function Sparkle({ size = 24, color = 'var(--rust)', style }) {
  // 8-point asterisk — drawn as 4 ellipses overlapping at center.
  const s = size, c = s / 2;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {[0, 45, 90, 135].map((deg) => (
        <ellipse
          key={deg}
          cx={c} cy={c}
          rx={s * 0.42 * (24 / s)} ry={s * 0.085 * (24 / s)}
          fill={color}
          transform={`rotate(${deg} ${c} ${c})`}
        />
      ))}
    </svg>
  );
}

// Window controls (Windows-style: − ☐ ✕)
function WinControls({ tone = 'light' }) {
  return (
    <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
      <button className="winctrl" title="Minimize"><Icon name="minimize" size={14}/></button>
      <button className="winctrl" title="Maximize"><Icon name="maximize" size={11} stroke={1.3}/></button>
      <button className="winctrl close" title="Close"><Icon name="close" size={13}/></button>
    </div>
  );
}

Object.assign(window, { Icon, Sparkle, WinControls });
