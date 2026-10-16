import { useSyncExternalStore } from 'react'

// DEV 표시 설정은 세션과 별개인 메모리 상태다. 이력·설정·모델 입력은 변경하지 않는다.
let visible = false
const listeners = new Set<() => void>()

export function getAutomaticFeedVisibility(): boolean {
  return import.meta.env.DEV && visible
}

export function setAutomaticFeedVisibility(value: boolean): void {
  if (!import.meta.env.DEV || visible === value) return
  visible = value
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  if (!import.meta.env.DEV) return () => {}
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAutomaticFeedVisibility(): boolean {
  return useSyncExternalStore(subscribe, getAutomaticFeedVisibility, getAutomaticFeedVisibility)
}
