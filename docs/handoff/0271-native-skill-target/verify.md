# Verify — 0271-native-skill-target

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0271-native-skill-target` |
| 검증자 | Claude Code |
| 일자 | 2026-10-22 |
| 대상 커밋/range | `30566e0..a5489f0`(r1) · 검증 HEAD `32b43cc` |
| 구현 전 plan 기준 | V1 `57983c2` · ΔV1 `30566e0` · 0278 이관 annotation `087543e` |
| V mode / 유효 V | Baseline V + ΔV1 (VP-01b·02b 대체, AC5 색상 단언 → 0278 AC1) |
| 라운드 | 1 (verify 1회째) |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니오 — 설계·구현 Codex, 검증 Claude |

**PASS — 4개 pair와 §10 16자리의 심은 고장 10건이 모두 잡혔다.** native 이름의 정확 조회·등록 경로만 OS 전달·native 쓰기 거부·비활성 plugin 파일 보존이 성립하고, 색상은 최신 정책(0278 capability 행렬)으로 채점했다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋 `a5489f0`의 `plan.md` 변경: 메타와 `[구현자 기입]` 채움.
- 기준선 diff 성립: 예 — V1·ΔV1이 구현과 분리된 설계 커밋. ΔV1(EP-05 검색이 6행인데 목록 4자리 → `includeDisabled` 필터 추가)은 구현자가 발견한 누락을 설계 커밋으로 먼저 고정했다.
- `087543e`가 AC4 일괄 토글 금지 → 항목별 capability, AC5 enabled=false 색상 → 0278 AC1/VP1·VP4로 이관 — 사용자 결정 인용.
- 채점 기준: AC1–5(AC5는 파일 열기·식별자 부분), VP-01b·02b·03·04, §10 16자리(EP-01 2 · EP-02 5 · EP-03 2 · EP-04 2 · EP-05b 5).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V + ΔV1 | 유효 | SD-01b CHANGED ↔ VP-02b REQUIRED, R 승계 ↔ VP-01b REGRESSION, VP-03·04 REQUIRED 유지 |
| §10 자리 목록 | 유효 | EP-05b 검색 재실행 6행 = 5자리 + 제외 1행(`installations.push`, `.files`만 scan에 전달) — 차집합 0 |
| SUPERSEDED 이관 | 유효 | AC5 색상 단언 → 0278 AC1 행렬, 파일 열기·원문 식별자·slug 증거 유지 명시 |
| 선택 적대 증거 | 유효 | 없음 — 직접 handler/schema/설정/마크업 출력 |
| 운영 gate | 유효 | Vitest·lint·typecheck·build·상태 사본 3자리 |

- root PLAN_GAP: 없음(설계자 반려 사유 없음).

### 0-1. 최신 handoff 이관 — PLAN_GAP (사용자 결정 2026-10-22)

| 항목 | 뒤집은 요소 | 이관 대상 | 이 handoff 처리 |
|---|---|---|---|
| EP-05b의 `CustomizeList` 표시 자리(AC5의 enabled=false 색상 단언, S9) | 0278 D11·D24 — on/off×capability 행렬이 색상 기준을 대체 | **0278 verify r2**(F12a–c) | 미판정 — 0278 책임 |

- 0279·0280·0281은 이 색상 기준을 다시 뒤집지 않는다. 파일 열기·원문 식별자·작성 slug 계약은 이 handoff에 남는다.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 | production path (HEAD) |
|---|---|---|
| D-002 | 카탈로그 이름은 정확한 조회 키 | `SkillTargetSchema.name: z.string().min(1)` → `findSkill(sourceId, name)` |
| D-003 | 파일 열기가 활성·쓰기 권한을 바꾸지 않음 | `openFile`/`showInFolder`는 등록 `skillPath`만 shell에 전달, `!skill.canToggle`·`!skill.canRemove` guard |
| D-004 | Orca 작성 이름 제약 보존 | `AuthorSkillSchema.name: AuthoredSkillNameSchema` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 요청 경로로 임의 파일 열기 | ✅ | handler가 `sourceId+name`으로 등록 항목을 찾아 그 `skillPath`만 shell에 전달(`skills.ts:32·73·77`) |
| 조회 완화가 쓰기로 번짐 | ✅ | native는 `!skill.canToggle`·`!skill.canRemove` guard(`:58·82`) |
| 작성 이름 제약 완화 | ✅ | `AuthorSkillSchema.name`은 `AuthoredSkillNameSchema`(`protocol.ts:377`), 조회 target만 원문 문자열(`:390`) |
| 비활성 plugin 파일 누락 | ✅ | `includeDisabled` 필터(`plugin-catalog.ts:156`)·enabled 운반(`:191`)·scan 보존(`scan.ts:75`) |

## 3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| 형제 진입점 비대칭 | 없음 | open·showInFolder·setEnabled·remove 4채널이 모두 `findSkill` 경유(S1·S3 잡음 시 4채널 테스트가 함께 red) |
| test-only symbol | 없음 | `findSkill`은 handler 내부, `readSkillCatalog`는 app catalog에서 호출 |

## 4. 고장 내 보기

- 등록 변이 0. §10 16자리 재량 고장. 실행: main `src/main src/shared src/preload`(기준선 15 red = Windows 전용), renderer `features/skills`.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 귀속 |
|---|---|---|---|---|---|---|
| S1 | `shared/protocol.ts:390` | 다른 값 | target name을 작성 slug 스키마로 | 잡음 | `skills.test: orca:skills:open opens the exact disabled native skill…` 외 19건 | EP-01 target · AC1 |
| S2 | `shared/protocol.ts:377` | 다른 값 | 작성 name을 원문 문자열로 완화 | 잡음 | `protocol.skills.test: rejects unsafe or unsupported authored directory names…` 13건 | EP-01 author · AC3 |
| S3 | `app/handlers/skills.ts:32` | 제거 | lookup의 `sourceId` 비교 삭제 | 잡음 | `skills.test: …rejects unknown source/name combinations before side effects` 6건 | EP-02 · AC2 |
| S4 | 같은 파일 `:73` | 맞바꿈 | open → showItemInFolder | 잡음 | `skills.test: orca:skills:open opens the exact disabled native skill…` | EP-03 · AC1 |
| S5 | 같은 파일 `:58` | 제거 | native toggle guard 삭제 | 잡음 | `skills.test: keeps native toggles read-only after accepting namespaced targets` | EP-04 · AC4 |
| S6 | 같은 파일 `:82` | 제거 | native remove guard 삭제 | 잡음 | `skills.test: keeps native removal forbidden after accepting namespaced targets` | EP-04 · AC4 |
| S7 | `extensions/common/skills/scan.ts:75` | 고정값 | native `entry.enabled` → `true` | 잡음 | `skill-catalog.test: assembles the real catalog from lock, harness and native plugin files…` | EP-05b scan · AC5 |
| S8 | `adapters/claude/plugin-catalog.ts:191` | 고정값 | filesByName enabled → `true` | 잡음 | 같음 외 12건 | EP-05b filesByName |
| S9 | `skills/components/customize/CustomizeList.tsx:111` | 고정값 | `enabled={true}` | 관측: 잡음 → **0278 이관(미판정)** | `CustomizeList.render.test: uses capability for font and fixed switches independently of enabled state` | EP-05b 표시 → 0278 D11·D24(F12a–c) |
| S10 | `adapters/claude/plugin-catalog.ts:156` | 뒤집기 | `includeDisabled`여도 비활성 제외 | 잡음 | `adapter.native-plugins.test: loads enabled native skills for session…`·`isolates global SDK choices…` 외 | EP-05b includeDisabled · AC5 |

- 검산: 시도 10 = 잡음 9 · 0278 이관 1(S9) · 못 잡음 0 · 동치 0.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 증거 |
|---|---|---|---|---|
| VP-04 | UT | REQUIRED | PASS | S1·S2 잡음 |
| VP-03 | IT | REQUIRED | PASS | S3–S6 잡음 |
| VP-02b | ST | REQUIRED | PASS | S7·S8·S10 잡음. 표시 색 자리(S9)는 0278 이관 |
| VP-01b | AT | REGRESSION | PASS | S1–S10 잡음 |

### AT / AC

| AC | 결과 | 근거 |
|---|---|---|
| AC1 namespace·원문 이름의 등록 경로 열기 | ✅ | S1·S4 잡음 |
| AC2 없는 조합 거부·임의 path 무시 | ✅ | S3 잡음 |
| AC3 작성 slug 제약 유지 | ✅ | S2 잡음 |
| AC4 native 쓰기 권한 유지(항목별 capability) | ✅ | S5·S6 잡음 |
| AC5 비활성 plugin 열기 유지(색상은 0278) | ✅ | S7·S8·S10 잡음 |

- 합계 재측정: `✅ 5 · ❌ 0 = 5`. 자기보고 `Criteria-Met: 5/5`(`a5489f0`) 일치.

### §10 강제 지점 분모

| EP | 결과 |
|---|---|
| EP-01 (2) | 2/2 (S1·S2) |
| EP-02 (5) | 5/5 (S3 — predicate 1곳이 4채널 lookup에 공통, 4채널 테스트 각각 red) |
| EP-03 (2) | 2/2 (S4, showInFolder는 S1·S3의 `showInFolder` 케이스 red) |
| EP-04 (2) | 2/2 (S5·S6) |
| EP-05b (5) | 4/4 판정 (S7·S8·S10, `files` 전달은 S8과 같은 catalog 테스트) + 표시 자리 1 0278 이관 |

- 판정 15/15 + 0278 이관 1. 검색 재실행 6행 = 5자리 + 제외 1행(`installations.push`) — 차집합 0.

### 운영 gate (HEAD `32b43cc`)

[0281 verify](../0281-opencode-menu-cache/verify.md#운영-gate-head-32b43cc)와 동일 실행: typecheck 0 · lint 0 error · renderer 374/3060 · main 15 red 전부 Windows 전용 fixture · Windows CI #853 green.

## 11. Repository operation checks

- INDEX: `impl/IMPL_DONE` → PASS 행 archive 이동.
- 대상 커밋: `57983c2`·`30566e0`·`a5489f0` `git cat-file -t` = commit, `a5489f0` trailer 5키 파싱.
- `[구현자 기입]` 7필드와 16자리 표 존재.

## 13. Finding disposition

- 없음.

## 14. Review Signals

- 첫 verify, 반복 증상 없음. 사용자 결정 변경: D-001 브랜치·D-003 색상 → 0278 D11·D24(최신 handoff 기준).
- 환경 한계: 실제 OS 파일 열기는 shell mock 경계 — 사람 확인 불필요 수준(경로 인자 단언).

## 15. 결론

- 상태: **PASS** — verify 1회째. pair PASS 4/4, PLAN_GAP 없음, AC ✅5/5.
