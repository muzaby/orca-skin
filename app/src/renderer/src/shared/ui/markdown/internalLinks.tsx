import { useContext, type MouseEvent, type ReactNode } from 'react'
import { MarkdownInternalLinkContext } from './internalLinkContext'

export function MarkdownLink({
  href,
  children
}: {
  href?: string
  children?: ReactNode
}): React.JSX.Element {
  const open = useContext(MarkdownInternalLinkContext)
  const internal = href?.startsWith('#') ?? false
  const onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (internal && href && open?.(href, event.currentTarget)) event.preventDefault()
  }
  return (
    <a
      href={href}
      target={internal ? undefined : '_blank'}
      rel={internal ? undefined : 'noopener noreferrer'}
      onClick={onClick}
      className="text-rust underline-offset-2 hover:underline"
    >
      {children}
    </a>
  )
}
