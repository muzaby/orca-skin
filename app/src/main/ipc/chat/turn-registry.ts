// 턴 핸들 타입의 무회귀 배럴(ipc/chat 내부 importer 호환). 레지스트리 소유는 RuntimeSupervisor
// (lifecycle/supervisor.ts)로 이관됐다(0053) — 이 배럴은 turn-local 타입만 재노출한다.
export type { InflightTurn, TurnContext } from '../../contracts/turn'
