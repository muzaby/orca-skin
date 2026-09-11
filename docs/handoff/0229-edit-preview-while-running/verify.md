# Verify — 0229-edit-preview-while-running

## 메타

| 항목 | 값 |
|---|---|
| slug | `0229-edit-preview-while-running` |
| 검증자 | Claude Code |
| 일자 | 2026-09-11 |
| 대상 커밋/range | `f7afca5..97773c0` |
| 구현 전 plan 기준 | `f7afca5` |
| V mode / 유효 V | `0228:V1@5259ede + ΔV1` |
| 검증 기준 plan revision | `f7afca5:ΔV1` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 설계·구현·검증이 동일 에이전트다 — §4에 구현 보고가 이름을 대지 않은 적대 축 4건(A~D)을 추가했고 **그중 축 B가 이번 FAIL의 근거**다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md` 를 변경했는가: 예 — **추가 105줄, 삭제 0줄**. 전부 `[구현자 기입]` 이다.
- 기준선이 diff 로 성립하는가: **예** — 설계 `f7afca5`, 구현 `97773c0` 분리.
- Decision Ledger / Product-UX / AC / V node·pair·§10 변경: 없음(삭제 0줄).
- 채점에 사용할 원 기준: `f7afca5` 의 AC1~AC10 · VP-Δ1~Δ8 · VP-R1·R2 · VP-N1 · EP-Δ1~Δ5.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 V `0228:V1@5259ede` 가 실재하고 유효 V 를 재구성할 수 있다 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | R 5 · SD 1 · AR 1 · MD 1 = 8 node, REQUIRED pair 8건 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | 0228 R-03·R-04 를 REGRESSION 2건으로 다시 닫는다 |
| pair별 path·§10 전수·직접 oracle | **PLAN 기준은 유효, 단 VP-Δ4 의 oracle 이 좁다** | EP-Δ1 은 "가드가 통과시킨 **그 경로**만" 인데 VP-Δ4 의 oracle 은 "reader 호출 횟수 0" 뿐이라 *어느 경로를 읽는가* 축을 덮지 않는다 → §13 D1 |
| 필요한 pair의 적대 증거·선택 이유 | 유효 | VP-Δ4·VP-Δ6 둘만 `required` 이고 이유가 적혀 있다 |
| 운영 gate·범위 | 유효 | 4종 열거, ABI 기존 실패를 blocking 으로 올리지 않았다 |

- root PLAN_GAP: **없음** — D1 은 구현자 권한 안(테스트 추가)에서 닫을 수 있어 `PLAN_GAP` 이 아니라 `BLOCKING` 이다. 규범 행(Decision·AC·V node·§10)을 고칠 필요가 없다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| E-001 진행 중에도 같은 화면 | 승인 전 카드가 실제 좌표 | `claude.ts:567` enricher → started 이벤트 → `chatReducer.ts:948` 파트 → `parts.ts:222` view → `DiffBody.tsx:48` |
| E-003 `diff.structuredPatch` | 문맥 4줄이 결과와 일치 | `edit-preview.ts:79` / 케이스 `문맥 폭이 SDK 결과 패치와 같은 4줄이다` |
| E-004 `Edit` 한정 | 다른 도구는 미리보기 없음 | `edit-preview.ts:60` 이름 가드 |
| E-005 가드 안에서만 읽는다 | 승인 전 workspace 밖 read 0 | `edit-preview.ts:68` `guardToolAccess` → `:70` read |
| E-006 1 MiB 상한 | 큰 파일은 읽지 않음 | `edit-preview.ts:94` `statSync` → `:95` `readFileSync` |
| E-008 비영속 | DB 에 남지 않음 | `tool-call-payload.ts` 키 2개 |
| E-009 결과 우선 | 완료 시 교체 | `DiffBody.tsx:47-48` `??` 순서 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | 5개 폴백이 전부 변경 전 카드로 수렴한다 |
| false success 가능성 | **1건** | 경로 해석 축 — §4 축 B 참조 |
| partial failure/rollback | 해당 없음 | 미리보기는 아무 곳에도 쓰지 않는다 |
| Product/UX 의 A 가 아닌 B | 아니오 | 사용자가 지적한 `수정 중` 상태를 직접 단언한다 |
| 최적화가 잃은 관측 | 없음 | 캐시를 두지 않아 연속 편집이 매번 현재 파일을 읽는다 |
| 출력/요청 worst-case 상한 | 계산됨 | 1 MiB 상한이 미리보기 크기의 상한이기도 하다 |
| 동기 읽기의 스트림 영향 | 허용 | 같은 루프가 이미 편집마다 동기 DB 쓰기를 한다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh f7afca5..97773c0
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `EditPreviewReader` (타입, 프로덕션 0) | 정상 | 같은 파일의 인자·반환 타입이다 |
| `EDIT_PREVIEW_MAX_BYTES` (테스트 2 · 프로덕션 0) | 정상 | 같은 파일에서 `nodeEditPreviewReader` 의 기본 인자로 소비된다. 다만 값 자체를 단언하는 케이스는 동어반복이다 → D2 |
| 형제 정책 비대칭 | 없음 | 스캔 `(없음)` |
| `editPreview` 를 나르는 프로덕션 지점 | 4곳 전수 잠김 | §4 축 C |
| producer ↔ consumer 파생 불일치 | 없음 | 미리보기와 결과가 같은 리더(`readFileEditStructuredPatch`)·같은 줄 생성기를 지난다 |
| 동일 규칙 중복 구현 | **개선됨** | `ToolCall` view 생성자 3 → 1 통합(구현 보고 잠재 문제 2) |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트: 0228 `DiffBody.render` 8케이스·`claude-map.fileEdit` 4케이스·`diffSyntax.render` 2케이스 실재하고 통과.
- structural proxy 만으로 통과시킨 AC: 없음 — AC1·AC2 는 렌더된 표의 거터 숫자를 본다.
- **선택된 적대 증거 재측정**: 등록 변이 2(N1·N2) + 새 oracle 민감도 1(N6 배선 가드) + 형제 축 3(N3·N4·N5) = 6건 **전건 red 재현**.
- **이전 라운드 대조**: r1 이라 대상 없음.
- **자기검증 분모**: 구현자 = 검증자 → 보고에 없던 축 **4건**(A~D) 추가. 그중 **축 B 가 green** 이라 이번 FAIL 의 근거다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| N1 가드 항상 통과 | `edit-preview` 스위트 | 미실행 | **red** 1케이스 | `VP-Δ4 등록 변이` |
| N2 writer 가 `editPreview` 를 적음 | `tool-call-payload` | 미실행 | **red** 1케이스 | `VP-Δ6 등록 변이` |
| N3 상한 확인을 읽기 뒤로 | `edit-preview` | 미실행 | **red** 1케이스 | EP-Δ2 순서 |
| N4 결과/미리보기 우선순위 스왑 | `DiffBody.render` | 미실행 | **red** 1케이스 | EP-Δ4 형제 슬롯 |
| N5 `messageSegments` 사본 복원 | `parts.editPreview` | 미실행 | **red** 1케이스 | EP-Δ4 형제 지점 |
| N6 `claude.ts` 배선 제거(잔여물 0까지) | 배선 가드 | 미실행 | **red** 2케이스 | 배선 존재 oracle |
| **축 A**(검증자) 리듀서 분기에서 필드 제거 | `parts.editPreview` | — | **red** 1케이스 | EP-Δ4 세 번째 지점 |
| **축 B**(검증자) `read(edit.filePath)` — 가드가 푼 경로 대신 원문 | `edit-preview` 12케이스 | — | **green — 잠금 없음** | **EP-Δ1 · VP-Δ4** → §13 D1 |

- 동작 보존 추출 라운드인가: 부분적(`toolCallPartPayload` 추출·생성자 통합). 그 hunk 되돌림을 판정 근거로 쓰지 않았고 대신 N2·N5 로 잠금을 봤다.
- 소거 변이의 잔여물 수렴: N6 는 미사용 import·지역변수까지 치워 **typecheck `error TS` 0건** 상태로 밀었고, 그 상태에서 배선 가드만 red 였다.
- 형제 슬롯 맞바꿈 변이: N4 1쌍(결과↔미리보기) 검출 1.
- **축 C**(검증자, 분모 독립 재열거) — 해법 이름(`buildEditPreview`)이 아니라 불변식 주어(`editPreview 를 나르는 지점`)로 재검색: `rg "editPreview" src --glob '!*.test.*'` → 프로덕션 4지점(`claude.ts:574` 실음 · `chatReducer.ts:948` 파트 · `parts.ts:222` view · `DiffBody.tsx:48` 소비) + 타입 선언 2. **4지점 전부** N6·축 A·N5·N4 로 red 확인.
- **축 D**(검증자, 라벨 진위) — 구현자는 EP-Δ2 분모를 `readFileSync` 검색으로 셌다. 독립 재검색 `rg "readFileSync|readFile\(" src/main/adapters --glob '!*.test.*'` → 2파일. `claude-settings.ts` 는 `~/.claude/settings.json` 로 미리보기와 무관하고, 미리보기 읽기는 `edit-preview.ts:95` 1곳이며 바로 앞 `:94` 가 `statSync` 가드다 — 라벨은 참이다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-Δ8 | MD-Δ1 ↔ UT-Δ1 / UT | REQUIRED | **PASS** | hunk 좌표·문맥 4줄 직접 단언 | 순수 빌더 / EP-Δ3 1/1 |
| VP-Δ3 | R-05 ↔ AT-Δ4·Δ5·Δ10 / UT | REQUIRED | **PASS** | 0회·2회·`replace_all`·비-Edit 반환값 | 같은 경로 / EP-Δ3 |
| VP-Δ4 | R-06 ↔ AT-Δ6·Δ7·Δ8 / IT | **PAIR_FAIL** | `read` 호출 0회·상한·실패는 잠겼으나 **경로 해석 축이 비었다**(축 B green) | `guardToolAccess` → reader / EP-Δ1 **0/1** · EP-Δ2 1/1 |
| VP-Δ6 | R-07 ↔ AT-Δ9 / IT | REQUIRED | **PASS** | 영속 payload 키 `['toolName','args']` · N2 red | writer 경로 / EP-Δ5 1/1 |
| VP-Δ7 | AR-Δ1 ↔ IT-Δ1 / IT | REQUIRED | **PASS** | 이벤트 → 파트 → 두 view 생성자 도달 · 축 A·N5 red | 어댑터→리듀서→view / EP-Δ4 |
| VP-Δ5 | SD-Δ1 ↔ ST-Δ1 / ST | REQUIRED | **PASS** | 결과 좌표 `90·91·91` 이 미리보기를 대체 · N4 red | started→completed / EP-Δ4 |
| VP-Δ1 | R-03′ ↔ AT-Δ1·Δ2 / AT | REQUIRED | **PASS** | 미리보기만 있는 카드의 거터 `45·46·46` | 전체 경로 / EP-Δ4 2/2 |
| VP-Δ2 | R-04′ ↔ AT-Δ3 / AT | REQUIRED | **PASS** | 진행 중 카드의 `color:#112233` | 카드→shiki / EP-Δ4 |
| VP-R1 | 0228 R-03 ↔ AT-06·07·10·12·13 | REGRESSION | **PASS** | `DiffBody.render` 8 + `claude-map.fileEdit` 4 케이스 통과 | 0228 완료 경로 |
| VP-R2 | 0228 R-04 ↔ AT-08·09 | REGRESSION | **PASS** | `diffSyntax.render` 2 + DiffBody 토큰 2 케이스 통과 | 0228 문법 강조 |
| VP-N1 | 0228 R-01·R-02 | NOT_REQUIRED | **NOT_REQUIRED** | 변경 파일에 랜딩 축 없음(`rg "lastAgentKind" <변경 파일>` → 0건) | — |

- root `PAIR_FAIL`: **VP-Δ4** — EP-Δ1 의 불변식("가드가 통과시킨 **그 경로**만 읽는다")을 어떤 oracle 도 보지 않는다.
- 종속 `BLOCKED_BY`: 없음 — 나머지 pair 는 경로 해석과 독립으로 판정된다.
- 이번 라운드 실행 범위: 최초 검증 — REQUIRED 8 + REGRESSION 2 + 운영 gate 4종.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AT-Δ1 / AC1 | 진행 중 실제 줄번호·전체 줄 | ✅ | 거터 `45·46·46`, 본문 전체 줄 |
| AT-Δ2 / AC2 | 결과가 미리보기를 대체 | ✅ | `90·91·91` |
| AT-Δ3 / AC3 | 진행 중 문법 색 | ✅ | `color:#112233` |
| AT-Δ4 / AC4 | 일치 1회 규칙 | ✅ | 0회·2회 모두 `null` |
| AT-Δ5 / AC5 | `replace_all` 전량 | ✅ | `spin` 2건 |
| AT-Δ6 / AC6 | workspace 밖 미독 | ⚠️ | `read` 호출 0회는 잠겼으나 **경로 해석 축 미잠금**(축 B) |
| AT-Δ7 / AC7 | 상한 초과 미독 | ✅ | 32바이트 상한 `null` · 64바이트 본문 |
| AT-Δ8 / AC8 | 읽기 실패가 턴을 막지 않음 | ✅ | 부재·디렉토리 모두 `null`, throw 0 |
| AT-Δ9 / AC9 | 비영속 | ✅ | payload 키 `['toolName','args']` |
| AT-Δ10 / AC10 | `Edit` 외 미생성 | ✅ | `Write`·`MultiEdit`·`Read` 모두 `null` |

- **합계 재측정**: `✅ 9 · ⚠️ 1 · ❌ 0 = 총 10` — 분모를 §7 표에서 다시 세어 10. 자기보고 `10/10` 과 **불일치**(AC6).
- **합계 사본 대조**: 본문 9 ↔ 커밋 trailer `Criteria-Met: 10/10` ↔ INDEX 비고 `AC 10/10` — **갈림**. r2 에서 정정한다.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-Δ4 | 가드 안에서만 읽는다 | 미리보기 생성 (1) | 1/1 구현됨 · **oracle 0/1** | **PAIR_FAIL** |
| VP-Δ4 | 1 MiB 상한 | 읽기 (1) | 1/1 (`edit-preview.ts:94→95`) | PASS |
| VP-Δ3·Δ8 | 일치 1회 | 생성 (1) | 1/1 (`:73`) | PASS |
| VP-Δ1·Δ5·Δ7 | 렌더 우선순위 | `DiffBody` (1) | **4/4** — 축 C 재열거로 나르는 지점이 4곳임을 확인하고 전부 red 관측 | PASS(범위 확대) |
| VP-Δ6 | 비영속 | writer (1) | 1/1 | PASS |

- 표에 없는데 같은 불변식이 필요한 지점: **3건**(리듀서 파트·`parts.ts` view·어댑터 실음). 구현자가 둘을 닫았고 검증자가 셋째(리듀서)를 축 A 로 확인했다 — 전부 잠겨 있어 `NON_BLOCKING` 이고, §10 EP-Δ4 의 지점 수를 4로 정정하는 것은 설계자 몫이다(D3).

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 / 범위 판정 |
|---|---|---|
| subtree 정적 | **PASS** | typecheck `error TS` 0건(3구성) · lint `0 errors, 1 warning`(변경 무관 기존 항목) |
| subtree 순수 테스트 | **PASS** | 486파일 4523케이스 — 4334 pass · 173 fail · 16 skip. 실패 30파일은 0228 기준선과 **동일 집합**(`diff after2.txt after3.txt` → 0줄) |
| repository 문서 인벤토리 | **PASS** | `generated doc ok` · `prose ok` · `links ok` |
| message-bus trailer | **PASS** | 설계·구현 두 커밋 모두 적은 키를 그대로 반환 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `diff.structuredPatch` | 반환 `hunks` 가 `FileEditPatchHunk[]` 에 `as` 없이 대입된다(typecheck) | 기본 문맥 4줄이 SDK 결과와 같다(케이스로 고정) | PASS |
| `docs/IPC_CONTRACT.md` `tool.call.started` | `editPreview?` 행 추가 — `ipc.ts` 와 일치 | 라이브 전용·비영속 서술이 `toolCallPartPayload` 와 일치 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 소비처 재측정: `editPreview` 프로덕션 4지점 · 미리보기 read 1지점 · `toolCallPartPayload` 호출 1지점.
- 내역 합 = 총계: 구현자 보고 `6/5` = §10 5지점 + 형제 1. 검증자 재열거로는 EP-Δ4 가 4지점이라 실질 분모는 8이고 8/8 이 잠겨 있다 — 분모 표기 차이는 D3.
- 0건 게이트의 정당한 예외 보존: `not.toContain('structuredPatch')` 를 **키 집합 동등**으로 이미 함께 단언한다.
- 출력 상한 재계산: 미리보기 크기 ≤ 읽은 파일 크기 ≤ 1 MiB. 영속 0.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 승인 대기 화면의 실제 표시 | 미리보기 생성·전달·렌더를 전수 단언 | **실기 1건** | 승인 필요한 모드에서 `Edit` 유발 → 카드 펼침 |
| `claude.ts` 배선 | 소스 스캔 가드 + 감도 케이스 | 없음 | — |

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**: typecheck `error TS` 0건 · lint `✖ 1 problem (0 errors, 1 warning)` · vitest 486파일/4523케이스 · 문서 게이트 3줄 ok.
- `npm test` 사용 여부: 쓰지 않았다 — DB 동작 검증이 필요 없다.
- 환경 기인 실패 분리 근거: 실패 파일 집합이 0228 기준선과 차집합 0이고 오류 원문 3종 전부 better-sqlite3/electron ABI 서명이다.
- 게이트가 작업 트리를 바꿨는가: 없음 — lint 후 `git status --short` 0줄.
- 검증 중 잔여물: 없음 — 여덟 변이 전부 백업본 원복 후 `git status` 0줄 확인.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 증거 | — | 완료 |
| AC ↔ production path | 10행 1:1 대조 | — | 완료(AC6 미충족) |
| 승인 전 read 경계 | 코드 대조 + 변이 | — | 코드는 옳고 증거가 없다 |
| UI 시각 | 로직 기계 검증 | **실기 1건** | §8 |
| PR merge | 상태 확인 | **승인** | 대기 |

## 11. Repository operation checks

### AGENTS.md 위생

해당 없음 — 변경 0건.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: r1 판정에 따라 `verify/FAIL` · 다음 주체 **구현자** 로 갱신한다.
- 「다음 주체」 칸이 주체 하나만 담는가: 예.
- 대상 커밋 좌표 기입: `f7afca5`(설계) · `97773c0`(r1) — `git cat-file -t` 둘 다 `commit`.
- 비고 5줄 이내: 예.
- PASS archive 이동: 해당 없음.

### Commit / reference 정합성

- trailer 허용값·파싱: 두 커밋 모두 `%(trailers:only=true)` 가 적은 키를 그대로 반환.
- `Criteria-Met: 10/10` ↔ 재측정 9 — **갈림**(§5 합계 사본 대조). r2 trailer 에서 바로잡는다.
- `[구현자 기입]` 7필드 전수: 7/7, 산문으로 접힌 필드 0.
- 이동한 reference: `writer.ts` 의 인라인 payload → `tool-call-payload.ts`. 구 형태 참조 0건.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 잠재 문제 1(배선 가드 추가) | 타당 — N6 로 재현 확인. 소스 스캔이라는 한계도 보고에 적혀 있다 | 유지 |
| 잠재 문제 2(생성자 3→1 통합) | 타당 — N5 로 재현. 축 C 재열거로 통합 후 1곳임을 독립 확인 | 유지 |
| 잠재 문제 3(`toolCallEquals` 비교 축) | 타당 — 미리보기는 파트 생성 시 1회 실리고 불변이다 | 유지 |
| 잠재 문제 5(승인 카드에 diff 없음) | 타당 — §6 비범위 | D4 `NEXT_HANDOFF` |
| `Criteria-Met: 10/10` | **불일치** — AC6 은 경로 축이 비어 ⚠️ 다 | r2 에서 정정 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | `read()` 에 넘기는 경로를 `read(edit.filePath)` 로 바꿔도 12케이스 전건 통과 — EP-Δ1 의 "가드가 통과시킨 **그 경로**만" 축에 oracle 이 없다. 상대 경로 `file_path` 면 main 프로세스 cwd 기준으로 풀려 가드 밖을 읽는다 | `VP-Δ4` · `§10 EP-Δ1` · AC6 | **BLOCKING** | root VP-Δ4 | 구현자 — 가드와 read 가 **같은 해석 경로**를 쓰는지 단언하는 케이스 추가 |
| D2 | `EDIT_PREVIEW_MAX_BYTES` 값 자체를 단언하는 케이스는 동어반복이다 | 비귀속 | NON_BLOCKING | — | 기록 |
| D3 | §10 `EP-Δ4` 의 지점 수가 1로 적혀 있으나 실제 불변식은 4지점에서 성립해야 한다(어댑터·리듀서·view·소비) | `§10 EP-Δ4` | NON_BLOCKING | — | 4지점 전부 잠겨 있어 막지 않는다. 설계자가 지점 수를 정정 |
| D4 | 승인 카드(`ToolApprovalBody`) 본문에는 여전히 diff 가 없다 | 비귀속(§6 비범위) | NEXT_HANDOFF | — | 새 handoff 후보 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **예** — 0228 verify 의 Review Signal("전수 표가 프로덕션 소비처만 세고 사본을 세지 않는다")과 같은 축이 D3 로 재현됐다.
- 관련 plan 지침/AC 의 존재 여부: D1 은 §10 EP-Δ1 이 이미 "그 경로" 라고 적었으나 §7-A 의 oracle 이 그 축을 옮기지 않았다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: better-sqlite3 ABI(30파일) · `claude.ts` 직접 테스트 불가.

## 15. 결론 (r1)

- 상태: **FAIL**
- pair 결과: REQUIRED PASS 7 · REGRESSION PASS 2 · root PAIR_FAIL 1(VP-Δ4) · BLOCKED_BY 0 · NOT_REQUIRED 1
- PLAN_GAP: 없음 — D1 은 규범 행 변경 없이 구현자가 닫는다
- AC 충족: **9/10**(AC6 ⚠️) — 자기보고 `10/10` 과 갈림
- 현재 변경 운영 gate: 4종 전건 PASS
- NON_BLOCKING / NEXT_HANDOFF: D2·D3 / D4
- 다음 단계: 보드는 `verify/FAIL` · 다음 주체 **구현자**. r2 에서 D1 을 닫고 `Criteria-Met` 를 재산정한다

---

# r2 재검증

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `97773c0..665dfab` |
| 라운드 | 2 |
| 상태 | **PASS** |
| 자기 검증 여부 | 동일 에이전트 — r2 구현 보고가 이름을 대지 않은 적대 축 1건(축 E)을 추가했다 |

## 0. 기준선 (r2)

- r2 커밋이 `plan.md` 에서 지운 줄: **0** — `[구현자 기입] … (r2)` 섹션 추가와 `[검증자 기입]` D1·D2 상태 갱신뿐이다.
- 규범 행(Decision·AC·V node/pair·§10) 변경: 없음. 채점 기준은 r1 과 같은 `f7afca5:ΔV1` 이다.
- 프로덕션 코드 변경: **0** — `git show --stat 665dfab` 의 코드 파일은 `edit-preview.test.ts` 하나다.

## 5. 실행 범위와 pair 결과 (r2)

재검증 범위는 root 실패 pair·그 종속·이번 변경 영향 pair·적용 gate 다. 영향받지 않은 r1 `PASS` 는 위 r1 표의 증거 좌표를 참조한다.

| Pair | 결과 | 직접 검증 증거 |
|---|---|---|
| VP-Δ4 (root, r1 `PAIR_FAIL`) | **PASS** | `read` 인자 = `<WS>/nested/hello_world.ts` 단언. D1 인용 변이 재실행 = **red 1케이스**(r1 에서는 green) |
| VP-Δ1·Δ2·Δ3·Δ5·Δ6·Δ7·Δ8 | **PASS**(r1 증거 유지) | 프로덕션 무변경이고 r1 의 red 변이 6건을 전부 재실행해 여전히 red |
| VP-R1·VP-R2 | **PASS** | 0228 스위트 전건 통과 |
| VP-N1 | **NOT_REQUIRED** | 랜딩 축 파일 무변경 |

### AT / AC (r2 갱신분)

| AT / AC | 결과 | 검증 증거 |
|---|---|---|
| AT-Δ6 / AC6 | ✅ (r1 ⚠️ → r2 ✅) | 경로 인자 단언 + main cwd 기준 경로가 아님을 함께 단언 |
| AT-Δ7 / AC7 | ✅ | 기본 reader 경계값 2점(상한 = 본문 길이, 상한+1 = `null`) |
| 나머지 8건 | ✅ | r1 관측 유지(프로덕션 무변경) |

- **합계 재측정**: `✅ 10 · ⚠️ 0 · ❌ 0 = 총 10` — 분모를 §7 표에서 다시 세어 10.
- **합계 사본 대조**: 본문 10 ↔ r2 trailer `Criteria-Met: 10/10` ↔ INDEX 비고 `AC 10/10` — **일치**. r1 의 갈림(9 vs 10)은 r2 에서 해소됐다.

## 4. 적대 증거 재측정 (r2)

이전 라운드가 red 로 관측한 변이 **전건**을 다시 실행했다. `red → green` 은 **0건**이다.

| 변이 | r1 | r2 |
|---|---|---|
| D1 인용 변이 — `read(edit.filePath)` | **green(잠금 없음)** | **red** 1케이스 |
| N1 가드 항상 통과 | red | red 1케이스 |
| N2 writer 가 미리보기를 적음 | red | red 1케이스 |
| N3 상한 확인 제거 | red | red **2케이스**(r2 의 경계값 케이스가 하나 더 잡는다) |
| N4 결과/미리보기 우선순위 스왑 | red | red 1케이스 |
| N5 `messageSegments` 사본 복원 | red | red 1케이스 |
| N6 `claude.ts` 배선 제거(잔여물 0까지) | red | red 2케이스 — typecheck `error TS` 0건 상태에서도 가드만 잡는다 |
| 축 A 리듀서 분기 제거 | red | red 1케이스 |

- **덮개 회귀**: 0건. 교체된 장치(`기본 상한은 1 MiB 다` → 경계값 케이스)는 구 장치가 잡던 자리를 잃지 않았다 — 구 케이스는 상수 값만 봐 어떤 프로덕션 변이에도 반응하지 않았고, 새 케이스는 N3 에서 함께 red 다(1 → 2케이스).
- **자기검증 분모**: 구현자 = 검증자 → r2 보고가 이름을 대지 않은 축 **1건** 추가.
  - **축 E** — `path.resolve` 를 `path.join` 으로 바꿔 **정규화 축**만 깬다(루트는 그대로). `path.join('/ws', '/ws/./a/../x.ts')` 는 `/ws/ws/x.ts` 라 가드가 판정한 경로와 다르다. 결과 **red 1케이스**(`절대 경로도 정규화해 같은 문자열로 넘긴다`) — r2 가 추가한 두 케이스가 루트 축과 정규화 축을 각각 잡는다.

## 9. 게이트 재실행 (r2)

- 실행 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run`.
- **관측한 실행 산출**: typecheck `error TS` **0건**(3구성) · lint `✖ 1 problem (0 errors, 1 warning)` · vitest **486파일 4525케이스 — 4336 pass · 173 fail · 16 skip**. 실패 30파일은 0228 기준선과 동일 집합.
- 게이트가 작업 트리를 바꿨는가: 없음 — 아홉 변이 원복 후 `git status --short` 0줄.
- 검증 중 잔여물: 없음.

## 11. Repository operation checks (r2)

- INDEX: `verify/PASS` · 다음 주체 **사람**(실기 1건) 으로 갱신. 대상 커밋 `f7afca5`·`97773c0`·`665dfab` — `git cat-file -t` 전건 `commit`.
- trailer: r2 커밋이 `%(trailers:only=true)` 로 6키를 그대로 반환. `Criteria-Met: 10/10` 이 본문 재측정과 일치.
- `[구현자 기입]` 7필드: r2 절도 7/7, 산문으로 접힌 필드 0.
- PASS archive 이동: **하지 않는다** — 사람 실기 1건이 남아 보드에 둔다.

## 13. Finding disposition (r2)

| # | finding | 분류 | 상태 |
|---|---|---|---|
| D1 | 경로 해석 축 oracle 부재 | BLOCKING | **closed** — 인용 변이가 red |
| D2 | 상수 값 동어반복 단언 | NON_BLOCKING | **closed** — 경계값 케이스로 교체 |
| D3 | §10 `EP-Δ4` 지점 수 1 → 4 | NON_BLOCKING | open — 설계자 몫. 4지점 전부 잠겨 있어 막지 않는다 |
| D4 | 승인 카드 본문에 diff 없음 | NEXT_HANDOFF | open — 새 handoff 후보 |
| D5 | "부르지 않았다" 단언이 "무엇으로 불렀나" 를 말하지 않는 형태가 다른 주입 포트에도 있을 수 있다(r2 구현 보고 1) | NEXT_HANDOFF | open — 전수 조사 별도 작업 |

## 15. 결론 (r2)

- 상태: **PASS**
- pair 결과: REQUIRED PASS 8 · REGRESSION PASS 2 · root PAIR_FAIL 0 · BLOCKED_BY 0 · NOT_REQUIRED 1
- PLAN_GAP: 없음
- AC 충족: **10/10** — 본문·trailer·INDEX 세 사본 일치
- 현재 변경 운영 gate: 4종 전건 PASS
- NON_BLOCKING / NEXT_HANDOFF: D3 / D4·D5
- 남은 사람 확인: 승인 대기 화면 실기 1건 · PR merge
- 다음 단계: 보드는 `verify/PASS` · 다음 주체 **사람**
