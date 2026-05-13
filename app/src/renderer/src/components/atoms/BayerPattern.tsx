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
        style={{
          width,
          height,
          position: 'relative',
          background: '#0a0d10',
          backgroundImage: `
            repeating-conic-gradient(from 0deg at 0 0, #b03a3a 0 90deg, #4a8a3a 90deg 180deg, #4a8a3a 180deg 270deg, #3a5a8a 270deg 360deg)
          `,
          backgroundSize: `${cell * 2}px ${cell * 2}px`,
          imageRendering: 'pixelated',
          filter: 'brightness(.45) contrast(1.2)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 45%, transparent 0%, rgba(0,0,0,0.5) 80%)'
          }}
        />
      </div>
    )
  }
  return (
    <div style={{ width, height, position: 'relative', background: '#1a1d22', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, #4a5666 0%, #2a323d 55%, #1a1d22 100%)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '18%',
          top: '28%',
          width: '64%',
          height: '44%',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 4,
          boxShadow: '0 4px 18px rgba(0,0,0,.5)',
          padding: 6,
          background: '#0a0d10'
        }}
      >
        {[
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
        ].map((c, i) => (
          <div key={i} style={{ background: c }} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(0,0,0,.55) 100%)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 28,
          height: 28,
          transform: 'translate(-50%,-50%)',
          border: '1px solid rgba(255,255,255,.5)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          background: 'rgba(255,255,255,.12)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background: 'rgba(255,255,255,.12)'
        }}
      />
    </div>
  )
}
