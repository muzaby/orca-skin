import { useEffect, useMemo } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { TaskStatusIcon } from './TaskStatusIcon'
import {
  taskBoardFromMessages,
  taskBoardItemByKey,
  taskBoardOrdered,
  taskDetailRows,
  type TaskBoardItem,
  type TaskBoardStatus,
  type TaskDetailValue
} from '../../lib/taskBoard'
import type { TFunction } from 'i18next'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { chatActions, useChatSession, useUnseenSettledTaskCount } from '../../store/chatStore'

// 상태/그룹 라벨 키 — 렌더에서 tr() 해석(0096 stale-방지 패턴).
const STATUS_KEY: Record<TaskBoardStatus, MessageKey> = {
  in_progress: 'chat.taskTile.status.in_progress',
  stopping: 'chat.taskTile.status.stopping',
  paused: 'chat.taskTile.status.paused',
  pending: 'chat.taskTile.status.pending',
  completed: 'chat.taskTile.status.completed',
  aborted: 'chat.taskTile.status.aborted',
  failed: 'chat.taskTile.status.failed'
}

// 현재 세션의 할 일 목록(0215 D-013 — `TaskCreate` 계열만). 서브에이전트는 `백그라운드 작업`
// 타일이 자기 파생으로 그린다.
function useTaskBoard(): TaskBoardItem[] {
  const messages = useChatSession((s) => s.messages)
  // 순서는 `taskBoardOrdered` 하나가 정한다(§10 EP-14) — 컴포넌트가 다시 정렬하지 않는다.
  return useMemo(() => taskBoardOrdered(taskBoardFromMessages(messages)), [messages])
}

// 헤더 전용 — 선택이 없으면 **접지 않는다**. 헤더는 그때 고정 문자열만 그리므로 전체 fold 가
// 통째로 버려진다(`SubAgentTileHeader` 가 같은 이유로 같은 가드를 둔다).
function useSelectedTaskForHeader(): TaskBoardItem | undefined {
  const messages = useChatSession((s) => s.messages)
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  return useMemo(
    () =>
      selectedKey ? taskBoardItemByKey(taskBoardFromMessages(messages), selectedKey) : undefined,
    [messages, selectedKey]
  )
}

// 타일 헤더 — 상세면 뒤로가기 + 작업 제목, 목록이면 '작업'. RightPanelTile 의 기본 라벨 span 을
// 대체한다(tileRegistry 주입). 제목 폰트/톤은 기본 라벨과 일치.
export function TaskTileHeader(): React.JSX.Element {
  const { tr } = useI18n()
  const selected = useSelectedTaskForHeader()

  if (selected) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-g1">
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowL"
          onClick={() => chatActions.selectTask(null)}
          aria-label={tr('chat.taskTile.backToList')}
        />
        <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
          {selected.subject}
        </span>
      </div>
    )
  }
  return (
    <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
      {tr('chat.taskTile.headerTitle')}
    </span>
  )
}

// 의존 문구 조립 — 목록 행과 상세가 **같은 함수**를 부른다(0213 D-005 · §10 EP-04). 키만
// 공유하고 조립을 각자 하면 구분자 하나로 두 화면이 갈라진다.
function blockedByText(tr: TFunction, ids: string[]): string {
  return tr('chat.taskTile.blockedByValue', { ids: ids.join(', #') })
}

// 할 일 행의 둘째 줄 — 막혔을 때만 선다. `completed` 는 제외한다(D-006): 끝난 항목의 의존은
// 이미 무의미하고, 취소선 옆의 `#2 완료 필요` 는 거짓으로 읽힌다.
function blockedRowText(tr: TFunction, item: TaskBoardItem): string | null {
  if (item.status === 'completed' || item.blockedBy.length === 0) return null
  return blockedByText(tr, item.blockedBy)
}

function detailValueText(tr: TFunction, value: TaskDetailValue): string {
  switch (value.kind) {
    case 'statusLabel':
      return tr(STATUS_KEY[value.status])
    case 'text':
      return value.text
    case 'taskIds':
      return blockedByText(tr, value.ids)
  }
}

interface TaskRowProps {
  item: TaskBoardItem
}

function TaskRow({ item }: TaskRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const open = (): void => chatActions.selectTask(item.key)
  const blockedRow = blockedRowText(tr, item)
  // 카드 전체가 상세 열기 트리거. 내부에 중단 버튼(중첩 버튼 불가)을 두기 위해 <button> 대신
  // role="button" div 로 두고 키보드 동작을 유지한다.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      /* aria-label 은 **안정 이름**(subject)이다 — 표시 제목은 `in_progress` 동안 현재진행형으로
         바뀌므로(0212 D-006), 라벨까지 따라가면 스크린리더 사용자가 같은 항목을 다른 항목으로
         읽는다(D-007 · §10 EP-05). */
      aria-label={tr('chat.taskTile.openDetailAria', { description: item.subject })}
      className="group/task cursor-pointer rounded-r6 px-p2 py-1.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus"
    >
      {/* 제목 행 — 아이콘 · 제목. 제목에 `flex-1` 을 주지 않는 것이 D-020 의 요지다(행 우측에
          붙는 요소가 다시 생겨도 제목이 그 자리를 밀어내지 않는다). */}
      <div className="flex min-w-0 items-start gap-g2">
        {item.status === 'pending' ? (
          <TaskStatusIcon status="pending" badge={item.id} />
        ) : (
          <TaskStatusIcon status={item.status} />
        )}
        <span
          className={`min-w-0 truncate text-body leading-[1.5] ${
            item.status === 'completed' ? 'text-t6 line-through' : 'font-medium text-t9'
          }`}
        >
          {item.title}
        </span>
      </div>
      {/* 둘째 줄 — 막힘 표시. 0215 이전에는 background 메타와 슬롯을 나눠 썼으나 이 타일에
          서브에이전트가 오지 않으므로 분기가 하나만 남는다. */}
      {blockedRow && (
        <div className="mt-0.5 truncate pl-6 text-footnote text-ink3">{blockedRow}</div>
      )}
    </div>
  )
}

// `작업` 타일 본문 — **props 만 읽는 순수 View**. store 를 읽지 않으므로
// `renderToStaticMarkup` 으로 직접 검증할 수 있다(zustand 는 SSR 에서 `getInitialState()` 를
// 돌려주기 때문에 store 연결 컴포넌트는 시드가 반영되지 않는다). 0203 의 `...View` 선례와 동형.
export function TaskProgressList({
  items,
  agentTools = null,
  cliVersion = null
}: {
  items: TaskBoardItem[]
  // SDK `init` 이 실은 노출 도구 전량 / CLI 버전(0212 R-01). **`null` 은 판정 불가**다 —
  // 도구 이름 배열이 안 왔다는 뜻이고, 그때는 안내하지 않는다(D-005).
  agentTools?: string[] | null
  cliVersion?: string | null
}): React.JSX.Element {
  const { tr } = useI18n()
  // 기능이 **없다고 판정된 경우에만** 원인을 말한다 — 판정 불가(agentTools === null)에 안내를
  // 띄우면 멀쩡한 CLI 를 의심하게 된다(0212 D-005).
  //
  // 0213 D-007 이 분모를 `items` 전체가 아니라 **할 일 항목**으로 좁혔었다. 0215 이후 `items`
  // 자체가 할 일뿐이라 두 분모가 같아졌다 — 서브에이전트는 이 목록에 오지 않는다.
  const unsupported =
    items.length === 0 && agentTools !== null && !agentTools.includes('TaskCreate')
  // 상태 그룹 없이 한 줄로 나열한다(D-018) — 순서는 `taskBoardOrdered` 가 정하고 완료 항목은
  // 그룹으로 옮겨가지 않고 제자리에서 취소선으로 표시된다.
  return (
    <div className="flex flex-col gap-px">
      {unsupported && (
        <div className="px-p2 text-caption text-ink3">
          <p>{tr('chat.taskTile.unsupported')}</p>
          {cliVersion && <p>{tr('chat.taskTile.unsupportedVersion', { version: cliVersion })}</p>}
        </div>
      )}
      {items.length === 0 && !unsupported && (
        <p className="px-p2 text-caption text-ink3">{tr('chat.taskTile.emptyDesc')}</p>
      )}
      {items.map((item) => (
        <TaskRow key={item.key} item={item} />
      ))}
    </div>
  )
}

function TaskDetail({ item }: { item: TaskBoardItem }): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-g4 overflow-auto px-p5 py-p4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-footnote">
        {taskDetailRows(item).map((row) => (
          <div key={row.labelKey} className="contents">
            <dt className="text-ink3">{tr(row.labelKey)}</dt>
            <dd className="min-w-0 break-words text-t9">{detailValueText(tr, row.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function TaskTileContent(): React.JSX.Element {
  const items = useTaskBoard()
  // 선택 항목은 이미 접은 목록에서 찾는다 — 별도 훅으로 부르면 같은 렌더에서 fold 가 한 번 더
  // 돈다(목록은 세션 전체 parts 순회다).
  const selectedKey = useChatSession((s) => s.selectedTaskKey)
  const selected = taskBoardItemByKey(items, selectedKey)
  const agentTools = useChatSession((s) => s.agentTools)
  const cliVersion = useChatSession((s) => s.cliVersion)
  // 타일이 화면에 있으면 사용자가 결과를 본 것이다 — 미확인 배지를 계속 비운다(0204 D-004).
  const unseen = useUnseenSettledTaskCount()
  useEffect(() => {
    if (unseen > 0) chatActions.acknowledgeSettledTasks()
  }, [unseen])

  if (selected) return <TaskDetail item={selected} />

  // 목록 하나가 카드에 직접 붙는다(0213 D-003). `출력`·`컨텍스트` 는 채울 재료(아티팩트 도구·
  // cowork 렌더링 모델)가 생길 때까지 숨긴다(D-002) — 섹션이 하나뿐이면 접기 헤더가 의미를
  // 잃고, 접었을 때 타일 전체가 빈 카드로 보인다. 두 섹션이 돌아올 때 `TaskTileSections` 의
  // 껍데기를 다시 씌운다: **파일도 i18n 키도 지우지 않았다**(D-004 — 0205 가 정지를 그렇게
  // 남긴 덕에 이번 복귀가 배열 하나였다).
  return (
    <div className="min-h-0 flex-1 overflow-auto px-p3 py-p2">
      <TaskProgressList items={items} agentTools={agentTools} cliVersion={cliVersion} />
    </div>
  )
}
