# Verify — 0270-native-command-presentation

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0270-native-command-presentation` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `453ef1f..44fce89`(r1) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `69e734f` · ΔV1 `453ef1f` |
| V mode / 유효 V | Baseline V + ΔV1 (SD1→SD1a·AR1→AR1a) |
| 라운드 | 1 (verify 1회째) |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**PASS — 10개 pair와 §10 12자리의 심은 고장 9건(+0271 공유 3건)이 모두 잡혔다.** OpenCode 진행 라벨·Claude 명령 이력 복원·세션 native 명령 후보·비활성 plugin 스킬 조회가 성립한다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `44fce89`의 `plan.md` 변경: 메타 상태 1행과 `[구현자 기입]` 채움.
- 기준선 diff 성립: 예 — V1 `69e734f`·ΔV1 `453ef1f`가 구현과 분리된 설계 커밋.
- 채점 기준: AC1–8, VP1–4·VP5a·VP6a·VP7–10, §10 12자리(EP1 2 · EP2 4 · EP3 3 · EP4 3).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V + ΔV1 | 유효 | SD1a·AR1a CHANGED ↔ VP5a·6a REQUIRED, R2 INHERITED ↔ VP2 REGRESSION |
| §10 자리 목록 | 유효 | 4행 12자리, 검색 명령과 파일 고정. ΔV1이 EP2 `sourceKey/unchanged` → `checkpoint/unchanged` 대체와 검색어 `projectionVersion` 추가 |
| 선택 적대 증거 | 유효 | 없음 — 표시 값·원문·옵션 직접 관측 |
| 운영 gate | 유효 | Vitest·lint·typecheck·build |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D1 | OpenCode 응답 진행 라벨 `생각 중`, Claude·준비·예약 라벨 유지 | `PendingAssistantStatus` `backend` → `StatusLine` `streamingLabelKey={statusStreamingLabel(backend)}` → `registries/status.ts` |
| D2 | native command envelope → `/command args`, 원본 보존 | `native-history-map.ts` `input.echo` → `nativeCommandText`(`native-command-text.ts`) |
| D3 | 세션 native commands가 컴포저 후보·강조 정본 | `composerSkills.ts` `native.status === 'ready'` 분기 → controller `knownSkillNames` |
| D4 | 비활성 native plugin 스킬도 읽기 전용 목록 | `plugin-catalog` files → `scanSkills` enabled 보존 → `skills:list` |
| D5 | 일반 XML·불완전 래퍼 보존, 자동 입력 origin 유지 | parser의 `match[1] !== match[2].slice(1)` 불일치 시 원문 반환 |
| ΔV1 | 원본 sourceKey 유지, 구 표시 cursor만 재투영 | `native-history.ts` `checkpoint?.projectionVersion === PROJECTION_VERSION` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 일반 XML·불완전 래퍼 변형 | ✅ | 이름 불일치·불완전이면 원문 반환(`native-command-text.ts:6`, V4 잡음) |
| 원본 파일·sourceKey 변경 | ✅ | 구 표시 cursor만 `projectionVersion`으로 재투영(`native-history.ts:174`, V7 잡음), 원본 bytes 불변 단언 |
| 자동 입력 origin 재분류 | ✅ | `input.echo`만 변환(`native-history-map.ts:199`), isMeta origin 회귀 pass |
| 전역 목록과 세션 명령 혼동 | ✅ | `native.status === 'ready'`일 때 세션 명령이 정본(`composerSkills.ts:23`, V8 잡음) |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| test-only symbol | 없음 | `nativeCommandText`·`statusStreamingLabel` production 호출 |
| 공유 자리 | 관찰 | EP4(설치 inventory)는 0271과 같은 코드(`scan.ts:75`·`plugin-catalog.ts:191`) — 0271 S7·S8·S10 결과를 공유 |

## 4. 고장 내 보기

- 등록 변이 0. §10 12자리 재량 고장. 실행: renderer `features/chat`·`shared`, main `src/main src/shared`.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| V1 | `chat/components/StatusLine.tsx:15` | 빈 값 | `streamingLabelKey` → `undefined` | 잡음 | `StatusLine.harness.test: renders the OpenCode grid…`·`TranscriptView.harness.test: uses the harness spinner on each pending transcript path (opencode)` | EP1 wrapper→common · AC1 |
| V2 | `harnesses/registries/status.ts:14` | 고정값 | backend 무관 `생각 중` | 잡음 | `StatusLine.harness.test: preserves Claude verbs and OpenCode preparation and scheduled waiting labels` | EP1 · AC2 |
| V3 | `transcript/PendingAssistantStatus.tsx:39` | 빈 값 | `backend={null}` | 잡음 | `TranscriptView.harness.test: …pending transcript path (opencode)`·`Timeline.render.test: keeps a progress indicator…` | EP1 backend→wrapper · AC1 |
| V4 | `claude/native-command-text.ts:6` | 제거 | message↔name 일치 확인 삭제 | 잡음 | `native-command-text.test: preserves ordinary, quoted and incomplete XML…` | EP2 parser · AC4 |
| V5 | 같은 파일 `:7` | 제거 | 인수 결합 삭제 | 잡음 | `native-command-text.test: restores the slash command and preserves arguments…` | EP2 parser · AC3·AC4 |
| V6 | `claude/native-history-map.ts:199` | 호출 대체 | echo 변환 삭제(원문) | 잡음 | `native-history-map.test: restores skill command string/blocks without changing raw entries or provenance` | EP2 map · AC3 |
| V7 | `claude/native-history.ts:174` | 제거 | projectionVersion 조건 삭제 | 잡음 | `native-history.test: reprojects a pre-command-display snapshot on restart…` | EP2 checkpoint (ΔV1) |
| V8 | `chat/lib/composerSkills.ts:23` | 고정값 | 세션 명령 분기 → `false` | 잡음 | `Composer.native-menu.test: loads claude/opencode native commands from +…` | EP3 projection · AC5·AC6 |
| V9 | `common/composer/ComposerInputController.tsx:152` | 빈 값 | `knownSkillNames` → 빈 집합 | 잡음 | `Composer.native-menu.test: keeps Orca file skill autocomplete scoped…` 외 | EP3 names→decoration · AC5 |

- 검산: 시도 9 = 잡음 9 · 못 잡음 0 · 동치 0. EP4 3자리는 0271 S7·S8·S10 잡음 공유.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP9 | UT | REQUIRED | PASS | V4·V5 잡음 |
| VP10 | UT | REQUIRED | PASS | V8 잡음 |
| VP6a | IT | REQUIRED | PASS | V6·V7 잡음 |
| VP7 | IT | REQUIRED | PASS | V8·V9 잡음 |
| VP8 | IT | REQUIRED | PASS | 0271 S7·S8·S10 잡음(같은 코드) |
| VP5a | ST | REQUIRED | PASS | V7·V8 잡음 |
| VP1 | AT | REQUIRED | PASS | V1·V2·V3 잡음 |
| VP2 | AT | REGRESSION | PASS | V5·V6 잡음 |
| VP3 | AT | REQUIRED | PASS | V8·V9 잡음 |
| VP4 | AT | REQUIRED | PASS | 0271 S7·S8 잡음 |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 OpenCode `생각 중` | ✅ | V1·V3 잡음 |
| AC2 Claude·준비·예약 라벨 보존 | ✅ | V2 잡음 |
| AC3 command wrapper 복원 | ✅ | V5·V6 잡음 |
| AC4 인수·원본 보존·일반 XML 무변경 | ✅ | V4·V5 잡음 |
| AC5 세션 명령 자동완성·강조 | ✅ | V8·V9 잡음 |
| AC6 빈 성공 제거·혼입 없음 | ✅ | V8 잡음(`…refreshes on reconnect`) |
| AC7 비활성 plugin 스킬 조회 포함 | ✅ | 0271 S7·S8·S10 잡음 |
| AC8 자동 입력 origin 유지 | ✅ | V6 잡음, `UserMessage.origin`·`turns` 회귀 pass |

- 합계 재측정: `✅ 8 · ❌ 0 = 8`. 자기보고 `Criteria-Met: 8/8`(`44fce89`) 일치.

### §10 강제 지점 분모

| EP | 결과 |
|---|---|
| EP1 (2) | 2/2 (V1·V3) |
| EP2 (4) | 4/4 (V4·V5·V6·V7) |
| EP3 (3) | 3/3 (V8·V9, autocomplete는 V8의 `loads … from +` 케이스) |
| EP4 (3) | 3/3 (0271 S7·S8·S10) |

- 12/12. 목록 밖 발견 없음.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · renderer 374/3060 · main 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → PASS 행 archive 이동.
- 대상 커밋: `69e734f`·`453ef1f`·`44fce89` `git cat-file -t` = commit, `44fce89` trailer 5키 파싱.
- `[구현자 기입]` 7필드와 12자리 표 존재.

## 13. Finding disposition

- 없음.

## 14. Review Signals

- 첫 verify, 반복 증상 없음, 사용자 결정 변경 없음.

## 15. 결론

- 상태: **PASS** — verify 1회째. pair PASS 10/10, PLAN_GAP 없음, AC ✅8/8.
