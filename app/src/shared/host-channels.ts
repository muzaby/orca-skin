// 셸 ↔ preload ↔ 페이지 — 호스트 포트 전달 (0324 EP-9 · §7-E · EP-26 ③ · D-058).
//
// zod 없는 상수만 둔다. preload 가 이 파일을 import 한다 — sandbox preload 의 `require` 는 `electron` 밖의
// 모듈을 불러오지 못하므로, zod 스키마가 있는 파일의 상수를 가져오면 그 파일의 최상위 zod 평가가 번들에
// 남아 preload 가 죽는다(§7-M 조사 3). `host-protocol.ts` 가 다시 내보내 셸·호스트의 import 는 그대로다.

export type HostName = 'agent' | 'data'
// 연결 요청의 대상 — 문서가 새로 읽힐 때 두 호스트 모두(`'all'`), 호스트가 죽은 뒤 첫 요청에서 그 호스트.
export type HostConnectTarget = HostName | 'all'

// 셸 → preload: 그 호스트의 새 포트(메시지에 동봉). payload `{ host }`.
export const HOST_PORT_CHANNEL = 'oo:host:port'
// 셸 → preload: 그 호스트가 종료됐다 — 기다리던 요청을 실패시키고 다음 요청에서 다시 잇는다.
// payload `{ host }`.
export const HOST_EXITED_CHANNEL = 'oo:host:exited'
// preload → 셸: 포트를 달라. payload `{ host: HostConnectTarget }`.
export const HOST_CONNECT_CHANNEL = 'oo:host:connect'
// preload → 페이지 메인 월드: 셸이 넘긴 포트를 같은 창의 `window.postMessage` 로 넘길 때의 표지.
// data `{ type: HOST_PORT_MESSAGE, host }` · 포트 1. 받는 쪽은 renderer 전송층(`transport/install.ts`)이다.
export const HOST_PORT_MESSAGE = 'oo:host:port-message'
