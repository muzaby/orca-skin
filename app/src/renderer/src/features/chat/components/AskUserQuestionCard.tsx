import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import type { AskQuestionRequest } from '../../../../../shared/ipc'

interface AskUserQuestionCardProps {
  ask: AskQuestionRequest
  // 모든 질문이 충족됐을 때 호출. answers = 질문텍스트 → label(단일) / label[](다중) / 기타 텍스트.
  onSubmit: (answers: Record<string, string | string[]>, response?: string) => void
  // ESC / 건너뛰기.
  onSkip: () => void
}

// 한 질문의 답을 구성한다. 기타 텍스트가 있으면 단일은 그것으로 대체, 다중은 선택지와 합친다.
// 충족되지 않으면(선택 0 · 기타 빈칸) null 을 돌려 제출을 막는다.
function answerFor(multiSelect: boolean, picks: string[], other: string): string | string[] | null {
  const trimmed = other.trim()
  if (multiSelect) {
    const vals = trimmed ? [...picks, trimmed] : picks
    return vals.length > 0 ? vals : null
  }
  if (trimmed) return trimmed
  return picks[0] ?? null
}

// 인라인 명확화 질문 카드. Composer 의 .app-frame-composer 하위, 입력 패널 바로 위에
// in-flow 위젯으로 렌더한다(모달 아님). 옵션은 role="listbox"/option, 단일/다중 선택을
// 지원하고 "기타" 자유입력 textarea 를 제공한다. Enter=제출 / Esc=건너뛰기.
export function AskUserQuestionCard({
  ask,
  onSubmit,
  onSkip
}: AskUserQuestionCardProps): React.JSX.Element {
  const { questions } = ask
  // 질문별 선택 라벨 배열(단일=최대 1) + 기타 자유입력 텍스트.
  const [picks, setPicks] = useState<string[][]>(() => questions.map(() => []))
  const [other, setOther] = useState<string[]>(() => questions.map(() => ''))
  // 한 번에 질문 1개만 보여준다. 좌우 화살표로 이동. (Composer 가 key={requestId} 로
  // 카드를 재마운트하므로 새 질문 묶음에선 0 으로 리셋된다.)
  const [current, setCurrent] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const last = questions.length - 1
  const multiQuestion = questions.length > 1
  const goPrev = (): void => setCurrent((c) => Math.max(0, c - 1))
  const goNext = (): void => setCurrent((c) => Math.min(last, c + 1))

  // 현재 질문 전환(및 마운트) 시 그 질문의 첫 옵션으로 포커스. picks/other 는 useState
  // 초기값으로 이미 리셋되므로 effect 내 setState 는 없다(React19 룰 무위반).
  useEffect(() => {
    queueMicrotask(() => {
      rootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus()
    })
  }, [current])

  const built = questions.map((q, i) => answerFor(q.multiSelect, picks[i], other[i]))
  const canSubmit = built.every((v) => v !== null)

  const submit = (): void => {
    if (!canSubmit) return
    const answers: Record<string, string | string[]> = {}
    questions.forEach((q, i) => {
      answers[q.question] = built[i] as string | string[]
    })
    onSubmit(answers)
  }

  const toggle = (qIdx: number, label: string, multiSelect: boolean): void => {
    setPicks((prev) => {
      const next = prev.map((p) => p.slice())
      if (multiSelect) {
        const at = next[qIdx].indexOf(label)
        if (at >= 0) next[qIdx].splice(at, 1)
        else next[qIdx].push(label)
      } else {
        next[qIdx] = next[qIdx][0] === label ? [] : [label]
      }
      return next
    })
    // 단일 선택은 옵션을 고르면 기타 입력을 비워 의도를 명확히 한다(다중은 병존 허용).
    if (!multiSelect) {
      setOther((prev) => {
        if (prev[qIdx] === '') return prev
        const next = prev.slice()
        next[qIdx] = ''
        return next
      })
    }
  }

  const changeOther = (qIdx: number, value: string, multiSelect: boolean): void => {
    setOther((prev) => {
      const next = prev.slice()
      next[qIdx] = value
      return next
    })
    // 단일 선택은 기타 입력 시 옵션 선택을 해제(상호 배타).
    if (!multiSelect && value.trim() !== '') {
      setPicks((prev) => {
        if (prev[qIdx].length === 0) return prev
        const next = prev.map((p) => p.slice())
        next[qIdx] = []
        return next
      })
    }
  }

  // 옵션 버튼 키보드: ↑↓ 같은 listbox 안에서 포커스 이동, Space 선택(Enter 는 카드로
  // 버블되어 제출에 쓰인다 — 옵션 선택은 click / Space 로).
  const onOptionKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const listbox = e.currentTarget.closest('[role="listbox"]')
      if (!listbox) return
      const opts = Array.from(listbox.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      const idx = opts.indexOf(e.currentTarget)
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const nextEl = opts[(idx + delta + opts.length) % opts.length]
      nextEl?.focus()
    }
  }

  // 카드 루트 키보드: Esc=건너뛰기, Enter=제출(textarea 안에서는 줄바꿈 허용),
  // ←→=질문 이동(textarea 밖 & 다중 질문일 때만 — listbox 는 ↑↓ 만 쓰므로 비충돌).
  const onRootKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onSkip()
      return
    }
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault()
      submit()
      return
    }
    if (multiQuestion && !(e.target instanceof HTMLTextAreaElement)) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
  }

  return (
    <div
      ref={rootRef}
      className="app-frame-ask mb-2 rounded-[14px] border border-border bg-panel px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]"
      data-ask-user-input
      data-behavior="interactive"
      role="group"
      aria-label="명확화 질문"
      onKeyDown={onRootKeyDown}
    >
      {multiQuestion && (
        <div className="mb-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={current === 0}
            aria-label="이전 질문"
            data-behavior="interactive"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2 hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Icon name="arrowL" size={14} />
          </button>
          <span className="font-mono text-[11.5px] tabular-nums text-ink3">
            {current + 1}/{questions.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={current === last}
            aria-label="다음 질문"
            data-behavior="interactive"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink2 hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Icon name="arrowR" size={14} />
          </button>
        </div>
      )}

      {(() => {
        const qIdx = current
        const q = questions[qIdx]
        return (
          <div>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="rounded bg-rust-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-rust">
                {q.header}
              </span>
              {q.multiSelect && <span className="text-[10.5px] text-ink3">여러 개 선택 가능</span>}
            </div>
            <div className="mb-2 text-[13.5px] font-medium text-ink">{q.question}</div>
            <div
              role="listbox"
              aria-multiselectable={q.multiSelect}
              className="flex flex-col gap-1.5"
            >
              {q.options.map((opt) => {
                const selected = picks[qIdx].includes(opt.label)
                return (
                  <button
                    key={opt.label}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggle(qIdx, opt.label, q.multiSelect)}
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.preventDefault()
                        toggle(qIdx, opt.label, q.multiSelect)
                      } else {
                        onOptionKeyDown(e)
                      }
                    }}
                    className={`flex w-full items-start gap-2 rounded-[10px] border px-3 py-2 text-left transition-colors ${
                      selected ? 'border-rust bg-rust-soft' : 'border-border bg-bg hover:bg-sidebar'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border ${
                        q.multiSelect ? 'rounded-[4px]' : 'rounded-full'
                      } ${selected ? 'border-rust bg-rust text-white' : 'border-border-strong'}`}
                    >
                      {selected && <Icon name="check" size={11} color="#fff" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[12px] text-ink2">{opt.description}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
            <textarea
              value={other[qIdx]}
              onChange={(e) => changeOther(qIdx, e.target.value, q.multiSelect)}
              placeholder="기타 — 직접 입력…"
              rows={1}
              aria-label={`${q.header} 기타 직접 입력`}
              className="mt-1.5 w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-1.5 text-[13px] text-ink placeholder:text-ink3 focus:border-border-strong focus:outline-none"
            />
          </div>
        )
      })()}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-lg border-0 bg-rust px-3.5 py-1.5 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          data-behavior="action:send"
        >
          제출
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="cursor-pointer rounded-lg border border-border bg-transparent px-3 py-1.5 text-[13px] text-ink2 hover:bg-sidebar"
          data-behavior="dismissible"
        >
          건너뛰기
        </button>
        <span className="ml-auto text-[11px] text-ink3">
          <kbd>↑↓</kbd> 이동 · <kbd>Space</kbd> 선택 ·{' '}
          {multiQuestion && (
            <>
              <kbd>←→</kbd> 질문 ·{' '}
            </>
          )}
          <kbd>Enter</kbd> 제출 · <kbd>Esc</kbd> 건너뛰기
        </span>
      </div>
    </div>
  )
}
