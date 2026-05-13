import { Icon } from '../components/atoms/Icon'
import { BayerPattern } from '../components/atoms/BayerPattern'
import { Histogram } from '../components/atoms/Histogram'
import { V1 } from './theme'

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 12,
          marginBottom: 5
        }}
      >
        <span style={{ color: V1.ink2 }}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', color: V1.ink, fontWeight: 600 }}>
          {value} {unit}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 6,
          background: V1.panel,
          borderRadius: 3,
          border: `1px solid ${V1.border}`
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -1,
            bottom: -1,
            width: `${pct}%`,
            background: V1.rust,
            borderRadius: 3
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            border: `2px solid ${V1.rust}`,
            boxShadow: '0 1px 3px rgba(0,0,0,.15)'
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: V1.ink3,
          fontFamily: 'var(--mono)',
          marginTop: 3
        }}
      >
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

export function Metric({ label, value, unit, tone = 'ok' }: MetricProps): React.JSX.Element {
  const colors: Record<'ok' | 'warn' | 'bad', string> = {
    ok: V1.ink,
    warn: '#c79431',
    bad: V1.rust
  }
  return (
    <div
      style={{
        background: V1.panel,
        border: `1px solid ${V1.border}`,
        borderRadius: 8,
        padding: '7px 10px'
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: V1.ink3,
          textTransform: 'uppercase',
          letterSpacing: 0.4
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 15,
          fontWeight: 600,
          color: colors[tone],
          marginTop: 2
        }}
      >
        {value}
        <span style={{ fontSize: 10, fontWeight: 400, color: V1.ink3, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  )
}

export function CameraPane(): React.JSX.Element {
  return (
    <section
      style={{
        width: 480,
        flex: '0 0 auto',
        background: V1.sidebar,
        borderLeft: `1px solid ${V1.border}`,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          padding: '12px 16px 8px',
          borderBottom: `1px solid ${V1.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <Icon name="cam" size={15} />
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 14, color: V1.ink }}>
          하드웨어 제어
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: V1.ink2,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5
          }}
        >
          <span className="dot green" /> COM7 · OV-9282
        </span>
      </div>

      <div style={{ padding: 12, background: '#0c0f12' }}>
        <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
          <BayerPattern width={456} height={258} />
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 10,
              right: 10,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'rgba(255,255,255,.85)',
              textShadow: '0 1px 2px rgba(0,0,0,.5)'
            }}
          >
            <span>1280×720 · RGGB · 10-bit</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e44a3a' }} />{' '}
              REC · 00:14
            </span>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 10,
              right: 10,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'rgba(255,255,255,.7)'
            }}
          >
            <span>EXP 50.0ms</span>
            <span>GAIN 4.0×</span>
            <span>FPS 19.8</span>
            <span>T 38.4°C</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginTop: 8,
            padding: 3,
            background: '#1a1d22',
            borderRadius: 6
          }}
        >
          {(
            [
              ['RGB', true],
              ['Bayer', false],
              ['R', false],
              ['G1', false],
              ['G2', false],
              ['B', false]
            ] as [string, boolean][]
          ).map(([t, a]) => (
            <button
              key={t}
              style={{
                flex: 1,
                padding: '5px 0',
                border: 0,
                borderRadius: 4,
                fontSize: 10.5,
                fontFamily: 'var(--mono)',
                background: a ? '#2a323d' : 'transparent',
                color: a ? '#fff' : 'rgba(255,255,255,.55)',
                cursor: 'pointer'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 16px 4px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              color: V1.ink2,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontWeight: 600
            }}
          >
            Histogram
          </span>
          <span style={{ fontSize: 10.5, color: V1.ink3, fontFamily: 'var(--mono)' }}>
            0 – 1023 DN
          </span>
        </div>
        <Histogram width={448} height={56} />
      </div>

      <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Slider label="노출 (Exposure)" unit="ms" value={50.0} min={1} max={120} pct={42} />
        <Slider label="아날로그 게인" unit="×" value={4.0} min={1} max={16} pct={26} />
        <Slider label="디지털 게인" unit="dB" value={0.0} min={0} max={24} pct={0} />
      </div>

      <div style={{ padding: '4px 16px 8px' }}>
        <div
          style={{
            fontSize: 11.5,
            color: V1.ink2,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: 600,
            marginBottom: 6
          }}
        >
          품질 메트릭
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <Metric label="SNR" value="32.7" unit="dB" tone="warn" />
          <Metric label="Sharpness" value="0.84" tone="ok" />
          <Metric label="DR" value="58.2" unit="dB" tone="ok" />
          <Metric label="Δ G1−G2" value="1.42" unit="dB" tone="bad" />
        </div>
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: 14,
          borderTop: `1px solid ${V1.border}`,
          display: 'flex',
          gap: 8
        }}
      >
        <button
          style={{
            flex: 1,
            padding: '9px 0',
            border: 0,
            borderRadius: 8,
            background: V1.rust,
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <Icon name="capture" size={14} color="#fff" /> 캡처
        </button>
        <button
          style={{
            flex: 1,
            padding: '9px 0',
            border: `1px solid ${V1.border}`,
            borderRadius: 8,
            background: V1.panel,
            color: V1.ink,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <Icon name="layers" size={14} /> 시퀀스
        </button>
        <button
          style={{
            width: 36,
            padding: '9px 0',
            border: `1px solid ${V1.border}`,
            borderRadius: 8,
            background: V1.panel,
            color: V1.ink2,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center'
          }}
        >
          <Icon name="history" size={14} />
        </button>
      </div>
    </section>
  )
}
