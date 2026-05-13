export interface BayerPatternProps {
  width?: number
  height?: number
  debug?: boolean
}

export function BayerPattern({
  width = 480,
  height = 360,
  debug = false
}: BayerPatternProps): React.JSX.Element {
  const cell = 2
  if (debug) {
    return (
      <div
        className="relative overflow-hidden bg-stage-950"
        style={{
          width,
          height,
          backgroundImage: `
            repeating-conic-gradient(from 0deg at 0 0, #b03a3a 0 90deg, #4a8a3a 90deg 180deg, #4a8a3a 180deg 270deg, #3a5a8a 270deg 360deg)
          `,
          backgroundSize: `${cell * 2}px ${cell * 2}px`,
          imageRendering: 'pixelated',
          filter: 'brightness(.45) contrast(1.2)'
        }}
      >
        <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_45%,transparent_0%,rgba(0,0,0,0.5)_80%)]" />
      </div>
    )
  }
  const swatches = [
    '#7b5340',
    '#c2a48f',
    '#5a78a0',
    '#5d7042',
    '#7c7ab2',
    '#73beb2',
    '#c87e3a',
    '#465a9a',
    '#b45f6a',
    '#5e3e6a',
    '#a3b840',
    '#d99c3a',
    '#3a4a85',
    '#4d8a4a',
    '#a83b3a',
    '#dbc63a',
    '#a64b9c',
    '#0e7eaa',
    '#f3f3f3',
    '#c8c8c8',
    '#9b9b9b',
    '#6e6e6e',
    '#444',
    '#1f1f1f'
  ]
  return (
    <div className="relative overflow-hidden bg-stage-700" style={{ width, height }}>
      <div className="absolute inset-0 [background:linear-gradient(160deg,#4a5666_0%,#2a323d_55%,#1a1d22_100%)]" />
      <div
        className="absolute left-[18%] top-[28%] grid h-[44%] w-[64%] gap-1 bg-stage-950 p-1.5 shadow-[0_4px_18px_rgba(0,0,0,.5)]"
        style={{
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)'
        }}
      >
        {swatches.map((c, i) => (
          <div key={i} style={{ background: c }} />
        ))}
      </div>
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_50%_40%,transparent_30%,rgba(0,0,0,.55)_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 border border-white/50" />
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
      <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
    </div>
  )
}
