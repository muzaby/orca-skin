import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// 2-pane 모달의 좌측 탭 레일 — 설정 모달과 플러그인 카탈로그 모달이 공유한다.
// 핸드오프 0159 r4 는 두 화면이 "동일 클래스 계약" 을 갖도록 클래스 문자열을 복제했는데,
// 두 소비처가 모두 features/ 라 상호 import 가 막혀 있어(eslint boundaries) 복제가 유일한
// 수단이었다. r5 에서 공통 상위인 shared/ui 로 올려 "동일 클래스" 를 "동일 소스" 로 승격한다.
export function Rail({
  title,
  children
}: {
  title: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <nav className="flex w-[210px] flex-none flex-col gap-g2 border-r border-border bg-sidebar p-p6">
      {/* 램프에 15px 단계가 없어 유일하게 남은 arbitrary px — 신규 토큰 단계 신설은
          제품 시각 결정(0121 §후속제안 1)이라 사용자 몫. 여기 한 곳으로 격리한다. */}
      <div className="px-p4 pb-p4 pt-p2 font-serif text-[15px] font-semibold text-ink">{title}</div>
      {children}
    </nav>
  )
}

// 레일 항목. `nested` 는 설정 모달의 provider 서브항목(들여쓰기 + 한 단계 흐린 텍스트).
export function RailItem({
  label,
  icon,
  active,
  nested = false,
  onClick
}: {
  label: ReactNode
  icon?: IconName
  active: boolean
  nested?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full cursor-pointer items-center rounded-r4 border-0 text-left transition-colors ${
        nested ? 'mt-g1 gap-g4 py-p2 pl-9 pr-p5 text-footnote' : 'gap-g5 px-p5 py-p3 text-body'
      } ${
        active
          ? 'bg-selected-soft font-medium text-selected'
          : `bg-transparent hover:bg-fill-uncontained-hover hover:text-t9 ${nested ? 'text-t6' : 'text-t7'}`
      }`}
    >
      {icon && <Icon name={icon} size={15} />}
      <span className={nested ? 'min-w-0 truncate' : undefined}>{label}</span>
    </button>
  )
}
