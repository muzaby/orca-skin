import { useMemo, useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { MenuItem } from '../../../../shared/ui/MenuItem'
import { useI18n } from '../../../../shared/i18n'

interface BranchMenuProps {
  current: string | null
  branches: string[]
  loading: boolean
  onPick: (branch: string) => void
}

// 브랜치 선택 팝오버 — 목록 + 하단 검색. 목록은 main 이 현재 브랜치를 맨 앞에 고정해
// 보내므로 여기서는 필터링만 한다(정렬을 두 곳에서 하면 갈라진다).
export function BranchMenu({
  current,
  branches,
  loading,
  onPick
}: BranchMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return branches
    return branches.filter((name) => name.toLowerCase().includes(needle))
  }, [branches, query])

  return (
    <div role="none" className="flex w-[280px] flex-col">
      <div className="max-h-[260px] min-h-[2rem] overflow-y-auto">
        {loading && branches.length === 0 && (
          <div className="px-2.5 py-2 text-footnote text-t5">
            {tr('chat.composer.loadingShort')}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-2.5 py-2 text-footnote text-t5">{tr('chat.composer.noMatches')}</div>
        )}
        {filtered.map((name) => (
          <MenuItem
            key={name}
            role="menuitemradio"
            aria-checked={name === current}
            title={name}
            onClick={() => onPick(name)}
          >
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {name === current && <Icon name="check" size={12} className="shrink-0" />}
          </MenuItem>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-1.5 rounded-r4 border border-border px-2 py-1.5">
        <Icon name="search" size={12} className="shrink-0 text-t5" />
        <input
          // 팝오버는 열릴 때마다 마운트되므로 autoFocus 가 "열면 바로 검색" 을 준다.
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={tr('chat.composer.branchSearchPlaceholder')}
          aria-label={tr('chat.composer.branchSearchPlaceholder')}
          className="min-w-0 flex-1 border-0 bg-transparent text-footnote text-ink outline-none placeholder:text-ink3"
        />
      </div>
    </div>
  )
}
