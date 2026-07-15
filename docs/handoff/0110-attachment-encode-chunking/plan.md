# Plan — 0110-attachment-encode-chunking

## 메타

| 항목 | 값 |
|---|---|
| slug | `0110-attachment-encode-chunking` |
| 작성자 | Claude Code |
| 일자 | 2026-07-15 |
| 매핑 | 성능 시리즈 4/4 (0107~0110) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "응답없음, 동기대기 등의 앱 사용 경험을 저해하는 성능 저하 요소들을 찾아라. 수정 방안을 마련하라" + "전체 4유닛 순차" 확정 | 라이브 세션 요청 (2026-07-15) |
| 추론 의도 | 큰 이미지 첨부 send/미리보기 순간의 프리즈도 "동기대기" 범주라는 판단은 조사 기반 해석 | 조사 결과 |

## Context (왜)

이미지 첨부의 base64 인코딩(`(await fs.readFile()).toString('base64')`)은 파일 읽기만 async 이고 **인코딩 자체는 동기 CPU** 다. 이미지 상한이 32MB(`image.ts:23` `maxRequestBytes`)라 큰 이미지 여러 장 첨부 시 `chat:send`·미리보기 invoke 순간 main 이벤트 루프가 수백 ms 점유된다(F6). 부수로 provider settings 스테일 체크의 `statSync` 가 매 `chat:send` 경유(F10 — 저비용이나 이미 async 인 `resolve()` 안이라 전환 비용 0).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| send 경로 동기 인코딩 | `app/src/main/features/chat/attachments.ts:112` (변경 전) |
| 미리보기 IPC 동기 인코딩 | `app/src/main/app/handlers/misc.ts:214` (변경 전) |
| 이미지 상한 32MB | `features/chat/image.ts:23` (`maxRequestBytes`) |
| `resolve()` 는 이미 async — statSync 만 동기 잔존 | `features/providers/provider-settings.ts:90,129-135` (변경 전) |
| base64 는 3바이트=4문자 — 3의 배수 경계로 자르면 청크별 인코딩 concat = 단일 인코딩과 바이트 동일 | RFC 4648 §4 (https://datatracker.ietf.org/doc/html/rfc4648#section-4) |

## 인수 기준 (Acceptance Criteria)

1. `bufferToBase64Chunked(buf, chunkBytes?)` — 3의 배수 정렬 청크(기본 3MiB)로 나눠 `setImmediate` 로 이벤트 루프에 양보하며 인코딩하고, **임의 크기 버퍼·임의 chunkBytes(비정렬·최소 미만 포함)에서 단일 `toString('base64')` 와 결과 동일** (단위 테스트).
2. `attachmentFromPath`(send 경로)와 `filesReadAttachment` 미리보기 핸들러가 이를 사용한다.
3. `provider-settings.ts` 의 mtime 스테일 체크가 `fs/promises.stat` 으로 전환된다 (`resolve()` 시그니처 무변경 — 이미 async).
4. worker/utilityProcess 오프로딩은 **불채택** — 1회성 수십~백 ms 작업에 프로세스 기동/직렬화 비용이 부적합(계획 문서 결정).
5. 게이트: lint 0 error · typecheck 3종 0 · attachments·providers 스위트 green.

## 범위 / 비범위

- **범위**: 위 3개 지점 + 테스트.
- **비범위**: 첨부 인코딩의 워커 오프로딩(기각), settings-store 전체 파일 쓰기(F9 보류), costSummary(F8 보류).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- Node 표준 `Buffer.subarray`(무복사 view)·`setImmediate`. **신규 의존성 없음**.

## 설계

- `features/chat/attachments.ts` 에 `bufferToBase64Chunked` 순수 헬퍼 — `aligned = max(3, chunkBytes - chunkBytes % 3)`, `aligned` 이하 버퍼는 단일 패스. 총비용 동일, 점유만 분산.
- 호출 2곳 교체(send·미리보기). misc.ts 는 app 레이어라 features import 합법(기존 import 블록 확장).
- `statMtime` → async (`stat` from `node:fs/promises`), 호출부 `await` 1곳.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 인코딩 총 소요는 동일 — 첨부 send 응답이 눈에 띄게 느려지지 않으면서 스트리밍/타이핑 등 다른 IPC 가 사이에 처리된다.
- 빈 버퍼(0B)·경계 정확히 일치·비정렬 chunkBytes 모두 동치 테스트로 고정.
- 동시성: 청크 사이에 다른 invoke 가 끼어들 수 있으나 인코딩은 지역 변수만 사용 — 공유 상태 없음.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 청크 경계 오류 = 첨부 데이터 훼손 | 단일 인코딩 동치 테스트(크기 11종 × 청크 6종) |
| setImmediate 왕복으로 총 소요 미세 증가 | 3MiB 청크 = 32MB 에 ~11회 양보 — 무시 가능 |

- 되돌리기 어려운 결정: 없음. Open Question: 없음.

## 영향 받는 파일

- `app/src/main/features/chat/attachments{,.test}.ts`
- `app/src/main/app/handlers/misc.ts`
- `app/src/main/features/providers/provider-settings.ts`

## 참고 문서

- 세션 계획(성능 시리즈) · `docs/arch/backend/adapters.md` §첨부. IPC 변경: 없음.

## 게이트

- `cd app && npm run lint && npm run typecheck` + `vitest run src/main/features/chat/attachments.test.ts src/main/features/providers`.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 출처 인용, 추론 표기.
- [x] 자료조사 — 전 발견 레퍼런스(외부 RFC 4648).
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 없음.
- [x] 파생 UX — 빈 버퍼/경계/동시성.
- [x] 리스크 — 동치 테스트 완화.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 청크+양보 방식. worker 기각 근거 유지.
- 이견 / 우려: 없음.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `chunkBytes < 3` 이면 정렬 결과 0 → 무한 루프 | ✅ `Math.max(3, …)` 클램프 + 동치 테스트에 1·2 포함 | `attachments.ts` |

## [구현자 기입] 구현 체크리스트

- [x] `bufferToBase64Chunked` + 동치 테스트 2건
- [x] send·미리보기 적용
- [x] `statMtime` async 전환

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 전부 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run …attachments …providers` |
| 게이트 결과 | lint ✅ 0 error(경고 1=0102 기지) / typecheck 3종 ✅ / attachments 6·providers 30 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 INDEX 기재) |
