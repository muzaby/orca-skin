# Verify — 0245-context-policy-cli-parity

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0245-context-policy-cli-parity` |
| 검증자 | Claude Code |
| 일자 | 2026-10-01 |
| 대상 커밋/range | `2da87fd2..97a59769` (r1 구현 `97a59769`) |
| 구현 전 plan 기준 | `0acd248a`(V1) · `64fbfb35`(AC6 정정) · `2da87fd2`(ΔV1) |
| V mode / 유효 V | `Delta V`: `V1@64fbfb35 + ΔV1@2da87fd2` |
| 검증 기준 plan revision | `64fbfb35:V1` / `2da87fd2:ΔV1` |
| 라운드 | 1 |
| 상태 | **FAIL** — root D1(`#` 든 파일명의 텍스트 첨부가 CLI 멘션으로 해석되지 않음) |
| 자기 검증 여부 | 설계 = Claude, 구현 = Codex, 검증 = Claude. 구현자 ≠ 검증자 — 그래도 보고에 없던 독립 축 8건을 심었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태` 1행과 `## [구현자 기입]` 이하만. `git diff 2da87fd2 97a59769 -- plan.md`에 Decision·AC·V·§10 행 변경 0.
- **기준선이 diff로 성립하는가**: 예. 설계 3커밋(`0acd248a`·`64fbfb35`·`2da87fd2`)과 구현 `97a59769`가 분리돼 있다.
- Decision Ledger·Product/UX·AC·V node/pair 변경: 없음.
- 채점에 사용할 원 기준: `2da87fd2`의 ΔV1 절 — 유효 AC 10행(AC1·2·3·11·15·18·20·21·22·23), pair REQUIRED 9 · REGRESSION 2.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 `V1@64fbfb35` 실재, ΔV1이 대체 행 우선으로 재구성 가능 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | ΔV1 READY 검산 11 node ↔ VP-02·10·12·13·14·15·16·17·18 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | AR-01 ↔ VP-03, MD-01 ↔ VP-01 |
| pair별 path·§10·oracle | 유효 | EP-01·02·06′·08·09·10 모두 자리 명시 |
| 선택적 적대 증거 | 유효 | VP-03(3자리)·VP-12(전환)·VP-17(4경로) 선택, 나머지는 직접 표 |
| SUPERSEDED 이관 | 유효 | V1 VP-08 4경로 변이 → VP-17, 그 밖은 폐기 근거 기재 |
| 운영 gate | 유효 | lint·typecheck·전체 vitest·inventory·trailer |

- root PLAN_GAP: 없음. D1은 plan이 이미 요구한 "멘션 경로 안전 전제 확인"(ΔV1 기술 보완 `조립(MD-07)`)의 범위 안이라 구현자가 새 계약 없이 닫을 수 있다(§13).

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-005~D-007 | 이름이 바뀐 Claude도 계열·버전으로 200k/1M 분류 | `classifyContextModel` ← `modelForCli` 단일 소비 |
| D-008·D-019 | CLI 실제 모델 기준으로 게이트웨이·3P에서만 `[1m]` 부착 | `sendMessage` → `envLookup`+settings `model` → `modelForCli` → `options.model`·`pushTurn`·`LiveTurn.setModel` |
| D-013 | env 불변 | `options.env` 조립 경로 무변경 |
| D-015·D-016 | 도구 결과·첨부 이미지 무처리 | `claude-adapt.ts` diff 0 · 이미지 data 원본 |
| D-017 | 결과 오류 원문 · `stream_error` 유지 | `claude-map.ts` result 분기 |
| D-018 | 텍스트 첨부를 저장 경로 `@"…"`로 넘겨 **CLI가 처리** | `send.ts` → `normalizeAttachments`(저장) → `buildTurnContent` → CLI `@` 확장 — **`#` 파일명에서 끊긴다(D1)** |

```text
composer 첨부(.md) → send.ts normalizeAttachments(storage) → storeAttachmentBytes(<uuid>-<safeName>)
  → ExtractedAttachmentText.path → buildTurnContent: [image…, text(…\n\n@"<path>")]
  → CLI Y0s(@"…") → Q0s(#L 파서) → 파일 읽기 → 모델 입력
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | **결함 1** | 저장 이름에 `#`가 남으면 CLI가 `#` 앞까지만 파일명으로 읽는다 — 첨부 내용이 모델에 안 간다(D1) |
| false success | 있음(D1) | 전송·저장·멘션 줄 모두 정상이라 Orca 쪽 신호가 없다. 모델은 경로 문자열만 받는다 |
| partial failure/rollback | 해당 없음 | 정규화 실패 시 `stored` cleanup 경로 무변경 |
| A가 아닌 B | 아니오 | 4종 분류·실행 문자열·멘션 위임·오류 원문 모두 ΔV1 그대로 |
| 증상만 제거 | 아니오 | 24,000자 자르기 상수·필드 제거(`rg` 0행 재현) |
| 캐시/관측 손실 | 해당 없음 | 정책은 순수 재계산, 상태 저장 없음 |
| worst-case 상한 | 유지 | 텍스트 본문 상한은 CLI(256KB·25,000토큰)로 이전. Orca 프롬프트에는 경로 한 줄뿐 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 2da87fd..97a5976`

| 후보 | 판정 | 근거 |
|---|---|---|
| `ContextEnvLookup` 타입 미사용 export | 정상 | 같은 파일 시그니처용 타입 |
| `classifyContextModel`·`resolveCliModel` 테스트 전용 | 정상(오탐) | 같은 파일 `modelForCli`가 호출(`claude-context-policy.ts:100·101`) |
| `buildTurnContent` 테스트 전용 | 정상(오탐) | `claude.ts:419·428·760` 같은 파일 호출 |
| `ExtractedAttachmentText` 필드 제거의 소비처 | 무영향 | `rg attachmentTexts`: Claude 어댑터만 조립, 큐·프렐류드·연속 턴은 운반만. 디스크 영속 0 |
| 블록 순서 변경(이미지 → 텍스트)의 소비처 | 무영향 | `claude-input-receipts.ts:16` `hookText`는 text 블록만 걸러 결합 — 순서 무관 |
| CLI `@` 파서 계약 | **결함(D1)** | `Y0s` `@"([^"]+)"` 뒤 `Q0s` `/^([^#]+)(?:#L(\d+)(?:-(\d+))?)?(?:#[^#]*)?$/` — 저장 이름 정제(`attachment-files.ts:98`)는 `"`만 막고 `#`은 남긴다 |
| CLI가 읽는 `settingSources: ['project','local']`의 env·`model` | 비귀속(D2) | plan §11 유효 env 규칙에 없음 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 케이스 존재: `claude-map.test.ts` "result 에러는 telemetry 와 error 이벤트를 함께 낸다" 유지 · `build-turn-content`·`attachments` 케이스 갱신.
- AC 표 원문 대조: AC1 plan 17행 전부 + 추가 4행, AC2 plan 8행 전부 + 3P 플래그 5종, AC20 plan 7행 전부 + 5행.
- **선택된 적대 증거 재측정**: 등록 9건 중 검출 9 · 미검출 0. 실패 케이스 수가 구현 보고와 같다.
- **자기검증 분모**: 구현자 ≠ 검증자 — 보고에 없던 독립 축 8건 추가, 8/8 red.
- 이전 라운드 대조: 해당 없음(첫 검증).

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 스폰 `options.model`에 원문 | `claude.context-policy.test.ts` | red 3 | VP-03 등록 |
| M2 `pushTurn` setModel에 원문 | 동일 | red 1 | VP-03 등록 |
| M3 `LiveTurn.setModel`에 원문 | 동일 | red 2 | VP-03 등록 |
| M4 `pushTurn` 해석을 스폰 값으로 고정 | 동일 | red 1 | VP-12 등록 |
| M5 `LiveTurn.setModel` 해석을 스폰 값으로 고정 | 동일 | red 2 | VP-12 등록 |
| M6 첫 입력 `attachmentTexts` → `[]` | 동일 | red 1 | VP-17 등록 |
| M7 프렐류드 `attachmentTexts` → `[]` | 동일 | red 1 | VP-17 등록 |
| M8 steer flush `attachmentTexts` → `[]` | 동일 | red 1 | VP-17 등록 |
| M9 `pushTurn` `attachmentTexts` → `[]` | 동일 | red 1 | VP-17 등록 |
| X1 준비된 env보다 settings env 우선 | policy UT+IT | red 1 | 독립 — VP-15 EP-08 |
| X2 `errors`를 `result`보다 우선 | `claude-map.test.ts` | red 1 | 독립 — VP-10 |
| X3 텍스트 블록을 이미지 앞으로 | build-turn UT+IT | red 9 | 독립 — VP-16·17 블록 순서 |
| X4 저장 경로 미대입(`normalized.path = file.path` 삭제) | `attachments.test.ts` | red 4 | 독립 — VP-18 EP-10 ② |
| X5 3P Sonnet 5 예외 삭제 | policy UT | red 1 | 독립 — VP-02 |
| X6 settings `model` 무시 | policy UT+IT | red 2 | 독립 — VP-15 |
| X7 `CLAUDE_CODE_DISABLE_1M_CONTEXT` 무시 | policy UT | red 1 | 독립 — VP-02 |
| X8 Orca 모델 `[1m]` 접미사 검사 삭제 | policy UT+IT | red 1 | 독립 — VP-02·15 |

- 재현: scratchpad `mut.py` — 앵커 문자열 1회 일치 확인 후 치환 → `vitest run <suite>` → 원본 복원. 종료 후 `git status --porcelain` 빈 출력.
- 동작 보존 추출 라운드: 아니오.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 / UT | REGRESSION | PASS | AC1 21행 | 모델 → 분류 / EP-01 1/1 |
| VP-02 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | AC2 12행 + 플래그 5 · X5·X7·X8 red | 해석 모델+env → 실행 문자열 / EP-01 1/1 |
| VP-15 | MD-06 ↔ UT-06 / UT | REQUIRED | PASS | AC20 12행 · `envLookup` 우선순위 · X1·X6 red | 모델·env·settings → 해석 / EP-08 1/1 |
| VP-16 | MD-07 ↔ UT-07 / UT | REQUIRED | **PAIR_FAIL** | 멘션 줄·순서 단언은 통과(X3 red). 그러나 멘션 경로가 CLI에서 해석된다는 전제가 `#`에서 깨진다 — D1 | 첨부 → content / EP-09 |
| VP-18 | MD-08 ↔ UT-08 / UT | REQUIRED | PASS | 원본 저장·필드 부재·NUL/확장자 거부 · X4 red | 바이트 → 정규화 / EP-10 2/2 |
| VP-03 | AR-01 ↔ IT-01 / IT | REGRESSION | PASS | query mock 세 인자 · M1~M3 red | EP-02 3/3 |
| VP-10 | AR-05 ↔ IT-05 / IT | REQUIRED | PASS | 원문 우선순위 8 + 정상 결과 1 · X2 red | SDK result → error 이벤트 / EP-06′ 1/1 |
| VP-17 | AR-07 ↔ IT-07 / IT | REQUIRED | PASS | 네 query 입력 경로 SDK 메시지 비교 · M6~M9 red | 4경로 → 입력 스트림 / EP-09 4/4 |
| VP-12 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | `sonnet→opus→sonnet`·`internal→opus→200k→fable` · M4·M5 red | 스폰 → 전환 / EP-02 ②③ |
| VP-14 | R-06 ↔ AT-15 / AT | REQUIRED | PASS | inventory·prose·links ok · adapters·가이드 3-e·study 8.6 | 문서 |
| VP-13 | R-02·R-05·R-07 ↔ AT / AT | REQUIRED | 사람 실기 대기 | AC18·AC23 미실행. AC23 "작은 .md 인용"은 `#` 파일명에서 D1로 실패가 예견된다 | 설치본 |

- root `PAIR_FAIL`: VP-16 — D1.
- 종속 `BLOCKED_BY`: 없음. VP-17은 배선만 판정하므로 독립 PASS.
- 실행 범위: 최초 검증 — 유효 V의 REQUIRED 9 · REGRESSION 2 전건.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | 21행 표 |
| AC2 | ✅ | 12행 + 3P 5종 |
| AC3 | ✅ | 세 자리·env/식별자 불변·M1~M5 |
| AC11 | ✅ | 원문 우선순위 · `stream_error` |
| AC15 | ✅ | 문서 3곳 · inventory exit 0 |
| AC18 | ⚠️ | 사람 실기 |
| AC20 | ✅ | 해석 12행 · query 배선 |
| AC21 | ❌ | 조립 형식은 맞으나 `#` 파일명 첨부가 CLI에서 다른 경로로 해석 — D1 |
| AC22 | ✅ | 300,014바이트 원본 저장 · 필드 부재 |
| AC23 | ⚠️ | 사람 실기 |

- **합계 재측정**: ✅7 · ⚠️2 · ❌1 = 10. 자기보고 ✅8 · ⚠️2 — AC21 한 행 불일치(D1).
- **합계 사본 대조**: plan 본문 ✅8 ↔ trailer `Criteria-Met: 8/10` ↔ INDEX 비고 ✅8 — 세 사본은 서로 일치.

### pair별 §10 강제 지점 분모

| Pair | plan 강제 지점 | 코드 확인 | 결과 |
|---|---|---|---|
| VP-01·02 | EP-01 `modelForCli` 1 | `classifyContextModel(` 호출 `:101` 1건 | 1/1 |
| VP-03·12 | EP-02 3 | `claude.ts:586·754·786` | 3/3 (`runCompletion :347` 비범위) |
| VP-10 | EP-06′ 1 | `claude-map.ts:808-828` | 1/1 · `error-classifier.ts` diff 0 |
| VP-15 | EP-08 1 | `claude.ts:384-386` | 1/1 |
| VP-16·17 | EP-09 4 | `:426`(프렐류드)·`:428`(첫 입력)·`:560`(steer)·`:760`(`pushTurn`) | 4/4 |
| VP-18 | EP-10 2 | 자르기 제거(`rg '24_000\|MAX_FILE_CONTEXT_CHARS\|truncateText'` 0행) · `send.ts` storage 전달 | 2/2 |

- 표 밖 지점: 저장 이름 정제 `attachment-files.ts:93-101` — EP-09 멘션의 전제. D1로 기록.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | 0 error · 1 warning(`useVirtualizer` 기존) |
| typecheck | PASS | node·web·test 3단 exit 0 |
| 전체 vitest | PASS(환경 보정) | `ELECTRON_OVERRIDE_DIST_PATH=/nonexistent vitest run --maxWorkers=2`: 602파일 pass · 1 skip(603) · 5790 pass · 3 skip(5793) |
| inventory | PASS | generated·prose·links ok |
| trailer | PASS | `97a59769` 6키 파싱 · 값 허용 범위 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| SDK `SDKResultSuccess.result`·`SDKResultError.errors` | unknown 선언 후 문자열 필터 | AC11 8사례 | PASS |
| CLI `@"…"` 멘션 (2.1.267 번들 `claude` 바이너리) | `Y0s` 인용 정규식은 `\`·공백·한글 허용 | `Q0s`가 `#` 뒤를 줄 범위/앵커로 떼어 낸다 | **D1** |

D1 재현(번들 바이너리에서 뽑은 두 정규식을 node로 실행):

```text
"C:\…\0f3e-first reference.md" -> "C:\…\0f3e-first reference.md"
"C:\T\0f3e-issue#12.md"        -> "C:\T\0f3e-issue"
"C:\T\0f3e-C# notes.md"        -> "C:\T\0f3e-C"
"C:\T\0f3e-a#b#c.md"           -> 원문 그대로(정규식 불일치)
```

## 7. 숫자 / 음성 기준 / 상한

- 텍스트 첨부 소비처 재측정: 조립 1(`claude.ts:818`) · 운반 6(`pending-message-queue`·`continuation`·`enqueue`·`send`·`session-runtime`·`turn.ts`) · 영속 0.
- 0건 게이트: 24,000자 상수·`truncateText` 비테스트 0행.
- 상한: 텍스트 본문 상한이 CLI로 이전 — Orca 프롬프트 증가분은 첨부당 경로 한 줄.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 실기 |
|---|---|---|
| AC18 | 실행 문자열 · 세 자리 · 전환 | 게이트웨이의 1M beta 헤더 수용 · 도넛 1M · 200k 초과 진행 |
| AC23 | 조립·순서·4경로 · CLI 파서 정규식 대조 | 작은/큰/25,000토큰 초과 `.md` · 이미지 동시 · steer 중 `@` 확장 · API 오류 원문 배너. **`#` 든 파일명 1건 포함 권장** |

## 9. 게이트 재실행

- 실행: `cd app && npm run lint && npm run typecheck` · `./node_modules/.bin/vitest run --maxWorkers=2` · `node scripts/check-doc-inventory.mjs --check`.
- **환경 분리**: 이 환경은 `node_modules/electron/path.txt`가 없어 electron을 import하는 8파일이 수집 단계에서 `Electron failed to install correctly`로 실패한다. 기준선 `2da87fd2` 워크트리에서도 같은 8파일이 같은 메시지로 실패했다(601파일 중 8 fail). `ELECTRON_OVERRIDE_DIST_PATH`로 import만 통과시키자 8파일 36케이스 전부 통과.
- 구현 보고(5792 pass · 1 skip)와 skip 분포만 다르고 총 5793은 같다.
- 게이트의 작업 트리 변경: 없음. 잔여물: 기준선 워크트리는 제거했다(`git worktree list` 1행).

## 11. Repository operation checks

- INDEX: 상태·다음 주체를 `verify/FAIL`·Codex로 갱신, 좌표 4건을 `git rev-parse`로 확인해 기입(`0acd248a`·`64fbfb35`·`2da87fd2`·`97a59769`).
- trailer: 설계 3커밋 `Agent: claude`·`Status: designed` 파싱, 구현 `Agent: codex`·`Status: partial`·`Criteria-*`·`Verified-By: pending` 파싱.
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·잠금·Product/UX·잠재 문제·구현 보고·Review Signals 모두 존재.
- AGENTS.md 변경: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 |
|---|---|
| I-01 `data` 유무로 이미지/텍스트 분기, 텍스트 `path` 필수화 | 타당 — 구현 세부 |
| I-02 result shape에 `result`·`errors` 추가 | 타당 |
| I-03 SQLite ABI는 `pretest`로 해소 | 타당 — 이 환경에선 이미 Node ABI |
| I-04 병렬 실행 지연 케이스 | 재현 안 됨(워커 2 전체 통과) |
| 설계 리뷰 "큰따옴표 전제 확인" | 확인 범위가 `"` 하나에 그쳤다 — CLI 파서의 `#` 처리를 보지 않았다(D1) |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | 저장 이름에 `#`가 남는다(`attachment-files.ts:93-101`은 `<>:"/\|?*`·제어문자만 치환). CLI `Q0s`가 `#` 앞까지만 파일명으로 읽어 `issue#12.md`·`C# notes.md` 첨부가 모델에 안 간다. 오류도 없다 | D-018 · VP-16(MD-07 멘션 경로 전제) · AC21 | **BLOCKING** | 구현 — 저장 이름 정제에 `#` 추가(또는 동등 처리) + `#` 이름 단위 테스트, CLI 파서 대조 사례를 근거로 남긴다 |
| D2 | `envLookup`·`resolveCliModel`이 CLI가 읽는 project/local settings의 env·`model`을 보지 않는다 | 비귀속 — plan §11 유효 env 규칙 범위 밖 | NEXT_HANDOFF | 실사용에서 프로젝트 설정으로 게이트웨이를 지정하는지 확인 후 판단 |
| D3 | VP-17 IT의 `additionalDirectories` 단언이 `expect.any(String)`이라 임시 저장 루트 포함을 잠그지 않는다 | 비귀속 — 등록 oracle 아님 | NON_BLOCKING | D1 수정 때 함께 강화 가능 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(첫 검증).
- 관련 plan 지침: ΔV1 `조립(MD-07)`이 "저장 경로에 큰따옴표가 들어가지 않는다는 전제"만 확인 대상으로 적었다. CLI 파서의 다른 특수 문자(`#`)는 적지 않았다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: electron 바이너리 부재로 8파일 수집 실패 — `ELECTRON_OVERRIDE_DIST_PATH`로 import만 통과시켜 실행.

## 15. 결론

**FAIL.** 9 pair PASS · VP-16 PAIR_FAIL(D1) · VP-13 사람 실기 대기. PLAN_GAP 0. AC ✅7 · ⚠️2 · ❌1.
다음 주체는 구현자(Codex) — D1만 고치면 되고 나머지 pair는 이번 증거로 닫혔다. 재검증 범위는 VP-16·VP-18·VP-17과 운영 gate다.
