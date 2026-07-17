export interface SteerBoundarySelection {
  providerKey: string | null
  modelFamily?: string | null
  model: string | null
  effort?: string
}

// provider 에 bare alias(haiku/sonnet/opus)를 요청하면 assistant 는 정식 모델 id 를 보고한다.
// exact id 는 그대로 비교하고, bare alias 일 때만 구분자 토큰 일치를 허용한다.
export function matchesActualModel(
  selection: Pick<SteerBoundarySelection, 'model' | 'modelFamily'>,
  actualModel: string
): boolean {
  const expected = selection.model?.trim().toLowerCase()
  if (!expected) return true
  const actual = actualModel.trim().toLowerCase()
  if (expected === actual) return true
  const family = selection.modelFamily?.trim().toLowerCase()
  if (!family || expected !== family) return false
  return actual.split(/[^a-z0-9]+/).includes(family)
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
