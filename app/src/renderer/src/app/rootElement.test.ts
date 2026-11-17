// 창의 첫 요소 (0324 EP-29 ② · AC53) — 다리가 없으면 실패 화면, 있으면 앱이다.
import { readFileSync } from 'node:fs'
import { createElement, isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import { BridgeMissingScreen } from './BridgeMissingScreen'
import { rootElement } from './rootElement'

const app = createElement('div', { 'data-app': true })

describe('rootElement', () => {
  it('다리가 없으면(`missing`) 앱이 아니라 실패 화면이다', () => {
    const element = rootElement('missing', app)
    expect(element).not.toBe(app)
    expect(isValidElement(element) && element.type).toBe(BridgeMissingScreen)
  })

  it.each(['installed', 'present'] as const)('`%s` 이면 앱 그대로다', (install) => {
    expect(rootElement(install, app)).toBe(app)
  })

  // 진입점 `main.tsx` 는 단위 테스트로 띄우지 못한다(문서·`createRoot`) — 배선을 소스로 본다(구조적 대리).
  it('`main.tsx` 는 `installOo()` 의 결과를 렌더 전에 받아 `rootElement` 에 넘긴다', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
    const install = main.indexOf('const install = installOo()')
    const render = main.indexOf('createRoot(')
    expect(install).toBeGreaterThan(-1)
    expect(render).toBeGreaterThan(install)
    expect(main.slice(render)).toMatch(/\.render\(\s*rootElement\(\s*install\s*,/)
  })
})
