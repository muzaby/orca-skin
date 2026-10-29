import type { ReactNode } from 'react'
import { create } from 'zustand'

// 범용 확인 다이얼로그의 열림 상태 + 요청 데이터. imperative opener(`openConfirmDialog`)로
// 어디서든 띄우고, `ConfirmDialogHost`(셸에 1회 마운트)가 이 store 를 구독해 렌더한다.
// 삭제 등 파괴적 액션은 `danger: true` 로 빨간 확정 버튼을 쓴다.
export interface ConfirmRequest {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  // 확인 없이 닫힐 때(취소·Esc·배경 클릭·다른 확인 요청에 의한 교체) 한 번 호출된다.
  onCancel?: () => void
}

interface ConfirmStore {
  request: ConfirmRequest | null
  open: (req: ConfirmRequest) => void
  /** 확인 처리 뒤 닫는다 — `onCancel`을 부르지 않는다. */
  close: () => void
  /** 확인 없이 닫는다 — 열린 요청의 `onCancel`을 부른다. */
  cancel: () => void
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  request: null,
  open: (req) => {
    const replaced = get().request
    set({ request: req })
    if (replaced && replaced !== req) replaced.onCancel?.()
  },
  close: () => set({ request: null }),
  cancel: () => {
    const cancelled = get().request
    set({ request: null })
    cancelled?.onCancel?.()
  }
}))

// 어디서든(팝오버 메뉴 onClick 등) 호출해 확인 다이얼로그를 띄운다.
export function openConfirmDialog(req: ConfirmRequest): void {
  useConfirmStore.getState().open(req)
}
