# Verify — 0268-opencode-runtime-composer

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0268-opencode-runtime-composer` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `93bdef8..84d5c85`(r1, `Status: partial`) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `93bdef8` |
| V mode / 유효 V | Baseline V / V1 (서버 공유 범위는 이후 0275 D13, Composer 표현은 0281이 최신 정본) |
| 라운드 | 1 (verify 1회째) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**FAIL — §10 EP6(외부 링크) 3자리 중 2자리에서 심은 고장이 green이었다.** 서버 소유권·명시 포트·상태 상세·MCP 그룹 간격·미지원 파일 reveal·native agent 필터는 잠겼다. AC4(OpenCode Windows 토스트 미발생)는 실제 Windows 관측이 없어 미확인이다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `84d5c85`의 `plan.md` 변경: `[구현자 기입]` 자리표시자 1줄 → 구현 보고. 규범 행 변경 없음. 기준선 diff 성립.
- 구현 trailer가 `Status: partial`·`Criteria-Pending: AC4 …; EP6 진입 3곳 직접 oracle`로 미완을 스스로 표시했다.
- 정책 충돌은 **최신 handoff가 정본**(사용자 지시): D2의 "같은 cwd 서버 공유"는 0275 D13(호환 profile은 cwd 간 공유)이 대체, 패널·Composer 표현은 0281 기준.
- 채점 기준: AC1–10, VP1–10, §10 EP1–EP7.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V | 유효 | R1–R8·SD1–2·AR1–2·MD1 NEW ↔ VP1–10 REQUIRED |
| §10 자리 목록 | 유효 | EP1–7 자리를 파일·호출 단위로 고정, 검색 명령 기록 |
| AC4 판정 수단 | 유효 | "실제 Windows/OpenCode Desktop 관측, 증거 없으면 미확인" — 사람 실기 경계를 plan이 명시 |
| 선택 적대 증거 | 유효 | 없음 — 직접 결과 관측 |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D1 | 공통 RuntimePool LRU, active 미축출 | `runtime-pool.ts:67` `closeEntry` → adapter close → server release |
| D2→0275 D13 | 참조 소유권으로 서버 공유, 마지막 해제 회수 | 0275 instance lifecycle(0275 verify) |
| D3 | Desktop 기본 포트와 격리, Desktop 전역 설정 불변 | `server.ts:206` `--port=${port}` 명시 |
| D4 | 상태 상세를 작업 패널 위로 | `chatStore.ts:341` `{ id: 'task', detail: { id: 'nativeStatus' } }` |
| D5 | MCP 그룹 간격·브랜드 색 | `CustomizeList.tsx:125` `spaced={index > 0}` |
| D6 | 미지원 산출물·컨텍스트는 위치 열기 | `artifactViewerStore.ts:90` `revealUnsupported` |
| D7 | HTTP(S)는 OS 브라우저 | `index.ts:238` `installExternalNavigation(...)` · `Markdown.tsx:54` `target="_blank"` |
| D8·D9 | SDK primary agent·variant 정본, generation 보존 | `composer-catalog.ts:19` hidden/subagent 제외 |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| LRU 축출이 공유 세션을 닫음 | ✅ | closeEntry 결과로만 evicted 계산(H5 잡음) |
| 4096 충돌 | ✅ | 명시 포트(H4 잡음) |
| 외부 링크 앱 내 로드 | ⚠️ | 등록 helper는 테스트되지만 `index.ts`의 실제 등록 호출 삭제(H1)·Markdown `_blank` 삭제(H2)가 green |
| 토스트 원인 | 미확인 | 구현 보고: 토스트 비활성화 설정 미구현·실제 알림 억제 미관측. D3이 Desktop 전역 설정 변경을 금지하므로 포트 격리 외 해법은 사용자 결정 사항 |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| 배선 없는 helper | **발견** | `installExternalNavigation`의 유일한 production 호출(`index.ts:238`)이 어떤 테스트의 실행 구간에도 없다 — electron을 import하는 `index.ts`는 테스트가 직접 import하지 못한다 |
| test-only symbol | 없음 | 나머지 신규 함수는 production 호출 |

## 4. 고장 내 보기

- 등록 변이 0. §10 재량 고장. 실행: main `src/main src/shared src/preload`(기준선 15 red = Windows 전용), renderer `src/renderer/src` 전체.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| H1 | `main/index.ts:238` | 제거 | 주 창 외부 링크 등록 호출 삭제 | **못 잡음** | — | EP6 registration · AC8 |
| H2 | `shared/ui/markdown/Markdown.tsx:54` | 제거 | anchor `target="_blank"` 삭제 | **못 잡음**(renderer 374/3060 green) | — | EP6 Markdown anchor · AC8 |
| H4 | `opencode/v1/server.ts:206` | 고정값 | `--port=${port}` → `--port=0` | 잡음 | `server.test: coalesces concurrent startup and passes isolated configuration, auth and preferences…` | EP2 start · AC3 |
| H5 | `sessions/runtime-pool.ts:67` | 제거 | closeEntry 성공 조건 삭제 | 잡음 | `runtime-pool.test: LRU eviction 은 close 를 정확히 1회 수행한다`·`opencode-runtime.test: reuses a live OpenCode process and releases it through the common runtime LRU` | EP1 closeEntry · AC1 |
| H6 | `skills/components/customize/CustomizeList.tsx:125` | 고정값 | 후속 그룹 `spaced` → `false` | 잡음 | `CustomizeList.render.test: labels native plugin skills and both native MCP groups with brand marks` | EP4 · AC6 |
| H7 | `chat/store/artifactViewerStore.ts:90` | 제거 | 미지원 retry의 reveal 삭제 | 잡음 | `artifactViewerStore.test: reveals an unsupported retry and ignores a late unsupported open after navigation` | EP5 · AC7 |
| H8 | `chat/store/chatStore.ts:341` | 다른 값 | 상태 상세를 별도 타일로 | 잡음 | `chatStore.panelTiles.test: opens status over the task…`·`Panel.interaction.test: opens native status in the task column…` | EP3 · AC5 |
| H9 | `opencode/v1/composer-catalog.ts:19` | 제거 | subagent 제외 삭제 | 잡음 | `composer-catalog.test: reads plugin-resolved primary agents and variants…` | EP7 mapper · AC9 |

- 검산: 시도 8 = 잡음 6 · 못 잡음 2(H1·H2) · 동치 0. 못 잡음 2건은 §10 EP6 고정 자리 → `PAIR_FAIL`. 구현자 자기보고 `EP6 0/3`과 방향 일치. 세 번째 자리(helper 내부의 popup/navigation 이벤트→shell)는 `external-navigation.test`가 직접 관측하며 이번 verify는 변이하지 않았다.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP10 | UT | REQUIRED | BLOCKED_BY:VP4 | version/cache/catalog 단위 pass(H9·0275 L11), 링크 형식(H2)은 VP4 root |
| VP8 | IT | REQUIRED | PASS | H5 잡음 |
| VP9 | IT | REQUIRED | PASS | H9 잡음, 0276 Q12·Q14 잡음 |
| VP6 | ST | REQUIRED | PASS | H4·H5 잡음 |
| VP7 | ST | REQUIRED | BLOCKED_BY:VP4 | EP3–5·7 흐름 PASS(H6–H9), EP6 진입은 VP4 root |
| VP1 | AT | REQUIRED | PASS | H5 잡음, version 재시도는 0275 L11 잡음 |
| VP2 | AT | REQUIRED | PASS(기계 범위) | AC3 H4 잡음 · AC4 사람 실기 대기 |
| VP3 | AT | REQUIRED | PASS | H6·H8 잡음 |
| VP4 | AT | REQUIRED | **PAIR_FAIL** | H7 잡음, **H1·H2** 못 잡음 |
| VP5 | AT | REQUIRED | PASS | H9 잡음, AC10은 0276·0281 테스트 pass |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 LRU 회수·공유 유지 | ✅ | H5 잡음 |
| AC2 version/db path 병합·재시도 | ✅ | 0275 L11·L10 잡음(같은 server 코드) |
| AC3 명시 loopback 포트 | ✅ | H4 잡음 |
| AC4 OpenCode Windows 토스트 미발생 | ⚠️ 사람 | 실제 Windows/Desktop 관측 없음 — plan 정의상 미확인 |
| AC5 상태 상세 | ✅ | H8 잡음 |
| AC6 MCP 그룹 간격·색 | ✅ | H6 잡음 |
| AC7 미지원 파일 reveal | ✅ | H7 잡음 |
| AC8 HTTP(S) 외부 열기 | ❌ | H1·H2 green |
| AC9 runtime agent·선택 전달 | ✅ | H9 잡음 |
| AC10 빈 variant·generation 보존 | ✅ | 0276 Q10·Q14 잡음, 0281 V1 VP4 PASS |

- 합계 재측정: `✅ 8 · ⚠️ 1(사람) · ❌ 1 = 10`. 자기보고 `Criteria-Met: 9/10`(AC4만 pending, AC8 ✅로 보고) — AC8에서 불일치.

### §10 강제 지점 분모

| EP | 결과 |
|---|---|
| EP1 서버 소유권 | PASS (H5, 0275 L12·L13 잡음) |
| EP2 시작·metadata | PASS (H4, 0275 L11) |
| EP3 상태 상세 | PASS (H8) |
| EP4 출처 그룹 | PASS (H6) |
| EP5 미지원 파일 | PASS (H7) |
| EP6 외부 링크 (3) | 1/3 — registration(H1)·Markdown anchor(H2) PAIR_FAIL, helper 이벤트→shell은 직접 oracle pass |
| EP7 native Composer | PASS (H9, 0276 Q11–Q14) |

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · renderer 374/3060 · main 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 8. 남은 사람 실기

| 항목 | 기계 검증 | 사람 |
|---|---|---|
| AC4: Orca OpenCode 세션 완료 시 Windows 토스트 | 명시 포트 spawn 인자(H4) | 실제 Windows + OpenCode Desktop 관측. 토스트가 남으면 Desktop 전역 설정 변경 여부는 D3 범위 밖이라 사용자 결정 |
| 상태 상세·그룹 색 두 테마 | DOM·class | 실제 창 |

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → `verify/FAIL`·Codex·라운드 2.
- 대상 커밋: `93bdef8`·`84d5c85` `git cat-file -t` = commit. `84d5c85` trailer 6키(`Criteria-Pending` 포함) 파싱.
- `[구현자 기입]` 필드와 EP1–7 표 존재. EP6를 `0/3`으로 정직하게 남겼다.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | H1: 주 창 외부 링크 등록 호출 삭제 green | EP6 registration · AC8 · VP4 | BLOCKING (PAIR_FAIL) | 창 생성 조립을 electron 비의존 함수로 떼어 등록을 단언하거나 production 소스 등록을 검사 |
| D2 | H2: Markdown `target="_blank"` 삭제 green | EP6 Markdown anchor · AC8 · VP4 | BLOCKING (PAIR_FAIL) | Markdown 링크 렌더의 `target`·`rel` 단언 |
| P1 | AC4 토스트 미발생 미확인 | VP2 · AC4 | 사람 실기 | 실제 Windows 관측 |

## 14. Review Signals

- 첫 verify. 구현자 보고가 EP6 미잠금·AC4 미확인을 스스로 표시했고 검증이 같은 자리를 재확인했다.
- 사용자 결정 변경: D2 → 0275 D13, 패널·Composer 표현 → 0281(최신 handoff 기준).
- 반복 환경 한계: electron을 import하는 `index.ts`의 테스트 불가, 실제 Windows 토스트 관측 불가.

## 15. 결론

- 상태: **FAIL** — verify 1회째.
- pair: PASS 7(VP1·VP2(기계)·VP3·VP5·VP6·VP8·VP9) · root PAIR_FAIL 1(VP4) · BLOCKED_BY 2(VP7·VP10). PLAN_GAP 없음.
- AC: ✅8 · ⚠️1(사람) · ❌1 / 10.
- 다음 단계: Codex r2 — D1·D2, 다음 verify는 H1·H2 재실행. AC4는 사람 관측.
