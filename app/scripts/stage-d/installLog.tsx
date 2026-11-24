import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { InstallerDialog } from '@renderer/features/backend/harnesses/claude/components/InstallerDialog'
import type { InstallStatus } from '../../src/shared/ipc'
import appCss from '@renderer/styles/app.css?inline'

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))
async function settle(): Promise<void> {
  for (let index = 0; index < 5; index++) await frame()
}

export interface InstallLogResult {
  label: 'diagnostic'
  inputRows: number
  mountedRows: number
  readingPositionPreserved: boolean
  followsTail: boolean
  finalOutputPresent: boolean
  completions: number
}

export async function measureInstallLog(): Promise<InstallLogResult> {
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed; inset:0;'
  document.body.append(host)
  const root = createRoot(host)
  let notify: ((status: InstallStatus) => void) | null = null
  let completions = 0
  const prior = window.oo
  Object.assign(window, {
    oo: {
      install: {
        start: () => Promise.resolve(),
        onStatus(handler: (status: InstallStatus) => void) {
          notify = handler
          return () => {
            notify = null
          }
        }
      }
    }
  })
  const publish = (status: InstallStatus): void => notify?.(status)
  const close = (): void => {}
  try {
    flushSync(() =>
      root.render(
        <InstallerDialog
          open
          onClose={close}
          onComplete={() => {
            completions++
          }}
        />
      )
    )
    await settle()
    const start = [...host.querySelectorAll('button')].at(-1)!
    flushSync(() => start.click())
    const inputRows = 10_000
    for (let offset = 0; offset < inputRows; offset += 100) {
      publish({
        step: 'installing',
        log: Array.from({ length: 100 }, (_, row) => 'line-' + (offset + row) + '\n').join('')
      })
    }
    await settle()
    const scroller = host.querySelector<HTMLElement>('div.overflow-auto[tabindex="0"]')!
    const mountedRows = scroller.firstElementChild!.childElementCount
    scroller.scrollTop = 20 * 400
    await settle()
    const before = scroller.scrollTop
    publish({ step: 'installing', log: 'a'.repeat(65_536) })
    await settle()
    const readingPositionPreserved = before > 0 && Math.abs(scroller.scrollTop - before) <= 1
    scroller.scrollTop = scroller.scrollHeight
    await settle()
    publish({ step: 'complete', log: '\nfinal-line\n', done: true })
    publish({ step: 'complete', done: true })
    await settle()
    return {
      label: 'diagnostic',
      inputRows,
      mountedRows,
      readingPositionPreserved,
      followsTail: scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 1,
      finalOutputPresent: scroller.textContent?.includes('final-line') ?? false,
      completions
    }
  } finally {
    root.unmount()
    Object.assign(window, { oo: prior })
    host.remove()
    style.remove()
  }
}
