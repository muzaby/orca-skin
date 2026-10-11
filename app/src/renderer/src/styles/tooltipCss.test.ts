// 0257 AC3·AC6·AC7·AC8 — 툴팁 표면·토큰·호스트 마운트를 원문에서 읽는다(node 환경 — 색 계산 없음).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TOOLTIP_SURFACE } from '../shared/ui/tooltipStyle'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')
const tokens = read('styles/tokens.css')

describe('0257 — 검은 툴팁 표면', () => {
  it('표면 SSOT 는 검은 배경·흰 글자·줄바꿈 유지·최대 폭 28rem 이다', () => {
    for (const cls of ['bg-tooltip', 'text-tooltip-ink', 'whitespace-pre-line', 'max-w-[min(28rem'])
      expect(TOOLTIP_SURFACE).toContain(cls)
  })

  it('색 토큰 3종은 @theme 에만 있고 다크 스코프에서 재정의되지 않는다 (AC7)', () => {
    const theme = tokens.slice(
      tokens.indexOf('@theme {'),
      tokens.indexOf('\n}', tokens.indexOf('@theme {'))
    )
    expect(theme).toContain('--color-tooltip: #0b0b0b;')
    expect(theme).toContain('--color-tooltip-ink: #ffffff;')
    expect(theme).toContain('--color-tooltip-ink-muted:')
    const dark = tokens.slice(tokens.indexOf("[data-theme='dark'] {"))
    expect(dark).not.toContain('--color-tooltip')
  })

  it('Popover tooltip 분기는 표면 SSOT 를 쓴다 (AC6)', () => {
    expect(read('shared/ui/Popover.tsx')).toContain("role === 'tooltip' ? TOOLTIP_SURFACE")
  })

  it('앱 루트가 TooltipHost 를 정확히 1회 마운트한다 (AC3)', () => {
    expect(read('App.tsx').match(/<TooltipHost \/>/g)).toHaveLength(1)
  })

  it('프로덕션 renderer 에 SVG <title> 툴팁 경로가 없다 (AC8)', () => {
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (
          name.endsWith('.tsx') &&
          !name.includes('.test.') &&
          readFileSync(p, 'utf8').includes('<title>')
        )
          hits.push(p)
      }
    }
    walk(SRC)
    expect(hits).toEqual([])
  })
})
