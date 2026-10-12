# Verify — 0258-sdk-update-haiku-5-5

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0258-sdk-update-haiku-5-5` |
| 검증자 | Claude Code |
| 일자 | 2026-10-12 |
| 대상 커밋/range | `80671413..d289279b` = r1 `d289279b` (gate·회귀는 head `8de244ee`에서도 수행) |
| 구현 전 plan 기준 | `1665842b` (V1 설계, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `1665842b:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-06(AC12) 실 API 실기 대기(비차단) |
| 자기 검증 여부 | **예** — 구현 커밋 `Agent: claude`. 보고에 없던 축 2건(X 별칭 1M 오분류 · lockfile 독립 재열거)을 넣었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]` 절만 — hunk 시작 줄이 전부 마커(`:418`) 이후.
- 기준선이 diff로 성립하는가: 예 — 설계 `1665842b`, 구현 `d289279b` 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 0246·0245 표 기존 행은 AC4·AC5 회귀 행으로 닫음 |
| NEW node ↔ REQUIRED pair | 유효 | R-01~05·SD-01·AR-01·MD-01~03 → VP-01~11 |
| 선택적 적대 증거 | 유효 | 하드코딩 데이터·pin pair에 M1~M4 |
| 운영 gate | 유효 | 기준선·lint·typecheck·vitest·smoke 3종·build·inventory·trailer |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | SDK 0.3.296 exact pin | `package.json:35` · lock 9 entries + root dep + optional 8 → 전부 `0.3.296` · `npm ls` 0.3.296 |
| D-002 | `haiku` = 5.5 | `CLAUDE_ALIAS_VERSION.haiku {5,5}` · smoke B `haiku` → 요청 `claude-haiku-5-5` |
| D-003 | Haiku 5.5 기본 `medium`, 4.5는 표 밖 | 표 행 추가 · smoke A·D·D2 |
| D-004 | Haiku ≥5.5 네이티브 1M | `claude-context-policy.ts` haiku 분기 · smoke E `gw-haiku-5.5[1m]` → `[1m]` 제거 + `context-1m-2025-08-07` |
| D-005 | 자동 권한 규칙 불변 | `permission-mode.test.ts` 양성 2행 green |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 일부 플랫폼만 갱신 | 없음 | lockfile 독립 재열거: 본체 + 플랫폼 8 + optionalDependencies 8 전부 0.3.296 |
| 별칭 해석과 분류의 비대칭 | 의도 | `defaultEffortForModel('haiku')` = medium(별칭 5.5) · `classifyContextModel('haiku')` = 200k(버전 없음) — AC5가 명시 |
| 번들 CLI 동작 변화 | 회귀 없음 | smoke background exit 0 · context-usage exit 0 |
| 빌드 산출 | 정상 | `out/main/index.js` `require("@anthropic-ai/claude-agent-sdk")` 1건 |

## 3. 역방향 탐색

- 신규 export 없음(데이터·조건 추가). `rg 0.3.286|2.1.286` 대응: 비테스트 잔여는 plan대로 유지하는 관측 주석 1건(`background.monitor.test.ts:1`).
- `scan-surface.sh`는 ripgrep 부재로 미실행.

## 4. 선택된 적대 증거 재측정

- 등록 변이 4건 중 검출 4 · 미검출 0.
- M4는 구현자 보고를 재사용하지 않고 직접 재현했다: scratch 디렉토리에 `@anthropic-ai/claude-agent-sdk@0.3.286`(+`-win32-x64`)을 설치해 `app/node_modules`의 두 패키지와 바꿔 실행 → 원복 후 `npm ls` 0.3.296 · 식별 테스트 9/9 green.

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 Haiku 5.5 행 삭제 | `src/shared`+policy·background·chatStore.effort 61파일 | red 8 | VP-02·09 |
| M2 별칭 `haiku {4,5}` | 같음 | red 4 | VP-02·09 |
| M3 1M haiku 분기 삭제 | 같음 | red 5 | VP-03·10 |
| M4 설치 SDK 0.3.286 | smoke B · `claude.background.test.ts` | smoke exit 1(`haiku` → `claude-haiku-4-5-2025…`) · 식별 1 failed | VP-01·07 |
| X 버전 없는 `haiku`를 1M으로 | `claude-context-policy.test.ts` | red 1(`haiku → claude/200000`) | VP-10 (독립) |

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 증거 | §10 전수 |
|---|---|---|---|---|
| VP-09 | MD-01↔UT-01 | PASS | AC4 표 · M1·M2 red | EP-03 3/3 |
| VP-10 | MD-02↔UT-02 | PASS | AC5 표 · M3·X red | EP-04 1/1 |
| VP-11 | MD-03↔UT-03 | PASS | AC8 표 | 0(불변) |
| VP-08 | AR-01↔IT-01 | PASS | typecheck 0 · 식별 테스트 · lock 재열거 | EP-01 11/11 · EP-02 3/3 |
| VP-07 | SD-01↔ST-01 | PASS | smoke effort 21/21 ok · M2·M4 | EP-05 2/2 |
| VP-01 | R-01↔AT-01·02 | PASS | `npm ls` · smoke B · M4 red | EP-01·02 |
| VP-02 | R-02↔AT-03·04·07 | PASS | smoke A(`claude-haiku-5-5` medium)·D·D2(`low`) · AC4 · AC7 store IT | EP-03·EP-05① |
| VP-03 | R-03↔AT-05·06 | PASS | AC5 · smoke E | EP-04·EP-05② |
| VP-04 | R-04↔AT-08 | PASS | AC8 | 0 |
| VP-05 | R-05↔AT-09~11 | PASS | 전체 vitest 실패 0 · build · `Haiku 5.5` adapters.md:48 · `2.1.296` model-effort.ts:16 | EP-06 2/2 |
| VP-06 | R↔AT-12 | 실기 대기 | 실 API | 0 |

### AT / AC 합계

- AC1~AC11 ✅(위 증거), AC12 ⚠️.
- **합계 재측정**: `✅ 11 · ⚠️ 1 · ❌ 0 = 총 12` · 자기보고 일치.
- **합계 사본 대조**: trailer `Criteria-Met: 11/12` ↔ INDEX `✅11·⚠️1` — 일치.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC12 | 루프백 픽스처로 별칭·effort·1M 베타 | 실 계정으로 Haiku(별칭) 대화 완주 · 칩 '중간' · 도넛 분모 1M |

## 9. 게이트 재실행

- lint 0 error · 1 warning(기존) · typecheck exit 0.
- 전체 vitest(head `8de244ee`) → 653 passed · 1 skipped / 6643 passed · 1 skipped · 실패 0 — 구현 보고의 기준선 6599 → 6614(+15) 이후 0259의 +29가 더해진 값과 정합.
- smoke: `smoke-effort-sdk.mjs` exit 0 · `"ok":true` 21 · `"ok":false` 0 · `smoke-background-sdk.mjs` exit 0 · `smoke-context-usage-sdk.mjs` exit 0.
- `electron-vite build` exit 0. inventory `--check` exit 0.
- 기준선 vitest(0.3.286)는 재실행하지 않았다 — 현재 실패 0이라 "새 실패 0"이 직접 성립한다.
- 잔여물: scratch 설치(`$TEMP/sdk286`)는 작업 트리 밖. `app/node_modules/@anthropic-ai` 두 패키지 원복 확인.

## 11. Repository operation checks

- INDEX 상태 일치 · 좌표 `d289279b`(`git cat-file -t` commit, 원격 포함) 기입.
- trailer `d289279b` 7키 파싱.
- `[구현자 기입]` 7필드 존재.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| — | 없음 | — | — | — |

## 14. Review Signals — 사실만

- 이전 라운드와 동일 증상: 없음(최초).
- 반복된 검증 환경 한계: 등록 변이 M4는 구버전 SDK 설치가 필요하다(네트워크 + 약 1분).

## 15. 결론

- 상태: **PASS (기계 범위)**.
- pair: REQUIRED 10 PASS · VP-06 실기 대기 · PAIR_FAIL 0.
- PLAN_GAP: 없음.
- AC: ✅11 · ⚠️1(AC12) · ❌0.
- 남은 사람 확인: AC12.
