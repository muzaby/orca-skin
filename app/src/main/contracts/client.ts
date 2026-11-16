// 창 참조 계약 (0324 AR-07). 정의는 전송 계층(`infra/ipc/transport.ts`)이 갖는다 — infra 의
// 등록·통지 함수가 이 타입을 쓰고 infra 는 contracts 를 import 하지 못한다. feature·app 은 여기서
// 가져온다.

export type { ClientRef, RequestEvent } from '../infra/ipc/transport'
