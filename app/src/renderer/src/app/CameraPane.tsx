import { Icon } from '../components/atoms/Icon'
import { Dot } from '../components/atoms/Status'
import { BayerPattern } from '../components/atoms/BayerPattern'
import { Histogram } from '../components/atoms/Histogram'

interface SliderProps {
  label: string
  unit: string
  value: number
  min: number
  max: number
  pct: number
}

function Slider({ label, unit, value, min, max, pct }: SliderProps): React.JSX.Element {
  return (
    <div>
      <div className="mb-[5px] flex items-baseline justify-between text-[12px]">
        <span className="text-ink2">{label}</span>
        <span className="font-mono font-semibold text-ink">
          {value} {unit}
        </span>
      </div>
      <div className="relative h-1.5 rounded-[3px] border border-border bg-panel">
        <div
          className="absolute -top-px -bottom-px left-0 rounded-[3px] bg-rust"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-rust bg-white shadow-[0_1px_3px_rgba(0,0,0,.15)]"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-[3px] flex justify-between font-mono text-[10px] text-ink3">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

interface MetricProps {
  label: string
  value: string
  unit?: string
  tone?: 'ok' | 'warn' | 'bad'
}

const METRIC_TONE: Record<'ok' | 'warn' | 'bad', string> = {
  ok: 'text-ink',
  warn: 'text-amber',
  bad: 'text-rust'
}

export function Metric({ label, value, unit, tone = 'ok' }: MetricProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-panel px-2.5 py-[7px]">
      <div className="text-[10px] uppercase tracking-[0.04em] text-ink3">{label}</div>
      <div className={`mt-0.5 font-mono text-[15px] font-semibold ${METRIC_TONE[tone]}`}>
        {value}
        <span className="ml-[3px] text-[10px] font-normal text-ink3">{unit}</span>
      </div>
    </div>
  )
}

export function CameraPane(): React.JSX.Element {
  const tabs: [string, boolean][] = [
    ['RGB', true],
    ['Bayer', false],
    ['R', false],
    ['G1', false],
    ['G2', false],
    ['B', false]
  ]
  return (
    <section className="flex w-[480px] flex-none flex-col border-l border-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-border px-4 pb-2 pt-3">
        <Icon name="cam" size={15} />
        <span className="font-serif text-[14px] font-semibold text-ink">하드웨어 제어</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-ink2">
          <Dot tone="green" /> COM7 · OV-9282
        </span>
      </div>

      <div className="bg-stage-900 p-3">
        <div className="relative overflow-hidden rounded-md">
          <BayerPattern width={456} height={258} />
          <div className="absolute left-2.5 right-2.5 top-2 flex justify-between font-mono text-[10.5px] text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
            <span>1280×720 · RGGB · 10-bit</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-[#e44a3a]" /> REC · 00:14
            </span>
          </div>
          <div className="absolute bottom-2 left-2.5 right-2.5 flex justify-between font-mono text-[10.5px] text-white/70">
            <span>EXP 50.0ms</span>
            <span>GAIN 4.0×</span>
            <span>FPS 19.8</span>
            <span>T 38.4°C</span>
          </div>
        </div>
        <div className="mt-2 flex gap-1 rounded-md bg-stage-700 p-[3px]">
          {tabs.map(([t, a]) => (
            <button
              key={t}
              className={`flex-1 cursor-pointer rounded border-0 py-[5px] font-mono text-[10.5px] ${
                a ? 'bg-stage-600 text-white' : 'bg-transparent text-white/55'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-1 pt-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink2">
            Histogram
          </span>
          <span className="font-mono text-[10.5px] text-ink3">0 – 1023 DN</span>
        </div>
        <Histogram width={448} height={56} />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-2.5 pt-3.5">
        <Slider label="노출 (Exposure)" unit="ms" value={50.0} min={1} max={120} pct={42} />
        <Slider label="아날로그 게인" unit="×" value={4.0} min={1} max={16} pct={26} />
        <Slider label="디지털 게인" unit="dB" value={0.0} min={0} max={24} pct={0} />
      </div>

      <div className="px-4 pb-2 pt-1">
        <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-ink2">
          품질 메트릭
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Metric label="SNR" value="32.7" unit="dB" tone="warn" />
          <Metric label="Sharpness" value="0.84" tone="ok" />
          <Metric label="DR" value="58.2" unit="dB" tone="ok" />
          <Metric label="Δ G1−G2" value="1.42" unit="dB" tone="bad" />
        </div>
      </div>

      <div className="mt-auto flex gap-2 border-t border-border p-3.5">
        <button
          type="button"
          disabled
          title="v1 비대상 — Future Scope (PRD §9)"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border-0 bg-rust py-[9px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="capture" size={14} color="#fff" /> 캡처
        </button>
        <button
          type="button"
          disabled
          title="v1 비대상 — Future Scope (PRD §9)"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-panel py-[9px] font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="layers" size={14} /> 시퀀스
        </button>
        <button
          type="button"
          disabled
          title="v1 비대상 — Future Scope (PRD §9)"
          className="grid w-9 place-items-center rounded-lg border border-border bg-panel py-[9px] text-ink2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="history" size={14} />
        </button>
      </div>
    </section>
  )
}
