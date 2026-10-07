import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import type { ProviderInfo, ProviderStepInfo } from '../../../../../shared/ipc'
import { GateLogin } from './GateLogin'

function provider(id: string, status: ProviderInfo['status'] = 'valid'): ProviderInfo {
  return {
    id,
    label: id,
    kind: 'gate',
    authScheme: 'login-required',
    origin: 'https://portal.example.corp',
    auth: [{ kind: 'browser-session', label: 'SSO', fields: [] }],
    status,
    activeAuthKind: 'browser-session',
    principal: null,
    expiresAt: null,
    tools: []
  }
}

const notice = '날짜가 바뀌어 다시 로그인해야 합니다.'
function render(
  providers: ProviderInfo[],
  dailyRelogin: string[],
  step: ProviderStepInfo | null = null
): ReturnType<typeof load> {
  return load(
    renderToStaticMarkup(
      createElement(GateLogin, {
        providers,
        dailyRelogin,
        step,
        busy: false,
        onLogin: () => {},
        onSubmit: () => {}
      })
    )
  )
}

describe('GateLogin daily re-login', () => {
  it('advances to the second valid member and renders one daily reason', () => {
    const $ = render([provider('first'), provider('second')], ['second'])
    expect(
      $('p')
        .map((_, node) => $(node).text())
        .get()
    ).toEqual(['2단계 중 2단계 · second', notice])
    expect($('button').text()).toContain('로그인')
  })
  it('shows the daily reason for a valid member in the daily list', () => {
    const $ = render([provider('first')], ['first'])
    expect($('p').filter((_, node) => $(node).text() === notice)).toHaveLength(1)
    expect($('button').text()).toContain('로그인')
  })
  it('does not show the daily reason for an expired current member', () => {
    const $ = render([provider('first', 'expired')], ['first'])
    expect($('p').text()).not.toContain(notice)
    expect($('button').text()).toContain('로그인')
  })
  it('does not show the daily reason for a member outside the daily list', () => {
    const $ = render([provider('first')], ['other'])
    expect($('p').text()).not.toContain(notice)
    expect($('button').text()).toContain('로그인')
  })
  it('keeps the daily reason above the existing failure message', () => {
    const $ = render([provider('first')], ['first'], {
      kind: 'failed',
      providerId: 'first',
      reason: 'cancelled',
      message: '로그인 창이 닫혔습니다'
    })
    expect(
      $('p')
        .map((_, node) => $(node).text())
        .get()
    ).toEqual([notice, '로그인 창이 닫혔습니다'])
    expect($('[role="alert"]').text()).toBe('로그인 창이 닫혔습니다')
  })
})
