# Handoff skill regression coverage baseline

> 2026-08-14 `handoff-review` 도입 시점의 회귀 대조 기록.
> 이 파일은 실행 지침이 아니다. 지침 정본은 `handoff-plan/SKILL.md`와 `handoff-verify/SKILL.md`다.
> review가 지침을 바꾸면 `failure-patterns.md`의 **현재 모든 `## P<number>`**를 다시 전수 대조해야 하며, 이 표의 번호 상한을 정본으로 사용하면 안 된다.

## 판정 기준

- `COVERED`: 과거 causal failure가 발생하기 전에 발동하는 실행 가능한 지침이 있음.
- `PARTIAL`: 관련 지침은 있으나 재발 경로가 남음.
- `GAP`: 방어 지침 없음.
- `OBSOLETE`: 현재 구조에서는 더 이상 성립하지 않음. 근거 필요.

## P1~P37 baseline

| Pattern | causal lesson | 새 방어 지침 | 판정 |
|---|---|---|---|
| P1 | electron/DB 의존에서 test seam을 구체화하지 않음 | plan Technical Design — native 의존 순수부는 별도 import 경계 seam | COVERED |
| P2 | AC가 측정 불가/목적 밖/production path 없음 | plan Acceptance Criteria — 행동 단언 + 검증 수단 + production path | COVERED |
| P3 | 숫자 stale/승계 | plan 조사 — 재측정 + 합계 검산 | COVERED |
| P4 | 대표 샘플만 보고 전수 소비처 누락 | plan 조사 — 전수 grep + N | COVERED |
| P5 | 전제를 실측 없이 채택해 반복 | plan 요구 비판/조사 — 권위 신호와 실측 | COVERED |
| P6 | 외부 규약/선택 필드 의미 미확인 | plan 조사/AC — 벤더 1차 출처 + true/false/undefined | COVERED |
| P7 | lint/위생/레이어 등 저장소 규칙을 설계 입력에서 누락 | plan 조사 — eslint boundaries/hooks, hygiene, migration guard, 호출 관례를 명시적 입력으로 읽음 | COVERED |
| P8 | 파라미터 단위·상태 타입 표현 모호 | plan Technical Design — 단위/범위/의미 + 상호배타 상태 discriminated union | COVERED |
| P9 | 선행 자료를 비판 없이 수용 | plan 요구 비판 — 선행 자료를 코드와 재대조 | COVERED |
| P10 | 기존 결정/계약 충돌을 본문 후반에서 놓침 | Decision Ledger + 본문 완성 후 전체 정합성 gate | COVERED |
| P11 | AC끼리/절끼리 자가당착 | plan 문서 정합성 — 같은 대상 전 절 교차검증 | COVERED |
| P12 | 조사 가능한 것을 불가로 선언 | plan 질의 경계 + verify 테스트 가능한 핸들 탐색 | COVERED |
| P13 | lifecycle/cancel/전이 미전개 | Product/UX 상태 전이 + Technical Design lifecycle | COVERED |
| P14 | 참조 구현 범위를 전체 계약으로 착각 | plan Technical Design — union/enum 전수 나열 + 참조 구현 coverage + 재사용 형상/시점 확인 | COVERED |
| P15 | 계약 제약의 enforcement point 없음 | Technical Design — 누가/언제 강제 | COVERED |
| P16 | 유예 비용/one-way door 오판 | Product/UX 범위 — one-way door는 지금 결정 | COVERED |
| P17 | 같은 규칙을 중복 구현, SSOT 없음 | Technical Design — SSOT + 공유 강제 | COVERED |
| P18 | 실기 불가 전 테스트 핸들 미탐색 | verify 테스트 가능한 핸들 탐색 | COVERED |
| P19 | 실재하지 않는 문서 앵커를 결정 근거로 사용 | plan 조사 — 앵커 grep | COVERED |
| P20 | 부팅 등록값 증가의 기존 소비처 누락 | Technical Design — 등록/스토어 기존 소비처 전수 | COVERED |
| P21 | 부작용 원인 대신 로그/증상만 제거 | plan/verify — 증상이 가리던 상태 변화 확인 | COVERED |
| P22 | 사람 실기가 순수 로직 하치장 | plan AC + verify test handle 탐색 | COVERED |
| P23 | AC를 테스트 파일명에 결박 | plan AC — 행동 단언이 정본, verify는 실제 분기 실행 확인 | COVERED |
| P24 | AC 과다 후 구현자가 기준 재작성 | plan AC>25 분할 검토 + verify 구현 전 plan 기준선 고정 | COVERED |
| P25 | 순서 요구에 관측 지점 없음 | plan/verify — 훅/로그/주입 경계에서 순서 관측 | COVERED |
| P26 | producer는 맞지만 consumer 파생 규칙 오류 | plan/verify — producer/consumer 쌍으로 end-to-end 검증 | COVERED |
| P27 | 모델 출력/요청 수 worst-case 미계산 | plan Technical Design + verify 재측정 — 원천 상한 × 배치 상한 | COVERED |
| P28 | 벤더 1차 문서보다 맥락 불명 내부 관찰을 우선 | plan 조사 증거 우선순위 | COVERED |
| P29 | 순수 함수를 같은 native 파일 안에 둬 seam 실패 | plan — 별도 파일/import graph seam | COVERED |
| P30 | 음성 0건 gate가 정당한 이력까지 제거 | plan/verify — 허용 예외 선열거 후 술어 구성 | COVERED |
| P31 | 하위 가이드 주장을 정본으로 승격하며 재검증 안 함 | plan 조사 — 정본 승격 시 코드 재검증 + 원본 동시 수정 | COVERED |
| P32 | 코드 형태를 보기 전에 구조적 목표 숫자 고정 | plan 수치/총량 — 단계 지도 + 달성 가능성 | COVERED |
| P33 | 존재하지 않는 기존 테스트를 검증 수단으로 인용 | plan/verify — 실제 케이스/분기 존재 확인 | COVERED |
| P34 | 제거 요구를 이동으로 재해석, 조건절 무시 | Decision Ledger + 요구 비판 — 이유/조건 보존, 이동≠제거 | COVERED |
| P35 | 음성 총량 임계가 허용/제거 대상을 섞음 | plan/verify — 총량을 형태별 분해 | COVERED |
| P36 | 외부 구현 포트 문서가 계약 변경에서 drift | plan/verify — 문서 예제 shape + semantics를 AC로 검증 | COVERED |
| P37 | semantic 목표를 structural proxy만으로 검증 | plan/verify — semantic 적대 사례 + 실제 관측 주체 | COVERED |

## 이번 review의 보완 이력

초안 대조에서 `P7`, `P8`, `P14`가 `PARTIAL`이었다. review 완료 전에 다음을 `handoff-plan/SKILL.md`에 직접 승격했다.

- P7 — 저장소별 eslint/위생/migration/호출 관례를 설계 입력으로 읽는 지침.
- P8 — 정책 파라미터 단위·범위·의미와 상호배타 상태 discriminated union 지침.
- P14 — 참조 구현 사용 시 계약 union/enum 전수 대비 coverage 지침.

보완 후 **P1~P37: COVERED 37 / PARTIAL 0 / GAP 0 / OBSOLETE 0**.
