import { create } from 'zustand'

interface ExtensionsModalState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useExtensionsModalStore = create<ExtensionsModalState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false })
}))
