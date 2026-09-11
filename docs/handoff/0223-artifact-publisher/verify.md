# Verify — artifact-publisher

라운드 2 판정은 **PASS (기계 검증 범위)** 다. 사용자가 "뒤의 핸드오프에서 구현했으므로 `impl/IMPL_DONE` 과 같다"고 확정해, Q-04/D-023 과 D-022 를 **구현으로 답해진 결정**으로 놓고 다시 평가했다. 남은 것은 사람 인수 3건과 plan 규범 행 정정 1건이다.

[라운드 1 원문](#라운드-1--plandraft-전제)은 아래에 그대로 둔다.

## 메타

| 항목 | 값 |
|---|---|
| 검증자 / 일자 | Claude / 2026-09-11 |
| 대상 handoff | `docs/handoff/0223-artifact-publisher/` |
| 검증 대상 트리 | **HEAD `6048d551`** |
| 전제 | 사용자 확정 — 후속 핸드오프 구현으로 `impl/IMPL_DONE` 과 동등 |
| 판정 | **PASS (기계 검증 범위)** · 사람 인수 3 · 규범 행 정정 1 |

---

# 라운드 2 — `impl/IMPL_DONE` 전제 재평가

## r2-1. 전제가 바꾸는 것

r1 은 보드의 `plan/DRAFT` 를 그대로 받아 Q-04 를 미결로 두었고, 그래서 AC2·AC18 을 **위반**으로 읽었다. 사용자가 구현 완료를 확정하면 같은 사실이 다르게 읽힌다.

| 계약 | r1 판정 | r2 판정 | 근거 |
|---|---|---|---|
| AC2 / D-023 | `PAIR_FAIL` | **SUPERSEDED** | 사용자가 자동 수집 채택을 확정 |
| AC18 / D-022 | `PAIR_FAIL` | **SUPERSEDED** | "다음 단계"가 도래해 구현됨 |

따라서 r2 의 과제는 계약 위반 여부가 아니라 **구현된 동작이 옳은가** 다. r1 이 하지 않은 검증이다.

## r2-2. r1 의 사실 오인 — 정정

r1 은 AC2 를 두고 "성공한 `Write`·`Edit` 마다 게시 행이 생긴다"고 적었다. **이것은 틀렸다.** 캡처 경로를 끝까지 읽지 않은 결과다.

`readOutputInput(path, temporaryRoot, signal)`(`features/artifacts/files.ts:172`)이 후보를 **지정된 OS Temp 출력 디렉토리 직속 파일로 한정**한다.

- `dirname(candidate)` 가 출력 루트가 아니면 `undefined` 로 되돌린다 — 하위 폴더도 제외
- `lstat` 심링크·비정규 파일은 `unsafe-path`
- `readStableFile` 이 `MAX_OUTPUT_BYTES` 로 상한을 건다
- 읽기 전후 `lstat` 를 `sameFile` 로 대조해 TOCTOU 를 `file-changed` 로 거른다
- `isInputFile` 이 사용자 제공 첨부의 재게시를 막는다

테스트가 이를 잠근다 — `service.test.ts:232`, `ignores intermediate and unrelated paths…`: 작업 폴더의 `report.md` 도, 출력 루트 하위 `work/draft.md` 도 전부 `undefined` 다.

모델은 `send.ts:132` 의 시스템 프롬프트로 그 디렉토리를 **명시적으로 지정받아** 거기에 쓸 때만 산출물이 된다. 감시기도 파일시스템 스캔도 없다. 이는 Q-04 의 선택지 중 "성공한 파일 도구 결과에서 자동 발견"보다 **"모델의 명시적 등록"에 가까운 하이브리드**다. r1 이 전자로 단정한 것을 정정한다.

## r2-3. 구현된 동작의 잠금 — 변이 6종

r1 의 M1~M3 에 더해, r2 가 대체 계약의 핵심 가드를 겨냥해 6종을 신설·재실행했다.

| 변이 | 겨냥한 계약 | 결과 |
|---|---|---|
| N1 `isInputFile` 가드 제거 | 사용자 첨부 재게시 금지 | **red** 1케이스 |
| N2 `realpath` 루트 재확인 제거 | 경로 이탈 심층 방어 | **green** — 아래 D8 |
| N3 출력 디렉토리 한정 제거 | 캡처 범위 (대체 AC2 의 핵심) | **red** 1케이스 |
| N4 훅의 `Write`/`Edit` 필터 제거 | 도구 종류 한정 | **red** 1케이스 |
| N5 URL protocol·자격증명 가드 제거 | 컨텍스트 수집 위생 (대체 AC18) | **red** 1케이스 |
| N6 소유 메시지를 마지막 메시지로 강제 | AC5 귀속 — **plan 등록 변이** | **red** 8케이스 |

여섯 모두 원복 후 green 을 확인했고 트리는 깨끗하다. 대체 계약의 핵심 가드 넷(N1·N3·N4·N5)이 전부 잠겨 있다.

## r2-4. AC5 는 이제 닫힌다

r1 구현 보고는 AC5 를 미완료로 남겼으나 **HEAD 에서는 닫힌다**. plan 이 VP-05 에 등록한 적대 증거("현재 마지막 메시지로 강제 시 실패")를 그대로 심어 red 를 얻었다(N6, 8케이스).

직접 oracle 도 있다 — `chatStore.artifacts.test.ts`:

- `:64` 중첩 지연 완료가 **원래 호출에만** 붙는다
- `:123` 알 수 없는 세션의 캡처가 같은 call id 의 draft 로 **떨어지지 않는다**
- `:95` 배경 세션 캡처가 턴을 시작하거나 live 텍스트를 지우지 않는다

## r2-5. pair 재판정

| Pair | AC | r1 | **r2** | 증거 |
|---|---|---|---|---|
| VP-U1 | AC17 | PASS | **PASS** | M1·M2 red |
| VP-U2 | AC18 | PAIR_FAIL | **PASS** (대체 계약) | N5 red · 수집 테스트 7케이스 |
| VP-U3 | AC19 | PASS | **PASS** | M3 red |
| VP-U4 | SD-05 | PASS | **PASS** | 수명 가드 보존 |
| VP-U5 | AR-04 | PASS | **PASS** | M1·M2 공유 |
| VP-42 | MD-03 | PASS | **PASS** | 회귀 green |
| VP-02 | AC2 | PAIR_FAIL | **PASS** (대체 계약) | N1·N3·N4 red |
| VP-05 | AC5 | 미종결 | **PASS** | N6 red (r2-4) |
| VP-12 | AC12 | 미종결 | **PASS** | 전체 스위트 0 fail |
| VP-03·40 | AC3 | — | **PASS** | 경로·형식·상한 직접 단언. D8 부수 |
| VP-11/14/15/90 | 회귀 | PASS | **PASS** | 0 fail |
| VP-01 | AC1 | 미종결 | **사람** | 실제 유료 모델 자율 호출 |
| VP-13 | AC13 | 미종결 | **사람** | 모델 평가 집계 |
| VP-06·16 | AC6·16 | BLOCKED | **사람** | native 저장 대화상자·탐색기 |

기계 판정 가능한 pair는 **전부 PASS** 다. 남은 셋은 유료 모델 실행과 OS native shell 이라 대체 핸들이 없다.

## r2-6. 게이트 재실행

| Gate | 산출 |
|---|---|
| typecheck | 3개 프로젝트 exit 0 |
| eslint (`--fix` 없이) | 0 error · 1 warning (기존, 무관) |
| vitest 전체 | 477파일 / 4469케이스 → **4466 pass · 3 skip · 0 fail** |
| vitest 대상 스위트 | 220파일 / 1901케이스 → 1899 pass · 2 skip · 0 fail |
| doc inventory | 9 items · 92 channels · 링크 전부 해석 |
| `git diff --check` | clean |

실패 6파일은 전부 import 시점 `Electron failed to install correctly` 이고 케이스 실패는 0이다. `better-sqlite3` 는 `npm rebuild`(Node ABI) 로 해소했다.

## r2-7. 새 발견

| ID | 발견 | 범위 |
|---|---|---|
| **D8** | `readOutputInput` 의 `realpath` 루트 재확인(`files.ts:191`)을 지워도 스위트가 침묵한다(N2 green) | **NON_BLOCKING** |

D8 을 과장하지 않는다. 프로덕션에서 `prepareOutputDirectory` 가 항상 `unredirectedDirectory` 로 해소한 루트를 넘기므로 이 분기는 **현재 배선에서 도달 불가한 심층 방어**다. 심링크 자체는 앞선 `lstat` 가 이미 잡는다(N2 를 걸어도 심링크 케이스는 red 로 남는다). 따라서 악용 가능한 구멍이 아니라 **잠기지 않은 방어선**이며, 호출자가 해소되지 않은 디렉토리를 넘기는 날 조용히 사라진다. 회귀 케이스 1개를 권한다.

r1 의 D1·D4·D6·D7 은 그대로 유지된다. D2·D3 는 위 전제 변경으로 `SUPERSEDED` 로 바뀐다. D5(`Handoff: none` 로 들어온 74파일 기능 커밋)는 **사실로 남는다** — 판정을 바꾸지 않지만 프로세스 기록이다.

## r2-8. 남는 일

| # | 항목 | 주체 |
|---|---|---|
| 1 | AC2·AC18 규범 행을 채택된 방향으로 다시 쓴다 (구현은 완료, 문서만 낡음) | Claude (설계) |
| 2 | 실제 유료 모델로 publisher 자율 호출·누락/오게시 집계 (AC1·AC13) | 사람 |
| 3 | 설치 앱에서 저장 대화상자·탐색기 종단 (AC6·AC16) | 사람 |
| 4 | D8 회귀 케이스 1개 | 다음 핸드오프 |

1번은 제품 결정이 아니라 **기록 정정**이다. 사용자가 방향을 확정했으므로 설계자가 기계적으로 수행한다.

## r2-9. Review Signals — 사실만

- **r1 과 동일 증상인가**: 아니다. 전제가 바뀌어 같은 코드가 다르게 판정됐다.
- **r1 이 틀린 지점**: 캡처 경로를 `createPublication` 까지만 따라가고 `readOutputInput` 의 한정을 읽지 않아 범위를 과대 진술했다(r2-2). 판정 자체는 전제에서 나왔지만 **사실 서술에 오류가 있었다**.
- **검증 환경 한계**: 유료 모델·native shell 은 이 환경에서 불가. Electron 바이너리 부재 6파일.
- **구조적 사실**: 보드가 `plan/DRAFT` 인 채 후속 핸드오프 둘이 같은 표면을 구현해, 보드만 읽으면 실제 구현 상태를 알 수 없었다.

## r2-10. 결론

**PASS (기계 검증 범위).** 기계 판정 가능한 모든 pair 가 PASS 고, 대체 계약의 핵심 가드 넷이 변이로 잠겨 있으며, 게이트 6종이 통과했다(케이스 실패 0).

배포 수용은 사람 인수 3건(실제 모델 2 · native 1)에 달려 있다. plan 의 AC2·AC18 문구는 구현을 따라오지 못한 상태이므로 설계자가 정정한다.

---

# 라운드 1 — `plan/DRAFT` 전제

> 아래는 r1 원문이다. 보드의 `plan/DRAFT` 를 그대로 받아 Q-04 를 미결로 둔 판정이며, r2-1·r2-2 가 전제와 사실 오인을 정정한다.

## 0. 기준선 / plan 변경 확인

기준선은 diff로 성립한다. 설계 커밋과 구현 커밋이 갈려 있어 §0의 자기 증명 방지 장치가 작동했다.

| 확인 | 관측 |
|---|---|
| AC 행 변경 | **없음**. `dd378d34`·`04953cf7`의 `plan.md` diff에 §7 AC 표·§7-A pair 표 수정이 없다 |
| Decision Ledger 변경 | 없음 |
| 메타 상태 변경 | **있음** — `04953cf7`(구현 커밋)이 `상태`를 `READY` → `DRAFT`로 내렸다 |

메타 상태 강등은 AC 완화가 아니라 구현자가 스스로 미완을 선언한 것이라 채점 기준을 흔들지 않는다. 다만 규범 행 수정은 설계 커밋의 몫이고 구현 산출과 같은 커밋에 담지 않는다(root `AGENTS.md` 커밋 프로토콜). D1로 남긴다.

### 검증 대상 트리를 HEAD로 잡은 이유

`04953cf7` 시점 코드는 더 이상 배포되지 않는다. r2가 만진 **app 파일 13개가 전부 이후에 다시 바뀌었다** — `ArtifactCard.tsx` 7회, `TaskTileContent.tsx`·`rightPanelTiles.ts` 각 4회. 0224·0226이 같은 우측 패널을 재작업했다. 따라서 r2 스냅샷이 아니라 **현재 production 상태**에서 0223의 계약이 성립하는지 판정한다.

### Plan validity

| 축 | 판정 |
|---|---|
| V mode | Baseline V1 + ΔV1. 상속 기준·revision·기준 커밋(`dd378d34`)이 명시돼 유효 V 재구성 가능 |
| pair 정합 | ΔV1의 `NEW` 3쌍·`CHANGED` 2쌍·`REGRESSION` 4쌍이 같은 레벨로 대응 |
| §10 분모 | EP-U1(3)·EP-U2(3)·EP-U3(2)·EP-U4(3) = 11 지점. 검증자가 전수 재열거했다(§5) |
| gap | **있음** — D-023/Q-04가 OPEN인데 HEAD 코드가 그 결정을 이미 내렸다(§2) |

## 1. Product & UX / ACTIVE Decision

| Decision | 계약 | HEAD 관측 |
|---|---|---|
| D-020 | 독립 `산출물` 타일 제거, 작업 타일에 세 섹션 복원 | **충족** |
| D-021 | transcript는 문서 카드, 출력은 작은 행 | **충족** |
| D-022 | 컨텍스트는 영역만 복원. 참조 리소스 수집·항목 표시는 **다음 단계** | **위반** — 수집이 구현·배선됐다 |
| D-023 / Q-04 | 일반 생성물 발견/등록 기준은 사용자 답변 후 확정. 답변 전 승격·watcher 추가 금지 | **위반** — PostToolUse 훅이 배선됐다 |

D-022·D-023은 이후 핸드오프가 명시적으로 **승계·보존**했다. 대체된 적이 없다.

- `0224/plan.md:38` — "컨텍스트는 실제 참조한 리소스이며 **수집은 다음 단계**"
- `0224/plan.md:151` — "0223 Q-04 유지. **발견/등록 기준 결정 전 watcher·자동 탐색 추가 없음**"
- `0226/plan.md:39` — "0223의 일반 생성물 자동 수집 **Q-04는 본 작업에서 결정하지 않는다**"
- `0226/plan.md:159` — "기존 일반 생성물 정책을 덮어쓰지 않는다"

## 2. 구현 결과 비판적 검토 — 근원 발견

두 위반의 근원은 **`45b1d43d` `feat(work): collect file outputs and add artifact catalog`** 한 커밋이다. 74파일·3579 insertion 규모이며 trailer가 **`Handoff: none`** 이다.

root `AGENTS.md`의 `Handoff: none` 예외는 *트리비얼(오타·주석·한두 줄)* 과 *핸드오프 인프라 자체* 뿐이다. 이 커밋은 둘 다 아니다. 설계 턴 없이 사용자 유보 결정을 코드로 확정했다.

### AC2 위반 — publisher 미호출 경로가 게시를 만든다

AC2/R-02: *"publisher 미호출 시 파일 생성/수정만으로 게시되지 않음. 부팅~종료에 감시기·scan·후보 주입 배선 없음"*

`app/src/main/adapters/claude-output-files.ts:177` `makeOutputFilesHook`이 훅 2개를 건다.

- `PostToolUse` — `Write`·`Edit` 성공 결과마다 `outputFiles.capture(filePath, …)` 호출
- `Stop` — 마지막 assistant 메시지의 Markdown 링크를 긁어 같은 경로로 캡처

`capture`는 `features/artifacts/output-files.ts:17` → `service.captureOutput` → **`service.ts:155` `queries.createPublication(...)`** 로 이어진다. publisher 도구 호출 없이 **게시 행이 생성된다**. AC2가 금지한 "후보 주입 배선"이 정확히 이것이다.

정확히 적는다 — 자동 캡처 행은 `category: 'file'` 이고, 카탈로그 조회는 `artifact-queries.ts:78` 에서 `WHERE f.category = 'artifact'` 로 거른다. 따라서 **아티팩트 카탈로그 화면에는 뜨지 않는다**. 그러나 `listLatest`는 category를 가리지 않아 세션 출력 목록에는 올라가고, 무엇보다 Q-04가 물었던 "성공한 파일 도구 결과에서 찾을지"가 **답변 없이 채택된 상태**다.

### AC18 위반 — 컨텍스트가 실제 참조 항목을 만든다

AC18/R-18: *"컨텍스트는 미수집 상태를 표시하고 실제 참조 항목을 만들지 않음"*

`features/chat/lib/taskContext.ts`(신규)가 `TaskContextSource = web | file | attachment` 를 정의하고 세션 메시지에서 수집한다. `TaskContextContent.tsx:19` 가 `sources = selectSources(messages)` 로 소비해 렌더한다.

계약이 뒤집혔을 뿐 아니라 **테스트가 반대 동작을 잠갔다** — `TaskContextContent.test.ts` 가 웹 소스 렌더·첨부 표시·디렉토리 버튼을 단언한다. 이 상태에서 AC18로 되돌리려면 테스트를 함께 바꿔야 하므로, 구현자 단독 판단으로 닫을 수 없다.

## 3. 역방향 탐색

`scan-surface.sh 538828ab..04953cf7` 후보를 HEAD에서 직접 확인했다.

| 후보 | 프로덕션 참조(정의 파일 밖) | 자체 파일 내 사용 | 판정 |
|---|---|---|---|
| `isRightPanelTileId` | 0 | 1 | NON_BLOCKING |
| `MENU_HIDDEN_RIGHT_PANEL_TILES` | 0 | 2 | NON_BLOCKING |
| `rightPanelTileIds` | 0 | 2 | NON_BLOCKING |
| `visibleRightPanelTileDefinitions` | 0 | 2 | NON_BLOCKING |
| `defaultRightPanelTileLabelKey` | 0 | 1 | NON_BLOCKING |
| `isRightPanelTileSuspended` | 0 | 3 | NON_BLOCKING |

여섯 다 `lib/rightPanelTiles.ts` 내부에서 실제로 쓰인다. 죽은 코드가 아니라 **테스트 전용으로 넓어진 export 표면**이다. 현재 pair·ACTIVE Decision에 귀속되지 않아 PASS를 막지 않는다(D4).

형제 파일 정책 비대칭 0건.

## 4. 구현 보고를 증거로 쓰지 않았다

`ui-impl.md`의 `12/18`·`EP 11/11 SELF_PASS`를 출발점으로만 쓰고 전부 재측정했다. 자기보고 합계는 본문 `12/18` ↔ trailer `Criteria-Met: 12/18` 로 일치했다(갈림 없음).

구현자는 Codex, 검증자는 Claude로 서로 달라 자기검증 분모 규칙은 적용 대상이 아니다. 그럼에도 등록되지 않은 독립 변이 1종(M3)을 추가했다.

## 5. V-pair closeout

### §10 강제 지점 독립 재열거 — 11/11

| EP | plan N | 검증자 재열거 | 관측 |
|---|---|---|---|
| EP-U1 a/b/c | 3 | 3 | catalog는 `plan·subagent·task·diff`(`rightPanelTiles.ts:10-13`), registry에 `artifacts` 없음, `TaskTileContent.tsx:26-30` 이 progress→output→context |
| EP-U2 a/b/c | 3 | 3 | `ArtifactCard.tsx:12` `variant?: 'transcript' \| 'list'`, `ArtifactCards` 전달, `TaskOutputContent.tsx:49` `variant="list"` |
| EP-U3 a/b | 2 | 2 | `TaskOutputContent.tsx:11-15` 세션 전환 처리, `artifactStore.ts` `lifetime`·`listUsers`·`request` 가드 보존 |
| EP-U4 | 3 | 3 | plan 메타·ui-plan·INDEX 세 사본은 서로 일치. **그러나 HEAD 코드와 불일치**(§2) → 실패 |

EP-U1~U3은 지점 수와 내용이 일치한다. **EP-U4는 지점은 3/3 존재하나 계약("확정 UI와 미정 Q-04를 일치시킴")이 깨졌다** — 문서는 Q-04를 미정이라 말하는데 코드는 이미 결정했다.

### 등록 변이 재실행 — red 유지, 덮개 회귀 없음

| 변이 | 출처 | r2 관측 | 이번 재측정 |
|---|---|---|---|
| M1 출력 섹션 제거 | 등록(VP-U1/U5) | red | **red** — 4파일 6케이스 |
| M2 진행↔컨텍스트 슬롯 교환 | 등록(VP-U1/U5) | red | **red** — 3파일 3케이스 |
| M3 `variant` 판정 반전 | **검증자 신설** | — | **red** — 5케이스 |

M3은 형제 슬롯 계약이 다를 때 소거만으로 부족하다는 규칙에 따라 추가했다. 두 표현이 실제로 구분돼 잠겨 있다. 세 변이 모두 원복 후 green을 확인했고 트리는 깨끗하다.

### pair 판정

| Pair | AC | 판정 | 근거 |
|---|---|---|---|
| VP-U1 | AC17 | **PASS** | EP-U1 3/3, M1·M2 red |
| VP-U2 | **AC18** | **PAIR_FAIL** | 컨텍스트 수집이 구현·배선·테스트 잠금 (§2) |
| VP-U3 | AC19 | **PASS** | EP-U2 3/3, M3 red |
| VP-U4 | SD-05 | **PASS** | EP-U3 2/2, 수명 가드 보존 |
| VP-U5 | AR-04 | **PASS** | M1·M2 공유 증거 |
| VP-42 | MD-03 | **PASS** | 카드 ID·액션 수명 회귀 green |
| VP-06 | AC6 | **BLOCKED** | native 저장/탐색기 종단은 사람 실기 (r2와 동일, 미해소) |
| VP-02 | **AC2** | **PAIR_FAIL** | publisher 미호출 게시 경로 (§2) |
| VP-11/14/15/90 | 회귀 | **PASS** | 전체 스위트 0 fail |
| VP-01·12·13·16 | AC1·12·13·16 | **미종결** | 실제 모델 호출·평가 인수가 r1 이후 재실행된 적 없다 |

AC 합계: ΔV1 확정 UI 4행 중 **3 PASS · 1 PAIR_FAIL**. 기준 V1의 6개 미완료는 그대로 남는다.

### 현재 변경의 운영 gate

| Gate | 명령 | 산출 관측 |
|---|---|---|
| typecheck | `npm run typecheck` | node·web·test 3개 프로젝트 exit 0 |
| eslint | `./node_modules/.bin/eslint ./src ./scripts` | **0 error · 1 warning**(기존 TanStack Virtual, 무관) |
| vitest | `./node_modules/.bin/vitest run` | **477파일 / 4469케이스 → 4466 pass · 3 skip · 0 fail** |
| doc inventory | `node scripts/check-doc-inventory.mjs --check` | 9 items · 92 channels · 상대 링크 전부 해석 |
| whitespace | `git diff --check` | clean |

`npm run lint`은 `--fix`라 작업 트리를 쓴다. 검증자가 고친 코드를 검증자가 채점하지 않도록 **`--fix` 없는 eslint를 직접 호출**했고, 실행 후 `git status --porcelain` 이 비어 있음을 확인했다.

vitest 실패 6파일은 전부 **import 시점** `Electron failed to install correctly` 다. 케이스 실패는 0이다. `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 설치해 electron 바이너리가 없는 환경 제약이며, `npm rebuild better-sqlite3`(Node ABI) 전에는 30파일·173케이스가 `Module did not self-register: better_sqlite3.node` 로 red였다가 rebuild 후 전부 green이 됐다. 두 서명 모두 `app/AGENTS.md` 의 알려진 제약 환경 signature이고 변경과 무관하다.

## 6. 테스트 가능한 핸들 탐색 후 남는 사람 실기

- 설치 앱의 실제 저장 대화상자·탐색기 열기(AC6) — native shell 경계라 대체 불가
- 실제 유료 모델의 publisher 자율 호출과 누락·오게시 평가(AC1·AC13)

UI 조립·수명·상태 로직은 전부 기계 검증했다. "UI라서"를 이유로 넘긴 항목은 없다.

## 7. Repository operation checks

| 항목 | 관측 | 조치 |
|---|---|---|
| INDEX 대상 커밋 | `(r2 구현 — 검증자 기입)` 자리표시자 | **`04953cf7` 로 채웠다**. `git cat-file -t` 확인 |
| INDEX 상태 | `plan/DRAFT` · 다음 주체 Codex | 검증 결과로 갱신 |
| trailer 파싱 | `04953cf7` 6키·`45b1d43d` 5키 모두 정상 반환 | — |
| `45b1d43d` trailer | `Handoff: none` + `Criteria-Met: 7/7` | **위반 2건** — 예외 범위 밖 · `Criteria-*`는 핸드오프 구현 커밋 전용 |
| 인용 해시 | `e520d1f6`·`dd378d34`·`538828ab`·`74355f6d`·`04953cf7`·`45b1d43d` 전부 실재 | — |

이 저장소는 얕은 클론으로 도착해 `e520d1f6` 가 HEAD 조상이 아니었다. `git fetch --unshallow` 로 77 → 1498 커밋을 복원한 뒤에야 기준선이 성립했다. 다음 라운드도 같은 조치가 필요하다.

## 8. Finding disposition

| ID | 발견 | 범위 |
|---|---|---|
| **D1** | 구현 커밋 `04953cf7` 이 plan 메타 상태를 `READY`→`DRAFT`로 수정 | NON_BLOCKING — 규범 행은 설계 커밋 몫 |
| **D2** | **AC2 위반** — PostToolUse `Write`/`Edit` 훅이 publisher 없이 `createPublication` | **BLOCKING / PAIR_FAIL(VP-02)** |
| **D3** | **AC18·D-022 위반** — 컨텍스트 참조 항목 수집이 구현되고 테스트가 반대 동작을 잠금 | **BLOCKING / PAIR_FAIL(VP-U2)** |
| **D4** | `rightPanelTiles.ts` export 6개가 테스트 전용 표면 | NON_BLOCKING |
| **D5** | `45b1d43d` 가 `Handoff: none` 으로 74파일 기능 변경 + 사용자 유보 결정 확정 | **PLAN_GAP 근원** |
| **D6** | `TaskScheduleContent` 가 세 섹션 앞에 추가됨(0224/0226 산물) | NON_BLOCKING — AC17은 세 섹션의 상대 순서만 요구 |
| **D7** | VP-01·12·13·16(AC1·12·13·16) 인수가 r1 이후 재실행된 적 없음 | 미종결 — 사람 실기 대기 |

## 9. PLAN_GAP

**근원**: D-023/Q-04 는 사용자에게 유보된 제품 결정인데, HEAD 코드가 한쪽(성공한 파일 도구 결과에서 자동 수집)을 이미 채택했다. 같은 커밋이 D-022가 "다음 단계"로 미룬 컨텍스트 수집까지 구현했다.

**영향 pair**: VP-02(AC2) · VP-U2(AC18). 둘 다 REQUIRED.

구현자는 이 둘을 스스로 닫을 수 없다. 되돌리면 이미 배포된 0224·0226 기능이 깨지고, 두면 0223의 ACTIVE 계약이 거짓이 된다. **어느 쪽이 제품 의도인지는 사용자만 답할 수 있다.**

설계자가 답변을 받은 뒤 고쳐야 할 규범 행:

1. D-023/Q-04 를 `ACTIVE`(자동 수집 채택) 또는 유지로 확정
2. 확정에 맞춰 **AC2 의 "감시기·scan·후보 주입 배선 없음" 문구**를 새 Delta V revision으로 정정하거나, 훅 제거를 구현 과제로 명시
3. D-022 와 **AC18** 을 같은 방식으로 정정하거나 수집 제거를 명시
4. 정정된 계약에 맞는 §10 지점과 pair 를 다시 건다

## 10. Review Signals — 사실만

- **이전 라운드와 동일 증상인지**: 아니다. 첫 독립 검증이다. r1·r2는 자기보고만 있었다.
- **관련 plan 지침이 있었는지**: 있었다. D-023·D-022가 명시적으로 금지했고 0224·0226이 두 번 더 승계했다. 지침 부재가 아니라 **지침이 있는데 우회됐다**.
- **사용자 결정 변경 근거가 있는지**: **없다.** 어느 문서에도 Q-04 답변이나 D-022 대체 근거가 없다.
- **반복된 검증 환경 한계**: 얕은 클론으로 기준선 불가(unshallow로 해소) · electron 바이너리 없음 6파일 · better-sqlite3 ABI(rebuild로 해소) · native shell·유료 모델 실기 불가.
- **구조적 사실**: `Handoff: none` 은 기계 강제가 없는 관례다. 74파일 기능 커밋이 그 관례로 설계 턴을 건너뛰었고, 세 핸드오프가 보존한 결정이 한 커밋에 덮였다.

## 11. 결론

**RETURN_TO_PLAN.** 다음 주체는 **사람(Q-04 답변)**, 그다음 **설계자**다.

ΔV1 확정 UI 범위는 실제로 성립한다 — VP-U1·U3·U4·U5·42 가 PASS 고, 등록 변이 2종과 검증자 신설 변이 1종이 모두 red 이며, 운영 gate 5종이 전부 통과했다(케이스 실패 0).

그러나 0223의 ACTIVE 계약 둘이 HEAD에서 거짓이다. 사용자가 유보한 결정이 설계 턴 없이 코드로 확정됐고, 그 되돌림 여부는 제품 결정이라 검증자가 해결안으로 위장하지 않는다.
