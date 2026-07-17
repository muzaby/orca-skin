import { useEffect } from 'react'

// Esc 로 닫기 — 공용 Modal 과 슬롯 계열 다이얼로그(Installer/Auth)가 공유한다
// (handoff 0121 닫기 UX 통일). enabled=false 면 리스너를 떼어 busy 중 닫기를 차단한다.
export function useEscToClose(enabled: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, onClose])
}
