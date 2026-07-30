import { create } from 'zustand'

export type CustomizeTab = 'skills' | 'connectors' | 'plugins'

interface ExtensionsModalState {
  open: boolean
  tab: CustomizeTab
  show: (tab?: CustomizeTab) => void
  setTab: (tab: CustomizeTab) => void
  hide: () => void
}

export const useExtensionsModalStore = create<ExtensionsModalState>((set) => ({
  open: false,
  tab: 'skills',
  show: (tab = 'skills') => set({ open: true, tab }),
  setTab: (tab) => set({ tab }),
  hide: () => set({ open: false })
}))
