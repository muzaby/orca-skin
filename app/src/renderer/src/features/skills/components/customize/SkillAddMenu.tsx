import { useState, type RefObject } from 'react'
import { Popover } from '../../../../shared/ui/Popover'
import { Icon, type IconName } from '../../../../shared/ui/Icon'

// 스킬 목록 헤더 `+` 의 캐스케이딩 메뉴(첨부 1). 1차: 스킬 둘러보기 / 스킬 만들기 ▸.
// 2차(우측 flyout): Claude와 함께 창작하기 / 스킬 지침 작성 / 스킬 업로드.
// 둘러보기·창작하기는 정적 스킨 플레이스홀더(닫기만), 지침 작성·업로드는 모달을 연다.
function MenuRow({
  icon,
  label,
  trailing,
  onClick
}: {
  icon: IconName
  label: string
  trailing?: IconName
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-ink hover:bg-fill-uncontained-hover"
    >
      <Icon name={icon} size={14} color="var(--color-ink2)" />
      <span className="flex-1">{label}</span>
      {trailing && <Icon name={trailing} size={13} color="var(--color-ink3)" />}
    </button>
  )
}

export function SkillAddMenu({
  open,
  anchorRef,
  onClose,
  onAuthor,
  onUpload
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onAuthor: () => void
  onUpload: () => void
}): React.JSX.Element | null {
  const [subOpen, setSubOpen] = useState(false)

  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} placement="bottom">
      <MenuRow icon="board" label="스킬 둘러보기" onClick={onClose} />
      <div
        className="relative"
        onMouseEnter={() => setSubOpen(true)}
        onMouseLeave={() => setSubOpen(false)}
      >
        <MenuRow icon="plus" label="스킬 만들기" trailing="chevR" />
        {subOpen && (
          <div
            role="menu"
            className="absolute left-full top-0 z-10 ml-1 min-w-[220px] rounded-lg border border-border bg-panel p-1 shadow-lg"
          >
            <MenuRow icon="chat" label="Claude와 함께 창작하기" onClick={onClose} />
            <MenuRow
              icon="doc"
              label="스킬 지침 작성"
              onClick={() => {
                onClose()
                onAuthor()
              }}
            />
            <MenuRow
              icon="upload"
              label="스킬 업로드"
              onClick={() => {
                onClose()
                onUpload()
              }}
            />
          </div>
        )}
      </div>
    </Popover>
  )
}
