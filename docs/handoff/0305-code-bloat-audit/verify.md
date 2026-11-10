# Verify — 0305-code-bloat-audit

## 메타

| 항목 | 값 |
|---|---|
| slug | `0305-code-bloat-audit` |
| 검증자 | Claude Code |
| 일자 | 2026-11-10 |
| 대상 커밋/range | `a0a95f7..00c5e70` (PR 브랜치 `claude/code-bloat-optimization-o1pfe6`) |
| 구현 전 plan 기준 | `83fa261`(V1) · `312e20e`(ΔV1) — 구현 커밋은 plan 규범 행을 바꾸지 않았다(§0) |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1` |
| 검증 기준 plan revision | `312e20e:ΔV1` |
| 라운드 | 1 |
| 상태 | **PASS** (r2 — 아래 `r2` 절, r1 FAIL 본문은 보존) |
| 확장 창 | verify 1회째 — 창 안. 사용자 요구 변경 ΔV1의 NEW·CHANGED 노드는 이 verify와 다음 verify까지 창 안 |
| 독립 축(⑥) | 3축 — ① 분모 독립 재열거(채널·feature·파일·심화 버킷·restructure·승인) ② 후보 근거 수치 재실행 15건 ③ 가정 입력 변이(디렉토리 경로·유령 버킷·restructure→remove) |
| 열거 sweep(⑦) | 1회째 전수 — 검사기 규칙 분기 18 · 데이터 14 = 32건 · 못 잡음 0 |
| 발견 분류 | 이행 1 · 현재 0 · 확장 0 · 경계 0 · 비귀속 3(N1·N2·E1) |
| 구현 주체·문맥 | 구현자 = 설계자 = 검증자(Claude). plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 바꿨는가: 예 — 상태 줄(`:11`)과 `[구현자 기입]` 절 추가뿐. `git diff 312e20e HEAD -- plan.md`의 hunk 2개(`@@ -8,7` · `@@ -640,6`)가 전부이고 Decision·AC·V·§10 행은 0줄.
- 기준선이 diff로 성립하는가: 예 — 설계 `83fa261`(plan·INDEX만)·`312e20e`(plan·INDEX만), 구현은 `2bcc268` 이후 별도 커밋.
- Decision Ledger · Product/UX · AC · V·§10 변경: 없음.
- 채점 원 기준: `312e20e`의 AC1~AC16 · VP-01~VP-10 · EP-01~EP-11 · 선언 경계 1~10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·기준 | 유효 | 기준 V1 = `83fa261`, ΔV1 = `312e20e`, `git cat-file -t` = commit |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | R-03·AT-03·MD-02·UT-02(ΔV1) ↔ VP-09·VP-10 |
| INHERITED ↔ REGRESSION | 유효 | VP-03·VP-04·VP-06 REGRESSION, VP-01·02·05·07 NOT_REQUIRED 근거 기재 |
| §10 자리 목록 재검색 | 유효 | 채널 `rg -o "'orca:…'" app/src/shared/ipc.ts \| sort -u \| wc -l` = 117 · `ls features` = 14 · `git ls-files …` = 2,116 · `volume.json` `prod.lines>=3000` = 12(+`chat/reducer` = 13 = `deep.json` 13) · `restructure` = 27 = 분해안 보유 27. 차집합 0 |
| 적대 증거 선택 | 유효 | VP-03·VP-09 구조 proxy에 변이·표본 재현 명시 |
| SUPERSEDED 이관 | 해당 없음 | — |
| 운영 gate | 유효 | 5개 열거, `app` gate는 범위 밖(§19) |

- root PLAN_GAP: 없음.
- 비귀속 N1: plan §17(`검사 규칙 16개로 고정`)·§9 모듈 표(`K1~K14·K17·K7b`)가 ΔV1의 K18·K19(18개)를 반영하지 않는다 — 규범 행(§10 EP-06)은 18로 맞다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 path |
|---|---|---|
| D-010 닿는 경로 과잉이 주 대상 | 후보 대부분이 `restructure`·L4 | 후보 39 중 L4 25 · restructure 27 (`candidates.json`) |
| D-011 CI 비검사 | CI·테스트 시간 비측정 | `audit.md`·`scan/`에 CI 측정 없음, `saving.test`는 딸린 몫만 |
| D-012 감사 심화 | 분량 상위 버킷 내부 판독 | `deep.json` 13건, 읽은 파일 `read`·구간 근거 |
| D-013 분해안 | 과도 판정은 분해 단계 | `restructure` 27 전부 `decomposition`(단계 58) |
| D-004 코드 무변경 | `app`·`.github` diff 0 | `git diff --stat a0a95f7..HEAD -- app .github` 0줄 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| false success 가능성 | 있음 — 검사 green은 완결성만 뜻한다 | plan §7 주의사항이 이미 선언. 표본 재현으로 보강(§4) |
| 근거 수치의 정확성 | **결함 1** | C-15 `약 560줄` ↔ 실측 738줄(§13 D1) |
| 다른 B를 구현했는가 | 아니오 | 산출은 audit.md + data + scan, Product/UX 성공 문장과 일치 |
| 상태 변경·부분 실패 | 없음 | 문서·스크립트만. CLI 껍질의 디렉토리 경로 `EISDIR`는 r1.2가 고쳤고 변이 G5로 재확인 |
| 출력/요청 worst-case | 해당 없음 | 모델 출력·fan-out 없음 |

## 3. 역방향 탐색

`scan-surface.sh`는 `app/src` 후보만 낸다 — `app/**` diff 0이라 대상 없음. 범위 밖 변경은 직접 봤다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 변경 범위 밖 파일 | 정상 | `git diff --name-only a0a95f7..HEAD`의 비-0305 3개(`0304` plan·verify · `INDEX.md`)는 `main` 병합분(`41bb8d6`)과 INDEX 행 |
| 테스트 전용 참조 | 해당 없음 | `scan/*.test.mjs`는 `check`·`render`·`classify`를 production 심볼로 import(`audit-check.test.mjs`) |
| 동일 규칙 중복 | SSOT 유지 | 분류는 `volume.mjs` `classifyBucket`을 `audit-check.mjs:11`이 import |
| producer ↔ consumer | 일치 | 승인 14 = `remove` 12 ∪ `decisionChange` 비-remove 2(C-33·C-34), `lenses.count` 12·25·2 = 후보 L1 12·L4 25·L5 2 |

## 4. 기존 테스트 / semantic 검증 확인

- 자체 테스트 `node --test docs/handoff/0305-code-bloat-audit/scan/*.test.mjs` → tests 144 · pass 144 · fail 0.
- 구조 proxy 보강 — 후보 근거를 코드에서 재실행했다: 15건 중 12건 일치, 3건 수치 불일치(D1).

| 후보 | 재현 명령·관측 | 판정 |
|---|---|---|
| C-01 | `rg stopAllBackgroundTasks` 비테스트 → preload·shared·`renderer/shared/api/ipc.ts` 정의뿐, 컴포넌트 호출 0 · `stopAll` `background-controller.ts` 실재 | 일치 |
| C-12 | `rg getSessionById send.ts resolve-turn.ts` → 5줄(83·163 / 72·74·104·160) + `:248` | 일치 |
| C-15 | `handleChatSend` `send.ts:52-789` = 738줄 · 근거 칸 `약 560줄` · deep.json·audit §7은 `약 740줄` · `prepareAgentExtensionProfile` 호출 2(`:432·:673`) ✓ · `instructions` 읽기 `:198·:268` ✓ | **불일치 — D1** |
| C-24 | `chatReducer.ts` `:848` 함수 · `:332-333 listening·activityTransport` · `:1256` 파생 ✓ · 2,218줄 | 일치 |
| C-25 | `rg "\.commit\(\|\.isFrozen\b" main -g '!*.test.*'` 큐 호출 0 | 일치 |
| C-26 | `rg -c "\?\.\(" turn-coordinator.ts` = 13 | 일치 |
| C-27 | `openChannel` `adapter.ts:493`, 닫는 `:1082` ≈ 590줄(근거 595) | 일치(근사) |
| C-28 | `openCodeChannel` `:22`, `let` `:34-81` = 19(근거 20) | **불일치 — D1** |
| C-29 | `runtime-model-startup.ts` 142줄 | 일치 |
| C-30 | `this.deps.onSnapshot?.(` 6 · `onStep?.(` 3 | 일치 |
| C-33 | `grep -c "window\.orca\." ipc.ts` = 116(근거 `→ 115`) — `:110` 주석 줄 포함 | **불일치 — D1** |
| C-36 | `composerCatalogState.ts` 275줄 · 필드 `:26-38` · `retired.has` `:84·:169` · `stale` `:109` ✓ · main 쪽 `composer-catalog-owner.ts` 206 · `handlers/composer-catalog.ts` 71 ✓ | 일치 |
| C-37 | `onStage` 비테스트 `sync-manager.ts` 11줄(import `:22` 포함, 근거는 import 제외 10) · `tools.ts:66` `undefined` ✓ | 일치 |
| C-38 | `FileDiffSection.tsx` `?.(` 6 ✓ · 호출 사슬 `DiffReview` ✓ | 일치 |
| C-39 | `ComposerInputController.tsx:223-229·238-248` 두 번 계산 ✓ | 일치 |

- 추적 단계 표본 5건(T1~T5 중간 단계): 파일·심볼 실재 5/5, `effect=user`. T1 10단계 `resolveTurn`의 `C-12` 연결은 위 C-12 재현으로 확인.
- 선택된 적대 증거 재측정: V1 M4·M5·M6 + ΔV1 N1·N2·N3 = 6건 전부 red(고장 이력 N1~M6). 일반 hunk 자동 확장 0.
- 직전 `못 잡음`·`동치` 재실행(③): 해당 없음 — 첫 verify. 이전 `잡음` 행(④): 해당 없음.
- 형제 슬롯 맞바꿈(⑤): K18 `excess`↔`necessary`·K19 `cut`↔`keep`는 impl이 코드 변이로 수행(코드 변이 28건). 이번 verify는 `restructure`→`remove`(A2)로 계약이 다른 형제 슬롯을 맞바꿔 red 3건.

**고장 이력** — 시도 32 = 잡음 32 · 못 잡음 0 · 동치 0 · 경계 0.

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 곳 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| S1·S2 | `audit-check.mjs` K19 `cut`·`keep` | 제거 | `blank(d.cut/keep)` 가드 | 잡음 | `audit-check.test.mjs` red K19 | ⑦ | — |
| S3·S4 | K19 `files`·`scenarios` | 고정값 | `!fileExists`·`!scenarioIds.has` → `false` | 잡음 | red K19 미실재·없는 S-ID | ⑦ | — |
| S5 | K18 소속 | 고정값 | `bucketOf(f) !== r.bucket` → `false` | 잡음 | red K18 다른 버킷 | ⑦ | — |
| S6 | K18 문턱 | 뒤집기 | `>= 3000` → `> 3000` | 잡음 | 경계 케이스 2건 | ⑦ | — |
| S7 | K18 excess | 다른 값 | `pointed === 0` → `-1` | 잡음 | red K18 excess 후보 0 | ⑦ | — |
| S8·S9 | K18 `basis`·없는 버킷 | 고정값 | 가드 → `false` | 잡음 | red K18 | ⑦ | — |
| S10·S18 | K10 시나리오·사유 | 고정값 | 가드 → `false` | 잡음 | red K10 | ⑦ | — |
| S11·S17 | K9 중복·누락 | 고정값 | 가드 → `false` | 잡음 | red K9 | ⑦ | — |
| S12 | K8 `decisionChange` | 제거 | `needsApproval`의 `\|\| decisionChange === true` | 잡음 | red K8 | ⑦ | — |
| S14·S16 | K11 effect=none · K17 L4 excess | 고정값 | 조건 → `false` | 잡음 | red K11 · K17 | ⑦ | — |
| S15 | pointer 범주 | 고정값 | `!(excess).includes(x)` → `false` | 잡음 | red 3(K17×2·K18) | ⑦ | — |
| S19 | K7b 순서 | 고정값 | `!(by>id)` → `false` | 잡음 | red K7b | ⑦ | — |
| G1·G3 | `deep.json` | 빈 값·다른 값 | `X4: []` · 버킷명 오타 | 잡음 | `--check` 위반 2·4 | ⑦ | — |
| G4 | `split.json` | 다른 값 | `S-10` → `S-99` | 잡음 | 위반 2 | ⑦ | — |
| G5 | `candidates.json` | 다른 값 | 분해 파일을 디렉토리로 | 잡음 | 위반 2(미실재로 셈) | ⑥ | — |
| N1·N2·N3 | `deep.json`·`candidates.json` | 제거 | chat/store 검토 · X3 칸 · C-24 분해안 | 잡음 | 위반 2·2·2 | ①(VP-09 등록) | — |
| M4·M5·M6 | `candidates`·`split`·`audit.md` | 뒤집기·제거·다른 값 | C-01 approval · C-01 분할 · 볼륨 숫자 | 잡음 | 위반 1·2·1 | ①(V1 등록, REGRESSION) | — |
| M12 | `candidates.json` | 제거 | 승인 목록에서 C-01 | 잡음 | 위반 2 | ⑦ | — |
| S12d | `candidates.json` | 다른 값 | `decisionChange` 후보 approval → `none` | 잡음 | 위반 4 | ⑦ | — |
| A1 | `deep.json` | 다른 값 | 같은 파일을 `read`에 중복 | 잡음 | 위반 1(K12 — 렌더 숫자 변동) | ⑥ | — |
| A2 | `candidates.json` | 맞바꿈 | C-24 `restructure`→`remove`(승인 없이) | 잡음 | 위반 3 | ⑤·⑥ | — |

- 검산: 시도 32 = 잡음 32. 코드 변이 S1~S19(S13 결번) 18 + 데이터·고정 14.
- 동작 보존 추출 라운드: 아니오 · 소거 변이 잔여물: 해당 없음(JSON·검사기 조건 변이, 잔여 진단 없음).
- 하네스: `mutate.py` 22건 + 직접 python 10건 — 전부 `git status` 빈 출력으로 원복 확인.

## 5. V-pair closeout

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | path / §10 |
|---|---|---|---|---|---|
| VP-07 | UT | REQUIRED | PASS | `scan/volume.test.mjs`(8규칙 + 층별 입력) · 자체 테스트 144 중 | 8/8 |
| VP-08 | UT | REQUIRED | PASS | `scan/audit-check.test.mjs` K1~K14·K17·K7b | 16/16 |
| VP-10 | UT | REQUIRED | PASS | 같은 파일 "red K18" · "red K19" · 경계 케이스, 변이 S1~S12·S14~S19 전부 red | K18 8 · K19 4 |
| VP-09 | IT | REQUIRED | **PAIR_FAIL** | `gate:audit-check.mjs --check` green · 변이 N1~N3 red · **표본 재현 15건 중 3건 불일치(D1)** | 13/13 · 27/27 |
| VP-03 | IT/AT | REGRESSION | **PAIR_FAIL**(D1과 같은 root) | 같은 gate · M4~M6 red · 후보 표본 재현(D1) | 후보 39 × 9칸 |
| VP-04 | AT | REGRESSION | PASS | `--check` K8~K10 · M4·M5·M12·S12d red | 승인 14 · 분할 11+3 |
| VP-06 | IT | REGRESSION | PASS | `--check` K12 · M6 red · 블록 9 | 9/9 |
| VP-01·02·05·07 | — | NOT_REQUIRED(VP-05 운영 gate) | PASS | `volume.mjs --check` ok · `audit-check` K1~K3 ok · AC11 0줄 | — |

- root `PAIR_FAIL`: VP-09의 표본 재현(근거 수치). VP-03 REGRESSION은 같은 `candidates.json` 근거 칸이라 root 하나로 센다.
- 하나의 증거가 닫은 pair: 해당 없음.
- 첫 검증이므로 유효 V 전건 실행.

### AT / AC 세부와 합계

| AC | 기준 | 결과 | 증거 |
|---|---|---|---|
| AC1 | 채널 117·feature 14 귀속 | ✅ | `--check` K1~K3 · M1류 변이는 impl이 수행, 이번 재열거 117·14 |
| AC2 | 2,116파일 분류 | ✅ | `volume.mjs --check` `2116 files · 305843 lines · 102 buckets` |
| AC5 | 렌즈 3건 방법·분모·수 | ✅ | K14 · 12·25·2 = 39 재계수 |
| AC6 | 후보 9칸 | ✅ | K4~K6 · 칸 제거 변이 |
| AC7 | 출처 | ✅ | K7·K7b |
| AC8 | 승인 목록 | ✅ | 14 = 12 ∪ 2, M4·M12 red |
| AC9 | 분할 | ✅ | 11+3 · M5·S11·S17 |
| AC10 | 추적 5건 | ✅ | 46단계(19·6·7·8·6) · 표본 5/5 · S14 |
| AC11 | 무변경 | ✅ | `git diff --stat a0a95f7..HEAD -- app .github` 0줄 |
| AC13 | 문서=데이터 | ✅ | K12 · M6·A1 |
| AC14 | 시나리오 검토 | ✅ | 31 × 7 · K17 변이 S15·S16 |
| AC15 | 심화 검토 | ✅ | 13건 차집합 0 · N1·N2 · S5~S9 |
| AC16 | 분해안 | ✅ | 27/27 · N3·S1~S4 |
| AC12 | 사용자 판정 | ⚠️ | 사람 — 승인 14건·분할 순위 |

- **합계 재측정**: `✅ 13 · ⚠️ 1 · ❌ 0 = 총 14` · 자기보고와 일치. D1은 AC가 아니라 VP-03·VP-09의 표본 재현 oracle이 닫지 못한 것이다.
- **합계 사본 대조**: 본문 13/14 ↔ 구현 커밋 trailer `Criteria-Met: 13/14`(`00c5e70`·`e8fc93d`·`ee1f309`) ↔ INDEX 비고(수치 없음) — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | 계약 | §10 자리 목록 | 확인 · 좌표 | 목록 밖 | 결과 |
|---|---|---|---|---|---|
| VP-09 | EP-10 | 13건 × (범주 7 + 밀도 1) | 13/13 · `gate:--check` + N1·N2·S5~S9 | 없음 | PAIR_FAIL(D1) |
| VP-09 | EP-11 | restructure 27 | 27/27 · `gate:--check` + N3·S1~S4·G5 | 없음 | PAIR_FAIL(D1) |
| VP-10 | EP-06 K18·K19 | 8 · 4 | 12/12 · `audit-check.test.mjs` 변이 18건 | 없음 | PASS |
| VP-06 | EP-07 | 블록 9 · INDEX 비고 | 9/9 · M6·A1 · INDEX 비고 수치 0 | 없음 | PASS |
| VP-03·04 | EP-05 | 후보 39 × 9칸 | 351/351 · K4~K10 + M4·M5·M12 | 없음 | VP-04 PASS · VP-03 D1 |

- 표에 없는데 같은 불변식이 필요한 지점: 없음 — D1의 수치 3건은 EP-05 `evidence` 칸 안이다.
- "다른 게이트가 막는다" 행: 해당 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| 감사 검사 | PASS | `[volume] ok — 2116 files · 305843 lines · 102 buckets` · `[audit-check] ok — 완료 선언` |
| 검사기 자체 테스트 | PASS | tests 144 · pass 144 · fail 0 |
| 문서 가드 | PASS | `check-doc-inventory.mjs --check` — generated ok(117 channels) · prose ok · links ok |
| trailer 파싱 | PASS | 구현 5커밋 `%(trailers:only=true)`가 Agent·Handoff·Status·Criteria-*·Verified-By를 반환 |
| 무변경 | PASS | AC11 0줄 |

## 6~8. 외부 포트 / 상한 / 사람 실기

- 외부 포트: 해당 없음. 상한: 해당 없음(모델 출력 없음).
- 숫자 재측정: 후보 L별 12+25+2 = 39 · 승인 14 · 분할 후보 소속 합 9+6+2+4+1+6+2+1+1+1+3 = 36 + 보류 3 = 39 ✓ · 절감 합 prod 1,031 · test 465(audit.md `:232`와 일치).
- 사람 실기: AC12(제품 결정)만. 순수 로직을 사람에게 넘긴 항목 없음.

## 9. 게이트 재실행

- 실행: `node scan/volume.mjs --check` · `node scan/audit-check.mjs --check` · `node --test scan/*.test.mjs` · `cd app && node scripts/check-doc-inventory.mjs --check`. `app` lint·typecheck·test는 `app/**` diff 0이라 범위 밖(plan §19).
- 관측: 위 표. 검사 CLI는 `--check`라 트리를 쓰지 않는다. gate 전후 `git status` 빈 출력.
- `ci.yml` 단계 대응: `app/**`·`.github/**` 무변경이라 CI paths 필터에 걸리지 않는다 — 돌리지 않은 단계 이유 = 범위 밖.
- 잔여물: `/tmp/claude-0/…/scratchpad`의 spec 2개(작업 트리 밖).

## 10~11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 상태·다음 주체 하나(`Claude`)·비고 3줄(5줄 이내) 정상. 대상 커밋 좌표는 이 verify가 채운다(아래).
- 좌표 확인: `83fa261 f7dfddc ec4407a ef4dc10 2bcc268 210a224 b0ce655 312e20e b3a98ef ee1f309 e8fc93d 00c5e70` 전부 `git cat-file -t` = commit. 아직 PR 브랜치라 `origin/main` 조상이 아니다 — `main` 병합 뒤 교정 대상.
- 재구현 턴 `[구현자 기입]`: r1·r1.2·r1.3 각각 설계 리뷰·강제 지점 전수·잠금·Product/UX·놓친 문제·구현 보고·Review Signals 7필드 존재(r1.3의 강제 지점 표는 pair 4행). 잠금 표에 sweep 행 있음.
- 비고: `[구현자 기입]` r1.3 `Review Signals`가 "verify 없는 impl 턴 3(r1·r1.2·r1.3)"을 적었다 — r1.2는 사용자 요구 변경 턴이라 세지 않으면 2, 임계(초과 3) 미달 → review 불필요.

## 12. 구현자 코멘트

| 코멘트 | 판단 | 반영 |
|---|---|---|
| 설계 대비 차이: `render(data, lineCount)` 둘째 인자 | 타당 — 순수성 유지 | 유지 |
| K19 완료 선언 전 `pending` | 타당 — plan §13 대기 규칙의 적용 | 유지 |
| 보고 4(X 범주에 "한 함수에 몰린 책임" 없음) | 범주 추가는 plan 규범 행 변경 — 구현자가 PLAN_GAP 대신 보고만 한 처리는 타당 | §13 E1(NON_BLOCKING) |
| 읽지 못한 큰 파일(`session-context.ts`·`auth/store.ts`·`chatReducer` 본문) | 선언 경계 7 안 | 경계 — 판정 영향 없음 |

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | `candidates.json` 근거 칸 수치 3건이 재실행값과 다르다 — C-15 `약 560줄`(실측 `send.ts:52-789` 738줄, deep.json은 740) · C-28 `let 20개 :34-81`(실측 19) · C-33 `grep -c … → 115`(실측 116, `:110` 주석 줄 포함) | **이행** — VP-03 적대 증거 원문 "검증자가 후보 5건·추적 단계 5개의 근거 명령을 재실행해 N 일치를 본다"를 표본 15건 중 3건이 어김. 재현: 위 §4 표 명령 | VP-09·VP-03(root 하나) | BLOCKING → FAIL | 구현: 3건의 수치와 근거 명령 출력을 정정하고 `audit-check.mjs --write`로 `audit.md` 블록을 다시 만든다. 나머지 후보의 근거 재계수는 요구하지 않는다(plan이 표본 재현을 선택) |
| N1 | plan §17·§9 표의 검사 규칙 수(16·K1~K14)가 ΔV1 뒤 18과 다르다 | 비귀속 — 규범 행(§10 EP-06)은 맞고 서술 사본만 낡음 | — | NON_BLOCKING | 다음 설계 턴이 고치면 된다. 이번 FAIL 재구현의 의무 아님 |
| N2 | C-37 근거의 `sync-manager.ts 10건`은 import 줄을 뺀 값(`rg` 출력은 11줄) | 비귀속 — 후보 타당성 불변, 근거 문장이 의미를 충족 | — | NON_BLOCKING | 기록 |
| E1 | 과잉 범주에 "한 함수에 몰린 책임"이 없다(구현자 보고 r1.2 #4) | 비귀속 — 잠금 공백이 아니라 plan 규범 행(§9 X1~X7) 변경 제안이다. 열거 원문 위반·재현 가능한 현재 결함 모두 아님 | D-010 주어 | NON_BLOCKING | 범주를 더할지는 설계자·사용자 결정 — 이번 FAIL 재구현의 의무 아님. 채택하면 ΔV로 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(첫 verify). impl 보고 r1 #2·r1.2 #3·r1.3 #4가 "읽은 깊이가 얕다"를 같은 축으로 3회 보고.
- 관련 plan 지침/AC: AC14·AC15는 `read` 소속·존재만 잠그고 읽은 비율 하한이 없다(선언 경계 7).
- 사용자 결정 변경 근거: ΔV1(턴 5)에 근거 있음.
- 반복된 검증 환경 한계: `app/node_modules` 없음 · shallow clone · 서브에이전트 금지(D-006)로 표본 재현을 직접 수행.
- 독립 축(⑥) 발견: 3축에서 D1(이행 1)이 ②에서 나왔고 ①·③은 발견 0.

## 15. 결론

- 상태: **FAIL**
- verify 횟수: 1회째 — 창 안(다음 2회째가 창 안 마지막).
- 후보 표로 간 확장 후보: 없음.
- pair 결과: REQUIRED/REGRESSION PASS 5(VP-07·08·10 · VP-04·06) · root PAIR_FAIL 1(VP-09 — VP-03 REGRESSION이 같은 root) · BLOCKED_BY 0.
- PLAN_GAP: 없음.
- Product/UX 및 ACTIVE Decision 충족: D-002~D-013 충족. 단 근거 칸 수치 3건 정정 필요.
- AC 충족: `✅ 13 · ⚠️ 1(AC12 사람) · ❌ 0 = 14`.
- 현재 변경 운영 gate: 5/5 PASS.
- 남은 사람 확인: AC12 — 승인 목록 14건·분할 순위.
- 다음 단계: 구현(Claude)이 D1의 3개 수치를 재실행값으로 고치고 `--write` 후 gate 재실행 → verify 2회째. E1(범주 추가)은 설계자·사용자 결정 사항으로 남긴다.

---

## r2 — verify 2회째 (대상 `71addd6`)

**판정: PASS.** r1의 BLOCKING D1이 해소됐고 막는 발견은 0이다. 확장 창: 2회째(창 안 마지막) — 확장 후보 0.

### 기준선
- 구현 커밋 `71addd6`의 `plan.md` diff는 상태 줄과 `[구현자 기입] (r2)` 절뿐이고 Decision·AC·V·§10 행은 0줄(`git diff af5c849 HEAD -- plan.md`). 기준 원문은 r1과 같은 `312e20e:ΔV1`.
- plan validity: r1과 같음, PLAN_GAP 0.

### D1 닫힘 — 재실행값
| 후보 | 재현 명령 | 관측 | 판정 |
|---|---|---|---|
| C-15 | `send.ts` `handleChatSend` `:52` ~ 닫는 `}` `:789`(`grep -n "^}"` 마지막) | 738줄 · 근거 칸 738 | 일치 |
| C-28 | `awk NR>=34&&NR<=81 channel.ts \| grep -cE '^\s*let '` | 19 · `:168`의 `let`은 구간 밖 · 근거 칸 19 | 일치 |
| C-33 | `grep -c "window\.orca\." ipc.ts` · 주석·`typeof` 줄 제외 | 116 · `:110` 주석 · `:233`·`:236` `typeof` → 호출 113 · 근거 칸 113(116 병기) | 일치 |
| `deep.json` opencode `basis` | `grep -n "20개" data/*.json audit.md` | 0건 · `let` 19 | 일치 |

- 보너스: `openCodeChannel` `:22`~`:584` = 563줄, 근거 `약 560줄` · `audit.md:31` 손글 `약 740`/`약 560` 은 근사 표기로 일치.

### 독립 축(⑥) — r1에 없던 후보 표본
- C-03 `openFolder` renderer 호출부는 `ipc.ts` 정의·테스트·i18n뿐 · `handlers` `artifactOpenFolder` 실재 — 일치.
- C-09 `projectMcpChoices` `protocol.ts:778` · `ipc.ts:1157,1179` 외 비테스트 참조 0 — 일치.
- C-14 `pending-message-queue.ts` 610줄 · public 메서드 26 · 테스트 742줄 — 일치.
- 표본 3건 일치(r1 15건과 겹치지 않음). 나머지 후보는 plan이 표본 재현을 택했으므로 전수 재계수하지 않았다.

### 고장 이력 (④ — 이번 diff가 닿은 생성 블록 자리)
| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 분류 |
|---|---|---|---|---|---|
| R1 | `audit.md` C-15 | 다른 값 | `738줄`→`739줄` | 잡음 — K12 위반 1 | — |
| R2 | `audit.md` C-28 | 다른 값 | `let 19개`→`18개` | 잡음 — K12 위반 1 | — |
| R3 | `audit.md` C-33 | 다른 값 | `호출 줄 113개`→`114개` | 잡음 — K12 위반 1 | — |
| R4 | `deep.json` basis | 다른 값 | `let 19개`→`20개` | 잡음 — K12 위반 1 | — |

- 시도 4 = 잡음 4 · 못 잡음 0. 직전 `못 잡음` 0이라 ③ 없음. 전부 `git checkout`으로 원복, `git status` 빈 출력.
- 검사기·테스트(`scan/`) diff 0이라 r1 `잡음` 32행 중 나머지는 닿지 않았다.

### gate
- `volume.mjs --check` ok(2116 files · 305843 lines · 102 buckets) · `audit-check.mjs --check` ok · `node --test scan/*.test.mjs` tests 144 · pass 144 · fail 0 · `check-doc-inventory.mjs --check` generated·prose·links ok · `git diff --stat a0a95f7..HEAD -- app .github` 0줄.
- `app` lint·typecheck·test는 `app/**` diff 0이라 범위 밖(plan §19). gate 전후 `git status` 빈 출력.

### pair·AC
- VP-09·VP-03 PASS(D1 해소) · VP-04·06·07·08·10 r1 좌표 유지(diff가 닿은 VP-06은 R1~R4 red) · BLOCKED_BY 0.
- AC `✅ 13 · ⚠️ 1(AC12 사람) · ❌ 0 = 14` — 행·합계 일치, 구현 커밋 trailer `Criteria-Met: 13/14` 일치.

### repository operation
- `71addd6` trailer: Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By 파싱 확인. `git cat-file -t` = commit, `origin/main` 조상 아님(PR 브랜치 — `main` 병합 뒤 교정).
- INDEX 행: 상태 PASS · 다음 주체 사람 하나 · 비고 5줄 이내 · r2 좌표 `71addd6` 기입.
- `[구현자 기입] (r2)` 7필드(설계 리뷰·강제 지점·잠금(sweep)·Product/UX·놓친 문제·구현 보고·Review Signals) 존재.

### Finding disposition
| # | finding | 분류 | disposition |
|---|---|---|---|
| D1 | 근거 수치 3건 | 이행 | **닫힘** — 재실행값 일치 |
| N1·N2·E1 | r1 §13 | 비귀속 | NON_BLOCKING 유지 — 설계자·사용자 결정 |

### Review Signals
- 같은 증상 재발 없음(r2 새 발견 0). verify 2회째 PASS라 review 조건(3·6회째 비PASS) 미해당.
- 독립 축 발견 0 · 환경 한계: `app/node_modules` 없음 · 서브에이전트 금지(D-006).

### 결론
- 상태 **PASS**(기계 범위). 남은 것: AC12 — 승인 목록 14건·분할 순위의 사람 판정. 그 뒤 archive 이동.
