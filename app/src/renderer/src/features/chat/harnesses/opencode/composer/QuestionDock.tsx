import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AskQuestionRequest } from '../../../../../../../shared/ipc'
import { useI18n } from '../../../../../shared/i18n'
import { OpenCodeIcon } from '../Icon'
import { DockButton, DockPrompt } from './DockPrompt'
import { QuestionMark, QuestionOption } from './QuestionOption'

// Desktop question dock uses explicit next/submit, with the existing normalized 1.x request.
export function OpenCodeQuestionDock({
  ask,
  onSubmit,
  onSkip
}: {
  ask: AskQuestionRequest
  onSubmit: (answers: Record<string, string | string[]>, response?: string) => void
  onSkip: () => void
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const { questions } = ask
  const [tab, setTab] = useState(0)
  const [picks, setPicks] = useState<string[][]>(() => questions.map(() => []))
  const [custom, setCustom] = useState(() => questions.map(() => ''))
  const [customOn, setCustomOn] = useState(() => questions.map(() => false))
  const [minimized, setMinimized] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const replied = useRef(false)
  const q = questions[tab]
  const answers = questions.map((question, index) => {
    const other = customOn[index] ? custom[index].trim() : ''
    const values = [...picks[index], ...(other ? [other] : [])]
    return values.length ? (question.multiSelect ? [...new Set(values)] : values[0]) : null
  })
  const canSubmit = answers.every((answer) => answer !== null)
  const last = tab === questions.length - 1

  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('[data-slot="question-option"]')?.focus()
  }, [tab, minimized])

  if (!q) return null
  const pick = (label: string): void => {
    setPicks((old) =>
      old.map((items, i) =>
        i !== tab
          ? items
          : q.multiSelect
            ? items.includes(label)
              ? items.filter((item) => item !== label)
              : [...items, label]
            : [label]
      )
    )
    if (!q.multiSelect) setCustomOn((old) => old.map((value, i) => (i === tab ? false : value)))
  }
  const selectCustom = (): void => {
    const next = !q.multiSelect || !customOn[tab]
    setCustomOn((old) => old.map((value, i) => (i === tab ? next : value)))
    if (!q.multiSelect) setPicks((old) => old.map((value, i) => (i === tab ? [] : value)))
    if (next) input.current?.focus()
  }
  const proceed = (): void => {
    if (replied.current || answers[tab] === null) return
    if (!last) {
      setTab((value) => value + 1)
      return
    }
    if (!canSubmit) return
    replied.current = true
    onSubmit(
      Object.fromEntries(questions.map((question, index) => [question.question, answers[index]!]))
    )
  }
  const skip = (): void => {
    if (replied.current) return
    replied.current = true
    onSkip()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.repeat) return
    if (event.key === 'Escape') {
      event.preventDefault()
      skip()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      proceed()
      return
    }
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault()
      setTab((value) => Math.max(0, value - 1))
      return
    }
    if (
      (event.target as HTMLElement).tagName === 'INPUT' ||
      minimized ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return
    const number = Number(event.key)
    if (number >= 1 && number <= 9) {
      if (number <= q.options.length) {
        event.preventDefault()
        pick(q.options[number - 1].label)
      } else if (number === q.options.length + 1) {
        event.preventDefault()
        selectCustom()
      }
      return
    }
    const options = Array.from(
      root.current?.querySelectorAll<HTMLElement>('[data-slot="question-option"]') ?? []
    )
    const current = options.indexOf(event.target as HTMLElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : event.key === 'ArrowDown'
            ? Math.min(options.length - 1, current + 1)
            : event.key === 'ArrowUp'
              ? Math.max(0, current - 1)
              : -1
    if (next >= 0) {
      event.preventDefault()
      options[next]?.focus()
    }
  }
  return (
    <div ref={root} data-component="opencode-question" onKeyDown={onKeyDown}>
      <DockPrompt
        kind="question"
        label={tr('chat.ask.aria')}
        header={
          <div className="flex flex-col gap-[4px] px-[4px]">
            <div className="flex min-h-[28px] items-center justify-between gap-[12px]">
              <span className="min-w-0 truncate text-oc-muted">
                {q.header}{' '}
                <span className="tabular-nums">
                  {tab + 1}/{questions.length}
                </span>
              </span>
              <div className="flex shrink-0 items-center">
                {questions.length > 1 &&
                  questions.map((question, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={question.header}
                      aria-current={index === tab ? 'step' : undefined}
                      onClick={() => setTab(index)}
                      className="grid size-[20px] place-items-center rounded outline-none hover:bg-oc-hover focus-visible:ring-2 focus-visible:ring-oc-focus"
                    >
                      <span
                        className={`h-[2px] w-[14px] rounded-full ${index === tab ? 'bg-oc-muted' : answers[index] !== null ? 'bg-oc-accent' : 'bg-oc-border'}`}
                      />
                    </button>
                  ))}
                <button
                  type="button"
                  aria-expanded={!minimized}
                  aria-label={tr('chat.opencode.toggleQuestion')}
                  onClick={() => setMinimized((value) => !value)}
                  className="grid size-[28px] place-items-center rounded-[6px] text-oc-faint outline-none hover:bg-oc-hover focus-visible:ring-2 focus-visible:ring-oc-focus"
                >
                  <OpenCodeIcon name="chevron-down" className={minimized ? '-rotate-90' : ''} />
                </button>
              </div>
            </div>
            <div
              className={`font-[530] ${minimized ? 'line-clamp-3' : 'whitespace-pre-wrap break-words'}`}
            >
              {q.question}
            </div>
            {!minimized && q.multiSelect && (
              <span className="text-[11px] leading-[16px] text-oc-faint">
                {tr('chat.ask.multiSelect')}
              </span>
            )}
          </div>
        }
        footer={
          !minimized && (
            <>
              <DockButton onClick={skip}>{tr('chat.ask.skip')}</DockButton>
              <div className="flex items-center gap-[8px]">
                {tab > 0 && (
                  <DockButton
                    onClick={() => setTab((value) => value - 1)}
                    aria-label={tr('chat.ask.prevQuestion')}
                  >
                    <OpenCodeIcon name="outline-arrow-left" />
                    {tr('chat.opencode.back')}
                  </DockButton>
                )}
                <DockButton
                  tone="submit"
                  onClick={proceed}
                  disabled={last ? !canSubmit : answers[tab] === null}
                >
                  {tr(last ? 'chat.ask.submit' : 'chat.ask.next')}
                  <span className="font-[440] opacity-60">Ctrl+↵</span>
                </DockButton>
              </div>
            </>
          )
        }
      >
        {!minimized && (
          <div
            role={q.multiSelect ? 'group' : 'radiogroup'}
            aria-label={q.question}
            className="flex max-h-[min(320px,40vh)] min-h-0 flex-col gap-[6px] overflow-y-auto [scrollbar-width:none]"
          >
            {q.options.map((option) => (
              <QuestionOption
                key={option.label}
                label={option.label}
                description={option.description}
                selected={picks[tab].includes(option.label)}
                multiple={q.multiSelect}
                onClick={() => pick(option.label)}
              />
            ))}
            <div
              className={`flex min-h-[40px] items-center gap-[8px] rounded-[6px] border-[0.5px] px-[10px] ${customOn[tab] ? 'border-oc-focus bg-oc-selected' : 'border-oc-border bg-oc-layer-1 hover:bg-oc-layer-2'}`}
            >
              <button
                type="button"
                role={q.multiSelect ? 'checkbox' : 'radio'}
                aria-checked={customOn[tab]}
                aria-label={tr('chat.ask.otherInputAria', { header: q.header })}
                data-slot="question-option"
                onClick={selectCustom}
                className="grid h-[32px] shrink-0 place-items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-oc-focus"
              >
                <QuestionMark selected={customOn[tab]} multiple={q.multiSelect} />
              </button>
              <input
                ref={input}
                value={custom[tab]}
                placeholder={tr('chat.ask.otherPlaceholder')}
                aria-label={tr('chat.ask.otherInputAria', { header: q.header })}
                onFocus={() => {
                  if (!customOn[tab]) selectCustom()
                }}
                onChange={(event) =>
                  setCustom((old) =>
                    old.map((value, i) => (i === tab ? event.target.value : value))
                  )
                }
                className="h-[28px] min-w-0 flex-1 border-0 bg-transparent text-[13px] leading-[16px] text-oc-ink outline-none placeholder:text-oc-muted"
              />
            </div>
          </div>
        )}
      </DockPrompt>
    </div>
  )
}
