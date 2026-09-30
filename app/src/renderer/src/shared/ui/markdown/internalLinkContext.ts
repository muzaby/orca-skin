import { createContext } from 'react'

// Domain ownership stays with the app which supplies this callback.
export const MarkdownInternalLinkContext = createContext<
  ((href: string, origin: HTMLAnchorElement) => boolean) | null
>(null)
