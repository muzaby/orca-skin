import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Button } from '../../../shared/ui/Button'
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
  // 단일 선택 시 다음 질문으로 자동 진행하는 지연 타이머(선택 하이라이트를 잠깐 보여준 뒤 이동).
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const last = questions.length - 1
  const multiQuestion = questions.length > 1
  const goPrev = (): void => setCurrent((c) => Math.max(0, c - 1))
  const goNext = (): void => setCurrent((c) => Math.min(last, c + 1))

  // 언마운트 시 진행 타이머 정리.
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [])

  // 현재 질문 전환(및 마운트) 시 그 질문의 첫 옵션으로 포커스. picks/other 는 useState
  // 초기값으로 이미 리셋되므로 effect 내 setState 는 없다(React19 룰 무위반).
  useEffect(() => {
    queueMicrotask(() => {
      rootRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus()
    })
  }, [current])

  const built = questions.map((q, i) => answerFor(q.multiSelect, picks[i], other[i]))
  const canSubmit = built.every((v) => v !== null)
  // 마지막 질문이면 primary = 제출, 아니면 다음(현재 질문만 답하면 진행). 화살표 행 대신
  // primary 버튼이 전진을 겸한다(참고 스크린샷 양식).
  const isLast = current === last

  const submit = (): void => {
    if (!canSubmit) return
    const answers: Record<string, string | string[]> = {}
    questions.forEach((q, i) => {
      answers[q.question] = built[i] as string | string[]
    })
    onSubmit(answers)
  }

  const toggle = (qIdx: number, label: string, multiSelect: boolean): void => {
    // 단일 선택에서 "새로 선택"(해제가 아님)인지 — 자동 진행 판단용. setPicks 전 현재값 기준.
    const isSelecting = !multiSelect && picks[qIdx][0] !== label
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
      // 단일 선택을 새로 고르면 마지막 질문이 아닌 한 다음 질문으로 자동 진행(짧은 지연으로
      // 선택 하이라이트를 보여준 뒤). 다중 선택/해제는 진행하지 않는다(수동 화살표 유지).
      if (isSelecting && qIdx < last) {
        if (advanceTimer.current) clearTimeout(advanceTimer.current)
        advanceTimer.current = setTimeout(() => {
          setCurrent((c) => (c === qIdx ? qIdx + 1 : c))
        }, 160)
      }
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
    // 1~9 숫자키 = 현재 질문의 N번째 옵션 직접 선택 (Desktop variant 단축키).
    if (!(e.target instanceof HTMLTextAreaElement) && /^[1-9]$/.test(e.key)) {
      const q = questions[current]
      const optIdx = Number(e.key) - 1
      if (q && optIdx < q.options.length) {
        e.preventDefault()
        toggle(current, q.options[optIdx].label, q.multiSelect)
        return
      }
    }
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault()
      // 마지막 질문이면 제출, 아니면 현재 질문이 답해졌을 때 다음으로.
      if (isLast) submit()
      else if (built[current] !== null) goNext()
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
      className="app-frame-ask rounded-r7 border border-t5 bg-surface-primary-elevated px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]"
      data-surface="prompt"
      data-ask-user-input
      data-behavior="interactive"
      role="group"
      aria-label="명확화 질문"
      onKeyDown={onRootKeyDown}
    >
      {(() => {
        const qIdx = current
        const q = questions[qIdx]
        return (
          <div>
            {/* 헤더 — 다중 질문이면 카운터 좌측에 이전/다음 화살표 + 1/N 카운터, 단일이면 질문
                헤더 라벨을 선두 배지로. 우측 상단 × 는 건너뛰기(참고 스크린샷). */}
            <div className="mb-2 flex items-start gap-g3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-g3">
                  {multiQuestion && (
                    <span className="flex items-center gap-g2">
                      <Button
                        iconOnly
                        size="small"
                        leadingIcon="arrowL"
                        onClick={goPrev}
                        disabled={current === 0}
                        aria-label="이전 질문"
                      />
                      <Button
                        iconOnly
                        size="small"
                        leadingIcon="arrowR"
                        onClick={goNext}
                        disabled={current === last}
                        aria-label="다음 질문"
                      />
                    </span>
                  )}
                  <span className="rounded bg-t3 px-1.5 py-0.5 text-caption font-semibold tabular-nums text-t7">
                    {multiQuestion ? `${current + 1}/${questions.length}` : q.header}
                  </span>
                  {q.multiSelect && <span className="text-caption text-t6">여러 개 선택 가능</span>}
                </div>
                <div className="text-[13.5px] font-medium text-t9">{q.question}</div>
              </div>
              <Button
                iconOnly
                size="small"
                leadingIcon="x"
                onClick={onSkip}
                aria-label="건너뛰기"
              />
            </div>
            <div
              role="listbox"
              aria-multiselectable={q.multiSelect}
              className="flex flex-col gap-g3"
            >
              {q.options.map((opt, optIdx) => {
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
                    className={`flex w-full items-start gap-g4 rounded-r4 border px-3 py-2 text-left outline-none hide-focus-ring ring-focus transition-colors ${
                      selected ? 'border-border-strong bg-t3' : 'border-t5 bg-t1 hover:bg-t2'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border ${
                        q.multiSelect ? 'rounded-[4px]' : 'rounded-full'
                      } ${selected ? 'border-rust bg-rust text-white' : 'border-border-strong'}`}
                    >
                      {selected && <Icon name="check" size={11} color="#fff" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-footnote font-medium text-t9">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-caption text-t6">{opt.description}</span>
                      )}
                    </span>
                    {optIdx < 9 && (
                      <kbd className="shrink-0 self-center" aria-hidden>
                        {optIdx + 1}
                      </kbd>
                    )}
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
              className="mt-1.5 w-full resize-y rounded-r4 border border-t5 bg-t1 px-3 py-1.5 text-footnote text-t9 outline-none ring-focus placeholder:text-t6 focus:border-border-strong"
              style={
                { fieldSizing: 'content', maxHeight: 'calc(4lh + 0.75rem)' } as React.CSSProperties
              }
            />
          </div>
        )
      })()}

      <div className="mt-3 flex items-center justify-end gap-g4">
        <Button variant="uncontained" onClick={onSkip} data-behavior="dismissible">
          건너뛰기
        </Button>
        <Button
          variant="primary"
          onClick={isLast ? submit : goNext}
          disabled={isLast ? !canSubmit : built[current] === null}
          data-behavior="action:send"
          kbd="Enter"
        >
          {isLast ? '제출' : '다음'}
        </Button>
      </div>
    </div>
  )
}
