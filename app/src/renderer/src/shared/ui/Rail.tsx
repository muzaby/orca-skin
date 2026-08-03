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
      {/* 레퍼런스(claude.ai 설정)의 "설정"·"사용자 지정" 처럼 조용한 섹션 라벨 —
          제목이 아니라 그룹 머리다. serif 15px 제목이었던 것을 라벨로 낮춘다. */}
      <div className="px-p4 pb-p2 pt-p2 text-caption text-ink3">{title}</div>
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
        // 활성 = 중립 회색 칩(t3 = press/selected surface). 레퍼런스가 파랑이 아니라
        // 회색 칩을 쓰고, 파랑(selected-soft/selected)은 이 표면에서 유일하게 튀는 색이었다.
        active
          ? 'bg-t3 font-medium text-t9'
          : `bg-transparent hover:bg-fill-uncontained-hover hover:text-t9 ${nested ? 'text-t6' : 'text-t7'}`
      }`}
    >
      {icon && <Icon name={icon} size={15} />}
      <span className={nested ? 'min-w-0 truncate' : undefined}>{label}</span>
    </button>
  )
}
