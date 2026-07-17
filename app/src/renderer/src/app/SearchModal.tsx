import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../shared/ui/Icon'
import { searchApi } from '../shared/api/ipc'
import { useI18n } from '../shared/i18n'
import type { SearchHit } from '../../../shared/ipc'

interface SearchModalProps {
  onClose: () => void
}

const DEBOUNCE_MS = 150
const LIMIT = 30

// 대화 검색 모달. 부모 (OverlayLayer) 가 `searchOpen` 일 때만 mount 하므로 internal
// open prop 은 없다 — unmount 가 곧 닫힘이고 state 자연 reset. 입력어는 150ms
// debounce 후 main 의 FTS5 IPC 로 전달. 인플라이트 request id 시퀀스 비교로 stale
// 응답을 폐기 — 빠르게 타이핑해도 마지막 응답만 반영.
export function SearchModal({ onClose }: SearchModalProps): React.JSX.Element {
  const { tr } = useI18n()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const reqSeqRef = useRef(0)
  const navigate = useNavigate()

  // 입력어 변경 → debounce → IPC. 빈 입력일 땐 IPC skip; 렌더 측에서 query 가
  // empty 면 "검색어를 입력하세요" 분기로 가니 hits 잔존값은 화면에 노출되지 않는다.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === '') return
    const seq = ++reqSeqRef.current
    const handle = window.setTimeout(() => {
      void searchApi.messages(trimmed, LIMIT).then((rows) => {
        if (seq !== reqSeqRef.current) return
        setHits(rows)
        setSelectedIdx(0)
      })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [query])

  // 외부 클릭 + Escape 로 닫기. Popover 패턴과 동일.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node | null
      if (panelRef.current?.contains(target ?? null)) return
      onClose()
    }
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const goto = useCallback(
    (hit: SearchHit): void => {
      navigate(`/chat/${hit.sessionId}`)
      onClose()
    },
    [navigate, onClose]
  )

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!hits || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[selectedIdx]
      if (hit) goto(hit)
    }
  }

  const showResults = query.trim() !== ''

  return (
    // 모달은 #app-frame-modal 의 grid 셀 중앙에 자리. 폭/높이는 콘텐츠 측에서 결정.
    <div className="grid h-full w-full place-items-center p-6">
      <div
        ref={panelRef}
        className="app-frame-search-modal flex max-h-[60vh] w-[640px] max-w-[92vw] flex-col overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
        data-context="modal"
        data-behavior="focus-trap"
      >
        <div className="flex flex-shrink-0 items-center gap-2 pl-6 pr-2.5 pt-[1.1rem] pb-[0.9rem]">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            id="search-modal-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={tr('search.placeholder')}
            autoFocus
            aria-label={tr('search.inputAria')}
            aria-controls="search-modal-results"
            aria-activedescendant={
              showResults && hits && hits.length > 0 ? `search-hit-${selectedIdx}` : undefined
            }
            className="flex-1 border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
          />
          <button
            type="button"
            aria-label={tr('common.close')}
            onClick={onClose}
            className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-ink2 hover:bg-sidebar"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="h-px w-full bg-border" />
        <SearchResults
          hits={showResults ? hits : null}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onChoose={goto}
        />
      </div>
    </div>
  )
}

interface SearchResultsProps {
  hits: SearchHit[] | null
  selectedIdx: number
  onSelect: (idx: number) => void
  onChoose: (hit: SearchHit) => void
}

function SearchResults({
  hits,
  selectedIdx,
  onSelect,
  onChoose
}: SearchResultsProps): React.JSX.Element {
  const { tr } = useI18n()
  if (hits === null) {
    return (
      <div className="px-3 py-6 text-center text-[12.5px] text-ink3">
        {tr('search.typeToSearch')}
      </div>
    )
  }
  if (hits.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[12.5px] text-ink3">{tr('search.noMatches')}</div>
    )
  }
  return (
    <div className="overflow-y-auto p-2.5">
      <div id="search-modal-results" role="listbox">
        {hits.map((hit, idx) => (
          <button
            key={hit.messageId}
            id={`search-hit-${idx}`}
            role="option"
            aria-selected={idx === selectedIdx}
            type="button"
            onMouseEnter={() => onSelect(idx)}
            onClick={() => onChoose(hit)}
            className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 px-2 py-1.5 text-left ${
              idx === selectedIdx ? 'bg-bg' : 'bg-transparent hover:bg-bg'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon name={hit.role === 'user' ? 'user' : 'chat'} size={16} />
              <span className="truncate text-[13px] text-ink">{renderSnippet(hit.snippet)}</span>
            </span>
            <span className="flex-none text-xs text-ink3">
              {(hit.sessionTitle ?? tr('search.noTitle')) + ' · ' + formatHitTime(hit.createdAt)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// SQLite snippet() 출력에서 `<mark>…</mark>` 만 강조로 변환. innerHTML 우회 — 임의의
// HTML 태그가 메시지 본문에 섞여 있어도 그대로 텍스트로 보여 XSS 방어.
function renderSnippet(snippet: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /<mark>([\s\S]*?)<\/mark>/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(snippet)) !== null) {
    if (m.index > lastIdx) {
      parts.push(<Fragment key={key++}>{snippet.slice(lastIdx, m.index)}</Fragment>)
    }
    parts.push(
      <mark key={key++} className="bg-rust-soft text-rust">
        {m[1]}
      </mark>
    )
    lastIdx = re.lastIndex
  }
  if (lastIdx < snippet.length) {
    parts.push(<Fragment key={key++}>{snippet.slice(lastIdx)}</Fragment>)
  }
  return parts
}

function formatHitTime(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
