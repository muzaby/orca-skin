import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { useRef, type ReactNode } from 'react'
import { createHostPortClient } from '@renderer/shared/api/transport/host-port'
import { MentionAutocomplete } from '@renderer/features/chat/harnesses/common/composer/MentionAutocomplete'
import {
  flattenMentionGroups,
  groupMentionSuggestions,
  parseMentionToken
} from '@renderer/features/chat/lib/mentionAutocomplete'
import { ProjectsScreen } from '@renderer/features/projects/components/ProjectsScreen'
import { ArtifactsView } from '@renderer/features/artifacts/components/ArtifactsView'
import { useArtifactCatalogStore } from '@renderer/features/artifacts/store/artifactCatalogStore'
import { PinnedSectionView } from '@renderer/features/sessions/components/PinnedSection'
import { SessionListView } from '@renderer/features/sessions/components/SessionList'
import { PinnedProjectChildren } from '@renderer/features/sessions/components/PinnedProjectsSection'
import { splitNavSections } from '@renderer/features/sessions/lib/navSections'
import type { AgentAppearanceResolver } from '@renderer/features/sessions/components/SessionRow'
import { RunHistory } from '@renderer/features/schedules/components/RunHistory'
import { SchedulesScreen } from '@renderer/features/schedules/components/SchedulesScreen'
import type { ScheduledRun, ScheduledTask } from '../../src/shared/scheduled-tasks'
import type { ArtifactCatalogItem } from '../../src/shared/artifacts'
import { CHANNELS, type FileEntry, type Project, type SessionListItem } from '../../src/shared/ipc'
import { UI_TASK_BUDGET_MS } from '../../src/shared/perf-budget'
import appCss from '@renderer/styles/app.css?inline'

const noop = (): void => {}
const resolved = async (): Promise<void> => {}
const sessionId = 'session-0'
const projectId = 'project-0'
const taskId = 'task-0'
const appearance: AgentAppearanceResolver = () => ({ navIcon: 'doc', label: 'sessions.empty' })
const data = createHostPortClient({ host: 'data', requestConnect: noop })
const connected = new Promise<void>((resolve, reject) => {
  const deadline = setTimeout(() => {
    window.removeEventListener('message', receive)
    reject(Error('No renderer port'))
  }, 15_000)
  const receive = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'stage-d-port' || event.ports.length !== 1)
      return
    const port = event.ports[0]
    data.attachPort({
      postMessage: (message) => port.postMessage(message),
      onMessage: (listener) => {
        port.onmessage = (message) => listener(message.data)
      },
      close: () => port.close()
    })
    clearTimeout(deadline)
    window.removeEventListener('message', receive)
    resolve()
  }
  window.addEventListener('message', receive)
})

function frame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

async function withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Error(message)), 15_000)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

type Groups = ReturnType<typeof groupMentionSuggestions>
// eslint-disable-next-line react-refresh/only-export-components -- This renderer runs as a diagnostic bundle.
function FileResults({ groups }: { groups: Groups }): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input ref={input} defaultValue="@src" />
      <MentionAutocomplete
        open
        loading={false}
        anchorRef={input}
        dirPath=""
        groups={groups}
        suggestions={flattenMentionGroups(groups)}
        activeIndex={0}
        onHover={noop}
        onPick={noop}
      />
    </>
  )
}

function nav(
  entries: SessionListItem[],
  project: boolean,
  onSelect: (id: string) => void = noop
): ReactNode {
  const ids = entries.map((item) => item.id)
  const sections = splitNavSections({
    byId: Object.fromEntries(entries.map((item) => [item.id, item])),
    recentIds: ids,
    pinnedProjectIds: new Set(project ? [projectId] : []),
    projectSessionIds: project ? { [projectId]: ids } : {}
  })
  return (
    <div className="app-frame-sidebar-scroll flex h-full min-h-0 flex-col overflow-y-auto">
      <PinnedSectionView
        agentAppearance={appearance}
        sessions={sections.pinned}
        currentSessionId={sessionId}
        onSelectSession={onSelect}
        onTogglePinSession={noop}
        onDeleteSession={noop}
        onRenameSession={noop}
      >
        {project && (
          <div data-stage-d-project-sessions="" className="pl-4">
            <PinnedProjectChildren
              agentAppearance={appearance}
              sessions={sections.projectChildren[projectId]}
              currentSessionId={sessionId}
              onSelectSession={onSelect}
              onTogglePinSession={noop}
              onDeleteSession={noop}
              onRenameSession={noop}
            />
          </div>
        )}
      </PinnedSectionView>
      {!project && (
        <SessionListView
          agentAppearance={appearance}
          sessions={sections.recent}
          currentSessionId={sessionId}
          onSelect={noop}
          onDelete={noop}
          onRename={noop}
          onTogglePin={noop}
        />
      )}
    </div>
  )
}

interface QueryCase {
  id: string
  size: number
  expected: number
  channel: string
  payload?: unknown
  selector: string
  prepare: (
    result: unknown[],
    onSelect?: (id: string) => void
  ) => {
    view: ReactNode
    publish?: () => void
  }
}

function cases(cwd: string): QueryCase[] {
  return [
    {
      id: 'S-D1-files',
      size: 20_000,
      expected: 20_000,
      channel: CHANNELS.filesList,
      payload: { cwd, relDir: '' },
      selector: '[role="option"]',
      prepare: (result) => ({
        view: (
          <FileResults
            groups={groupMentionSuggestions(
              parseMentionToken('@src', 4)!,
              [],
              result as FileEntry[]
            )}
          />
        )
      })
    },
    {
      id: 'S-D4-sessions',
      size: 10_000,
      expected: 50,
      channel: CHANNELS.sessionList,
      selector: '[data-session-id]',
      prepare: (result) => ({ view: nav(result as SessionListItem[], false) })
    },
    {
      id: 'S-D4-project-sessions',
      size: 10_000,
      expected: 10_000,
      channel: CHANNELS.projectListSessions,
      payload: { projectId },
      selector: '[data-session-id]',
      prepare: (result, select) => ({ view: nav(result as SessionListItem[], true, select) })
    },
    {
      id: 'S-D4-projects',
      size: 100,
      expected: 100,
      channel: CHANNELS.projectList,
      selector: 'li[data-project-catalog-row]',
      prepare: (result) => ({
        view: (
          <ProjectsScreen
            projects={result as Project[]}
            loading={false}
            onCreate={resolved}
            onOpenProject={noop}
            onTogglePin={noop}
          />
        )
      })
    },
    {
      id: 'S-D4-artifacts',
      size: 10_000,
      expected: 10_000,
      channel: CHANNELS.artifactCatalog,
      payload: {},
      selector: 'li[data-artifact-catalog-row]',
      prepare: (result) => ({
        view: <ArtifactsView onOpen={noop} onDeleted={noop} />,
        publish: () =>
          useArtifactCatalogStore.setState({
            items: result as ArtifactCatalogItem[],
            loading: false
          })
      })
    },
    {
      id: 'S-D6-history',
      size: 50,
      expected: 20,
      channel: CHANNELS.scheduleListRuns,
      payload: { id: taskId },
      selector: 'li[data-schedule-run]',
      prepare: (result) => ({
        view: <RunHistory runs={result as ScheduledRun[]} onOpenSession={noop} />
      })
    },
    {
      id: 'S-D6-schedules',
      size: 100,
      expected: 100,
      channel: CHANNELS.scheduleList,
      selector: 'li[data-schedule-row]',
      prepare: (result) => ({
        view: (
          <SchedulesScreen
            tasks={result as ScheduledTask[]}
            loading={false}
            revision={0}
            projects={[]}
            pickers={{ project: () => null, execution: () => null }}
            onCreate={resolved}
            onUpdate={resolved}
            onDelete={noop}
            onSetEnabled={noop}
            onRunNow={noop}
            loadRuns={async () => []}
            onOpenSession={noop}
          />
        )
      })
    }
  ]
}

interface Sample {
  T1: number
  T2: number
  T3: number
  T4: number
  T5: number
  T6: null
  C1: number
  C2: number
  longTasks: number[] | null
  severeStalls: number
  frameGapMs: number
}

interface CaseResult {
  id: string
  size: number
  source: 'host-fixture'
  channel: string
  resultRows: number
  samples: Sample[]
  reachedAndSelected: string | null
}
interface MeasuredReply {
  value: unknown[]
  T1: number
  C1: number
}

async function selectLast(
  query: QueryCase,
  container: HTMLElement,
  value: unknown[],
  selected: () => string | null
): Promise<string | null> {
  if (query.id === 'S-D4-project-sessions') {
    const last = (value as SessionListItem[]).findLast((item) => item.pinnedAt == null)!
    const owner = container.querySelector<HTMLElement>('.app-frame-sidebar-scroll')!
    const section = owner.querySelector<HTMLElement>('[data-stage-d-project-sessions]')!
    owner.scrollTop += section.getBoundingClientRect().bottom - owner.getBoundingClientRect().bottom
    for (let i = 0; i < 6; i++) await frame()
    section.querySelector<HTMLElement>(`[data-session-id="${last.id}"]`)?.click()
    if (selected() !== last.id) throw Error('Last project session selection failed')
    return last.id
  }
  if (query.id === 'S-D6-schedules') {
    const last = (value as ScheduledTask[]).at(-1)!
    const owner = container.querySelector<HTMLElement>('[data-schedule-catalog] > div')!
    owner.scrollTop = owner.scrollHeight
    for (let i = 0; i < 6; i++) await frame()
    owner.querySelector<HTMLElement>(`[data-schedule-row="${last.id}"] button`)?.click()
    await frame()
    if (!container.querySelector(`[data-schedule-detail-panel="${last.id}"]`))
      throw Error('Last schedule selection failed')
    return last.id
  }
  return null
}

async function measure(
  cwd: string,
  runs: number
): Promise<{ budget: number; measurements: CaseResult[] }> {
  await connected
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  const previous = window.oo
  // The fixture supplies the reply via the measured port. No second artifact refresh joins the sample.
  Object.assign(window, { oo: { artifacts: { catalog: () => new Promise(() => {}) } } })
  const longTasks: PerformanceEntry[] = []
  const observer = PerformanceObserver.supportedEntryTypes.includes('longtask')
    ? new PerformanceObserver((list) => longTasks.push(...list.getEntries()))
    : null
  observer?.observe({ type: 'longtask' })
  const measurements: CaseResult[] = []
  try {
    for (const query of cases(cwd)) {
      const samples: Sample[] = []
      let reachedAndSelected: string | null = null
      for (let run = 0; run <= runs; run++) {
        const container = document.createElement('div')
        container.style.cssText =
          'position:fixed;inset:0;display:flex;align-items:stretch;overflow:auto'
        document.body.append(container)
        const root = createRoot(container)
        const empty = query.prepare([])
        if (query.id !== 'S-D1-files') {
          flushSync(() => {
            empty.publish?.()
            root.render(empty.view)
          })
        }
        await frame()
        await frame()
        longTasks.length = 0
        try {
          const started = performance.now()
          const { value, T1, C1 } = (await withTimeout(
            data.invoke(query.channel, query.payload),
            'No reply for ' + query.id
          )) as MeasuredReply
          const received = performance.now()
          if (value.length !== query.expected)
            throw Error(query.id + ': unexpected result size ' + value.length)
          let selected: string | null = null
          const { view, publish } = query.prepare(value, (id) => {
            selected = id
          })
          const updating = performance.now()
          flushSync(() => {
            publish?.()
            root.render(view)
          })
          const committed = performance.now()
          const firstFrame = await frame()
          const secondFrame = await frame()
          const painted = performance.now()
          const C2 = document.querySelectorAll(query.selector).length
          // Let the observer deliver entries from the preceding task, outside measured durations.
          await new Promise((resolve) => setTimeout(resolve, 0))
          if (observer) longTasks.push(...observer.takeRecords())
          const tasks = observer
            ? longTasks
                .filter(({ startTime }) => startTime >= started && startTime < painted)
                .map(({ duration }) => duration)
            : null
          if (run > 0)
            samples.push({
              T1,
              T2: Math.max(0, received - started - T1),
              T3: updating - received,
              T4: committed - updating,
              T5: painted - committed,
              T6: null,
              C1,
              C2,
              longTasks: tasks,
              severeStalls: tasks?.filter((duration) => duration >= 160).length ?? 0,
              frameGapMs: secondFrame - firstFrame
            })
          if (run === runs)
            reachedAndSelected = await selectLast(query, container, value, () => selected)
        } finally {
          root.unmount()
          container.remove()
        }
      }
      measurements.push({
        id: query.id,
        size: query.size,
        source: 'host-fixture',
        channel: query.channel,
        resultRows: query.expected,
        samples,
        reachedAndSelected
      })
    }
    return { budget: UI_TASK_BUDGET_MS, measurements }
  } finally {
    observer?.disconnect()
    Object.assign(window, { oo: previous })
    style.remove()
  }
}

Object.assign(window, { measureHostQueries: measure })
