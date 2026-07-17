export interface SteerBoundarySelection {
  providerKey: string | null
  model: string | null
  effort?: string
}

// permission 은 라이브 변경 가능하고, provider·실제 모델·effort 가 턴 경계를 이룬다.
export function canSteerAcrossSelection(
  active: SteerBoundarySelection,
  incoming: SteerBoundarySelection
): boolean {
  return (
    active.providerKey === incoming.providerKey &&
    active.model === incoming.model &&
    active.effort === incoming.effort
  )
}
