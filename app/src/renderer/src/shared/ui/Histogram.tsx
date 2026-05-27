import { useMemo } from 'react'

export interface HistogramProps {
  width?: number
  height?: number
}

export function Histogram({ width = 240, height = 64 }: HistogramProps): React.JSX.Element {
  const bins = 64
  const data = useMemo(() => {
    const r: number[] = []
    const g: number[] = []
    const b: number[] = []
    for (let i = 0; i < bins; i++) {
      const x = i / bins
      const rv =
        Math.exp(-Math.pow((x - 0.45) * 3.2, 2)) * 0.9 +
        Math.exp(-Math.pow((x - 0.78) * 8, 2)) * 0.3
      const gv = Math.exp(-Math.pow((x - 0.5) * 3.6, 2)) * 1.0
      const bv =
        Math.exp(-Math.pow((x - 0.4) * 3.4, 2)) * 0.8 + Math.exp(-Math.pow((x - 0.15) * 6, 2)) * 0.4
      r.push(rv)
      g.push(gv)
      b.push(bv)
    }
    return { r, g, b }
  }, [])
  const path = (arr: number[], max: number): string => {
    const w = width / bins
    return (
      arr
        .map(
          (v, i) =>
            `${i === 0 ? 'M' : 'L'}${(i * w).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`
        )
        .join(' ') + ` L${width},${height} L0,${height} Z`
    )
  }
  const max = Math.max(...data.r, ...data.g, ...data.b)
  return (
    <svg width={width} height={height} className="block bg-stage-800">
      <path d={path(data.r, max)} fill="rgba(220,80,70,.7)" />
      <path d={path(data.g, max)} fill="rgba(110,180,90,.7)" />
      <path d={path(data.b, max)} fill="rgba(90,140,220,.7)" />
    </svg>
  )
}
