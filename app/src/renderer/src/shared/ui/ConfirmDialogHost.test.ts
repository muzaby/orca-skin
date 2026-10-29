import { afterEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./renderHarness.testfixture')).fakeHooks
}))
vi.mock('react-dom', async () => (await import('./renderHarness.testfixture')).fakeReactDom)
// The real store, read through the harness hooks so the host re-renders on store changes.
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('./renderHarness.testfixture')
  return {
    ...actual,
    create: <T>(init: import('zustand').StateCreator<T>) => {
      const api = actual.createStore(init)
      const hook = <U>(select: (state: T) => U): U =>
        fakeHooks.useSyncExternalStore(api.subscribe, () => select(api.getState())) as U
      return Object.assign(hook, api)
    }
  }
})
vi.mock('../i18n', async (original) => ({
  ...(await original<typeof import('../i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))
import { createElement } from 'react'
import { installFakeDom } from './renderHarness.testfixture'
import { ConfirmDialogHost } from './ConfirmDialogHost'
import { openConfirmDialog, useConfirmStore } from './confirmDialogStore'

let dom: ReturnType<typeof installFakeDom>
afterEach(() => {
  dom?.unmount()
  useConfirmStore.getState().close()
  vi.useRealTimers()
})

it('notifies cancel on the cancel button, dismissal and replacement but not on confirm', () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  dom.render(createElement(ConfirmDialogHost))
  const calls: string[] = []
  const ask = (name: string): void =>
    dom.act(() =>
      openConfirmDialog({
        title: name,
        message: name,
        confirmLabel: 'ok',
        cancelLabel: 'no',
        onConfirm: () => calls.push(`${name}:confirm`),
        onCancel: () => calls.push(`${name}:cancel`)
      })
    )
  const buttons = (): ReturnType<typeof dom.queryAll> => dom.queryAll('[type="button"]')

  ask('button')
  dom.click(buttons()[0])
  ask('escape')
  dom.keyDown('Escape')
  ask('backdrop')
  dom.click(dom.query('[data-context="overlay"]')!)
  ask('replaced')
  ask('confirm')
  dom.click(buttons()[1])

  expect(calls).toEqual([
    'button:cancel',
    'escape:cancel',
    'backdrop:cancel',
    'replaced:cancel',
    'confirm:confirm'
  ])
  expect(useConfirmStore.getState().request).toBeNull()
  expect(dom.query('[role="dialog"]')).toBeNull()
})
