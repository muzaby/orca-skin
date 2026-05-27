import { Icon } from '../../../shared/ui/Icon'
import { Dot } from '../../../shared/ui/Status'
import type { StatusTone } from '../../../shared/ui/Status'

interface Skill {
  name: string
  desc: string
  enabled: boolean
}

interface Mcp {
  name: string
  cmd: string
  tools: number
  status: StatusTone
  enabled: boolean
}

const SKILLS: Skill[] = [
  { name: 'bayer-analysis', desc: 'RAW 프레임을 채널별로 분리하고 SNR/DR 계산', enabled: true },
  { name: 'mtf-sfr', desc: 'Slanted-edge MTF / SFR 계산 (ISO 12233)', enabled: true },
  { name: 'capture-batch', desc: '시퀀스 캡처 헬퍼 (노출 sweep, gain sweep)', enabled: true },
  { name: 'flat-field', desc: 'Flat field 보정 / vignetting 분석', enabled: false },
  { name: 'color-checker', desc: 'X-Rite 차트 자동 검출 + ΔE 계산', enabled: false }
]

const MCPS: Mcp[] = [
  {
    name: 'cam-board-mcp',
    cmd: 'node ./mcp/board-server.js',
    tools: 14,
    status: 'green',
    enabled: true
  },
  { name: 'github', cmd: 'mcp-server-github', tools: 8, status: 'green', enabled: true },
  {
    name: 'jira-validation',
    cmd: 'mcp-jira --project=CAMVAL',
    tools: 6,
    status: 'amber',
    enabled: false
  }
]

function SectionHead({
  title,
  count,
  action
}: {
  title: string
  count?: string
  action?: string
}): React.JSX.Element {
  return (
    <div className="mb-2.5 flex items-baseline gap-2.5">
      <span className="font-serif text-[16px] font-semibold text-ink">{title}</span>
      {count && <span className="text-[12px] text-ink3">{count}</span>}
      {action && (
        <button className="ml-auto cursor-pointer border-0 bg-transparent text-[12px] font-medium text-rust">
          + {action}
        </button>
      )}
    </div>
  )
}

function Toggle({ on }: { on: boolean }): React.JSX.Element {
  return (
    <div
      className={`relative h-[17px] w-[30px] flex-none cursor-pointer rounded-[9px] ${
        on ? 'bg-rust' : 'bg-border-strong'
      }`}
    >
      <div
        className="absolute top-[1.5px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] duration-150"
        style={{ left: on ? 14.5 : 1.5 }}
      />
    </div>
  )
}

function PermRow({ label, desc }: { label: string; desc: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon name="check" size={13} color="#5a8a4f" />
      <div className="flex-1">
        <div className="font-medium text-ink">{label}</div>
        <div className="text-[11.5px] text-ink3">{desc}</div>
      </div>
      <button className="cursor-pointer border-0 bg-transparent text-[11px] text-ink3">편집</button>
    </div>
  )
}

export function SkillsMcpView(): React.JSX.Element {
  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          Skills & MCP
        </h1>
        <span className="text-[13px] text-ink3">Claude가 사용할 수 있는 도구</span>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">
        <b>cam-validation-v3</b> 프로젝트에 설치된 항목입니다.
      </p>

      <div className="grid grid-cols-[1.2fr_1fr] gap-[22px]">
        <div>
          <SectionHead title="Skills" count="3 / 5 활성" action="설치" />
          <div className="overflow-hidden rounded-xl border border-border bg-panel">
            {SKILLS.map((s, i) => (
              <div
                key={s.name}
                className={`flex items-center gap-3 px-3.5 py-3 ${
                  i < SKILLS.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="grid h-[30px] w-[30px] place-items-center rounded-md bg-cream-50">
                  <Icon name="bolt" size={14} color={s.enabled ? '#c96442' : '#a8a092'} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-mono text-[12.5px] font-semibold ${
                      s.enabled ? 'text-ink' : 'text-ink3'
                    }`}
                  >
                    {s.name}
                  </div>
                  <div className="mt-px text-[11.5px] text-ink2">{s.desc}</div>
                </div>
                <Toggle on={s.enabled} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHead title="MCP 서버" count="2 / 3 연결됨" action="추가" />
          <div className="overflow-hidden rounded-xl border border-border bg-panel">
            {MCPS.map((m, i) => (
              <div
                key={m.name}
                className={`px-3.5 py-3 ${i < MCPS.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <Dot tone={m.status} />
                  <span className="font-mono text-[12.5px] font-semibold text-ink">{m.name}</span>
                  <span className="ml-auto text-[11px] text-ink3">{m.tools} 툴</span>
                  <Toggle on={m.enabled} />
                </div>
                <div className="mt-1 pl-[17px] font-mono text-[11px] text-ink2">{m.cmd}</div>
              </div>
            ))}
          </div>

          <div className="mt-[22px]">
            <SectionHead title="권한" />
            <div className="rounded-xl border border-border bg-panel p-3.5 text-[12.5px]">
              <PermRow label="하드웨어 보드 제어" desc="capture, set_exposure, set_gain" />
              <PermRow label="파일 시스템 (워크스페이스)" desc="cam-validation-v3/ 안에서만" />
              <PermRow label="네트워크" desc="회사 GitLab + 로컬 MCP만 허용" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
