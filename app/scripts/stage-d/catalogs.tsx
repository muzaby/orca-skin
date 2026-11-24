import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ArtifactsView } from '@renderer/features/artifacts/components/ArtifactsView'
import { ProjectsScreen } from '@renderer/features/projects/components/ProjectsScreen'
import { RunHistory } from '@renderer/features/schedules/components/RunHistory'
import type { ArtifactCatalogItem } from '../../src/shared/artifacts'
import type { Project } from '../../src/shared/ipc'
import type { ScheduledRun } from '../../src/shared/scheduled-tasks'
import appCss from '@renderer/styles/app.css?inline'

const frames = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
const noop = (): void => {}

interface Measurement {
  id: 'artifacts' | 'projects' | 'schedule-history'
  inputRows: number
  mountedRows: number
  renderCommitMs: number
  paintUpperBoundMs: number
  lastItemReachable: boolean | null
  opensStoredOutput: boolean | null
}

export async function measureCatalogs(runs: number): Promise<Measurement[]> {
  const artifacts: ArtifactCatalogItem[] = Array.from({ length: 10_000 }, (_, item) => ({
    publicationId: 'publication-' + item,
    artifactFileId: 'artifact-' + item,
    title: 'Plan ' + item,
    filename: 'plan-' + item + '.md',
    kind: 'markdown',
    sizeBytes: item,
    publishedAt: 1_700_000_000_000 + item,
    sessionId: 'session-' + item,
    sessionTitle: 'Review ' + item,
    pinned: item % 10 === 0
  }))
  const projects: Project[] = Array.from({ length: 100 }, (_, item) => ({
    id: 'project-' + item,
    name: 'Project ' + item,
    cwd: null,
    createdAt: item,
    updatedAt: item,
    instructions: '',
    pinnedAt: item % 10 === 0 ? item : null
  }))
  const history: ScheduledRun[] = Array.from({ length: 20 }, (_, run) => ({
    id: run,
    taskId: 'task',
    origin: 'schedule',
    startedAt: 1_700_000_000_000,
    finishedAt: 1_700_000_001_000,
    status: 'success',
    error: null,
    sessionId: null,
    exitCode: 0,
    output: ('a'.repeat(63) + '\n').repeat(1024),
    outputTruncated: true
  }))
  const previous = window.oo
  Object.assign(window, { oo: { artifacts: { catalog: () => Promise.resolve(artifacts) } } })
  const style = document.createElement('style')
  style.textContent = appCss
  document.head.append(style)
  const cases = [
    {
      id: 'artifacts',
      rows: artifacts.length,
      markup: <ArtifactsView onOpen={noop} onDeleted={noop} />
    },
    {
      id: 'projects',
      rows: projects.length,
      markup: (
        <ProjectsScreen
          projects={projects}
          loading={false}
          onCreate={async () => {}}
          onOpenProject={noop}
          onTogglePin={noop}
        />
      )
    },
    {
      id: 'schedule-history',
      rows: history.length,
      markup: <RunHistory runs={history} onOpenSession={noop} />
    }
  ] as const
  const results: Measurement[] = []
  try {
    for (const { id, rows, markup } of cases) {
      for (let run = 0; run <= runs; run++) {
        const host = document.createElement('div')
        host.style.cssText = 'position:fixed;inset:0;display:flex; overflow:auto;'
        document.body.append(host)
        const root = createRoot(host)
        const started = performance.now()
        flushSync(() => root.render(markup))
        const committed = performance.now()
        await frames()
        const painted = performance.now()
        for (let tick = 0; tick < 6 && !host.querySelector('li'); tick++) await frames()
        const mountedRows = host.querySelectorAll('li').length
        let lastItemReachable: boolean | null = null
        let opensStoredOutput: boolean | null = null
        if (run > 0 && id === 'artifacts') {
          const scroller = host.querySelector<HTMLElement>('[data-artifact-catalog-list]')!
          scroller.scrollTop = scroller.scrollHeight
          for (let tick = 0; tick < 6; tick++) await frames()
          lastItemReachable = !!host.querySelector('[data-artifact-catalog-row="publication-9999"]')
        }
        if (run > 0 && id === 'schedule-history') {
          const summary = host.querySelector('summary')
          if (summary) {
            summary.click()
            await frames()
            opensStoredOutput = host.querySelector('pre')?.textContent === history[0].output
          }
        }
        if (run > 0)
          results.push({
            id,
            inputRows: rows,
            mountedRows,
            renderCommitMs: committed - started,
            paintUpperBoundMs: painted - started,
            lastItemReachable,
            opensStoredOutput
          })
        root.unmount()
        host.remove()
      }
    }
    return results
  } finally {
    Object.assign(window, { oo: previous })
    style.remove()
  }
}
