// Call after the previous layer becomes visible. Hidden/detached targets may belong
// to a dismissed layer or a session that is no longer active.
export function focusPanelOrigin(origin?: HTMLElement, fallback?: HTMLElement): boolean {
  for (const target of [origin, fallback]) {
    if (!target?.isConnected || target.closest('[inert], [hidden]')) continue
    target.focus({ preventScroll: true })
    return true
  }
  return false
}
