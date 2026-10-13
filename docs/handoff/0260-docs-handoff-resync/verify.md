# Verify — 0260-docs-handoff-resync

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다 — 판정 먼저, 주장 한 줄에 관측 하나, 표 한 칸 3줄.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0260-docs-handoff-resync` |
| 검증자 | Claude Code |
| 일자 | 2026-10-13 |
| 대상 커밋/range | `0b53bbfa..7f1f504d` (r1 구현 1커밋) |
| 구현 전 plan 기준 | `0b53bbfa` (plan READY 커밋 — 공유 브랜치 `origin/ccr-0d9ab133-25ay9c` 에서 `git cat-file -t` = commit) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `0b53bbfa:V1` |
| 라운드 | 1 |
| 상태 | r1 **RETURN_TO_PLAN** — PLAN_GAP 2 + BLOCKING 4 → r2 **PASS** (아래 `# r2 검증`) |
| 자기 검증 여부 | 설계·구현·검증 동일 에이전트 — §4 에 구현 보고가 이름을 대지 않은 적대 축 5건 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태` 1행 + `[구현자 기입]` 자리표시자만. `git diff 0b53bbfa 7f1f504d -- …/plan.md` 의 삭제 줄 중 자리표시자가 아닌 것은 `| 상태 | READY |` 1줄.
- **기준선이 diff로 성립하는가**: 예 — 설계(`0b53bbfa`)와 구현(`7f1f504d`)이 다른 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 변경: 없음(위 diff).
- 채점에 사용할 원 기준: `0b53bbfa:docs/handoff/0260-docs-handoff-resync/plan.md` 의 AC1~AC24 · D-001~D-012 · VP-01~VP-09.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 0191/0192 는 구 템플릿 — 상속 V 없음, Baseline V1 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~04↔AT-01~04 · SD-01↔ST-01 · AR-01/02↔IT-01/02 · MD-01/02↔UT-01/02 = VP-01~09 |
| 영향받은 INHERITED ↔ REGRESSION pair | 해당 없음 | 상속 node 없음(VP-04 는 기존 장치 유지를 REQUIRED 로 둠) |
| pair별 path·§10 전수·직접 oracle | **PLAN_GAP (G1)** | VP-02 의 oracle 은 확인어 매치(구문)뿐이라 "문서 영향 없음(`-`)" 행이 거짓이어도 green — D3 이 전 gate 를 통과했다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | VP-01·02·03·05·08·09 선택, VP-04·06·07 not selected + 이유 |
| `SUPERSEDED` pair 이관 | 해당 없음 | — |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | `drift-check.sh check` · `doc-gate.sh check` · `check-doc-inventory.mjs --check` · trailer 파싱 |

- root PLAN_GAP과 영향 pair: **G1**(R-02 의미 oracle 부재 → VP-02) · **G2**(코드 인용 좌표 정책 — 아래 D4: AC4·AC7·AC11 은 "줄번호를 현행 값으로" 를 요구하고 구현은 줄번호를 식·심볼 좌표로 바꿨다. 어느 쪽을 계약으로 둘지는 설계자 결정 → VP-01).

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 범위 문서 전수 0193~0259 반영 | 범위 문서가 코드와 다른 말을 하지 않는다 | 문서 → DA 행 → `drift-check.sh check` — **해설 미러 4자리 낡음(D1·D2)** |
| D-002 이력은 삭제+링크 | `arch/` 에 델타 서술 신규 0 | `git diff docs/arch \| grep '^+' \| grep -cE '에서 제거\|에서 재작성'` = 0 |
| D-003 PRD/TRD 깊이 · OQ 비접촉 | OQ3 비고만 정정 | `git diff -U0 6ee2d4db -- docs/PRD.md` OQ4~7·9·10 행 변경 0 · OQ3 비고 1행 |
| D-005 ADR 비접촉 | ADR 본문 diff 0 | `git diff 0b53bbfa..7f1f504d -- docs/decisions` = 0 |
| D-007 AGENTS 범위 | 루트·docs AGENTS 는 `TRD §15→§10` 1줄씩 | diff 확인 — `app/AGENTS.md` 는 범위 밖 5곳 선조치(§12) |
| D-009 0192 F1~F3 | `limits` 라벨·상대경로·exit 문구 | `doc-gate.sh` F1·F3 문구 · F2 해석 · `exit 0 고정` 6자리 0 |
| D-010 TSV + 스크립트 | 세 축 대조 | `drift-check.sh check` → `전부 공집합 — 통과` |

### end-to-end 흐름

```text
0193~0259 코드 변화 → 범위 문서 문장(정정) → drift-assertions / status-marks / handoff-coverage 행
  → drift-check.sh check (+ doc-gate check · inventory) → 다음 세션 에이전트가 읽는 문서
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 장치는 실패를 행 id 로 인쇄 | 파일 부재 DA 행도 `불일치 — 파일 없음` 으로 red(검증자 변이 V-a) |
| false success 가능성 | **있음 — 커버리지 축** | `-` 행의 사유가 거짓이어도 green(D3, G1) |
| partial failure | 해당 없음 | 읽기 전용 스크립트 |
| A 가 아닌 B 를 구현 | **있음 — 좌표 정책** | 줄번호 갱신(AC) 대신 식·심볼 좌표(D4, G2) |
| 증상만 제거 | 아니오 | 정정 문장마다 must + anchor |
| 최적화가 잃은 재검증 | 해당 없음 | — |
| 출력 worst-case | 해당 없음 | — |

## 3. 역방향 탐색

`scan-surface.sh` 는 코드 표면용이라 이번 문서 diff 에는 쓰지 않았다. 대신 문서 축으로 역방향을 걸었다.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 같은 사실의 형제 자리(해설 미러) | **결함** | §11:409·§5.5:238·§14.3:498 "권한 우회 미사용" ↔ `permission-mode.ts` `menuModes` 의 `bypass`(0224 `4313e953`) · IPC_CONTRACT:562·provider-runtime:222 는 현행 — D1 |
| 같은 문서 내 채택 표기 모순 | **결함** | §7.3:319 `--fork-session` "❌ 미사용" ↔ §11:405 "✅ 채택 (0064)" · `send.ts:492` `forkSession` — D2 |
| 커버리지 `-` 행의 사실 | **결함** | 0221 `busy-reserve.ts`·`turn-setup.ts`(app/AGENTS.md:50 인용) · 0222 `useTweaks.ts`(GLOSSARY:25·TRD F10 인용) — D3 |
| producer ↔ consumer | 정상 | 세 TSV 의 유일한 소비자 `drift-check.sh` |
| 동일 규칙 중복(SCOPE 사본) | SSOT 대조 유지 | preflight 가 doc-gate 의 식·`EXTRA_SCOPE` 동일성을 대조(변이 2건 exit 2) |

## 4. 기존 테스트 / semantic 검증 확인

- **선택된 적대 증거 재측정**: 등록 변이 12건(VP-01 ①×4 · ② · ③ · VP-02 확인어 · ④ · EP-13 형식 2 · VP-05 형제 2) 재실행 → 12 검출 · 0 미검출. VP-09 `limits` non-ts-paths 45 → 부재 상대경로 삽입 46(+1). 원복 후 `drift-check.sh check` 통과 · `*.mutbak` 0.
- **자리 미지정 등록 변이**: VP-05 "자리 하나만 되돌림" — EP-01 3자리(TRD §6.8 · adapters §2.1 · std §5.1)에서 각각 그 자리 행만 red.
- **이전 라운드 대조**: 해당 없음(r1).
- **자기검증 분모 — 보고에 없던 축 5건**:

| 변이 / 축 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| V-a DA 행의 `file` 을 부재 경로로 | drift-check 단언 축 | red — `DA-ZZ9: 파일 없음` | 장치 민감도 — 정상 |
| V-b 커버리지 `-` 행 의미 감사 — 핸드오프 커밋이 지우거나 옮긴 `app/src` 파일 이름이 기준 커밋(`6ee2d4db`) 범위 문서에 인용됐는가 | `-` 10행 | **0221·0222 적중**(green 이어야 할 사유가 거짓) | **D3 · G1** |
| V-c 표식 술어 엄격화(`❌`·`미도입`·`예정`·`후속`·`Future Scope`) 차집합 | 범위 문서 | **해설 미러 4자리 낡음** — 나머지는 금지 규칙·범례·의도적 미사용 | **D1 · D2** |
| V-d `파일:줄번호` 인용 재열거 `git grep -nE '\.(ts\|tsx)\`?:[0-9]+'` | 범위 문서 | 기준선 4 → HEAD 0 | D4 의 근거(줄번호 인용이 사라짐) |
| V-e 0193~0259 커밋이 지운·옮긴 모듈 이름(확장자 없는 이름 포함)의 HEAD 인용 | 615커밋 · 38파일 | 0건(`timers` 는 Node 내장 모듈, `SearchModal` 은 현재 경로) | 정상 |

- 커버리지 확인어 의미 감사(57행, 첫 매치 문맥 판독): 54행 정상 · 3행 약함(0202 `invalidat` 가 다른 표의 단어 · 0213 `기능 가용성` 절 제목 · 0239 `정착` 첫 매치가 다른 문장) — N1.
- 형제 슬롯 맞바꿈 변이: 해당 없음 — 문서 단언은 자리별 고유 문구.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-08 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | `gate:drift-check.sh check` — §4 등록 변이 12 red + V-a | 판정 함수 3 + 형식 1 = 4/4 |
| VP-09 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | `gate:doc-gate.sh limits` 45 → 46 | 1/1 |
| VP-06 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | `gate:doc-gate.sh check` 형식오류·미분류·미판정·잔류 전부 0, `전부 공집합 — 통과` | 3/3 |
| VP-07 | AR-02 ↔ IT-02 / IT | REQUIRED | PASS | plan 메타 `impl/IMPL_DONE (r1)` = INDEX `impl·IMPL_DONE (V1 r1)` · `git log -1 --format='%(trailers:only=true)' 7f1f504d` 8키 | 3/3 (verify 판정은 이번 커밋) |
| VP-05 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | 자리별 DA 행 · 형제 변이 3자리 | EP-01 12/12 · EP-02 9/9 · EP-03~05 낡은 자리 0 · EP-06 1/2(ADR, D-005) · EP-07 4/4 |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | **PAIR_FAIL** | 커버리지 축 67/67 green 이지만 V-b 가 거짓 `-` 2행 + 근거 없는 사유 1행 | D3 · G1 |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | PASS | 표식 축 82/82 · 엄격화 차집합은 D1·D2 로 VP-01 귀속 | 82/82 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | PASS | doc-gate 통과 · inventory `generated doc ok · prose ok · links ok` · `git diff --stat docs/generated` 0 | 2/2 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **PAIR_FAIL** | 단언 축 green 이지만 해설 미러 §11:409(AC16 범위)·§5.5·§14.3·§7.3 이 코드와 반대 · AC11 `:1920` 술어 0건 | D1 · D2 · D4 |

- root `PAIR_FAIL`: VP-01(D1·D2·D4) · VP-02(D3). 종속 `BLOCKED_BY`: 없음.
- 이번 라운드 실행 범위: 최초 검증 — 유효 V 의 REQUIRED 9 전건 + 운영 gate.

### AT / AC 세부와 합계

| AT / AC | 결과 | 검증 증거 |
|---|---|---|
| AC1~AC6 · AC8~AC10 · AC12~AC15 · AC17 · AC18 · AC20~AC23 | ✅ | DA 행 전건 green(`drift-check.sh check`) · AC12 OQ 행 diff 0 · AC21 doc-gate 통과·`exit 0 고정` 6자리 0 · AC22 inventory ok 3줄 · AC23 술어 0 |
| AC7 | ⚠️ | 검증 수단(`줄 21-23` 0 등) green · 동작 기준 "§1.1 줄번호 `210-213`" 대신 `createWindow` 의 `webPreferences` 블록 — G2 |
| AC11 | ❌ | 검증 수단 `:1920 ≥1` = 0건(`chatApi.onEvent(ingestChatEvent)` 식으로 대체) — D4·G2 |
| AC16 | ❌ | §11:409 "권한 우회 미사용 확정" — 코드는 `bypass` 메뉴 노출 — D1 |
| AC19 | ❌ | 0221·0222 `-` 사유 거짓 · 0205 사유 근거 0 — D3 |
| AC24 | ✅ | READY(`0b53bbfa`)·구현(`7f1f504d`) 분리 · trailer 8키 파싱 · INDEX ↔ plan 메타 일치 |

- **합계 재측정**: ✅ 20 · ⚠️ 1 · ❌ 3 = 총 24 · 자기보고 ✅21·⚠️3 과 불일치(AC16·AC19 를 자기보고는 ✅, AC24 를 ⚠️ 로 셌다).
- **합계 사본 대조**: 자기보고 본문 21/24 ↔ trailer `Criteria-Met: 21/24` ↔ INDEX "✅21·⚠️3" — 세 사본은 서로 일치.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 검증자가 다시 센 지점 | 결과 |
|---|---|---|---|---|
| VP-05 | EP-01 settingSources | 13 후보 | `rg settingSources` 15줄 → 현재값 12 · 이력/외부 3 · 가이드 0 | PASS |
| VP-05 | EP-02 disallowedTools | 21 후보 | 18줄 → Orca 값 9(가이드 4 는 파일 단위 행 — N4) | PASS |
| VP-05 | EP-03~EP-05 | 낡은 문구 rg | 0 · 0 · 0 | PASS |
| VP-05 | EP-06 | GLOSSARY + 1 | ADR-005:36 잔존(D-005 비접촉) | PASS |
| VP-01 | (§10 행 없음) 권한 우회·세션 분기 채택 표기 | — | 해설 미러 4자리 | **표 밖 지점** — AC16 범위(§11)와 R-01 에 필수 → D1·D2 로 PAIR_FAIL |

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| `bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` | PASS | `단언 축 불일치 0 · 표식 82/82 · 커버리지 67/67 · 전부 공집합 — 통과` exit 0 |
| `bash docs/handoff/0192-doc-gate-baselines-as-data/doc-gate.sh check` | PASS | `심볼 276사이트/165심볼 · 경로 13줄 · 시제 126사이트 · 전부 공집합 — 통과` exit 0 |
| `cd app && node scripts/check-doc-inventory.mjs --check` | PASS | ok 3줄 exit 0 |
| trailer 파싱 | PASS | `7f1f504d` 8키 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `closed-network-extensions.md §1.7` Plugin 경로 | `features/plugins/{confluence,jira,mail}` 실재(DA-GD3 anchor) | 등록 경로 = auth.md §7(DA-GD4) | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 커버리지 분모: `ls -d docs/handoff/0[12]*/` 중 193~259 = 67(`drift-check.sh sweep handoffs`). `verify.md` 없는 디렉토리는 **5**(0205·0208·0214·0219·0220) — plan §8 의 "6" 은 오기(N6).
- 0건 게이트의 정당한 예외: ADR-005 의 구 상태 어휘(D-005) · `timers`(Node 내장) — 보존.

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 문서 가독성 | 형식·링크·수치·사실 대조 | 없음 — 설계자 기본값 D-003·D-007 확인은 사람 결정(§10) |

## 9. 게이트 재실행

- 실행 명령: §5 운영 gate 3종 + 변이 스위트 + `limits` 2회. `app/**` 코드 변경 없음 → lint/typecheck/vitest 대상 아님.
- 게이트가 작업 트리를 바꿨는가: 아니오 — 변이는 전부 원복(`git status` 대상 파일 0 변경, `*.mutbak` 0).
- 잔여물: 스크래치패드(`npm pack` SDK tarball)만 — 저장소 밖.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 문서 사실 ↔ 코드 | 대조·변이 | — | D1~D4 |
| 제품 의도 / Open Question | OQ 비접촉 확인 | **D-003·D-007 기본값 확인** | 대기 |
| bypass 모드 동작(코드) | SDK 타입 주석 대조 | **수정 여부 결정** | X5 |

## 11. Repository operation checks

- AGENTS 위생: 비밀·토큰·이메일 패턴 0 · 일회성 정보 없음 · 부모↔자식 충돌 없음(루트·docs 는 `TRD §15→§10` 1줄씩).
- INDEX: 상태·다음 주체·대상 커밋 — 이번 커밋에서 `verify/RETURN_TO_PLAN`·다음 주체 Claude(설계)·좌표 `0b53bbfa`(V1 설계)·`7f1f504d`(r1)로 기입. 비고 5줄 이내.
- trailer: `7f1f504d` 허용값·파싱 정상. 인용 해시 `0b53bbfa`·`7f1f504d`·`4313e953`·`6ee2d4db` 전부 `git cat-file -t` = commit.
- `[구현자 기입]` 7필드 전수 존재.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `app/AGENTS.md` 범위 밖 5곳 선조치(D-007 초과) | 구현 세부 보완 — 같은 문서의 낡은 사실, 제품 결정 아님 | 유지 · 사람 확인 목록에 D-007 과 함께 |
| status-marks 키 = 24자 문맥(§11 은 60자 snippet) | 타당 — 대체물 실패 모드(같은 문맥 2사이트 병합) 재측정 raw 82 = unique 82 | 유지 |
| SCOPE 사본 대조 = 식 동일성(§10 은 파일 수) | 타당 — 변이 2건 exit 2 | 유지 |
| AC7·AC11 줄번호 → 식·심볼 좌표 | **설계 결정 사항** — 계약은 줄번호 | G2 → 설계자 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G1 | R-02 의 oracle 이 `-`(문서 영향 없음) 행의 진위를 보지 않는다 — D3 이 모든 gate 통과 | VP-02 · AC19 · MD-01 | **PLAN_GAP** | 설계자: `-` 행 의미 oracle(핸드오프 커밋이 지운·옮긴 `app/src` 이름의 기준 커밋 인용 0) 추가 |
| G2 | 코드 인용 좌표 정책 미결 — AC4·AC7·AC11 은 줄번호 갱신, 구현은 식·심볼 좌표 | VP-01 · AC4·AC7·AC11 | **PLAN_GAP** | 설계자: 정책 결정(Decision) + 영향 AC 술어 정정 |
| D1 | 해설 미러 §11:409·§5.5:238·§14.3:498 "권한 우회 미사용" — 코드는 Work·Code 메뉴에 `bypass`(→ `bypassPermissions`) | VP-01 · AC16 · R-01 | **BLOCKING** | r2 구현 — 3자리 정정 + DA 행 |
| D2 | §7.3:319 `--fork-session` "❌ 미사용" ↔ §11:405 ✅ · `forkSession` 코드 | VP-01 · R-01 | **BLOCKING** | r2 구현 |
| D3 | 커버리지 0221·0222 `-` 사유 거짓 · 0205 사유("0226 뷰어로 반영") 근거 0 | VP-02 · AC19 | **BLOCKING** | r2 구현 — 반영 문서·확인어로 교체, 0205 사유 정정 |
| D4 | AC11 `:1920 ≥1` 0건 · AC7 동작 기준의 줄번호 부재 | VP-01 · AC7·AC11 | **BLOCKING** (G2 결정 뒤 해소 방식 확정) | G2 → r2 |
| N1 | 확인어 약함 — 0202·0213·0239 | VP-02 | NON_BLOCKING | r2 에서 함께 |
| N2 | §7.2:309·§7.5:343 사유가 "Phase 3 … 예정/검토"(채택 표기 자체는 맞음) | R-01 | NON_BLOCKING | r2 에서 함께 |
| N3 | adapters 스킬 스캔 표 "부팅 1회 · 핫리로드 ❌ 재시작 필요" — Orca 작성·업로드·토글·삭제 뒤 `refreshSkills()` 재스캔, 파일 감시만 없음 | R-01 | NON_BLOCKING | r2 에서 함께 |
| N4 | EP-02 가이드 4자리는 파일 단위 행 하나 | VP-05 | NON_BLOCKING | r2 선택 |
| N5 | DA-UX9 anchor 를 정확한 식으로(`chatApi\.onEvent\(ingestChatEvent\)`) | VP-01 | NON_BLOCKING | G2 결정에 따름 |
| N6 | plan §8 "`verify.md` 없는 것 6" → 실측 5 | plan 본문 | NON_BLOCKING | 설계자 ΔV1 에서 |
| X1 | 프로덕션 DevTools 를 코드가 막지 않는다 | 비귀속 | NEXT_HANDOFF | 사용자 결정 |
| X2 | `app/src/main/AGENTS.md` chat-turn 표에 `background`·`permission-mode-observer`·`prepare-worktree`·`project-binding` 없음 | 비귀속 | NEXT_HANDOFF | — |
| X3 | TRD §2 의 0193 이전 미기재 기능 행 | 비귀속(§6 비범위) | NEXT_HANDOFF | — |
| X4 | drift/coverage 장치는 0193~0259 한정 — 상시 게이트화는 결정 사항 | 비귀속 | NEXT_HANDOFF | 사용자 결정 |
| X5 | `bypass` 모드가 `permissionMode: 'bypassPermissions'` 만 넘기고 `allowDangerouslySkipPermissions` 를 넘기지 않는다 — SDK 0.3.296 `sdk.d.ts` 주석 "Must be set to `true` when using `permissionMode: 'bypassPermissions'`" | 비귀속(코드) | NEXT_HANDOFF | 실기·코드 조사 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(r1). 다만 D1·D2 는 "같은 사실의 형제 자리를 한 곳만 고침" 축이고, 구현 턴은 §11·§14 표를 고치면서 같은 문서의 §5.5·§7.3 본문을 다시 읽지 않았다.
- 관련 plan 지침/AC: AC16 이 §10·§11·§12 만 열거했고 §5·§7·§14 는 목록에 없었다. AC19 의 검증 수단은 구문 매치만 요구했다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: `app/node_modules` 부재 — SDK 타입은 고정 핀 tarball 로 대조.

## 15. 결론

- 상태: **RETURN_TO_PLAN** (라운드 1 → 2)
- pair 결과: PASS 7 · root PAIR_FAIL 2(VP-01 · VP-02) · BLOCKED_BY 0
- PLAN_GAP: G1(VP-02 의미 oracle) · G2(코드 인용 좌표 정책 → VP-01)
- Product/UX 및 ACTIVE Decision: D-001(범위 문서 전수 반영)이 해설 미러 4자리·커버리지 3행에서 미충족, 나머지 Decision 충족
- AC 충족: ✅ 20 · ⚠️ 1 · ❌ 3 / 24
- 현재 변경 운영 gate: 3종 PASS
- 남은 사람 확인: D-003·D-007 기본값 · X1·X4·X5
- 다음 단계: 설계자(Claude)가 G1·G2 를 ΔV1 로 정정(별도 설계 커밋) → r2 구현(D1~D4 + N1~N3) → r2 검증

---

# r2 검증 — V1 + ΔV1

> r1 판정(위)은 보존한다. 이 절은 r2 구현(`4a30602a`)을 ΔV1(`f26d342a`) 기준으로 검증한다.

## r2-0. 메타 · 기준선

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `f26d342a..4a30602a` (r2 구현 1커밋) |
| 구현 전 plan 기준 | `f26d342a` (ΔV1 설계 커밋 — `origin/ccr-0d9ab133-25ay9c` 에서 `git cat-file -t` = commit) |
| 유효 V | `V1 + ΔV1` |
| 라운드 | 2 |
| 상태 | **PASS** |
| 자기 검증 여부 | 동일 에이전트 — r2 보고에 없던 축 4건(아래 r2-3) |

- 구현 커밋의 `plan.md` 변경: 메타 `상태` 1행 삭제 + `[구현자 기입] r2` 블록 추가뿐(삭제 줄 = `| 상태 | plan/READY … |` 1줄). Decision·AC·V·§10 규범 행 변경 0.
- Plan validity: ΔV1 의 대체 pair 3(VP-01·02·08 -D1)이 같은 레벨 REQUIRED 이고 V1 선택 변이를 전부 승계했다. G1·G2 는 D-014·D-013 으로 닫혔다. 새 PLAN_GAP 0.

## r2-1. 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | 닫힘 — 커버리지 `-` 행 거짓 주장이 이제 red | ⑤ 0221·0222 를 `-` 로 → `'-' 인데 기준 커밋 인용 …` |
| A 가 아닌 B | 닫힘 — 좌표 정책은 D-013 이 정했다 | DA-SE12·UX9·A07 |
| 새 표면 실패 | `COVERAGE_BASE` 소실 시 preflight exit 2 | ⑥ |

## r2-2. 등록 적대 증거 재측정

| 변이 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|
| r1 등록 10건(UT-01 ①×4·②·③·확인어·④·형식 2) | red 10 | **red 10** | 덮개 회귀 0 |
| EP-15 §11 도구 권한 → "미사용 확정" | — | red(DA-CS4·CS5) | VP-01-D1 · D1 인용 |
| EP-15 §7.3 → "❌ 미사용" | — | red(DA-CS7) | VP-01-D1 · D2 인용 |
| EP-15 §5.5 만 · §14.3 만 | — | red(DA-CS4 · DA-CS6) | VP-01-D1 형제 |
| ⑤ 0222 · 0221 → `-` | r1: 축 없음(green) | red 2 | VP-02-D1 · D3 인용 |
| ⑥ `COVERAGE_BASE` 부재 | — | exit 2 | VP-08-D1 |

- 합: 등록·인용 변이 17 → 검출 17 · 미검출 0. 원복 후 `drift-check.sh check` 통과 · `*.mutbak` 0 · `git status` 변경 0.

## r2-3. 자기검증 분모 — r2 보고에 없던 축

| 축 | 결과 | 귀속 |
|---|---|---|
| EP-15 §11 **세션 분기** 행을 "❌ 미사용" 으로 | red(DA-CS11) | 정상 — 보고의 잠금 표에 없던 자리 |
| D4 재도입 — ux-domains §3.2 식을 `chatStore.ts:1920` 으로 | red(DA-UX9 must_not `chatStore\.ts:[0-9]`) | 정상 |
| EP-15 자리 독립 재열거 `grep -nE 'dangerously\|bypass\|fork-session\|forkSession\|세션 분기\|--continue\|--name' docs/claude-code-spec.md` | 채택/미사용 표기 전부 코드와 일치 · §14.3 `--continue` 행의 **사유**만 "단일 세션 시나리오"(N8) | NON_BLOCKING |
| 엄격화 재측정(`예정`·`미도입`) 차집합 | GLOSSARY:82 "현 … 정적 정책 append `prompts/`" — `app/src/main/prompts/` 는 0062(`91ee76f3`)에 제거(범위 이전 사실, N9) | NON_BLOCKING |

## r2-4. V-pair closeout

| Pair | 결과 | 직접 증거 |
|---|---|---|
| VP-08-D1 (MD-01-D1 ↔ UT-01-D1) | PASS | 판정 함수 4 + 형식 — r2-2 ①~⑥·형식 2·SCOPE 사본 2(r1 좌표 유지) |
| VP-09 | PASS | r1 좌표 유지(장치 변경 없음) |
| VP-06 · VP-07 | PASS | `doc-gate.sh check` `전부 공집합 — 통과` · plan 메타 `impl/IMPL_DONE (r2 · V1 + ΔV1)` = INDEX 행 · `4a30602a` trailer 8키 파싱 |
| VP-05 | PASS | r1 자리별 DA 행 green · r1 형제 변이 red 유지 |
| VP-02-D1 (R-02 ↔ AT-02-D1) | PASS | 커버리지 축 67/67 · `-` 8행 인용 0 · ⑤ red |
| VP-03 · VP-04 | PASS | 표식 82/82 · inventory ok 3줄 · `docs/generated` diff 0 |
| VP-01-D1 (R-01 ↔ AT-01-D1) | PASS | 단언 축 불일치 0 · EP-15 5/5 · EP-16 3/3 + 범위 줄번호 인용 0 |

- root `PAIR_FAIL` 0 · `BLOCKED_BY` 0.

### AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1~AC3 · AC5 · AC6 · AC8~AC10 · AC12~AC15 · AC17 · AC18 · AC20~AC23 | ✅ | r1 증거 유지 + r2 gate 재실행 green |
| AC4-D1 · AC7-D1 · AC11-D1 | ✅ | DA-A07·SE12·UX9 (D-013) |
| AC16-D1 | ✅ | DA-CS4~CS11 · EP-15 변이 red |
| AC19-D1 | ✅ | 커버리지 축 + `-` 인용 대조 · ⑤ red |
| AC24 | ✅ | 설계(`0b53bbfa`·`f26d342a`)와 구현(`7f1f504d`·`4a30602a`) 분리 · trailer 파싱 · INDEX ↔ plan 메타 |

- **합계 재측정**: ✅ 24 · ⚠️ 0 · ❌ 0 = 총 24 · 자기보고 23/24(AC24 ⚠️ — 커밋 전이라 관측 불가였던 trailer)와 차이 1, 이번에 관측해 ✅.
- **합계 사본 대조**: r2 본문 `✅ 23 · ⚠️ 1` ↔ trailer `Criteria-Met: 23/24` ↔ INDEX "✅23·⚠️1" — 일치.

## r2-5. 운영 gate · repository operation

- `drift-check.sh check` `전부 공집합 — 통과` · `doc-gate.sh check` `심볼 276/165 · 경로 13 · 시제 126 · 전부 공집합 — 통과` · inventory ok 3줄 exit 0.
- INDEX: 이번 커밋에서 `verify/PASS`·다음 주체 **사람**(D-003·D-007 확인)·좌표 `f26d342a`(ΔV1 설계)·`4a30602a`(r2) 기입. 사람 확인 대기라 archive 로 옮기지 않는다(D-004 와 같은 보드 관례).
- trailer: `4a30602a` 허용값·파싱 정상. 인용 해시 `f26d342a`·`4a30602a`·`91ee76f3` 실재.
- `[구현자 기입] r2` 7필드 전수 존재.

## r2-6. Finding disposition

| # | finding | disposition | 후속 |
|---|---|---|---|
| G1·G2 · D1~D4 | r1 지적 | **closed** — r2-2·r2-4 관측 | — |
| N1·N2·N3·N5·N6 | r1 NON_BLOCKING | closed — 확인어 교체 · DA-CS9·10·A14·UX9 · ΔV1 §8 정정 | — |
| N4 | EP-02 가이드 4자리 파일 단위 행 | NON_BLOCKING(유지) | 기록 |
| N7 | §14.3 "❌ 미사용 (의도적)" 아래 `--allow-dangerously-skip-permissions` 행 — 의도인지는 미확인(X5) | NON_BLOCKING | X5 결정 때 함께 |
| N8 | §14.3 `--continue` 행 사유 "단일 세션 시나리오"(표기 자체는 맞음) | NON_BLOCKING | 한 줄 정정 후보 |
| N9 | GLOSSARY:82 "현 … 정적 정책 append `prompts/`" — 0062 에 제거된 경로 | NON_BLOCKING(범위 이전) | 한 줄 정정 후보 |
| X1~X5 | r1 과 같음 | NEXT_HANDOFF | 사용자 결정 |

## r2-7. Review Signals — 사실만

- 이전 라운드와 같은 축: r1 D1·D2 와 r2 N8 은 모두 "같은 문서 안 같은 사실의 다른 자리" 다 — r2 는 표기 자리를 전수로 닫았고 사유 문장 1자리(N8)가 남았다.
- 관련 plan 지침: ΔV1 의 EP-15 는 "채택/미사용 표기" 를 셌고 사유 문장은 세지 않았다.
- 사용자 결정 변경 근거: 없음. 환경 한계: 없음(신규).

## r2-8. 결론

- 상태: **PASS** (라운드 2)
- pair: REQUIRED 9 PASS · PAIR_FAIL 0 · PLAN_GAP 0
- AC: ✅ 24 / 24
- 운영 gate 3종 PASS · repository operation 정상
- 남은 사람 확인: D-003(PRD/TRD 정정 깊이)·D-007(AGENTS 범위 — `app/AGENTS.md` 선조치 포함) 기본값 · X1(DevTools)·X4(장치 상시화)·X5(`bypass` 모드 SDK 플래그)
- 다음 단계: 사람 확인 뒤 archive 이동. NON_BLOCKING N8·N9 는 한 줄 정정 후보.

## 사용자 확인 (2026-10-13)

- D-003(PRD/TRD 정정 깊이) "이 범위로 괜찮다" · D-007(AGENTS 범위) "Ok" — 남은 사람 확인 0, 보드 행을 archive 로 옮긴다.
- NEXT_HANDOFF 중 X1(프로덕션 DevTools 차단)·X5(`allowDangerouslySkipPermissions` 전달)는 사용자 지시로 **0261** 에서 다룬다. X2·X3·X4 와 NON_BLOCKING N4·N7~N9 는 후보로 남는다.

