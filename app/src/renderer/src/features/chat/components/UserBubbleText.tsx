import type { HTMLAttributes, ReactNode } from 'react'

const USER_BUBBLE_TEXT_CLASS = 'min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]'

interface UserBubbleTextProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

// 사용자 발화 버블 본문 공통 정책.
// - pre-wrap: 사용자가 입력한 줄바꿈/공백을 보존한다.
// - overflow-wrap:anywhere + break-words: 긴 단일 토큰/URL도 버블 폭 안에서 줄바꿈한다.
export function UserBubbleText({
  children,
  className = '',
  ...props
}: UserBubbleTextProps): React.JSX.Element {
  return (
    <div className={`${USER_BUBBLE_TEXT_CLASS} ${className}`} {...props}>
      {children}
    </div>
  )
}
