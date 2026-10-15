import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { OpenCodeIcon } from '../Icon'
import type { OpenCodeTodo } from '../toolPresentation'
import {
  emptyTodoDock,
  summarizeTodos,
  TODO_MOTION_DURATION,
  TODO_OVERLAP,
  updateTodoDock
} from './todoState'

export interface OpenCodeTodoDockProps {
  sessionKey: string
  turnKey: string | number
  todos: readonly OpenCodeTodo[]
  live: boolean
  blocked: boolean
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const update = (): void => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

function useProgress(target: number, key: string, reduced: boolean): number {
  const [value, setValue] = useState({ key, progress: reduced ? target : 0 })
  const current = useRef(value)
  useLayoutEffect(() => {
    const from = current.current.key === key ? current.current.progress : 0
    const begin = Date.now()
    let frame: number | undefined
    const update = (progress: number): void => {
      current.current = { key, progress }
      setValue(current.current)
    }
    if (reduced || from === target) {
      update(target)
      return
    }
    update(from)
    const step = (): void => {
      const elapsed = Math.min(1, (Date.now() - begin) / TODO_MOTION_DURATION)
      const ease = 1 - (1 - elapsed) ** 3
      update(elapsed === 1 ? target : from + (target - from) * ease)
      if (elapsed < 1) frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame)
    }
  }, [target, key, reduced])
  return value.key === key ? value.progress : 0
}

/** OpenCode 1.19.0 session-todo-dock geometry, implemented with the existing React runtime. */
export function OpenCodeTodoDock({
  sessionKey,
  turnKey,
  todos,
  live,
  blocked,
  collapsed,
  onCollapsedChange
}: OpenCodeTodoDockProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const key = JSON.stringify([sessionKey, turnKey])
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState(() => emptyTodoDock(key))
  const [expired, setExpired] = useState<{ key: string; closingId: number } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(78)
  // Adjust the retained exit snapshot in render, before children can paint stale session data.
  const next = updateTodoDock(state, { key, todos, live, blocked, reducedMotion })
  if (next !== state) setState(next)
  useEffect(() => {
    if (next.closeDelay === null) return
    const timer = window.setTimeout(
      () => setExpired({ key: next.key, closingId: next.closingId }),
      next.closeDelay
    )
    return () => window.clearTimeout(timer)
  }, [next.key, next.closingId, next.closeDelay])
  const current = !blocked ? next : emptyTodoDock(key)
  const target =
    current.phase === 'open' ||
    (current.phase === 'closing' &&
      (current.closeDelay ?? 0) > 0 &&
      !(expired?.key === key && expired.closingId === current.closingId))
      ? 1
      : 0
  const progress = useProgress(target, key, reducedMotion)
  const visible = !blocked && current.snapshot.length > 0 && (target === 1 || progress > 0.001)
  useLayoutEffect(() => {
    if (!visible || !card.current) return
    const measure = (): void =>
      setHeight(Math.max(78, card.current?.getBoundingClientRect().height ?? 78))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(card.current)
    return () => observer.disconnect()
  }, [visible, collapsed, current.snapshot])
  if (!visible) return null
  const summary = summarizeTodos(current.snapshot)
  const actionable = target === 1
  return (
    <div
      data-slot="opencode-todo-region"
      data-phase={current.phase}
      data-progress={progress}
      className="relative overflow-hidden"
      style={{
        height: height * progress,
        marginBottom: -TODO_OVERLAP * progress,
        pointerEvents: actionable ? 'auto' : 'none'
      }}
      aria-hidden={!actionable || undefined}
    >
      <div
        ref={card}
        data-slot="opencode-todo-dock"
        className="min-h-[78px] rounded-[12px] border border-oc-border bg-oc-surface pb-[36px] text-[13px] leading-[20px] text-oc-ink"
        style={{ transform: `translateY(${(1 - progress) * height}px)` }}
      >
        <button
          type="button"
          data-slot="todo-toggle"
          className="flex h-[42px] w-full items-center gap-2 px-[16px] text-left hover:bg-oc-hover"
          aria-expanded={!collapsed}
          aria-label={tr(collapsed ? 'common.expand' : 'common.collapse')}
          disabled={!actionable}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <span className="shrink-0 text-oc-muted">{tr('chat.opencode.tool.todo')}</span>
          <span data-slot="todo-count" className="shrink-0 tabular-nums">
            {summary.completed}/{current.snapshot.length}
          </span>
          {collapsed && (
            <span data-slot="todo-summary" className="min-w-0 flex-1 truncate">
              {summary.representative?.text}
            </span>
          )}
          <OpenCodeIcon
            name="chevron-down"
            className={`ml-auto shrink-0 ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>
        {!collapsed && (
          <ul data-slot="todo-list" className="max-h-[168px] overflow-y-auto px-[16px] pb-[12px]">
            {current.snapshot.map((todo, index) => {
              const done = todo.status === 'completed' || todo.status === 'cancelled'
              return (
                <li
                  key={index}
                  data-status={todo.status}
                  className="flex min-h-[28px] items-start gap-2 py-1"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-4 shrink-0 items-center justify-center"
                  >
                    {todo.status === 'completed' ? (
                      <OpenCodeIcon name="check" />
                    ) : todo.status === 'in_progress' ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-oc-ink" />
                    ) : (
                      <span className="h-3 w-3 rounded-sm border border-oc-border" />
                    )}
                  </span>
                  <span className={done ? 'text-oc-faint line-through' : 'text-oc-ink'}>
                    {todo.text}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
