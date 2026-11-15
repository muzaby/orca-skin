import { useId, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { CatalogTabs } from '../../../shared/ui/CatalogTabs'
import { CatalogSearch } from '../../../shared/ui/CatalogSearch'
import { useCatalogSearch } from '../../../shared/hooks/useCatalogSearch'
import { useI18n } from '../../../shared/i18n'
import type {
  ScheduledRun,
  ScheduledTask,
  ScheduledTaskInput
} from '../../../../../shared/scheduled-tasks'
import type { ScheduleProject } from '../lib/scheduleForm'
import { RunHistoryPanel } from './RunHistory'
import { ScheduleRow } from './ScheduleRow'
import { ScheduleTaskModal, type RenderExecutionPicker } from './ScheduleTaskModal'

export interface SchedulesScreenProps {
  tasks: ScheduledTask[]
  loading: boolean
  revision: number
  projects: readonly ScheduleProject[]
  renderExecutionPicker: RenderExecutionPicker
  onCreate: (input: ScheduledTaskInput) => Promise<void>
  onUpdate: (input: ScheduledTaskInput & { id: string }) => Promise<void>
  onDelete: (task: ScheduledTask) => void
  onSetEnabled: (id: string, enabled: boolean) => void
  onRunNow: (id: string) => void
  loadRuns: (id: string) => Promise<ScheduledRun[]>
  onOpenSession: (sessionId: string) => void
}

type Tab = 'all' | 'enabled'
const TAB_KEYS = { all: 'schedules.tabAll', enabled: 'schedules.tabEnabled' } as const

function commandOf(task: ScheduledTask): string {
  return task.action.kind === 'prompt' ? task.action.text : task.action.command
}

// 예약 작업 카탈로그 — 프로젝트 카탈로그(`ProjectsScreen`)와 같은 골격이다:
// 제목+개수 · 우상단 추가 버튼 · 검색 · 탭 · 목록.
export function SchedulesScreen({
  tasks,
  loading,
  revision,
  projects,
  renderExecutionPicker,
  onCreate,
  onUpdate,
  onDelete,
  onSetEnabled,
  onRunNow,
  loadRuns,
  onOpenSession
}: SchedulesScreenProps): React.JSX.Element {
  const { tr } = useI18n()
  // 'new' = 생성 모달, ScheduledTask = 편집 모달.
  const [editing, setEditing] = useState<'new' | ScheduledTask | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const search = useCatalogSearch(() => setQuery(''))
  const createRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (tab === 'all' || task.enabled) &&
          (!normalizedQuery ||
            `${task.title}\n${commandOf(task)}`.toLocaleLowerCase().includes(normalizedQuery))
      ),
    [tasks, tab, normalizedQuery]
  )
  const closeModal = (): void => {
    setEditing(null)
    // 모달을 연 자리로 초점을 돌려준다.
    createRef.current?.focus({ preventScroll: true })
  }

  return (
    <section data-schedule-catalog="" className="flex min-h-0 min-w-0 flex-1 pb-2 pr-2">
      <div className="@container/catalog min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] px-8 pb-10 pt-10">
          <div className="flex items-center gap-3">
            <h1 className="m-0 font-serif text-[30px] font-medium tracking-[-0.02em] text-ink">
              {tr('schedules.title')}
              <span className="ml-2.5 align-middle font-sans text-footnote font-normal tracking-normal text-ink3">
                {tr('common.count', { count: tasks.length })}
              </span>
            </h1>
            <Button
              ref={createRef}
              variant="primary"
              size="small"
              leadingIcon="plus"
              className="ml-auto"
              data-schedule-new=""
              onClick={() => setEditing('new')}
            >
              {tr('schedules.newTask')}
            </Button>
          </div>
          <CatalogSearch
            id={id}
            label={tr('schedules.search')}
            placeholder={tr('schedules.searchPlaceholder')}
            value={query}
            onChange={setQuery}
            controls={search}
          >
            <CatalogTabs
              id={id}
              label={tr('schedules.title')}
              value={tab}
              items={(['all', 'enabled'] as const).map((value) => ({
                value,
                label: tr(TAB_KEYS[value])
              }))}
              onChange={setTab}
              marker="data-schedule-tab"
            />
          </CatalogSearch>
          <div
            role="tabpanel"
            id={`${id}-items`}
            aria-labelledby={`${id}-${tab}`}
            aria-busy={loading}
          >
            {loading && tasks.length === 0 ? (
              <p role="status" className="py-16 text-center text-footnote text-ink3">
                {tr('common.loading')}
              </p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-ink3">
                <Icon name={normalizedQuery ? 'search' : 'clock'} size={28} />
                <p role="status" className="text-footnote">
                  {tr(
                    normalizedQuery
                      ? 'schedules.noMatches'
                      : tab === 'enabled' && tasks.length > 0
                        ? 'schedules.emptyEnabled'
                        : 'schedules.emptyTitle'
                  )}
                </p>
                {tasks.length === 0 && (
                  <Button size="small" leadingIcon="plus" onClick={() => setEditing('new')}>
                    {tr('schedules.createFirst')}
                  </Button>
                )}
              </div>
            ) : (
              <ul className="m-0 list-none divide-y divide-border p-0">
                {visible.map((task) => (
                  <ScheduleRow
                    key={task.id}
                    task={task}
                    projectName={
                      projects.find((project) => project.id === task.projectId)?.name ?? null
                    }
                    expanded={expandedId === task.id}
                    onToggleExpanded={() =>
                      setExpandedId((current) => (current === task.id ? null : task.id))
                    }
                    onSetEnabled={(enabled) => onSetEnabled(task.id, enabled)}
                    onRunNow={() => {
                      // 방금 시작한 실행이 보이도록 이력을 펼친다.
                      setExpandedId(task.id)
                      onRunNow(task.id)
                    }}
                    onEdit={() => setEditing(task)}
                    onDelete={() => onDelete(task)}
                  >
                    <RunHistoryPanel
                      taskId={task.id}
                      revision={revision}
                      loadRuns={loadRuns}
                      onOpenSession={onOpenSession}
                    />
                  </ScheduleRow>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <ScheduleTaskModal
        open={editing != null}
        initial={editing != null && editing !== 'new' ? editing : undefined}
        projects={projects}
        renderExecutionPicker={renderExecutionPicker}
        onClose={closeModal}
        onSubmit={async (input) => {
          if (editing != null && editing !== 'new') {
            await onUpdate({ ...input, id: editing.id })
            return
          }
          await onCreate(input)
          setTab('all')
          search.reset()
        }}
      />
    </section>
  )
}
