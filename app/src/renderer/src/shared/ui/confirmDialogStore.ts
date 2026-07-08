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
}

interface ConfirmStore {
  request: ConfirmRequest | null
  open: (req: ConfirmRequest) => void
  close: () => void
}

export const useConfirmStore = create<ConfirmStore>((set) => ({
  request: null,
  open: (req) => set({ request: req }),
  close: () => set({ request: null })
}))

// 어디서든(팝오버 메뉴 onClick 등) 호출해 확인 다이얼로그를 띄운다.
export function openConfirmDialog(req: ConfirmRequest): void {
  useConfirmStore.getState().open(req)
}
