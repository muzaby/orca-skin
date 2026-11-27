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
import { DetailSidePane } from '../../../shared/ui/DetailSidePane'
import { CATALOG_VIRTUALIZE_AFTER } from '../../../shared/ui/virtual/limits'
import {
  VirtualCatalogList,
  type CatalogRowPosition
} from '../../../shared/ui/virtual/VirtualCatalogList'
import { ScheduleDetail } from './ScheduleDetail'
import { ScheduleRow } from './ScheduleRow'
import { ScheduleTaskModal, type SchedulePickers } from './ScheduleTaskModal'

export interface SchedulesScreenProps {
  tasks: ScheduledTask[]
  loading: boolean
  revision: number
  projects: readonly ScheduleProject[]
  pickers: SchedulePickers
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

function taskRowKey(task: ScheduledTask): string {
  return task.id
}

// 예약 작업 카탈로그 — 프로젝트 카탈로그(`ProjectsScreen`)와 같은 골격이다:
// 제목+개수 · 우상단 추가 버튼 · 검색 · 탭 · 목록.
export function SchedulesScreen({
  tasks,
  loading,
  revision,
  projects,
  pickers,
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
  // 우측 상세 패널에 연 작업 — 플러그인 카탈로그의 상세 패널과 같은 규칙이다.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelWidth, setPanelWidth] = useState(560)
  const [expanded, setExpanded] = useState(false)
  const originRef = useRef<HTMLElement | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const search = useCatalogSearch(() => setQuery(''))
  const createRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const listScroller = useMemo(() => ({ current: scroller }), [scroller])
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
  const selected = tasks.find((task) => task.id === selectedId)
  const projectNameOf = (task: ScheduledTask): string | null =>
    projects.find((project) => project.id === task.projectId)?.name ?? null
  const select = (taskId: string): void => {
    originRef.current = document.activeElement as HTMLElement | null
    setSelectedId(taskId)
  }
  const closeDetail = (): void => {
    setExpanded(false)
    setSelectedId(null)
    // 패널을 연 행으로 초점을 돌려준다.
    window.requestAnimationFrame(() => {
      if (originRef.current?.isConnected) originRef.current.focus({ preventScroll: true })
    })
  }
  const closeModal = (): void => {
    setEditing(null)
    // 모달을 연 자리로 초점을 돌려준다.
    createRef.current?.focus({ preventScroll: true })
  }
  const renderRow = (task: ScheduledTask, position?: CatalogRowPosition): React.JSX.Element => (
    <ScheduleRow
      key={task.id}
      position={position}
      task={task}
      projectName={projectNameOf(task)}
      selected={selectedId === task.id}
      onSelect={() => (selectedId === task.id ? closeDetail() : select(task.id))}
      onSetEnabled={(enabled) => onSetEnabled(task.id, enabled)}
      onRunNow={() => {
        // 방금 시작한 실행이 보이도록 그 작업의 패널을 연다.
        select(task.id)
        onRunNow(task.id)
      }}
      onEdit={() => setEditing(task)}
      onDelete={() => onDelete(task)}
    />
  )

  return (
    <section
      data-schedule-catalog=""
      data-side-pane-host=""
      data-state={selected ? 'detail' : 'list'}
      className="relative flex min-h-0 min-w-0 flex-1 pb-2 pr-2"
    >
      <div
        ref={setScroller}
        inert={!!selected && expanded}
        className="@container/catalog min-h-0 min-w-0 flex-1 overflow-y-auto"
      >
        <div className={`mx-auto w-full max-w-[960px] pb-10 pt-10 ${selected ? 'px-4' : 'px-8'}`}>
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
            ) : visible.length > CATALOG_VIRTUALIZE_AFTER ? (
              <VirtualCatalogList
                items={visible}
                owner={listScroller}
                documentKey={JSON.stringify([tab, normalizedQuery])}
                keyOf={taskRowKey}
                renderRow={renderRow}
              />
            ) : (
              <ul className="m-0 list-none divide-y divide-border p-0">
                {visible.map((task) => renderRow(task))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {selected && (
        <DetailSidePane
          key={selected.id}
          lifecycleKey={`schedule:${selected.id}`}
          title={tr('schedules.title')}
          width={panelWidth}
          expanded={expanded}
          onWidthChange={setPanelWidth}
          onExpandedChange={setExpanded}
          onClose={closeDetail}
          markers={{ 'data-schedule-detail-panel': selected.id }}
          behavior="schedule-detail"
        >
          <ScheduleDetail
            task={selected}
            projectName={projectNameOf(selected)}
            revision={revision}
            loadRuns={loadRuns}
            onSetEnabled={(enabled) => onSetEnabled(selected.id, enabled)}
            onRunNow={() => onRunNow(selected.id)}
            onEdit={() => setEditing(selected)}
            onDelete={() => onDelete(selected)}
            onOpenSession={onOpenSession}
          />
        </DetailSidePane>
      )}
      <ScheduleTaskModal
        open={editing != null}
        initial={editing != null && editing !== 'new' ? editing : undefined}
        projects={projects}
        pickers={pickers}
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
