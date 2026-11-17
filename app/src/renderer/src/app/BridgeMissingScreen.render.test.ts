// preload 다리가 없을 때의 실패 화면 (0324 EP-29 ③ · AC53 · D-059). node 환경 — `window` 가 없다. 화면은
// 다리·`window.oo` 를 읽지 않으므로 `window` 없이 그려져야 한다.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import '../shared/i18n'
import { ko } from '../shared/i18n/resources/ko'
import { BridgeMissingScreen } from './BridgeMissingScreen'

describe('BridgeMissingScreen', () => {
  it('`window` 없이 그려지고 경고 역할 · 제목 · 본문을 보인다', () => {
    expect(typeof window).toBe('undefined')
    const html = renderToStaticMarkup(createElement(BridgeMissingScreen))
    expect(html).toContain('role="alert"')
    // 제목은 화면 표지(`data-screen-label`)에도 들어간다 — 문단 본문으로 본다.
    expect(html).toContain(`>${ko.boot.bridgeMissingTitle}</p>`)
    expect(html).toContain(`>${ko.boot.bridgeMissingBody}</p>`)
    expect(ko.boot.bridgeMissingTitle).toBe('앱 창을 연결하지 못했습니다.')
    expect(ko.boot.bridgeMissingBody).toBe(
      '창과 앱을 잇는 구성 요소를 불러오지 못했습니다. 앱을 종료하고 다시 실행해 주세요. 계속되면 앱을 다시 설치해 주세요.'
    )
    // 창을 끌 수 있는 영역이 있다 — 창 조작 단추는 없다(B43).
    expect(html).toContain('data-behavior="drag-region"')
  })
})
