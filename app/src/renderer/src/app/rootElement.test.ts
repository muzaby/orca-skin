// 창의 첫 요소 (0324 EP-29 ② · AC53) — 다리가 없으면 실패 화면, 있으면 앱이다.
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
})
