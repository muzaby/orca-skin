import { useEffect } from 'react'
import { useStore } from 'zustand'
import {
  mailArchiveSourceStore,
  type MailArchiveSourceStore,
  type MailArchiveSourceState
} from './source-state'

export function useMailArchiveSourceState(
  store: MailArchiveSourceStore = mailArchiveSourceStore
): MailArchiveSourceState {
  const state = useStore(store)
  useEffect(() => store.getState().acquire(), [store])
  return state
}
