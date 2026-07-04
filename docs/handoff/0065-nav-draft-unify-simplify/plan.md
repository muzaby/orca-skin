# Plan — 0065-nav-draft-unify-simplify

> 0064(conversation continuity) 후속 — 사용자 지시 3건(2026-07-04): ① r5 잔여 항목(도넛 하락·원본 열기·분기 구분선) **구현이 안 됐으면 구현**(사용자 정정 — PR 보고 문제가 실기에서 그대로 재현) ② 이번 세션 구현 코드의 over-engineering 제거(simple is best) ③ **continuity draft 의 nav 즉시 노출을 일반 '새 대화' 에도 통일**. 비기능+소규모 UX 통일 = Claude 직접 plan→impl→verify.
>
> **① 은 실기 재현·실측으로 r5 결함을 확정하고 수정했다** — 로컬 환경(사용자 머신)이라 r1~r5 내내 불가능했던 실 wire 실측이 가능했다. 상세는 아래 "① 도넛 결함 실측·수정".

## 메타

| 항목 | 값 |
|---|---|
| slug | `0065-nav-draft-unify-simplify` |
| 작성자 | Claude Code |
| 일자 | 2026-07-04 |
| 상태 | READY |

## 사용자 의도 분리

- **명시**: nav 즉시 생성의 '새 대화' 통일 · over-engineering 제거 · r5 3항목 진행.
- **해석(추론)**: "통일" = 렌더 경로/행동 모델의 통일이지, continuity draft 의 전체 라이프사이클(이탈 생존·명시 삭제)을 빈 새 대화에 복제하라는 뜻이 아니다 — 빈 새 대화는 보존할 상태(프리필 transcript·계보)가 없고 컴포저 입력은 컴포넌트 로컬이라 이탈 생존 행은 유령 행이 된다. **active 한정 노출**이 simple-is-best 정합.

## 설계

1. **새 대화 nav 행 (통일)** — `chatStore` 의 draft 행 셀렉터를 일반화: continuity draft 행(기존, 생존 라이프사이클 유지) + **new-chat 슬롯 행**(`activeKey === NEW_CHAT_KEY` 일 때만, 최상단). 행 제목 null → SessionRow 의 기존 '새 대화' 폴백 재사용. 프로젝트 랜딩 바인딩(`pendingProjectId`)이 있으면 프로젝트 배지도 기존 경로 재사용. 클릭 = no-op(이미 활성), kebab(이름변경·삭제) 숨김 — `SessionRow` 에 "메뉴 항목 0 이면 kebab 미렌더" 조건 추가. 첫 전송 물질화(promote) 시 activeKey 가 세션 id 로 바뀌어 행이 DB 행으로 자연 교체(기존 direction-2 navigate 재사용). **신규 상태·액션·IPC 0.**
2. **단순화 (over-engineering 제거)** — ① `startForkDraft`/`startHandoff` 의 중복 draft 시드 블록(원본 메타 8필드 복사)을 공용 헬퍼로 추출 ② 훅 이름 일반화 `useContinuityDraftRows`→`useDraftSessionRows`·`useActiveContinuityDraftKey`→`useActiveDraftKey`(new-chat 행 포함으로 이름이 거짓이 됨) ③ 그 외 0064 코드는 검토 결과 유지 — `ContinuityArrivalHook`(경계 강제 필수)·claude-map 도넛 근사(도메인 로직·테스트 잠금)·fork_boundary 이중 합성(라이브/재로드 일치 필수)은 제거 대상 아님. 핸드오프 템플릿 축약(0064 OQ)은 사용자 승인 문안이라 본 범위 밖 유지.
3. **① 도넛 결함 실측·수정** — 실 앱(CDP 9223 + wireLog)에서 /compact 실기 재현: **compact 턴의 `result.usage` 는 전부 0 으로 온다**(실측 `inputTokens:0, outputTokens:0, costUsd:0.019` — 요약 요청 사용량은 `modelUsage` 에만 계상). r5 근사(`inputTokens := outputTokens`)의 전제("output_tokens 상시 제공")가 compact 턴에서 항상 거짓 → 근사 결과 0 → main 원장(`hasContextTokens`)·renderer(`contextTokens>0`) 게이트가 모두 스킵 → 라이브·재로드 도넛이 압축 전 값에 고착(사용자 보고 그대로). **수정 2점**: ⓐ `claude-map` 근사 폴백을 **modelUsage 출력 토큰 합(=요약 크기)** 으로 ⓑ `chatReducer` 가 `session.compacted` 에서 stale `lastTelemetry` 를 클리어(잔여 엣지에서도 "고착된 경고" 대신 "미측정"). 수정 후 실기 확증: telemetry `inputTokens:1471`(요약 크기), 도넛 **8%→1%** 즉시 하락, 재로드(turn_usage 행 1471·cache 제거·비용 보존) 정합. ②(원본 열기)·③(분기 구분선)은 실기 확인 결과 정상 동작 — 결함 없음.

## 인수 기준

1. **compact 후 도넛 갱신(r5 결함 수정)** — 실 /compact 턴에서 도넛/경고가 요약 크기 수준으로 즉시 하락하고 재로드(turn_usage) 정합. 근사 폴백=modelUsage 출력 합, `session.compacted` 시 renderer stale 텔레메트리 클리어. 단위 테스트 잠금(claude-map 신규 1·chatReducer 신규 1).
2. '새 대화' 활성 시(부팅 /new·새 대화 버튼·프로젝트 랜딩) nav '최근 대화' 최상단에 '새 대화' 행이 활성 강조로 즉시 노출되고, 다른 세션으로 이동하면 사라지며, 첫 전송 물질화 시 DB 행으로 교체된다. 행의 kebab 메뉴는 없다.
3. continuity draft 행의 기존 동작(생존·선택·삭제·rename 불가) 회귀 없음 — 기존 테스트 green + 이름 변경 반영.
4. fork/handoff draft 시드 중복 제거(공용 헬퍼) — 동작 diff 0(테스트 green).
5. 게이트 lint/typecheck/test green. 신규 의존성·IPC 채널·DB 변경 0.

## 비범위

- 새 대화 draft 의 이탈 생존/복수 draft(NEW_CHAT_KEY 싱글턴 유지) · 컴포저 입력 텍스트의 store 승격 · 핸드오프 템플릿 축약(OQ 유지).

## [구현자 기입] 구현 보고 (Claude, 2026-07-04)

| 항목 | 내용 |
|---|---|
| 변경 파일 | **main**: `adapters/claude-map.ts`(+test — modelUsage 폴백) / **renderer**: `reducer/chatReducer.ts`(+parts.test — compacted 클리어) · `store/chatStore.ts`(draft 시드 헬퍼 + `useDraftSessionRows`/`useActiveDraftKey` 일반화 + DRAFT_ROW_SEP 상수) · `features/chat/index.ts` · `app/hooks/useSessionHandlers.ts`(deletable 매핑 + continuity 한정 loadSession 우회) · `sessions/SessionList.tsx`(DraftSessionRow.deletable) · `sessions/SessionRow.tsx`(메뉴 항목 0 이면 kebab 미렌더) |
| 실기 확인 | CDP(9223)+wireLog 실측 — 결함 재현(도넛 8% 고착) → 수정 후 8%→1% 하락·재로드 정합. '새 대화' 행: /new 진입 즉시 최상단 활성·kebab 없음·이탈 시 소멸·mock 전송 물질화 시 DB 행 교체. fork draft: nav 즉시 행·분기된 지점 구분선(role=separator)·'원본 열기' 즉시 전환·draft 행 생존. 테스트 세션 2건 삭제(정리). |
| 게이트 | lint ✅ / typecheck(node·web·test) ✅ / test **677 passed(90파일)** (신규 2) |
| 단순화 검토 | 적용: draft 시드 dedup·훅 이름 정직화·SessionRow 메뉴 조건. 유지(제거 아님 판단): `ContinuityArrivalHook`(경계 강제)·fork_boundary 이중 합성(라이브/재로드 일치)·행 문자열 인코딩(useShallow 안정화 — zustand 제약). 핸드오프 템플릿 축약은 OQ 유지(사용자 승인 문안). |

## [구현자 기입] r2 — 사용자 피드백 2건 (2026-07-04)

| # | 피드백 | 대응 |
|---|---|---|
| 1 | '새 대화' nav 행은 클릭/진입이 아니라 **composer 전송 즉시** 노출(핸드오프/fork 는 현행 유지) | 노출 조건을 `activeKey===NEW_CHAT_KEY`(활성) → **`isNewChatRowVisible`**(`pendingNewChatKey===NEW_CHAT_KEY \|\| newChatQueue 대기`) 로 교체 — 전송 순간부터 세션 id 승격까지의 창에만 행이 존재하고, 승격 시 DB 행으로 자연 교체. continuity draft 라이프사이클은 무변경. |
| 2 | `compact_metadata.post_tokens`(SDK optional) 활용 — 구분선에 "얼마→얼마" 표기 + 도넛 참조 검토 | **도넛 참조 답변**: r1 수정 후 compact 턴 도넛은 modelUsage 출력 합(요약 크기) *근사* 를 참조 중이었다 — post_tokens 는 압축 후 컨텍스트 *실측* 이므로 1순위로 교체(`ctx.compactPostTokens ?? 요약 크기 폴백`). **구분선**: `session.compacted`/`compact_boundary` 파트에 postTokens 전파(claude-map→writer→reducer→parts→마커), 표기 `이전 대화 압축됨 · 15.3k → 9k 토큰`(pre/post 둘 다 있을 때, k 단위 소수 1자리). IPC_CONTRACT §3 갱신. 테스트: claude-map 2건(정규화·우선순위). |

- 게이트: lint/typecheck(3종) green, 관련 스위트 106 passed. **전체 test 는 better-sqlite3 ABI 이슈로 DB 스위트 20건 환경 실패 — 사용자 지시로 무시**(0019 계열, 코드 무관·658 passed).
