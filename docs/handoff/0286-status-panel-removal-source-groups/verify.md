# Verify — 0286-status-panel-removal-source-groups

## 메타

| 항목 | 값 |
|---|---|
| slug | `0286-status-panel-removal-source-groups` |
| 검증자 | Claude Code |
| 일자 | 2026-10-29 |
| 대상 커밋/range | `0e73fb6..528a158` (r1 `9a8ccaa`, r1.2 `1984c9b`, 기록 `528a158`). 판정은 HEAD `81153e2` 위에서 수행 |
| 구현 전 plan 기준 | V1 `0e73fb6` |
| V mode / 유효 V | Baseline V1 |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — AC16 white/dark 실제 창 시각 인수 대기 |
| 자기 검증 여부 | 설계 Claude·구현 codex·검증 Claude. 구현자 ≠ 검증자 |

## 0. 기준선 / 후행 정본

- 구현 커밋의 `plan.md` 변경은 메타 상태와 `[구현자 기입]` 자리표시자뿐이다.
- 후행 0289 D25는 OpenCode MCP 토글 자리(`features/skills` 토글)를 "건드리지 않음"으로 고정했다 — 0286이 지운 것은 chat의 상태 패널·제어이며 skills 페이지 토글은 남는다(`preload/index.ts:302` `setNativeResource` 유지, 소비자는 skills). 충돌 없음.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| NEW ↔ REQUIRED / §10 / 적대 증거 | 유효 | 선택 증거 19(M01~M19) + 새 oracle 감도 14(S·C 계열) 등록 |

## 1. 비판적 검토 / 역방향

| 질문 | 판정 | 근거 |
|---|---|---|
| 제거한 제어의 잔여 호출 | 없음 | `scripts/check-chat-resource-surface.test.mjs` 2/2 pass |
| 그 스윕이 전수인가(엄격화) | 부분 — NON_BLOCKING | 동적 키 `api['set' + 'NativeResource']` 주입은 스윕 통과. 어휘 proxy의 한계이며 API 자체는 skills가 쓰므로 제거 불가 |
| 그룹 키 혼동 | 없음 | M14·M15 red — 제목(label) 기준 병합 유지 |

## 2. 고장 이력 (HEAD에 재적용)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|---|---|
| M01 | `nativeResourceState.ts` | 호출 대체 | `sessionApi.setNativeResource` 참조 복원 | 잡음 1/2 | chat features keep native observations … |
| M02 | `CustomizeList.tsx:171` | 뒤집기 | native MCP 블록을 Orca 앞으로 | 잡음 5/24 | puts the Orcinus orca group first (mcp) 외 |
| M03 | `CustomizeList.tsx:207` | 제거 | provider Orca 제목 | 잡음 4/24 | … (providers) |
| M04 | `catalogOrder.ts:14` | 제거 | Orca 우선 비교식 | 잡음 4/31 | orders skill sources by label … |
| M14 | `attachMenuModel.ts:94` | 맞바꿈 | 그룹 키 label → sourceId | 잡음 3/20 | merges groups that share a title … |
| M15 | `skillGroups.ts:15` | 맞바꿈 | 연속 비교 label → sourceId | 잡음 1/2 | 연속한 같은 출처를 한 섹션으로 … |
| M16 | `SourceHeading.tsx:25` | 다른 값 | 로고 `size-4` | 잡음 3/24 | sizes the Orca mark by height only ×3 |
| M18 | `CustomizeList.tsx:183` | 다른 값 | 아이콘 mcp → link | 잡음 1/24 | uses the MCP icon for Orca MCP rows … |
| S01~S07·S10 | 새 파일·삭제 모듈·hook·state·catalog·en.ts·arch 문서 | 다른 값(토큰 주입) | 제거된 식별자·키·설명 주입 | 잡음 8/8 | 스윕 2케이스 중 해당 1 |
| C01 | `landingFrame.ts:5` | 다른 값 | 720px → 800px | 잡음 1/10 | 0256 AC9·AC10 … 720px 상한 |

- 검산: 시도 17 = 잡음 17 · 못 잡음 0 · 동치 0. 미재실행: M05~M13·M17·M19(제목·접미·로고 형제), S08·S09, C02·C03 — 시도하지 않은 고장은 결함 아님. 재실행한 형제(M02~M04·M14~M18)가 같은 테스트로 red.
- §1의 동적 키 주입은 실수를 흉내 내는 표준 종류가 아닌 의도적 우회라 고장 이력 분모에서 뺐다. 어휘 proxy의 한계로 §5 V1에만 남긴다.

## 3. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| UT (catalogOrder·skillGroups·attachMenuModel) | PASS | M04·M14·M15 red |
| IT (CustomizeList·Composer 메뉴·스윕) | PASS | M01·M02·M03·M16·M18·S계열 red |
| ST/AT | PASS(기계) / AC16 시각 대기 | 원격 CI(0286 기록 run 40261035522) + 이번 HEAD CI success |

- AC 합계 재측정: ✅ 15 · ⚠️ 1(AC16) · ❌ 0 = 16. trailer `15/16` 일치.

## 4. 게이트

[0289 verify §6](../0289-opencode-runtime-retention/verify.md) 같은 HEAD — typecheck·lint·inventory PASS, `node --test scripts/check-chat-resource-surface.test.mjs` 2/2, Windows CI success. trailer 4커밋 파싱 정상.

## 5. 파생 이슈

| # | 이슈 | 분류 |
|---|---|---|
| V1 | 상태 제어 부재 스윕이 동적 키 참조를 보지 못함(§1 엄격화) | NON_BLOCKING |
| V2 | AC16 white/dark 실제 창 시각 | 사람 실기 |
