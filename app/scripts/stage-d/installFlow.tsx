import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { InstallerDialog } from '@renderer/features/backend/harnesses/claude/components/InstallerDialog'
import { createHostPortClient } from '@renderer/shared/api/transport/host-port'
import { createOo } from '@renderer/shared/api/transport/oo'
import type { InstallStatus } from '../../src/shared/ipc'
import appCss from '@renderer/styles/app.css?inline'
import { frame } from './domInput'

const noop = (): void => {}
export async function measureInstallFlow(port: MessagePort): Promise<unknown> {
  const client = createHostPortClient({ host: 'agent', requestConnect: noop })
  client.attachPort({
    postMessage: (m) => port.postMessage(m),
    onMessage: (fn) => {
      port.onmessage = (e) => fn(e.data)
    },
    close: () => port.close()
  })
  const prev = window.oo
  const oo = createOo({
    bridge: { platform: 'linux' } as Parameters<typeof createOo>[0]['bridge'],
    hosts: { agent: client, data: client },
    onHostLifecycle: () => noop
  })
  Object.assign(window, { oo })
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0'
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  document.body.append(host)
  const root = createRoot(host)
  const events: InstallStatus[] = []
  const off = oo.install.onStatus((status) => events.push(status))
  let completions = 0
  const wait = async (predicate: () => boolean, label: string): Promise<void> => {
    const until = performance.now() + 10000
    while (!predicate()) {
      if (performance.now() > until) throw Error('install deadline ' + label)
      await frame()
    }
    await frame()
    await frame()
  }
  const records: Record<string, string | number>[] = []
  try {
    flushSync(() =>
      root.render(
        <InstallerDialog
          open
          onClose={noop}
          onComplete={() => {
            completions++
          }}
        />
      )
    )
    const preparing = host.querySelector('.whitespace-pre')?.textContent
    if (!preparing?.trim()) throw Error('missing empty installer log')
    for (const generation of [1, 2, 3]) {
      events.length = 0
      const start = Array.from(host.querySelectorAll('button')).at(-1)!
      flushSync(() => start.click())
      if (
        host.querySelector('.whitespace-pre')?.textContent !== preparing ||
        host.querySelector('[tabindex="0"].overflow-auto .absolute')
      )
        throw Error('previous archive mounted on restart')
      if (host.textContent?.includes('generation-' + (generation - 1) + '-end'))
        throw Error('old run archive survived restart')
      if (generation > 1) {
        await wait(() => events.some((event) => event.progress === 0.5), 'initial archive')
        const scroller = host.querySelector<HTMLElement>('[tabindex="0"].overflow-auto')!
        scroller.scrollTop = 8000
        await frame()
        await frame()
        const top = scroller.scrollTop
        await client.invoke('stage-d:advance', {})
        await wait(() => events.some((event) => event.progress === 0.9), 'partial line')
        if (top <= 0 || Math.abs(scroller.scrollTop - top) > 1) throw Error('reading position lost')
        scroller.scrollTop = scroller.scrollHeight
        await frame()
        await frame()
        await client.invoke('stage-d:advance', {})
      }
      await wait(() => events.some((e) => e.done), 'terminal')
      const archive = events.map((e) => e.log ?? '').join('')
      const expected =
        generation === 1
          ? ''
          : Array.from({ length: 10000 }, (_, i) => 'line-' + i + '\n').join('') +
            'a'.repeat(65536) +
            '\nsplit-line\ngeneration-' +
            generation +
            '-end\n'
      const terminal = events.filter((e) => e.done)
      if (
        archive !== expected ||
        terminal.length !== 1 ||
        events.at(-1) !== terminal[0] ||
        completions !== (generation === 3 ? 2 : 1) ||
        (generation > 1 && !host.textContent?.includes('generation-' + generation + '-end')) ||
        Boolean(host.textContent?.includes('fixture-error')) !== (generation === 2)
      )
        throw Error('installer output ' + generation)
      records.push({
        source: generation === 1 ? 'ClaudeAdapter.install' : 'diagnostic',
        generation,
        bytes: new TextEncoder().encode(archive).length,
        batches: events.filter((e) => e.log).length,
        terminal: terminal.length,
        completions
      })
    }
    return records
  } finally {
    root.unmount()
    off()
    port.close()
    Object.assign(window, { oo: prev })
    host.remove()
    style.remove()
  }
}
