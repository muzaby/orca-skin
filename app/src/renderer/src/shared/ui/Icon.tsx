import type { CSSProperties } from 'react'

export type IconName =
  | 'chat'
  | 'plus'
  | 'search'
  | 'folder'
  | 'settings'
  | 'send'
  | 'cpu'
  | 'bolt'
  | 'cam'
  | 'board'
  | 'flask'
  | 'history'
  | 'user'
  | 'check'
  | 'x'
  | 'chevR'
  | 'chevD'
  | 'chevU'
  | 'panelL'
  | 'panelR'
  | 'download'
  | 'copy'
  | 'pause'
  | 'play'
  | 'capture'
  | 'link'
  | 'power'
  | 'refresh'
  | 'alert'
  | 'sparkle'
  | 'mic'
  | 'doc'
  | 'trash'
  | 'layers'
  | 'kebab'
  | 'edit'
  | 'clock'
  | 'menu'
  | 'arrowL'
  | 'arrowR'
  | 'briefcase'
  | 'eye'
  | 'code'
  | 'upload'
  | 'pin'
  | 'stop'
  | 'enter'

const ICONS: Record<IconName, string> = {
  chat: 'M3 4h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5V12H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  plus: 'M8 3v10M3 8h10',
  search: 'M11.5 11.5L14 14M7 12.5A5.5 5.5 0 1 1 7 1.5a5.5 5.5 0 0 1 0 11z',
  folder: 'M2 5a1 1 0 0 1 1-1h3l1.5 1.5h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5z',
  settings:
    'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm5.4 2.5l1.3-.8-1-1.7-1.4.6a4.4 4.4 0 0 0-1-.6L11 4h-2l-.3 1.5a4.4 4.4 0 0 0-1 .6l-1.4-.6-1 1.7L6.6 8a4.4 4.4 0 0 0 0 1l-1.3.8 1 1.7 1.4-.6c.3.2.6.4 1 .6L9 13h2l.3-1.5c.4-.2.7-.4 1-.6l1.4.6 1-1.7-1.3-.8a4.4 4.4 0 0 0 0-1z',
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
  panelR: 'M2 3h12v10H2zM10 3v10',
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
  // kebab — 세로 3 dots. circle 대신 stroke 가 그리는 짧은 수직 선분으로 표현
  // (현 Icon 은 stroke 기반이라 dot fill 이 까다로움). 시각적으로 dot 처럼 보이도록 strokeLinecap=round 활용.
  kebab: 'M8 4v.01M8 8v.01M8 12v.01',
  edit: 'M11 2l3 3-7.5 7.5-3.5.5.5-3.5L11 2z',
  clock: 'M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3zM8 5v3l2 1',
  menu: 'M3 4h10M3 8h10M3 12h10',
  arrowL: 'M10 3l-5 5 5 5M5 8h8',
  arrowR: 'M6 3l5 5-5 5M3 8h8',
  // briefcase — 맞춤설정 랜딩 히어로
  briefcase:
    'M2 6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6zM6 5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5M2 8.5h12',
  eye: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  code: 'M5.5 5L2.5 8l3 3M10.5 5l3 3-3 3M9 3.5l-2 9',
  upload: 'M8 11V2M4 6l4-4 4 4M2 14h12',
  // pin — 압정(thumbtack). 머리 캡 + 모인 몸통 + 바늘. stroke single-path 규약 유지.
  pin: 'M5.5 2h5M7 2v3L4.5 7.5h7L9 5V2M8 7.5V13',
  // stop — 둥근 사각형 외곽선(채움 없음, fill=none 기본). 서브에이전트 중단 버튼.
  stop: 'M6 4h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  // enter — Enter/return 키 기호(↵). 우측에서 내려와 좌측으로 꺾이는 화살표. 컴포저 전송 버튼.
  enter: 'M13 4v4a1 1 0 0 1-1 1H4M7 6 4 9l3 3'
}

export interface IconProps {
  name: IconName
  size?: number
  color?: string
  stroke?: number
  fill?: string
  style?: CSSProperties
}

export function Icon({
  name,
  size = 16,
  color = 'currentColor',
  stroke = 1.6,
  fill = 'none',
  style
}: IconProps): React.JSX.Element | null {
  const d = ICONS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={fill}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={d} />
    </svg>
  )
}
