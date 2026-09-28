import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorToastHost } from './ErrorToastHost'
import { errorToastStore } from '../errors/errorToastStore'
import { ERROR_TOAST_DURATION_MS } from '../errors/errorToastModel'
import { i18n } from '../i18n'

afterEach(() => {
  for (const { id } of errorToastStore.getState().toasts) errorToastStore.getState().dismiss(id)
  errorToastStore.getInitialState().toasts = []
  vi.useRealTimers()
})

describe('ErrorToastHost', () => {
  it('renders two alerts with translated titles, escaped details and accessible close buttons', () => {
    void i18n.changeLanguage('ko')
    errorToastStore
      .getState()
      .push({ id: 'a', title: 'loadFailed', detail: '<script>detail</script>', origin: 'main' })
    errorToastStore.getState().push({ id: 'b', title: 'copyFailed', origin: 'renderer' })
    errorToastStore.getInitialState().toasts = errorToastStore.getState().toasts
    const html = renderToStaticMarkup(createElement(ErrorToastHost, { onOpen: vi.fn() }))
    expect(html.match(/role="alert"/g)).toHaveLength(2)
    expect(html).toContain('정보를 불러오지 못했습니다')
    expect(html).toContain('클립보드에 복사하지 못했습니다')
    expect(html).toContain('&lt;script&gt;detail&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html.match(/aria-label="닫기"/g)).toHaveLength(2)
    expect(html).toContain('motion-reduce:animate-none')
    for (const token of [
      'fixed',
      'right-[28px]',
      'top-[38px]',
      'w-[min(480px,calc(100vw-56px))]',
      'max-sm:right-[14px]',
      'max-sm:w-[calc(100vw-28px)]',
      'grid-cols-[34px_1fr_24px]',
      'gap-[10px]',
      'rounded-[13px]',
      'border-toast-border',
      'bg-toast-bg',
      'py-[13px]',
      'pl-[14px]',
      'pr-[13px]',
      'shadow-[var(--shadow-toast)]',
      'size-[30px]',
      'rounded-[8px]',
      'border-toast-icon-border',
      'text-rust',
      'text-[13.5px]',
      'font-[620]',
      'leading-[1.35]',
      'text-toast-title',
      'mt-[3px]',
      'text-[12.5px]',
      'leading-[1.4]',
      'text-toast-desc',
      'text-[18px]',
      'text-toast-close',
      '[font-family:var(--font-app)]'
    ])
      expect(html).toContain(token)
  })

  it('uses Orca semantic aliases in both themes and the specified subtle 4.6s keyframes', () => {
    const css = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')
    for (const [name, source] of [
      ['bg', 'panel'],
      ['border', 'border'],
      ['icon-border', 'border-strong'],
      ['title', 'ink'],
      ['desc', 'ink2'],
      ['close', 'ink3']
    ]) {
      expect(css).toContain(`--color-toast-${name}: var(--color-${source});`)
      expect(css.split("[data-theme='dark'] {")[1]).toMatch(new RegExp(`--color-${source}:`))
    }
    expect(css).toMatch(/--animate-error-toast:\s*error-toast 4\.6s/)
    expect(css).toContain('cubic-bezier(0.2, 0.75, 0.2, 1) both')
    expect(css).toContain('0 12px 34px color-mix(in srgb, black 12%, transparent)')
    expect(css).toContain('0 12px 34px rgb(0 0 0 / 0.35)')
    expect(ERROR_TOAST_DURATION_MS / 1000).toBe(4.6)
    for (const [stop, opacity, y, scale] of [
      [0, 0, '-6px', '0.992'],
      [4, 1, '0', '1'],
      [86, 1, '0', '1'],
      [100, 0, '-3px', '0.996']
    ]) {
      const frames = css.slice(css.indexOf('@keyframes error-toast'))
      const body = frames.match(new RegExp(`(?:^|\\s)${stop}%\\s*\\{([^}]+)\\}`))![1]
      expect(body).toMatch(new RegExp(`opacity:\\s*${opacity};`))
      expect(body).toContain(`translateY(${y})`)
      expect(Number(body.match(/scale\(([^)]+)\)/)![1])).toBe(Number(scale))
    }
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
    expect(app.match(/<ErrorToastLayer\s*\/>/g)).toHaveLength(1)
    expect(app).not.toContain('<ErrorToastHost')
  })
})
