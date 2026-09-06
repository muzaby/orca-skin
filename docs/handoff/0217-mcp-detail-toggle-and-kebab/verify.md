# Verify — 0217-mcp-detail-toggle-and-kebab

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0217-mcp-detail-toggle-and-kebab` |
| 검증자 | Claude Code |
| 일자 | 2026-09-06 |
| 대상 커밋/range | `ffa7b559..ff7b9038` (구현 `ff7b9038`) |
| 구현 전 plan 기준 | `ffa7b559` (설계 커밋) |
| V mode / 유효 V | `Baseline V` / `V1` |
| 검증 기준 plan revision | `ffa7b559:V1` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude 다.** §4 에 구현 보고가 이름을 대지 않은 적대 축 2건(M-E1 편집 배선 소거 3단계 · §10 분모 독립 재열거)을 넣었다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: 예 — **`[구현자 기입]` 7필드만**이다. `git diff ffa7b559..ff7b9038 -- docs/handoff/0217-*/plan.md` 의 hunk 가 전부 `## [구현자 기입]` 이후다.
- 기준선이 diff 로 성립하는가: **예** — 설계 `ffa7b559`, 구현 `ff7b9038` 이 갈려 있다.
- Decision Ledger 변경: 없음 — D-301~D-308 이 설계 커밋 그대로다.
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — AT-301~AT-307 원문 동일.
- V node/pair·requiredness·§10·oracle 변경: 없음.
- 채점에 사용할 원 기준: `ffa7b559` 의 §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 상속할 V 없음을 `rg 'V mode' docs/handoff/0159-*/plan.md` 0건으로 적었다 |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R-301~307·SD-301·AR-301/302·MD-301 이 VP-301~307 로 닫힌다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | 기존 계약은 i18n 위생뿐 — VP-306 이 `REGRESSION` |
| pair별 path·§10 전수·직접 oracle | 유효 | 7 pair 전부 경로와 EP-30x 전수(3·3·2·4·2·2·0)를 갖는다 |
| 필요한 pair의 선택적 적대 증거 | 유효 | 음성 술어(VP-302)·존재 주장(VP-303)만 변이를 등록하고 나머지는 `not selected` 이유를 적었다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | subtree·repository·message-bus 3종. `@opencode-ai/sdk` 미설치 typecheck 2건을 미리 분리했다 |

- root PLAN_GAP 과 영향 pair: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-301 제거 경로 | 케밥 → 제거 → 확인 → 목록에서 사라짐 | `McpDetail.tsx:100` MenuItem → `:129` Modal → `ExtensionsCatalogView.tsx:137` → `useMcpServers.remove` → `mcpApi.delete` → main |
| D-302 토글 대체 | 활성 상태를 스위치가 갖는다 | `McpDetail.tsx:63` `Toggle` → `onToggle` → `mcp.toggle` |
| D-303 skills 배치 | Toggle → 케밥 순서 | `McpDetail.tsx:62-78` ↔ `SkillDetail.tsx:85-100` 같은 `ml-auto flex items-center gap-2` |
| D-304 편집 부활 | 죽어 있던 모달에 진입점이 생긴다 | `:136` `onEdit` → `mcpEditId` → `AddMcpServerModal(initial)` → `mcp.update` |
| D-306 공용 MenuItem | 세 번째 로컬 사본 없음 | `McpDetail.tsx:3` import · 로컬 메뉴 컴포넌트 정의 0건 |
| D-308 rename 추적 | 저장 후 상세가 새 id 로 따라간다 | `ExtensionsCatalogView.tsx:205` `openDetail(state, values.name)` |

### end-to-end 흐름

```text
플러그인 → MCP → 서버 선택
  → McpDetail(Toggle · 케밥)
  → Popover → MenuItem(편집 | 제거)
  → 편집: AddMcpServerModal → mcp.update → refresh → (rename 시 openDetail(새 id))
  → 제거: 확인 Modal → mcp.remove → refresh → 상세 언마운트 → 목록
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ⚠️ 조용하다 | `remove()` 의 `finally` 가 `removing` 만 푼다 — 실패 문구가 없다(D3). `SkillDetail` 도 같다 |
| false success 가능성 | 없음 | `mcpApi.delete` 가 던지면 `await` 가 던져 `setConfirmOpen(false)` 에 도달하지 않는다 |
| partial failure/rollback | 해당 없음 | 단일 store 1회 쓰기 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | 요구 3건(삭제 경로·토글·케밥)이 §5 흐름 그대로다 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | 제거 후 `selection.selectedId` 는 스테일이지만 어떤 서버와도 매칭되지 않는다(skills 제거와 동형) |
| 최적화가 잃은 재검증 | 해당 없음 | 캐시·조기 반환을 만들지 않았다 |
| 출력/요청 worst-case 상한 | 유한 | 사용자 행동당 mutation 1 + `refresh` 1 |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | 없음 | 새 export 0 — `McpDetail` props 2개 추가가 전부다 |
| 테스트 전용 참조 | 없음 | `mcpDetail.render.test.ts` 가 production `McpDetail` 을 직접 렌더한다(동명 재구현 아님) |
| 형제 정책 비대칭 1 | **의도(D-307)** | `SkillDetail` 은 로컬 `MenuRow`, `McpDetail` 은 공용 `MenuItem` — gap 10→8px · `text-ink`→`text-t8`. D1 |
| 형제 정책 비대칭 2 | 무해 | 케밥 a11y 속성이 `McpDetail` 에만 있다(`SkillDetail` `aria-haspopup` 0건) — 새 쪽이 낫다. D4 |
| 신규 등록값의 기존 소비처 | 무영향 | i18n 키 6 추가·2 삭제. 삭제 키 참조 0건(차집합) |
| producer ↔ consumer 파생 불일치 | 없음 | `McpFormValues.auth` 의 `undefined`=미변경 계약을 `:200` 조건부 전개가 지킨다 |
| 동일 규칙 중복 구현 | SSOT 유지 | 메뉴 항목 시각은 `shared/ui/MenuItem.tsx` 한 곳 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트 실재: **예** — `shared/i18n/resources/resources.test.ts` 의 `it` 3개를 실행해 3 passed 를 봤다. plan §7 은 경로 없이 파일명만 적었고 실제 위치는 `resources/` 아래다(비차단).
- structural proxy 만으로 통과시킨 AC: 없음 — 렌더 출력·소스 전수가 직접 관측이다.
- **선택된 적대 증거 재측정**: 등록 변이 **2건 중 검출 2** · 인용 변이 0 · 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: 해당 없음 — r1 이다.
- **자기검증 분모**: 구현자 = 검증자다. 구현 보고에 없던 축 **2건**을 넣었다 — M-E1(편집 배선 소거, 3단계) · §10 분모 독립 재열거(16지점 직접 재계수).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-1 Toggle → 옛 텍스트 버튼 | `mcpDetail.render.test.ts` | 없음 | **red** (2 failed / 4) | VP-302 등록 변이 |
| M-2 케밥 a11y 속성 2개 삭제 | 같은 스위트 | 없음 | **red** (1 failed / 4) | VP-303 등록 변이 |
| M-E1a 편집 모달 렌더 블록 삭제 | typecheck·lint·skills 스위트 | 없음 | **red** (TS6133 2 · eslint 2) — 잔여물 | 검증자 신설 축 |
| M-E1b + import·`editingMcp`·`onEdit` 제거 | 같은 게이트 | 없음 | **red** (TS2741 — 필수 prop) | 같은 축 2단계 |
| M-E1c + `onEdit={() => {}}` 로 대체 | typecheck·lint·`vitest run src/renderer` | 없음 | **green (151파일 1174케이스)** | 같은 축 3단계 |

- 소거 변이의 잔여물 수렴: **3단계까지 밀었다.** 진단이 0 인 상태에서 전 게이트가 초록이다 — **편집 경로의 배선은 커밋된 테스트가 잠그지 않는다.** `onEdit` 이 필수 prop 이라는 사실은 "무언가를 넘긴다" 까지만 잠근다.
- 그 판정: **NON_BLOCKING**. plan 이 VP-304 의 적대 증거를 `not selected`("전수 검색과 배선이 곧 계약")로 선언했고 AT-304 의 oracle 은 소스 전수다 — 그 전수는 §5·§7 에서 직접 수행했다. 전수가 **커밋된 장치가 아니라 사람의 명령**이라는 사실을 D5 로 남긴다.
- 형제 슬롯 맞바꿈 변이: 해당 없음 — 케밥 항목 두 개가 닫힌 렌더 출력에 나타나지 않아 맞바꿀 슬롯이 없다(EP-301 실기 축과 같은 원인).
- 동작 보존 추출 라운드인가: 아니오.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-302 | R-302 ↔ AT-302·UT-301 / UT | REQUIRED | **PASS** | 두 상태 렌더의 `role="switch"`·`aria-checked` · 옛 버튼 텍스트 0건 · M-1 red | 3/3 |
| VP-303 | R-303 ↔ AT-303 / UT | REQUIRED | **PASS** | `aria-haspopup="menu"`·`aria-expanded="false"`·`aria-label` · M-2 red | 2/2 |
| VP-305 | R-305 ↔ AT-305 / IT | REQUIRED | **PASS** | 헤더 순서 `Toggle`(:63) → 케밥(:71) · 공용 `MenuItem`(:3) · 로컬 사본 신설 0 | 2/2 |
| VP-304 | R-304·AR-301·AR-302 ↔ AT-304·IT-301 / IT | REQUIRED | **PASS** | 프로덕션 소비자 1(`:19`·`:185`; 변경 전 0) · `:191` id · `:200` auth 조건부 · `:205` rename 추적 | 4/4 |
| VP-306 | R-306 ↔ AT-306 / IT | REGRESSION | **PASS** | `resources.test.ts` 3 passed · 죽은 키 참조 0건 | 2/2 |
| VP-301 | R-301·SD-301 ↔ AT-301·ST-301 / ST | REQUIRED | **PASS(부분 — 항목 축 실기)** | 확인 모달 닫힌 시작 · `onRemove` 배선(:137) | **2/3** |
| VP-307 | R-307 ↔ AT-307 / AT | REQUIRED | **사람 실기 대기** | — | 0 |

- root `PAIR_FAIL`: **없음**. 종속 `BLOCKED_BY`: 없음.
- 이번 라운드 실행 범위: 최초 검증 — REQUIRED/REGRESSION 7 pair 전건 + 운영 gate 3종.

### AT / AC 세부와 합계

| AT | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AT-301 | 상세에서 서버를 제거할 수 있다 | ⚠️ | 배선·닫힌 시작은 기계 검증, **danger 톤 항목은 실기** |
| AT-302 | 활성 상태는 토글이 갖는다 | ✅ | 두 상태 렌더 + 음성 술어 + M-1 red |
| AT-303 | 그 밖의 동작은 케밥에 모인다 | ✅ | 세 속성 + M-2 red |
| AT-304 | 편집 경로가 살아난다 | ✅ | 소비자 0→1 전수 · 매핑 3지점 |
| AT-305 | 배치가 skills 상세와 같다 | ✅ | 헤더 순서 + 공용 `MenuItem` |
| AT-306 | 문구가 두 로케일에 갖춰진다 | ✅ | 3 케이스 green + 죽은 키 0 |
| AT-307 | 실행 앱에서 메뉴·제거가 동작한다 | ⏸ | 사람 실기 |

- **합계 재측정**: `✅ 5 · ⚠️ 1 · ⏸ 1 · ❌ 0 = 총 7`. 자기보고 `Criteria-Met: 5/7` — **일치**.
- **합계 사본 대조**: verify 본문 `5/7` ↔ 커밋 trailer `5/7` ↔ INDEX 비고 — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | plan 이 적은 지점 | 검증자가 다시 센 지점 | 결과 |
|---|---|---|---|
| EP-301 | 3 | 2/3 (실기 1 남김) | PASS(부분) |
| EP-302 | 3 | 3/3 | PASS |
| EP-303 | 2 | 2/2 | PASS |
| EP-304 | 4 | 4/4 | PASS |
| EP-305 | 2 | 2/2 | PASS |
| EP-306 | 2 | 2/2 | PASS |

- 독립 재열거 합계: **15/16** — 구현 보고와 일치한다. 라벨이 아니라 지점을 하나씩 다시 셌다.
- 표에 없는데 같은 불변식이 필요한 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 / 범위 판정 |
|---|---|---|
| subtree `app/**` | **PASS** | `npm run lint` 0 error / 1 warning(`useTranscriptVirtualizer.ts:22`, 기존·변경 무관) · `npm run typecheck` node·web 0 error / test 2 error(`@opencode-ai/sdk` 미설치 베이스라인) · `vitest run src/renderer` **151파일 1174케이스 green** |
| repository (docs) | **PASS** | `check-doc-inventory --check` → generated ok(9 items, 82 channels) · prose ok · links ok |
| message bus | **PASS** | `git log -1 --format='%(trailers:only=true)' ff7b9038` 이 6키를 그대로 반환 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `AddMcpServerModal` 프로덕션 소비자: **1**(`ExtensionsCatalogView.tsx`). `shared/ui/Modal.tsx` 의 2건은 주석 언급이라 분모 밖이다.
- 죽은 i18n 키 참조: `mcpDetail.enable`·`mcpDetail.disable` **0줄**(차집합).
- 새 i18n 키 6개의 소비자: 6/6 — 전부 `McpDetail.tsx` 의 `tr()` 인자다.
- 출력 상한: 메뉴 항목 2 · 모달 1, 모두 열림 상태에만 마운트.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 케밥 메뉴 항목 | 트리거 속성·닫힌 상태 | 열린 메뉴에 편집·제거가 보이는가 | 앱 → 플러그인 → MCP → 서버 → 케밥 |
| 제거 결과 | `mcp.remove` 배선 | 확인 후 목록에서 실제로 사라지는가 | 같은 화면에서 제거 → 확인 |
| rename 추적 | `openDetail(state, values.name)` 소스 | 저장 후 상세가 유지되는가 | 편집 → 이름 변경 → 저장 |

- 더 내릴 수 있었는가: **아니오.** `Popover`·`Modal` 이 `createPortal` 로 `document.body` 에 붙고 `vitest.config.ts` 가 `environment: 'node'` 다. jsdom 도입은 별도 결정이라 D2 로 둔다.

## 9. 게이트 재실행

- 실제 실행 명령: `cd app && npm run lint`, `npm run typecheck`, `./node_modules/.bin/vitest run src/renderer`, `node scripts/check-doc-inventory.mjs --check`.
- 관측한 실행 산출: 위 gate 표 — exit code 가 아니라 파일·케이스·error 수다.
- `npm test` 사용: **안 했다** — DB 동작을 보지 않는 변경이라 ABI 를 뒤집지 않았다(`app/AGENTS.md`).
- 게이트가 작업 트리를 바꿨는가: **아니오** — `npm run lint` 는 `--fix` 지만 실행 전후 `git status --short` 파일 목록이 같다.
- 검증 중 실행한 명령의 잔여물: 변이 하네스·백업본은 전부 스크래치패드에 두었고 작업 트리는 클린이다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 — 위 산출 |
| AC ↔ production path | 에이전트 — §1·§5 |
| 레이어/계약/문서 링크 | 에이전트 — doc-inventory ok |
| 제품 의도 | 사람 — 이번엔 새 결정 없음 |
| UI 시각 품질 | **사람 — AT-307** |
| 신규 의존성 / merge | 해당 없음 / 사람 |

## 11. Repository operation checks

- `AGENTS.md` 변경: 없음.
- INDEX 상태/다음 주체/좌표: 이번 검증 커밋에서 `verify/PASS`·다음 주체 사람(AT-307)으로 갱신하고 좌표를 기입한다.
- 대상 커밋 좌표 확인: `git cat-file -t ffa7b559` = commit · `ff7b9038` = commit.
- 비고 5줄 이내: 예.
- trailer 허용값·파싱: `ff7b9038` 이 `Agent/Handoff/Status/Criteria-Met/Criteria-Pending/Verified-By` 6키를 그대로 반환한다.
- `[구현자 기입]` 7필드 전수: **7/7**.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 확인 버튼을 `danger` 톤으로 하지 않았다 — `SkillDetail` 과 같은 형상이라 | **타당** — `SkillDetail.tsx:212` 도 `ModalActions` 를 `danger` 없이 부른다 | 유지 |
| rename 저장 중 편집 모달이 자기 밑에서 언마운트된다 | **타당·무해** — React 18 에서 언마운트 후 setState 는 no-op 이다 | D6 으로 기록 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `SkillDetail` 이 아직 로컬 `MenuRow` 를 쓴다 | D-307 · VP-305 | NEXT_HANDOFF | 공용 `MenuItem` 이설 |
| D2 | 케밥 메뉴 항목이 자동 검증 밖이다 | §17 · EP-301 | NEXT_HANDOFF | jsdom 또는 메뉴 본문 분리 렌더 |
| D3 | 제거 실패에 사용자 문구가 없다 — 버튼만 되살아난다 | 비귀속(§5 error 행은 "모달이 열린 채" 까지만 적었다) | NON_BLOCKING | `SkillDetail` 과 함께 다룬다 |
| D4 | `SkillDetail` 케밥에 a11y 속성이 없다 | 비귀속 | NON_BLOCKING | D1 과 같은 파일에서 함께 |
| D5 | AT-304 의 oracle 이 **사람의 grep** 이다 — 배선을 지우고 `onEdit` 을 no-op 으로 두면 전 게이트가 초록이다 | VP-304(적대 증거 `not selected`) | NON_BLOCKING | 소비자 전수를 커밋된 스윕으로 올릴지 판단 |
| D6 | rename 저장 중 편집 모달이 자기 밑에서 언마운트된다 | 비귀속 | NON_BLOCKING | 관측 증상 없음 — 기록만 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음 — r1 이다.
- 관련 plan 지침/AC 의 존재: D5 의 축은 plan 이 `not selected` 로 **미리 선언**했다 — 놓친 것이 아니라 고른 것이다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: vitest `environment: 'node'` 로 포털을 렌더할 수 없다. 0204·0216 과 같은 자리다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED/REGRESSION **6 PASS**(VP-301 은 §10 2/3, 남은 1은 실기) · VP-307 사람 실기 대기 · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-301~D-308 전건 — §1 에 지점별 좌표
- AC 충족: ✅ 5 · ⚠️ 1(AT-301 항목 축) · ⏸ 1(AT-307) = 7
- 현재 변경 운영 gate: subtree·repository·message-bus 3종 PASS
- NON_BLOCKING / NEXT_HANDOFF: D1~D6 (차단 0)
- 남은 사람 확인: AT-307 — 케밥 항목 2개 · 제거 결과 · rename 후 상세 유지
- 다음 단계: 사람 실기 후 archive 이동. 코드 축에 남은 구현자 작업은 없다.
