import type { ReactNode } from 'react'
import { Icon } from '../components/atoms/Icon'
import { Avatar } from '../components/atoms/Avatar'
import { Dot } from '../components/atoms/Status'

const ICON_BTN =
  'grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2'

const CHIP =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-panel px-[9px] py-1 text-[11.5px] text-ink2'

interface MsgProps {
  kind: 'user' | 'claude'
  children: ReactNode
  inProgress?: boolean
}

function Msg({ kind, children, inProgress }: MsgProps): React.JSX.Element {
  if (kind === 'user') {
    return (
      <div className="flex gap-3">
        <Avatar kind="user" size={28} />
        <div className="flex-1 pt-[3px]">
          <div className="mb-1 text-[12.5px] font-semibold text-ink">김재훈</div>
          <div className="text-[13.5px] leading-[1.6] text-ink">{children}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <Avatar kind="claude" size={28} />
      <div className="flex-1 pt-[3px]">
        <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          Claude
          {inProgress && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-normal text-ink3">
              <Dot tone="amber" /> 응답 중
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2.5 text-[13.5px] leading-[1.65] text-ink">
          {children}
        </div>
      </div>
    </div>
  )
}

interface ToolProps {
  name: string
  args: string
  status: 'done' | 'running' | string
  duration?: string
}

function Tool({ name, args, status, duration }: ToolProps): React.JSX.Element {
  const tone: 'green' | 'amber' | 'slate' =
    status === 'done' ? 'green' : status === 'running' ? 'amber' : 'slate'
  const label = status === 'done' ? '완료' : status === 'running' ? '실행 중…' : status
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-panel px-3 py-2 font-mono text-[12.5px] text-ink">
      <Dot tone={tone} />
      <span className="font-semibold text-rust">{name}</span>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink3">
        ({args})
      </span>
      <span className="font-sans text-[11px] text-ink3">
        {label}
        {duration ? ` · ${duration}` : ''}
      </span>
    </div>
  )
}

function Table(): React.JSX.Element {
  const rows: [string, string, string, string, string][] = [
    ['R', '108.3', '4.21', '32.4', ''],
    ['G1', '142.7', '4.04', '34.1', ''],
    ['G2', '141.9', '4.79', '32.7', '−1.42 dB vs G1'],
    ['B', '95.6', '4.18', '31.9', '']
  ]
  const cols = 'grid-cols-[60px_1fr_1fr_1fr_1.6fr]'
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-panel font-mono text-[12px]">
      <div
        className={`grid ${cols} border-b border-border bg-cream-50 px-3 py-2 text-[11px] text-ink2`}
      >
        <span>채널</span>
        <span>μ (DN)</span>
        <span>σ</span>
        <span>SNR (dB)</span>
        <span></span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className={`grid ${cols} items-center px-3 py-[7px] text-ink ${
            i < rows.length - 1 ? 'border-b border-border' : ''
          }`}
        >
          <span className="font-semibold">{r[0]}</span>
          <span>{r[1]}</span>
          <span>{r[2]}</span>
          <span className={r[0] === 'G2' ? 'font-semibold text-rust' : ''}>{r[3]}</span>
          <span className="font-sans text-[11px] text-rust">{r[4]}</span>
        </div>
      ))}
    </div>
  )
}

export function ChatPane(): React.JSX.Element {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <div className="flex items-center gap-3 border-b border-border px-6 pb-2.5 pt-3.5">
        <div>
          <div className="font-serif text-[17px] font-semibold tracking-tight text-ink">
            Low-light SNR at G2 channel
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink3">
            <span>cam-validation-v3</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Dot tone="green" /> Claude Code · sonnet-4.5
            </span>
            <span>·</span>
            <span>3 skills · 2 MCP</span>
          </div>
        </div>
        <div className="ml-auto flex gap-1">
          <button className={ICON_BTN}>
            <Icon name="search" size={14} />
          </button>
          <button className={ICON_BTN}>
            <Icon name="copy" size={14} />
          </button>
          <button className={ICON_BTN}>
            <Icon name="settings" size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[22px] overflow-auto px-6 py-5">
        <Msg kind="user">
          저조도 환경에서 G2 채널의 SNR이 G1보다 약 1.4dB 낮게 측정됩니다. 보드를 바꿔도 같은
          패턴이라 디바이스 이슈는 아닌 것 같은데, 우선 캡처를 10장 받아서 채널별 통계를 봐줘.
        </Msg>
        <Msg kind="claude">
          <p>
            좋아요. 보드(<code>OV-9282 / Rev.C</code>)와 연결 상태 확인했습니다. 캡처 시퀀스
            시작합니다.
          </p>
          <Tool
            name="hardware.capture"
            args="frames=10, exposure_ms=33, gain=4x"
            status="done"
            duration="3.2s"
          />
          <Tool
            name="analysis.bayer_split"
            args="pattern=RGGB, dark_subtract=true"
            status="done"
            duration="0.8s"
          />
          <p>통계가 나왔어요. 채널별 평균 / 표준편차입니다:</p>
          <Table />
          <p>
            G1과 G2 차이가 <b>1.42 dB</b>로 일관되게 나타납니다. row-noise 패턴이 의심스러운데, 아래
            라이브 뷰에서 G2-only 디버그 모드 켜고 같이 보시죠.
          </p>
        </Msg>
        <Msg kind="user">
          그래, 디버그 토글 켜줘. 그리고 노출을 50ms로 올리면 어떻게 되는지도 같이 보고싶어.
        </Msg>
        <Msg kind="claude" inProgress>
          <Tool name="hardware.set_exposure" args="value_ms=50" status="running" />
        </Msg>
      </div>

      <div className="px-6 pb-[18px] pt-3">
        <div className="rounded-[14px] border border-border bg-panel px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
          <div className="min-h-9 px-1 py-1.5 text-[13px] text-ink3">Orca에게 메시지 보내기…</div>
          <div className="flex items-center gap-1.5 pt-1">
            <button className={CHIP}>
              <Icon name="plus" size={12} /> 첨부
            </button>
            <button className={CHIP}>
              <Icon name="cam" size={12} /> 현재 프레임
            </button>
            <button className={CHIP}>
              <Icon name="bolt" size={12} /> Skill
            </button>
            <span className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-ink3">claude-sonnet-4.5</span>
              <button className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg border-0 bg-rust text-white">
                <Icon name="send" size={14} color="#fff" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
