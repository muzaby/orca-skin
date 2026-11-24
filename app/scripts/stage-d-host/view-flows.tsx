import { useRef, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { SearchModal } from '@renderer/features/sessions/components/SearchModal'
import { UsageTab } from '@renderer/features/settings/components/UsageTab'
import { useMentionAutocomplete } from '@renderer/features/chat/hooks/useMentionAutocomplete'
import { MentionAutocomplete } from '@renderer/features/chat/harnesses/common/composer/MentionAutocomplete'
import { RunHistory } from '@renderer/features/schedules/components/RunHistory'
import { createOo } from '@renderer/shared/api/transport/oo'
import type { HostPortClient } from '@renderer/shared/api/transport/host-port'
import { measureComposerFlow } from '../stage-d/composerFlow'
import { UserMessage } from '@renderer/features/chat/harnesses/common/transcript/UserMessage'
import { assistantRuntime } from '@renderer/features/chat/harnesses/registries/assistant'
import { TranscriptRuntimeProvider } from '@renderer/features/chat/harnesses/common/transcript/TranscriptRuntime'
import type { Message } from '@renderer/features/chat/reducer/chatReducer'
import { editInput, frame } from '../stage-d/domInput'
import { CHANNELS, type SearchHit, type SessionListItem } from '../../src/shared/ipc'
import type { ScheduledRun } from '../../src/shared/scheduled-tasks'
import { aggregateWeekly, fillDailySeries } from '../../src/shared/usage/stats'
import appCss from '@renderer/styles/app.css?inline'

const noop = (): void => {}
// eslint-disable-next-line react-refresh/only-export-components -- isolated Electron probe, mounted once per fixture.
function Files({ cwd, text }: { cwd: string; text: string }): React.JSX.Element {
  const anchor = useRef<HTMLInputElement>(null)
  const menu = useMentionAutocomplete(text, text.length, cwd, true, false)
  return (
    <>
      <input ref={anchor} value={text} readOnly />
      <MentionAutocomplete
        {...menu}
        dirPath="watch"
        anchorRef={anchor}
        onHover={noop}
        onPick={noop}
      />
    </>
  )
}
async function wait(f: () => boolean, label: string): Promise<void> {
  const until = performance.now() + 9000
  while (!f()) {
    if (performance.now() > until) throw Error('DOM deadline ' + label)
    await frame()
  }
}
export async function measureDataFlows(
  cwd: string,
  client: HostPortClient,
  renderNav: (rows: SessionListItem[], project: boolean, choose: (id: string) => void) => ReactNode,
  usageRuns = 0
): Promise<unknown> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;overflow:auto'
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  document.body.append(host)
  const root = createRoot(host)
  const prev = window.oo
  const oo = createOo({
    bridge: { platform: 'linux' } as Parameters<typeof createOo>[0]['bridge'],
    hosts: { agent: client, data: client },
    onHostLifecycle: () => noop
  })
  Object.assign(window, {
    oo: {
      ...oo,
      provider: { ...oo.provider, state: async () => ({ providers: [] }), onState: () => noop }
    }
  })
  async function chartPeriods(): Promise<Record<string, string | number>[]> {
    const usage: Record<string, string | number>[] = []
    for (const [range, period] of [
      ['7d', 90],
      ['30d', 90],
      ['all', 90],
      ['all', 91],
      ['all', 800]
    ] as const) {
      await client.invoke('stage-d:period', period)
      const firstStart = performance.now()
      flushSync(() => root.render(<UsageTab key={range + period} />))
      const firstCommitMs = performance.now() - firstStart
      const tabs = host.querySelectorAll<HTMLButtonElement>('[role=tab]')
      flushSync(() => tabs[range === '7d' ? 0 : range === '30d' ? 1 : 2].click())
      const requestStart = performance.now()
      const stats = await oo.cost.usageStats(range)
      const roundTripMs = performance.now() - requestStart
      const dataMs = Number(await client.invoke('stage-d:usage-duration', range))
      await wait(
        () =>
          !!host.querySelector('.recharts-cartesian-axis') &&
          !!host.textContent?.includes('stage-model'),
        'chart'
      )
      const deriveStart = performance.now()
      const filled = fillDailySeries(stats.days, stats.since, stats.updatedAt)
      const expected = range === '7d' ? 7 : range === '30d' ? 30 : Math.min(730, period)
      const weekly = range === 'all' && expected > 90
      const series = weekly ? aggregateWeekly(filled) : filled
      const deriveMs = performance.now() - deriveStart
      const total = stats.days.reduce((acc, d) => acc + d.inputTokens, 0)
      const label = Array.from(host.querySelectorAll('span')).find((s) =>
        s.className.includes('text-[22px]')
      )
      if (
        filled.length !== expected ||
        total !== (range === 'all' ? 23 : 10) ||
        stats.models[0].inputTokens !== 21 ||
        label?.textContent !== String(total) ||
        !host.textContent?.includes('21')
      )
        throw Error('usage total ' + range + period)
      const nonzero = series.filter((day) => day.inputTokens !== 0).length
      await wait(
        () => host.querySelectorAll('.recharts-bar-rectangle path').length === nonzero,
        'bars ' + range + period
      )
      const chart = host.querySelector<HTMLElement>('.recharts-wrapper')!
      const visible = performance.now()
      await frame()
      await frame()
      const paintMs = performance.now() - visible
      // A range change can briefly paint the previous series before the new reply commits.
      await wait(
        () => {
          const bars = Array.from(chart.querySelectorAll('.recharts-bar-rectangle path'))
          const rect = bars.at(-1)?.getBoundingClientRect()
          if (!rect) return false
          chart.dispatchEvent(
            new MouseEvent('mousemove', {
              bubbles: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2
            })
          )
          return host.querySelector('.recharts-tooltip-wrapper .font-medium')?.textContent === '10'
        },
        'last chart bucket ' + range + period
      )
      const tooltip = host.querySelector('.recharts-tooltip-wrapper')!.textContent
      usage.push({
        range,
        period,
        days: filled.length,
        buckets: series.length,
        paintedBars: nonzero,
        dataMs,
        roundTripMs,
        deriveMs,
        firstCommitMs,
        paintMs,
        total,
        modelTokens: 21,
        tooltip
      })
    }
    return usage
  }
  try {
    if (usageRuns) {
      const samples: Record<string, string | number>[][] = []
      for (let run = 0; run <= usageRuns; run++) {
        const sample = await chartPeriods()
        if (run) samples.push(sample)
      }
      return { samples }
    }
    const listSessions = (): Promise<SessionListItem[]> =>
      client.invoke(CHANNELS.sessionList, undefined) as Promise<SessionListItem[]>
    const first = await listSessions()
    const duplicates = first.filter((row) => row.title === 'Same title').map((row) => row.id)
    const boundary = first.at(-1)!.id
    if (first.length !== 50 || duplicates.length !== 2) throw Error('session boundary fixture')
    const pinnedId = duplicates[1]
    await client.invoke(CHANNELS.sessionSetPinned, { sessionId: pinnedId, pinned: true })
    const pinned = await listSessions()
    if (pinned.find((row) => row.id === pinnedId)?.pinnedAt == null) throw Error('pin missing')
    let selected = ''
    flushSync(() =>
      root.render(
        renderNav(pinned, false, (id) => {
          selected = id
        })
      )
    )
    await wait(
      () => !!host.querySelector('[data-session-id="' + pinnedId + '"]'),
      'pinned duplicate'
    )
    host.querySelector<HTMLElement>('[data-session-id="' + pinnedId + '"]')!.click()
    if (selected !== pinnedId) throw Error('duplicate title opened incorrect ID')
    await client.invoke(CHANNELS.sessionSetPinned, { sessionId: pinnedId, pinned: false })
    const deleted = (await client.invoke(CHANNELS.sessionDelete, { sessionId: boundary })) as {
      ok: boolean
    }
    const next = await listSessions()
    const ids = next.map((row) => row.id)
    if (
      !deleted.ok ||
      ids.length !== 50 ||
      ids.includes(boundary) ||
      first.slice(0, -1).some((row, index) => ids[index] !== row.id) ||
      next.find((row) => row.id === pinnedId)?.pinnedAt != null
    )
      throw Error('deleted session boundary or unpin')
    const catalog = { duplicates, selected, removed: boundary, replacement: ids.at(-1) }
    const folders: Record<string, string | number>[] = []
    await client.invoke('stage-d:directory', 'open')
    flushSync(() => root.render(<Files cwd={cwd} text="@watch/entry" />))
    await frame()
    await frame()
    for (const [op, name] of [
      ['create', 'entry-one'],
      ['rename', 'entry-two'],
      ['delete', ''],
      ['replace', 'entry-three']
    ]) {
      const t = performance.now()
      await client.invoke('stage-d:directory', op)
      await wait(
        () =>
          name
            ? document.body.textContent!.includes(name)
            : !document.body.textContent!.includes('entry-two'),
        'file ' + op
      )
      folders.push({ op, name, elapsedMs: performance.now() - t })
    }
    flushSync(() => root.render(<Files cwd={cwd} text="" />))
    flushSync(() => root.render(<Files cwd={cwd} text="@watch/entry" />))
    window.dispatchEvent(new Event('focus'))
    await wait(() => document.body.textContent!.includes('entry-three'), 'reopen')
    const search: Record<string, string | number>[] = []
    let chosen = ''
    flushSync(() =>
      root.render(
        <SearchModal
          onClose={noop}
          onChoose={(id) => {
            chosen = id
          }}
        />
      )
    )
    const input = host.querySelector('input')!
    for (const [q, id, rest] of [
      ['orchard', 'session-1', 'sole-specific'],
      ['tide', 'session-2', 'distinct second']
    ]) {
      flushSync(() => editInput(input, q))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      if (chosen) throw Error('previous query was selectable')
      const rows = (await oo.search.messages(q, 30)) as SearchHit[]
      await wait(() => !!host.querySelector('[role=option] mark'), 'FTS ' + q)
      const option = host.querySelector<HTMLElement>('[role=option]')!
      if (
        rows.length !== 1 ||
        rows[0].sessionId !== id ||
        rows[0].messageId !== search.length + 1 ||
        !rows[0].snippet.includes(rest) ||
        option.querySelector('mark')?.textContent !== q ||
        !option.textContent?.includes(rest)
      )
        throw Error('search result ' + q + ' ' + JSON.stringify(rows))
      option.click()
      if (chosen !== id) throw Error('wrong session')
      search.push({ q, sessionId: chosen, messageId: rows[0].messageId, snippet: rows[0].snippet })
      chosen = ''
    }
    flushSync(() => editInput(input, ''))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    if (chosen) throw Error('empty query selected a message')
    const usage = await chartPeriods()
    const runs = (await client.invoke(CHANNELS.scheduleListRuns, {
      id: 'task-0'
    })) as ScheduledRun[]
    const empty = (await client.invoke(CHANNELS.scheduleListRuns, {
      id: 'missing'
    })) as ScheduledRun[]
    let linked = ''
    flushSync(() =>
      root.render(
        <RunHistory
          runs={runs}
          onOpenSession={(id) => {
            linked = id
          }}
        />
      )
    )
    const details = host.querySelector('details')!
    if (!details || details.querySelector('pre') || empty.length || runs.length !== 20)
      throw Error('schedule initial state')
    details.open = true
    await wait(() => !!details.querySelector('pre'), 'stored output')
    if (details.querySelector('pre')!.textContent !== runs[0].output || !runs[0].outputTruncated)
      throw Error('schedule output mismatch')
    host.querySelector<HTMLButtonElement>('[data-schedule-run] button')!.click()
    if (linked !== 'session-1') throw Error('wrong linked session')
    const composer: unknown[] = []
    for (const source of ['dialog', 'drag_drop', 'clipboard'] as const) {
      composer.push(
        await measureComposerFlow(source, async (views) => {
          const message = (await client.invoke('stage-d:reopen-attachments', {
            source,
            views
          })) as Message
          const restored = message.parts.find((part) => part.type === 'attachment')?.attachments
          if (JSON.stringify(restored) !== JSON.stringify(views))
            throw Error('reopened attachment snapshot')
          const started = performance.now()
          flushSync(() =>
            root.render(
              <TranscriptRuntimeProvider value={assistantRuntime('claude')}>
                <UserMessage message={message} />
              </TranscriptRuntimeProvider>
            )
          )
          const commitMs = performance.now() - started
          await frame()
          await frame()
          const paintMs = performance.now() - started - commitMs
          const pictures = Array.from(host.querySelectorAll('img')).map((el) =>
            el.getAttribute('src')
          )
          if (
            !host.textContent?.includes('sent draft') ||
            pictures.length !== 2 ||
            pictures.some((url, i) => url !== views[i].previewDataUrl) ||
            views.some(({ name }) => !host.querySelector('[title="' + name + '"]'))
          )
            throw Error('restored user bubble')
          return { files: views.length, previews: pictures.length, commitMs, paintMs }
        })
      )
    }
    return {
      composer,
      catalog,
      folders,
      search,
      usage,
      schedule: { runs: runs.length, bytes: runs[0].output!.length, session: linked }
    }
  } finally {
    root.unmount()
    style.remove()
    host.remove()
    Object.assign(window, { oo: prev })
  }
}
