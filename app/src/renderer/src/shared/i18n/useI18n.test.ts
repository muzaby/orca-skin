import { createElement, Fragment } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { FakeDom } from '../ui/renderHarness.testfixture'
import { i18n, useI18n } from './index'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../ui/renderHarness.testfixture')).fakeHooks
}))

afterEach(async () => {
  vi.restoreAllMocks()
  await i18n.changeLanguage('ko')
})

it('shares the language subscription across roots and keeps old translators fixed', async () => {
  const views = new Map<string, ReturnType<typeof useI18n>>()
  function Label({ id }: { id: string }): React.JSX.Element {
    const view = useI18n()
    views.set(id, view)
    return createElement('span', null, view.locale, '-', view.tr('common.close'))
  }

  const first = new FakeDom(() => undefined)
  const second = new FakeDom(() => undefined)
  const add = vi.spyOn(i18n, 'on')
  const remove = vi.spyOn(i18n, 'off')
  try {
    first.render(
      createElement(
        Fragment,
        null,
        ...['a', 'b'].map((id) => createElement(Label, { id, key: id }))
      )
    )
    second.render(createElement(Label, { id: 'c' }))
    const korean = views.get('a')!.tr
    expect(first.container.textContent).toBe('ko-닫기ko-닫기')
    expect(second.container.textContent).toBe('ko-닫기')
    expect(views.get('c')!.tr).toBe(korean)
    expect(add.mock.calls.filter(([name]) => name === 'languageChanged')).toHaveLength(1)

    first.render(createElement(Label, { id: 'a' }))
    expect(views.get('a')!.tr).toBe(korean)
    await i18n.changeLanguage('en')
    first.act(() => {})
    second.act(() => {})
    expect(first.container.textContent).toBe('en-Close')
    expect(second.container.textContent).toBe('en-Close')
    expect(korean('common.close')).toBe('닫기')
    const english = views.get('c')!.tr
    expect(views.get('a')!.tr).toBe(english)
    expect(english).not.toBe(korean)
    first.unmount()
    expect(remove).not.toHaveBeenCalled()
    await i18n.changeLanguage('ko')
    second.act(() => {})
    expect(second.container.textContent).toBe('ko-닫기')
    expect(english('common.close')).toBe('Close')
    second.unmount()
    expect(remove.mock.calls.filter(([name]) => name === 'languageChanged')).toHaveLength(1)

    await i18n.changeLanguage('en')
    first.render(createElement(Label, { id: 'a' }))
    expect(first.container.textContent).toBe('en-Close')
  } finally {
    first.unmount()
    second.unmount()
  }
})
