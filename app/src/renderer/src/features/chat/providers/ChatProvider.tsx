import { createContext, useContext, type ReactNode } from 'react'
import { useChat } from '../hooks/useChat'

type UseChatReturn = ReturnType<typeof useChat>

const ChatContext = createContext<UseChatReturn | null>(null)

export function ChatProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const chat = useChat()
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>
}

export function useChatContext(): UseChatReturn {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}
