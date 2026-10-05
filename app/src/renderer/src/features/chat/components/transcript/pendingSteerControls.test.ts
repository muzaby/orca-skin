import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatActivitySnapshot } from '../../../../../../shared/ipc'
import { i18n } from '../../../../shared/i18n'
import { PendingSteerTurn } from './PendingSteerTurn'
import {
  pendingSteerControls,
  runPendingSteerControl,
  type PendingSteerControl
} from './pendingSteerControls'

const harness = vi.hoisted(() => ({
  foreground: 'streaming' as 'idle' | 'preparing' | 'streaming',
  sendSteerNow: vi.fn(),
  cancelSteer: vi.fn().mockReturnValue('restored draft'),
  clicks: new Map<string, () => void>()
}))
vi.mock('../../store/chatStore', () => ({
  chatActions: { sendSteerNow: harness.sendSteerNow, cancelSteer: harness.cancelSteer },
  useChatActivity: () => ({ activityForeground: harness.foreground })
}))

// 기존 React fixture 방식으로 실제 버튼 callback을 호출해 control kind 전달도 잠근다.
vi.mock('react/jsx-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-runtime')>()
  const capture = (type: unknown, props: Record<string, unknown>): void => {
    if (type === 'button' && typeof props['data-control'] === 'string')
      harness.clicks.set(props['data-control'], props.onClick as () => void)
  }
  return {
    ...actual,
    jsx: (type: Parameters<typeof actual.jsx>[0], props: Record<string, unknown>, key?: string) => {
      capture(type, props)
      return actual.jsx(type, props, key)
    },
    jsxs: (
      type: Parameters<typeof actual.jsxs>[0],
      props: Record<string, unknown>,
      key?: string
    ) => {
      capture(type, props)
      return actual.jsxs(type, props, key)
    }
  }
})
vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const [type, rawProps] = args
      const props = rawProps as Record<string, unknown>
      if (type === 'button' && typeof props['data-control'] === 'string')
        harness.clicks.set(props['data-control'], props.onClick as () => void)
      return actual.jsxDEV(...args)
    }
  }
})

const cases: {
  foreground: ChatActivitySnapshot['foreground']
  submitted: boolean
  sendNowRequested: boolean
  controls: PendingSteerControl[]
}[] = [
  {
    foreground: 'streaming',
    submitted: false,
    sendNowRequested: false,
    controls: ['send-now', 'cancel']
  },
  { foreground: 'streaming', submitted: false, sendNowRequested: true, controls: ['cancel'] },
  { foreground: 'streaming', submitted: true, sendNowRequested: false, controls: [] },
  { foreground: 'streaming', submitted: true, sendNowRequested: true, controls: [] },
  { foreground: 'idle', submitted: false, sendNowRequested: false, controls: ['cancel'] },
  { foreground: 'idle', submitted: false, sendNowRequested: true, controls: ['cancel'] },
  { foreground: 'idle', submitted: true, sendNowRequested: false, controls: [] },
  { foreground: 'idle', submitted: true, sendNowRequested: true, controls: [] },
  { foreground: 'preparing', submitted: false, sendNowRequested: false, controls: ['cancel'] },
  { foreground: 'preparing', submitted: false, sendNowRequested: true, controls: ['cancel'] },
  { foreground: 'preparing', submitted: true, sendNowRequested: false, controls: [] },
  { foreground: 'preparing', submitted: true, sendNowRequested: true, controls: [] }
]

beforeEach(async () => {
  harness.clicks.clear()
  harness.sendSteerNow.mockClear()
  harness.cancelSteer.mockClear()
  await i18n.changeLanguage('ko')
})

describe('0250 pending steer controls', () => {
  it.each(cases)(
    '$foreground submitted=$submitted requested=$sendNowRequested 뷰모델·markup',
    ({ foreground, submitted, sendNowRequested, controls }) => {
      const item = { id: 'held', text: '대기 메시지', createdAt: 10, submitted, sendNowRequested }
      expect(pendingSteerControls(item, foreground)).toEqual(controls)
      harness.foreground = foreground
      const html = renderToStaticMarkup(createElement(PendingSteerTurn, { items: [item] }))
      const $ = load(html)
      expect(
        $('button[data-control]')
          .map((_index, button) => $(button).attr('data-control'))
          .get()
      ).toEqual(controls)
      expect($('button[data-control="send-now"]').text()).toBe(
        controls.includes('send-now') ? '즉시 보내기' : ''
      )
      expect($('button[data-control="cancel"]').text()).toBe(
        controls.includes('cancel') ? '취소' : ''
      )
      expect(html.includes('전달됨')).toBe(submitted)
      expect($('[data-state]').attr('data-state')).toBe(
        submitted ? 'submitted-steer' : 'pending-steer'
      )
    }
  )

  it('선택 필드 undefined는 held·미요청이고 streaming에서 두 버튼을 보인다', () => {
    expect(pendingSteerControls({ id: 'held' }, 'streaming')).toEqual(['send-now', 'cancel'])
  })

  it('순수 action mapping은 즉시 보내기를 1회 요청하고 취소만 id와 draft를 반환한다', () => {
    const actions = { sendSteerNow: vi.fn(), cancelSteer: vi.fn().mockReturnValue('draft') }
    expect(runPendingSteerControl('send-now', { id: 'held' }, actions)).toBeNull()
    expect(actions.sendSteerNow).toHaveBeenCalledExactlyOnceWith()
    expect(actions.cancelSteer).not.toHaveBeenCalled()
    expect(runPendingSteerControl('cancel', { id: 'held' }, actions)).toBe('draft')
    expect(actions.sendSteerNow).toHaveBeenCalledTimes(1)
    expect(actions.cancelSteer).toHaveBeenCalledExactlyOnceWith('held')
  })

  it('실제 두 버튼은 서로 다른 액션에 전달되고 취소만 composer draft를 복원한다', () => {
    harness.foreground = 'streaming'
    const onRestoreDraft = vi.fn()
    renderToStaticMarkup(
      createElement(PendingSteerTurn, {
        items: [{ id: 'held', text: '대기', createdAt: 10 }],
        onRestoreDraft
      })
    )
    expect([...harness.clicks.keys()]).toEqual(['send-now', 'cancel'])
    harness.clicks.get('send-now')!()
    expect(harness.sendSteerNow).toHaveBeenCalledExactlyOnceWith()
    expect(harness.cancelSteer).not.toHaveBeenCalled()
    expect(onRestoreDraft).not.toHaveBeenCalled()
    harness.clicks.get('cancel')!()
    expect(harness.sendSteerNow).toHaveBeenCalledTimes(1)
    expect(harness.cancelSteer).toHaveBeenCalledExactlyOnceWith('held')
    expect(onRestoreDraft).toHaveBeenCalledExactlyOnceWith('restored draft')
  })

  it('영문 control 라벨도 동일한 슬롯에 표시한다', async () => {
    await i18n.changeLanguage('en')
    harness.foreground = 'streaming'
    const $ = load(
      renderToStaticMarkup(
        createElement(PendingSteerTurn, {
          items: [{ id: 'held', text: 'pending', createdAt: 10 }]
        })
      )
    )
    expect($('[data-control="send-now"]').text()).toBe('Send now')
    expect($('[data-control="cancel"]').text()).toBe('Cancel')
  })
})
