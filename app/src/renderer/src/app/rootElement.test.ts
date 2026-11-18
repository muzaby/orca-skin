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

  // 진입점 `main.tsx` 는 단위 테스트로 띄우지 못한다(문서·`createRoot`). 최상위는 분기 없는 직선 코드라 원문
  // 순서가 실행 순서다 — import · 주석 · 빈 줄 · 들여쓴 줄을 뺀 열 0 최상위 문의 순서를 본다(0324 EP-30 · AC52′).
  // 단계를 함수·조건 안으로 옮기면 열 0 최상위 문이 아니게 돼 red 다(fail-closed).
  it('`main.tsx` 의 첫 실행 문은 `installOo()` 이고 렌더 전 단계와 첫 렌더는 모두 그 뒤다 (EP-30 ①②④⑤)', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
    const top = main.split(/\r?\n/).filter((text) => !/^(import |\/\/|$|\s|\)|\})/.test(text))
    // ① 첫 실행 문.
    expect(top[0]).toBe('const install = installOo()')
    // ②~⑤ 그 뒤 — 각 단계가 열 0 최상위 문으로 한 번씩.
    const steps = [
      (text: string) => text === 'registerGlobalErrorHandlers()',
      (text: string) => text === 'void connectMainErrorReports()',
      (text: string) => text === 'startLongTaskReporter()',
      (text: string) => text.startsWith('createRoot(')
    ]
    for (const step of steps) {
      expect(top.filter(step)).toHaveLength(1)
      expect(top.findIndex(step)).toBeGreaterThan(0)
    }
    // ⑤ 첫 렌더는 설치 결과로 진입 요소를 고른다.
    expect(main.slice(main.indexOf('\ncreateRoot('))).toMatch(
      /\.render\(\s*rootElement\(\s*install\s*,/
    )
  })
})
