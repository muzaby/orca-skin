import { Icon } from '../components/atoms/Icon'
import { Dot } from '../components/atoms/Status'
import type { StatusTone } from '../components/atoms/Status'

interface Project {
  id: string
  name: string
  desc: string
  engine: string
  model: string
  sessions: number
  captures: number
  last: string
  active?: boolean
  tone: StatusTone
}

const PROJECTS: Project[] = [
  {
    id: 'cam',
    name: 'cam-validation-v3',
    desc: 'OV-9282 검증, 저조도 SNR 회귀 테스트',
    engine: 'Claude Code',
    model: 'sonnet-4.5',
    sessions: 12,
    captures: 248,
    last: '14분 전',
    active: true,
    tone: 'green'
  },
  {
    id: 'snr',
    name: 'snr-regression-2026',
    desc: 'IMX-415 야간 모드 SNR 추적, 주간 리그레션',
    engine: 'OpenCode',
    model: 'gpt-4.1',
    sessions: 5,
    captures: 96,
    last: '2시간 전',
    tone: 'amber'
  },
  {
    id: 'aec',
    name: 'aec-tuning-suite',
    desc: '자동 노출 수렴 시간 최적화 — 차량용 캠',
    engine: 'Claude Code',
    model: 'sonnet-4.5',
    sessions: 8,
    captures: 412,
    last: '어제',
    tone: 'green'
  },
  {
    id: 'bay',
    name: 'bayer-debug',
    desc: 'Bayer pattern 디버깅 / 채널 분리 도구',
    engine: 'Local (llama.cpp)',
    model: 'qwen-coder-30b',
    sessions: 3,
    captures: 18,
    last: '4일 전',
    tone: 'slate'
  }
]

export function Projects(): React.JSX.Element {
  return (
    <section className="flex-1 overflow-auto px-8 pb-10 pt-6">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.02em] text-ink">
          프로젝트
        </h1>
        <span className="text-[13px] text-ink3">4개의 활성 워크스페이스</span>
        <button className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-rust px-3.5 py-[7px] text-[12.5px] font-medium text-white">
          <Icon name="plus" size={13} color="#fff" /> 새 프로젝트
        </button>
      </div>
      <p className="mb-[22px] mt-1.5 text-[13.5px] text-ink2">
        각 프로젝트는 자체 엔진, 모델, Skill/MCP, 캡처 히스토리를 가집니다.
      </p>

      <div className="mb-4 flex gap-1.5">
        {['모두 (4)', 'Claude Code (2)', 'OpenCode (1)', '로컬 (1)', '보관'].map((c, i) => (
          <button
            key={c}
            className={`cursor-pointer rounded-full px-3 py-[5px] text-[12px] text-ink2 ${
              i === 0
                ? 'border border-border-strong bg-panel'
                : 'border border-border bg-transparent'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            className={`relative rounded-xl bg-panel p-4 ${
              p.active ? 'border border-border-strong' : 'border border-border'
            }`}
          >
            {p.active && (
              <div className="absolute right-3.5 top-3 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-rust">
                활성
              </div>
            )}
            <div className="mb-1 flex items-center gap-2.5">
              <Dot tone={p.tone} />
              <span className="font-mono text-[14px] font-semibold text-ink">{p.name}</span>
            </div>
            <div className="mb-3 text-[12.5px] leading-[1.5] text-ink2">{p.desc}</div>
            <div className="mb-2.5 flex gap-3.5 text-[11.5px] text-ink3">
              <span>
                <Icon name="cpu" size={11} style={{ verticalAlign: -1, marginRight: 3 }} />{' '}
                {p.engine}
              </span>
              <span className="font-mono">{p.model}</span>
            </div>
            <div className="flex items-center gap-4 border-t border-border pt-2.5 text-[11.5px] text-ink2">
              <span>
                <b className="text-ink">{p.sessions}</b> 대화
              </span>
              <span>
                <b className="text-ink">{p.captures}</b> 캡처
              </span>
              <span className="ml-auto text-ink3">{p.last}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
