// 서버 생성 **응답 처리** (0163) — React 비의존.
//
// 0162 는 생성 응답에서 새 커넥터를 `origin === 입력한 주소` 로 찾고, **찾았을 때만**
// `onCreated` 를 불렀다. 그 콜백 안에 목록 갱신이 있었으므로 매칭이 한 글자라도 어긋나면
// **목록도 안 바뀌고 오류도 안 뜨는** 상태가 됐다 — 사용자에게는 "추가했는데 아무 일도
// 없었다" 로 보인다(사용자 보고 2026-08-03).
//
// 그래서 두 가지를 바꾼다:
//   1. 갱신은 **무조건** 한다. 새 커넥터를 특정하는 것과 목록을 최신으로 만드는 것은 별개다.
//   2. 특정은 **차집합**으로 한다. 문자열 정규화(끝 슬래시·대소문자)에 기대지 않는다.

export interface CreatedConnectorLike {
  connectorId: string
}

// 이전 목록에 없던 것이 새로 생긴 것이다. 여러 개면 첫 번째 — 생성 IPC 는 한 번에 하나만
// 만들므로 둘 이상 나오는 것은 다른 창이 동시에 만든 경우뿐이고, 그때 어느 쪽을 골라도
// 사용자는 목록에서 다시 고를 수 있다.
export function pickCreatedConnector<T extends CreatedConnectorLike>(
  before: readonly CreatedConnectorLike[],
  after: readonly T[]
): T | null {
  const known = new Set(before.map((item) => item.connectorId))
  return after.find((item) => !known.has(item.connectorId)) ?? null
}

// 생성 성공 후의 순서를 고정한다 — **갱신 먼저, 그 다음 인증**. 반대로 하면 인증 모달이
// 뜬 뒤에야 목록이 바뀌어, 사용자가 모달을 닫는 순간 화면이 흔들린다.
export function handleCreated<T extends CreatedConnectorLike>(steps: {
  before: readonly CreatedConnectorLike[]
  after: readonly T[]
  refresh: () => void
  connect: (connector: T) => void
}): T | null {
  steps.refresh()
  const created = pickCreatedConnector(steps.before, steps.after)
  if (created !== null) steps.connect(created)
  return created
}
