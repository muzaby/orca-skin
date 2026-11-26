# Plan — 0330 Windows 실창 반응성 통합 판정

> 입력(V1 rev 2): [PR #640 코멘트 — 0330 Windows 통합 판정 · 구현 전 plan 보완 요청](https://github.com/muzaby/orca-skin/pull/640#issuecomment-7179699819)(2026-11-26, 검토 기준 `eae9081b`). 지적별 코드 대조는 §0.

## 메타

| 항목 | 값 |
|---|---|
| slug · 작성 · 일자 | `0330-windows-responsiveness-verdict` · Codex(V1) → Claude Code(V1 rev 2) · 2026-11-20 / 2026-11-26 |
| 상태 | **plan/READY — WU-M(기계 범위)만.** WU-W(판정용 Windows 실측)는 W-004 확정과 H1 필수 셀 목록 고정 뒤 착수한다(W-013). 0325 AC19 참고 기준선 수집은 지금도 가능하다. |
| 기준 트리 | `eae9081b`(PR #640 head `codex-handoff-0326-plan-gap`). V1의 기준 `62125eaa`는 PR 이력에 없다(`git merge-base --is-ancestor 62125eaa eae9081b` 실패) — rev 2가 대체한다. |
| V mode · 기준 V · revision | Baseline V · none · **V1 rev 2**. 구현·verify 0회라 Delta V가 아니다. rev 1 = `a680ee0`에 포함된 V1 초안. 노드 ID는 V1을 잇고 rev 2가 더한 노드는 §7-A에 `rev 2`로 표시한다. |
| 작업 단위 | **WU-M**(지금 착수): 판독기 `windows-verdict.mjs`·시험, 측정 도구 출처 스탬프(0328 stage-d), 기준선 측정 소스 좌표(0329 stage-e), H1-0 Linux 사전 실행. **WU-W**(W-004 뒤): H1~H6 Windows 실측·판정. |

## 0. PR #640 피드백 대조 — 지적 9건 모두 재현, 수용

외부 피드백은 입력이다(`docs/handoff/AGENTS.md §외부 리뷰는 verify를 대체하지 않는다`). 아래는 이번 턴에 코드·이력으로 다시 잰 결과다.

| # | 지적 | 재현 명령 → 관측 | 판정 · 반영 |
|---|---|---|---|
| F1 | 소유 유효 계약·PASS 커밋 | `git merge-base --is-ancestor <h> eae9081b` → `d8684684`·`7c241d19`·`c7d2adf2`·`7db1c7ce`·`eae9081b` 5/5 성공. 원 브랜치 사본 `d3033986`(0327, `origin/ccr-4767226e-xqwgpk`)·`421d2393`(0329, `origin/ccr-ca3d795a-2t0cmj`)은 tree가 PR 쪽과 같다(`93ac467a`·`646de0b9`) | 수용 → W-007 · §6 · H1 표 |
| F2 | §8 “진단 등록 호출 0”·“J3/J8 불일치” | `main.tsx:23-26`이 `VITE_OO_DIAGNOSTIC === '1'`일 때 `installTranscriptDevTools()` 호출. J3 `measure-ui-inputs.mjs:825` “index 1 산출물” ↔ 0326 §19 J3 “index 1 산출물 교체”, J8 `:873` “앞삽입 1턴 · 기존 1/100턴” ↔ J8 “읽은 1·100 턴” | 수용 — V1 §8 두 행이 낡았다 → §8 |
| F3 | H1에 F9 누락 | V1 H1 “C의 파일 F6~F8”. `writeInputs`(`measure-ui-inputs.mjs:919-923`)가 `visibleInputs()`(`visible-views/measure.mjs:27-41` — F9 = `table-1600.md`·`table-2001.md`·`footnote-60k.md`·`single-line-1mb.json`)까지 쓴다 | 수용 → H1-0 |
| F3′ | (설계자 추가) 0327 §19 진단 다리 이름 | 0327 plan §19가 `__ooDev.computeTimings()`·`setVirtualRows(false)`를 적지만 실제 API는 `startComputeTimings()`·`finishComputeTimings()`(`transcriptFixtures.ts:243-244`)이고 `setVirtualRows`는 `rg -n setVirtualRows app/src` 0건 | 사전 실행은 실제 이름으로 한다 → H1-0. 0327 문서 정정은 비귀속(INDEX 후보 아님 — 0330 H1이 실행 정본) |
| F4 | `measure-stage-d.mjs` 환경 고정 | `rg -n linux-electron app/scripts -g '!*.test.*'` → 생산 5자리(`measure-stage-d.mjs:51`·`:114`·`:128`·`stage-d-host/electron-main.mjs:86`·`stage-d-shell/probe.ts:281`) + 소비 1(`stage-d/measurement.mjs:63` — `compatibleRun`이 `linux-electron`만 받음). geometry·overlap·interactions·installer 기록은 환경·SHA가 아예 없다(`stage-d/electron-main.mjs:40-138`) | 수용 + 소비 자리 추가 → W-012 · AC8 · VP-11·13 |
| F5 | `measure-stage-e.mjs --baseline`의 `3d8e1d90` | `3d8e1d90`은 `origin/ccr-ca3d795a-2t0cmj`에만 있고 PR head의 조상이 아니다. 같은 blob `1c4bcb1a`가 PR 조상 `4412276f`에 있다(`git rev-parse 4412276f:app/scripts/stage-e/host.ts`). 0329 plan:1068의 재현 문장 “이 커밋의 …”은 커밋을 특정하지 않는다 | 수용 → W-012 · AC9 · VP-12 · H1 |
| F6 | T09 일반 열기 주 경로 | `session-load.ts:91-119` `page()` — `HistoryPageReplySchema.safeParse` + 세션·요청·세대 대조. V1 §12 T09 행은 조각 경로(`:54` `SessionLoadChunkSchema` · `:63` `assembleSession`)만 적었다 | 수용 → W-009 · §12 |
| F7 | H3·H4 사용자 동작·기대 결과 | 원표 좌표 실재 확인: 0326 D-109(plan:165 · §19:1705-1725) · 0327 ΔV1 적용표(:21-32) · 0327 실행표(:1994-2005) · 0328(:437-456) · 0329 AC10(:524-533) | 수용 → W-008 · H3 · H4 |
| F8 | W-004·판독기·H6 | V1 W-004에 IME·터치패드·필수/기록 전용 칸이 없고, 판독기 시험에 재제출·상충·기능 부재/위반·장비 누락이 없으며, H6에 열 분리가 없다 | 수용 → W-004 · W-011 · AC7 · H6 |
| F9 | 0329 NX1~NX3 | INDEX `## 새 handoff 후보` 0329 행에 이미 있다 | 유지(새 행 없음) |

# Part I — 사용자와 테스터가 받는 결과

## 1. 목표

사용자는 목표 Windows 장비에서 **스트리밍 중에도 한글 입력·스크롤·선택·세션 전환이 허용 시간 안에 끝나는지** 결정한다. 판정표의 각 행에서 원본 trace나 설치본 로그의 해당 구간과 그 동작을 맡은 핸드오프까지 찾을 수 있어야 한다.

WU-M이 끝나면 테스터는 같은 명령으로 빌드·입력·측정 도구를 깨끗한 체크아웃에서 재현하고, 판독기가 합성 입력과 실제 기록을 같은 규칙으로 판정하는 것을 CI에서 확인할 수 있다.

## 2. 사용자 의도와 근거

| 구분 | 요구 · 근거 |
|---|---|
| 명시 요구 (V1) | “327 구현전에 328 329 330 플랜 만듷수잇나?”에 이어 “작성하라”. D·E·W를 각각 계획하며 이번 산출은 계획서다. |
| 측정 시점 | “목표 장비의 허용치는 측정 전에 합의한다.” 0325 D-024가 허용치 결정 전에도 AC19 기준선을 수집하게 했다. [원요청 Windows 절](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md) · [0325 §3·§19](../0325-ui-responsiveness-followup/plan.md) |
| 검증 범위 | “각 담당자가 T01–T33별로 수정·검증 완료, 현행 유지 근거, 또는 미검증 환경과 잔여 위험을 명시한다.” |
| 명시 요구 (rev 2) | PR #640 코멘트: “아래 내용을 한 번에 반영해 주세요.” · “지금은 plan 개정·합성 입력 판독기 준비·0325 AC19 참고 기준선 수집을 진행할 수 있습니다. 위 계약과 재현 경로를 맞추고 W-004 사전 합의와 필수 셀 목록을 고정한 뒤 판정용 Windows 실측을 시작해 주세요.” |
| 설계 판단 | 소유자 실기 결과와 최종 통합 빌드는 서로 다른 질문에 답한다. 장비·입력·빌드·시나리오가 일치하는 원본을 한 번만 수집하고 필요한 행에서 같은 좌표를 인용한다. |

## 3. Decision Ledger

| ID | 결정 | 출처 · 조건 | 상태 |
|---|---|---|---|
| W-001 | W가 원본 측정을 조합하고 사용자가 목표 장비의 허용치 판정을 확정한다. | 0325 D-003·D-021·D-025, 분할 승인 | ACTIVE |
| W-002 | AC19 소유자는 A 이전·이후 기준선을 모은다. 같은 실창 세션에서 0324 AC22·AC23·AC52′도 수행하고 원래 verify에 좌표를 남긴다. | 0325 D-024·D-028·D-042 | ACTIVE |
| W-003 | 0326 AC33의 D-095 기준과 0327 AC30의 기록 완료 기준을 유지한다. | V1. D-095는 0326에서 D-106 → D-109로 대체됐다(0326 plan:165·:622) | SUPERSEDED → W-007 |
| W-004 | 목표 프로필(Windows 버전·CPU/GPU·RAM·디스플레이 Hz·배율·전원 모드)과 **한국어 IME·정밀 터치패드 사용 가능 여부**, 시나리오별 **지표·단위·집계·연산자·허용값·필수/기록 전용**을 판정 실측 전에 사용자가 확정한다. 구 빌드에 없던 동작은 이전 셀의 사유와 신 빌드의 기능·절대 기준을 미리 정한다. 0326 자체 50/160ms와 0329 기계 기준선 3,729ms는 해당 소유 행에서만 쓴다. | 0325 D-025 OPEN · PR #640 코멘트 §3. 서식은 §14 | **OPEN** |
| W-005 | 비교 단위는 같은 프로필·빌드 종류·하네스·입력·동작의 교차 실행 세 쌍이다. 기존 소유자 표본·집계 규칙이 다르면 해당 행은 그 규칙으로 읽는다. | 0325 D-042, 0326 D-063·D-090, 0327 D-025 | ACTIVE |
| W-006 | 진단 경로는 로컬 계측 빌드로 한정한다. 설치본에서 production의 DevTools 차단·정상 preload와 저장 동작을 유지하고 진단 기능이 노출되지 않음을 따로 확인한다. | 앱 빌드·보안 계약, 0325 §19, 0326 §7-A “개발 메뉴 제외” | ACTIVE |
| W-007 | 소유 유효 계약과 PASS 커밋을 아래로 고정하고 모든 절·INDEX가 이 표를 가리킨다: 0325 `V1 rev 4 + ΔV1 + ΔV2` @ `d8684684` · 0326 `V1 rev 7 + ΔV1 rev 2 + ΔV2 rev 5 + ΔV3`(실기 판정 D-109) @ `7c241d19` · 0327 `V1 rev 3 + ΔV1~ΔV8` @ `c7d2adf2`(원 브랜치 `d3033986`) · 0328 `V1 rev 5 + ΔV1` @ `7db1c7ce` · 0329 `V1 rev 5 + ΔV1~ΔV7` @ `eae9081b`(원 브랜치 `421d2393`). 0326 S8/T17·S9/T18은 W의 별도 관측 행이다. | PR #640 코멘트 §1 · F1 | ACTIVE |
| W-008 | 선택·복사는 **정상 복사**와 **선택 취소** 두 결과로 판정한다. 폐기한 J9·K12와 복사 전용 50ms 기준은 필수 셀에서 제외한다. 규칙 문장은 H4 W3 행. | 0326 D-102·D-109 ⑤ · 0327 ΔV1 적용표 · PR #640 코멘트 §2 | ACTIVE |
| W-009 | 일반 열기의 주 측정 경로는 **제한 페이지 조회 → IPC 응답 → 창의 `HistoryPageReplySchema` 검증 → 상태 반영 → 첫 실제 본문 paint**다. 구 빌드의 조각 조립과 전체 archive가 필요한 실행 복구·분기는 별도 행이다. | PR #640 코멘트 §1 · F6 | ACTIVE |
| W-010 | 판독기는 `app/scripts/windows-verdict.mjs`·`windows-verdict.test.mjs`에 둔다 — `npm test`의 `node --test "scripts/*.test.mjs"`를 통해 `ci.yml` test 단계가 그대로 실행하므로 CI 파일을 바꾸지 않는다. V1의 handoff 폴더 위치를 대체한다. | 설계 판단(되돌리기 쉬움) · PR #640 코멘트 §3 “PR 자동 게이트로 운영할 경우 CI에 해당 명령을 연결” | ACTIVE |
| W-011 | 결과표는 **소유자 기계 PASS · 소유자 Windows 결과 · W 통합 판정 · 사용자 확정**을 별도 열로 둔다. 최종 통합 PASS는 하나의 통합 SHA와 하나의 기준 revision에 대한 W 필수 셀 전체가 필요하다. 수정 효과 확인은 영향 셀·교차 조작만 재실행할 수 있고 다른 SHA의 통과 셀을 합쳐 PASS를 만들지 않는다. | PR #640 코멘트 §3 · V1 H6 | ACTIVE |
| W-012 | 측정 기록은 **생성한 프로세스의 실제 플랫폼과 앱 트리 SHA**를 원본에 남긴다. 기준선 측정 소스는 PR에서 도달 가능한 커밋과 blob 해시로 고정하고, 해시가 다르거나 도달 불가면 측정을 시작하지 않는다. | PR #640 코멘트 §1 · F4·F5 | ACTIVE |
| W-013 | 순서: 지금 plan 개정·WU-M·0325 AC19 참고 기준선. W-004 확정과 H1 필수 셀 목록 고정 뒤에 판정용 Windows 실측(WU-W). 합의 전 실행은 W 최종 표본으로 승격하지 않는다. | PR #640 코멘트 “진행 순서” | ACTIVE |

**갱신 메모.** 추가 W-007~W-013, 대체 W-003 → W-007, 유지 W-001·002·004(칸 확장)·005·006. `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — W-008 ↔ AC4(W3 두 결과), W-009 ↔ AC4(T09 행), W-010 ↔ AC7(CLI 위치), W-011 ↔ AC6·AC7(열·단일 SHA), W-012 ↔ AC8·AC9, W-013 ↔ AC1·AC6(합의 전 표본 승격 금지)을 나란히 읽었다. W-004의 빈 값으로 통과할 수 있는 셀은 없다(AC7 U12·U14).

## 4. 요구 비판적 검토

- 설치본의 `perf.stall`은 50ms 미만 작업·페인트·읽던 문장의 위치를 보여주지 않는다. 설치본은 로그와 화면 동작을, 같은 소스의 진단 빌드는 프레임·React commit·layout을 관측한다.
- `build:win`은 일반 production 설치본을 만든다. `VITE_OO_DIAGNOSTIC=1`이 켜는 것은 진단 다리 등록(`main.tsx:23-26`)뿐이고 React profiling 번들·비압축·DevTools는 H1의 진단 오버레이가 따로 만든다.
- 소유자 자체 실기 기준(0324 AC22, 0326 D-109, 0328 분기 규칙, 0329 3,729ms)은 각자 판정하고 W 장비 목표로 바꾸지 않는다. 특히 `measure-stage-e.mjs`의 `latencyGate`(3,729ms, `:88-89`)는 Linux 기준이라 Windows 출력의 그 필드를 W 셀에 쓰지 않는다.
- 측정 도구 수정(F4·F5)은 0328·0329 소유 도구지만 둘 다 PASS 종료라 0330 WU-M이 W 재현을 위해 고친다. 0328의 분기 판정(R-H·R-W·R-R)은 `linux-electron` 행 기준 그대로다(0328 plan:450).

## 5. 동작과 상태

| 사건 | 결과 · 다음 행동 |
|---|---|
| 기준선 수집만 가능 | 테스터가 AC19 절차를 실행하고 A의 evidence를 작성한다. W는 기준선 좌표를 **참고 기준선**으로 보관한다. |
| 사전 합의 완료 | 측정자가 날짜·사용자 결정 출처·프로필·임계표 revision을 저장하고 기준/통합 SHA, 시나리오·필수 셀 목록을 고정한다. W 판정용 첫 실행은 그 뒤에 한다. |
| 결과 수신 | 실행 식별자와 원본 좌표를 검사한다. 같은 runId·같은 원본 해시·같은 값의 재제출은 기존 행을 참조한다. 값·원본이 다르면 양쪽을 보관하고 충돌을 해소할 때까지 그 셀을 보류한다. |
| 구 빌드만 기능 부재·재현 실패 | 관측과 이유를 기록하고 전후 계산에서 제외한다. 신 빌드의 절대 판정은 W-004 표가 그 셀에 절대 기준을 둘 때만 계속한다. |
| 신 빌드 기능 실패 | `N/A`가 아니라 위반이다(0325 §19 N/A 규칙). 소유자 결함 후보로 되돌린다. |
| 결과 부족·시나리오 무효·프로필/도구 불일치 | 해당 행은 미판정이다. 올바른 조합으로 부족한 반복만 다시 실행한다. 직전 수치와 다른 결과도 원본과 함께 보존한다. |
| 모두 비교 가능 | 기준 위반 행과 소유자를 제시한다. 사용자 확정 전에는 `판정 보류(사용자 확정 대기)`, 판정일·결정 출처를 받은 뒤 `합격`을 기록한다. |

## 6. 범위와 원본 증거

| 원본 · 유효 계약(W-007) | 이번 판정에서 쓰는 증거 |
|---|---|
| [0324 AC22·AC23·AC52′ 및 §19](../0324-execution-contexts-ui-responsiveness/plan.md) · PASS `ee8ac81` | AC22 8개 조작과 B1·B2·B8 예외의 원인, AC23 설치본의 강조·세션 열기·전송 응답·호스트/워커 오류와 프로세스별 메모리, AC52′ 실제 sandbox 창의 본 화면. [원래 verify](../0324-execution-contexts-ui-responsiveness/verify.md)에도 같은 세션의 증거를 연결한다. |
| [0325 AC19 §19](../0325-ui-responsiveness-followup/plan.md) · `V1 rev 4 + ΔV1 + ΔV2` @ `d8684684` | `ee8ac81` ↔ `d8684684`, S1~S8, F1~F5·I1~I9의 진단/설치/Windows 함수 재측정 세 벌. 기록 완결은 0325가 판정한다. |
| [0326 AC33 §19](../0326-transcript-incremental-model/plan.md) · `V1 rev 7 + ΔV1 rev 2 + ΔV2 rev 5 + ΔV3` @ `7c241d19` | `d8684684` ↔ `7c241d19`. S1~S9 및 S7d를 D-109 표대로(H4 “긴 대화” 행). J 계수·함수 표는 순수 측정으로 보존한다. |
| [0327 AC30 §19](../0327-worker-protocol-visible-views/plan.md) · `V1 rev 3 + ΔV1~ΔV8` @ `c7d2adf2` | `7c241d19` ↔ `c7d2adf2`. S-C0~S-C9, F5~F9·K1~K11·K13. K12와 복사 전용 50ms는 제외(W-008). |
| [0328 §19](../0328-composer-panels-lists-shell/plan.md) · `V1 rev 5 + ΔV1` @ `7db1c7ce` | `c7d2adf2` ↔ `7db1c7ce`. S-D1~S-D10(S-D10a/b/c 분리), R-H·R-W·R-R 결정. [Linux 원본과 Windows 재현 항목](../0328-composer-panels-lists-shell/evidence/r1.2-measurements.md) |
| [0329 §19](../0329-turn-history-paging/plan.md) · `V1 rev 5 + ΔV1~ΔV7` @ `eae9081b` | `7db1c7ce` ↔ `eae9081b`. S-E1~S-E5, 구 DB `small`·`long`. |

제품 수정, 새 SLA 선정, 원소유자의 기계 PASS 선언은 해당 결정권자에게 귀속한다. W는 원자료 수집·재현·검산과 통합 빌드에서 되돌아온 결함의 식별을, WU-M은 그 재현·판정 도구를 맡는다.

## 7. Requirements / Acceptance

| R ↔ AT · AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| R-01 ↔ AT-01 / AC1 | 같은 장비에서 같은 시나리오를 세 쌍 비교한 행은 원본 6개와 연결된다. 프로필·단위·빌드 종류를 뒤섞은 행은 보류된다. | 같은 표본에서 Hz만 바꾸거나 설치/진단 라벨을 바꾸어 비교 셀을 확인한다(AC7 U6·U16이 같은 규칙의 기계 시험). | Windows manifest → 원본 → 비교 행 |
| R-02 ↔ AT-02 / AC2 | AC19·0324 실기는 허용치 대기 중에도 기록된다. 출처가 같은 결과를 반복 수집하지 않고 소유 문서와 W의 증거 좌표가 일치한다. | 0324 호스트 강제 종료와 재전송 성공, AC23/AC52′과 A 세 벌의 원본 좌표를 검토한다. | 설치/진단/Node → 0324·0325 verify → W |
| R-03 ↔ AT-03 / AC3 | B·C·D·E 결과에서 원소유자와 통합 빌드 판정을 모두 조회한다. T01~T33에는 소유자·근거·처리가 있고 T09·T17·T18은 W 관측을 가진다. | H1 예정 셀과 수집 셀의 차집합(AC7 U8). 프로필 하나와 S-E5 전부를 뺀 제출에서 각각 누락을 확인한다. | 소유자 verify → 통합 실행 → T별 결산 |
| R-04 ↔ AT-04 / AC4 | 세 하네스의 복합 조작에서 H4 표의 기대 결과(선택 두 결과 · D-109 시나리오별 규칙 · Markdown 꼬리 세 구간 · 첨부 순서 · 페이지 첫 paint · 검색 강조)와 느린 구간을 구별해 재현한다. | 조작 구간 원본의 원인별 마커·프레임·프로세스 식별자와 화면 결과를 대조한다. | 입력/에이전트 → data·창·워커 → commit/layout/paint |
| R-05 ↔ AT-05 / AC5 | 셀별 집계·비교·결측 사유가 원자료로 재현되고 원소유자의 FAIL이 보존된다. | 실기 원본 한 셀을 처음부터 다시 계산해 판독기 출력과 대조한다(H5). | 원래 단위·구간·표본 → 수치·셀 상태 |
| R-06 ↔ AT-06 / AC6 | 사용자 합의와 관측이 모두 갖춰지고 단일 통합 SHA일 때만 `합격`을 제시한다. 위반과 결측이 동시에 있으면 둘 다 보인다. 결과표는 W-011의 네 열을 가진다. | H6 결과표와 판독기 출력(AC7 U7·U13·U14)을 대조한다. | 잠근 기준 → 셀 판정 → W verify와 INDEX |
| R-07 ↔ AT-07 / AC7 (rev 2) | 판독기 CLI가 예제 입력에서 기대 출력과 같은 보고서를 내고, U1~U16 입력마다 §10 P3·P4·P5 규칙 칸의 결과를 낸다. 모르는 지표·단위·연산자·키는 `충족`이 되지 않는다. | `app/scripts/windows-verdict.test.mjs` — CLI 자식 프로세스 실행(IT-01) + 순수 함수(UT-01·UT-02). `npm test`의 `node --test` 단계 | 테스터 파일 → CLI → 보고서 JSON · exit code |
| R-08 ↔ AT-08 / AC8 (rev 2) | `measure-stage-d.mjs`의 모든 시나리오 출력에 생성 프로세스의 `environment`(`<process.platform>-electron`)·`sha`·`dirty`가 있다. `--compare`는 환경이 같고 허용 집합(`linux-electron`·`win32-electron`)에 있을 때만 호환이며, 기존 Linux 증거 쌍은 계속 호환이다. | `measure-stage-d.test.mjs` 추가 케이스(UT-03) + CLI `--compare` 자식 프로세스(IT-02) | CLI → 측정 결과 → 스탬프 → stdout / 증거 파일 → `--compare` |
| R-09 ↔ AT-09 / AC9 (rev 2) | `measure-stage-e.mjs --baseline`은 PR 도달 커밋 `4412276f`의 `app/scripts/stage-e/host.ts`를 blob `1c4bcb1a…`로 확인한 뒤에만 빌드한다. blob 불일치·커밋 부재·HEAD에서 도달 불가면 측정 없이 실패한다. 출력에 `environment`·`sha`가 있다. | `measure-stage-e.test.mjs`(신규, UT-04) | `--baseline` → 기준 host 소스 해석 → esbuild stdin |

## 7-A. Baseline V / Trace Matrix

좌·우 노드는 모두 NEW다(VP-01~10은 V1, VP-11~13과 AC7~9는 rev 2). A~E의 기존 V는 변경하지 않는다. `P`는 §10의 고정 자리, `H`는 §19의 실제 장비 증거, `U`는 AC7 입력이다.

| Pair · 노드 | requiredness | 생산 경로 `start → edges → end` | §10 자리 · 직접 좌표 |
|---|---|---|---|
| VP-01 R-01 ↔ AT-01 | REQUIRED (WU-W) | 프로필 잠금 → 3쌍 실행 → 비교 행 | P1·P3; H1·H6 |
| VP-02 R-02 ↔ AT-02 | REQUIRED (WU-W) | AC19 실창 → 원자료 → 두 소유 verify → W | P2·P5; H2 |
| VP-03 R-03 ↔ AT-03 | REQUIRED (WU-W) | B/C/D/E 시나리오 → 소유 결과 → T 행 | P2·P5; H3 |
| VP-04 R-04 ↔ AT-04 | REQUIRED (WU-W) | 통합 설치본·진단 조작 → 구간별 결과·첫 paint | P2·P3; H4 |
| VP-05 R-05 ↔ AT-05 | REQUIRED (WU-W) | raw 관측 → 유효성/집계 → 셀 | P3·P4; H5 |
| VP-06 R-06 ↔ AT-06 | REQUIRED (WU-W) | 합의 원본 → 셀 결과 → 사용자 확인 결과·공유 보드 | P1·P4·P5; H6 |
| VP-07 SD-01 ↔ ST-01 | REQUIRED (WU-W) | 수집/재시도 → 합의·증거 여부 → 최종 상태 | P1·P3·P4·P5; H6 + `windows-verdict.test.mjs:'report CLI …'` |
| VP-08 AR-01 ↔ IT-01 | REQUIRED (WU-M) | 테스터 파일(plan·manifest·observations·owners·decision) → `windows-verdict.mjs` CLI 인자 해석 → 스키마 검증 → 판정 → stdout JSON·exit code | P2·P3·P4·P5 (CLI 자리 C1~C4); `windows-verdict.test.mjs:'report CLI …'` 4건(§10) |
| VP-09 MD-01 ↔ UT-01 | REQUIRED (WU-M) | 표본·단위·수집 구간 → 지표/분모/결측 | P3; `windows-verdict.test.mjs` U1~U6·U10·U11·U15·U16 |
| VP-10 MD-02 ↔ UT-02 | REQUIRED (WU-M) | 예정 셀·판정식·허용치 revision → 누락 목록·셀·전체 결과 | P1·P4·P5; U7~U9·U12~U14 |
| VP-11 MD-03 ↔ UT-03 (rev 2) | REQUIRED (WU-M) | `process.platform`·`git rev-parse HEAD` → `provenance()` → `stampProvenance()` → 기록 / 기록 쌍 → `compatibleRun()` | P6 S1~S9; `measure-stage-d.test.mjs` 추가 케이스(§10 P6) |
| VP-12 MD-04 ↔ UT-04 (rev 2) | REQUIRED (WU-M) | 고정 좌표 상수 → `baselineHostSource(git)` → 소스 텍스트 / 오류 | P7 E1~E4; `measure-stage-e.test.mjs`(§10 P7) |
| VP-13 AR-02 ↔ IT-02 (rev 2) | REQUIRED (WU-M) | `node scripts/measure-stage-d.mjs --compare a b`(자식 프로세스) → `compareEvidence` → `compatibleRun` → stdout·exit code | P6 S8·S9; `measure-stage-d.test.mjs:'compare CLI …'` 2건 |
| VP-R1 0328 VP-12·VP-25 | REGRESSION (WU-M) | 0328 EP12 판정 함수 | INHERITED `0328:V1 rev 5 + ΔV1@7db1c7ce` — `measure-stage-d.test.mjs` 기존 7케이스(`:11`~`:64`) 전부 green |

VP-01~07의 H 좌표는 WU-W 실행 전에는 닫힌 좌표가 아니다. WU-M의 verify는 VP-08~13·VP-R1만 닫고, VP-01~07은 `BLOCKED_BY:W-004`로 둔다.

# Part II — Technical Design

## 8. 조사 — 기준 트리 `eae9081b`에서 확인한 사실

| 대상 | 재현 검색(저장소 루트) | N · 관측 → 설계 영향 |
|---|---|---|
| 계측 빌드 | `rg -n -e 'minify:' -e 'react-dom/profiling' app/electron.vite.config.ts` · `rg -n 'devTools: import.meta.env.DEV' app/src/main` | renderer minify = esbuild, profiling 별칭 없음. 창 생성자가 DEV 가드. → 진단 오버레이는 H1 2단계 |
| 진단 다리 | `rg -n 'installTranscriptDevTools' app/src -g '!*.test.*'` | 2 — 선언 `transcriptFixtures.ts:427`, 호출 `main.tsx:24-25`(`VITE_OO_DIAGNOSTIC === '1'`). API: `loadFixture`·`loadToolCardFixture`·`startComputeTimings`·`finishComputeTimings`·`prependFixtureTurn`·`setVirtualization`·`streamFixture`(`:237-259`) |
| 설치본 진단 비노출 | 0326 §7-A “개발 메뉴 제외” | `VITE_OO_DIAGNOSTIC` 없이 `npx electron-vite build` 뒤 `rg -c "__ooDev" out/renderer` → 0 · 진단 빌드 ≥ 1 → H1-0 |
| 재현 입력 | `rg -n 'function writeInputs' -A3 app/scripts/measure-ui-inputs.mjs` | `inputFiles()` + `visibleInputs()` + `git-50000/`(F5) + `git-200-files/`(F8). F6 `artifact-1mb.md` · F7 `generated-5mib.ts` · F9 4파일 · `work-5mb.json`. 이 환경은 node_modules가 없어 해시를 재지 않았다 → H1-0이 기록 |
| J3/J8 | `rg -n "'J3'|J8" app/scripts/measure-ui-inputs.mjs` | 2 — `:825` index 1 산출물 · `:873` 앞삽입 1턴 / 기존 1·100턴. 0326 §19 J3·J8과 같다 |
| stage-d 환경 스탬프 | `rg -n 'linux-electron|environment' app/scripts/measure-stage-d.mjs app/scripts/stage-d app/scripts/stage-d-host app/scripts/stage-d-shell -g '!*.test.*'` | 생산 5 · 소비 2줄(`measurement.mjs:63-64`). SHA 생산 3(`measure-stage-d.mjs:48` · `host-runner.mjs:11` · `shell-runner.mjs:28`). → §10 P6 |
| stage-e 기준선 소스 | `rg -n "7db1c7ce|3d8e1d90|'show'" app/scripts/measure-stage-e.mjs` | 3 — `:14` 기준 앱 · `:28` src 대조 · `:52` `git show 3d8e1d90:…`. `3d8e1d90` PR 미도달, 같은 blob이 `4412276f`에 있음 → §10 P7 |
| 일반 열기 경로 | `rg -n 'HistoryPageReplySchema|SessionLoadChunkSchema|assembleSession' app/src/renderer/src/shared/api/transport/session-load.ts` | 페이지 `:91-119`(현행 주 경로) · 조각 `:54`·`:63`(구 빌드·복구) → §12 |
| T 분모 | `rg -c '^\| T[0-9]{2} \|' docs/handoff/0325-ui-responsiveness-followup/plan.md` | T01~T33. 0325 §6-D 단계분담과 함께 읽어 복수 소유(T01, T33 등)의 잔여를 가르지 않는다 |
| CI 실행 | `.github/workflows/ci.yml:36-40`·`:83` | `fetch-depth: 0`(전체 이력) · test = `npm test`(vitest + `node --test "scripts/*.test.mjs"`) → W-010 |
| 후보 표 | INDEX `## 새 handoff 후보` | 0330 파일과 겹치는 행 없음. 0329 NX1~NX3는 유지 |

## 9. 구조와 책임 변화

| 단계 | 현재 | rev 2 |
|---|---|---|
| 생성 | 소유자별 측정 도구가 `linux-electron`을 하드코딩하고 일부 시나리오는 환경·SHA를 남기지 않는다. | 모든 stage-d·stage-e 출력이 생성 시점 `environment`·`sha`·`dirty`를 갖는다(W-012). |
| 재현 | 0329 기준선이 PR 밖 커밋에 의존하고 재현 문장이 커밋을 특정하지 않는다. | 고정 좌표 + blob 검증 + H1 명령. |
| 소비 | 소유 verify의 범위·대상 빌드가 다르다. 판독기는 계획만 있다. | `app/scripts/windows-verdict.mjs`가 예정 셀 대비 차집합·셀·전체 결과·네 열을 낸다(W-010·W-011). |
| 결정 | 0325 D-025가 열려 있다. | W-004 결정 파일(`decision`)을 판독기 입력으로 묶고 최종 결정은 W verify에 둔다. |

## 10. 계약과 강제 지점

### 10-A. 판독기 `app/scripts/windows-verdict.mjs`

**입력**(JSON, UTF-8). `plan` = `{ revision, lockedAt, profiles[], integrationSha, cells[] }` — `cells[]`는 예정 필수 키 `{ key, owner, ownerRevision, scenario, harness, profile, side, buildKind, repeat, metric, required, rule }`, `rule` = `{ aggregate: 'p95'|'max'|'median'|'count'|'ratio'|'equal', operator: '<'|'≤'|'='|'≥'|'>', value, unit, mode: 'absolute'|'relative' }`. `manifest` = `{ runs[]: { runId, sha, binarySha256, buildKind, profile, harness, scenario, repeat, tools{}, startedAt, endedAt } }`. `observations` = JSONL `{ runId, scenario, harness, metric, unit, interval, values[] | status: 'absent'|'failed'|'censored', bound?, rawRef: { sha256, range } }`. `owners` = `{ rows[]: { key, machine: 'PASS'|'FAIL'|'미완', machineRef, windows?, windowsRef? } }`. `decision` = `{ revision, decidedAt, by, confirmed: boolean }`(없으면 미확정).

**출력**(stdout JSON) `{ cells[]: { key, status: '충족'|'위반'|'미판정'|'기록 전용', aggregate, n, unit, rawRefs[], reason? , ownerMachine, ownerWindows, w, user }, missing[], unexpected[], duplicates[], conflicts[], overall: '합격'|'불합격'|'판정 보류', holds[] }`. exit code: 0 `합격` · 1 `불합격`/`판정 보류` · 2 입력 오류(스키마·예정 키 0). 모르는 `aggregate`·`operator`·`unit`·`status`는 그 셀을 `미판정(지원 안 함: <값>)`으로 만든다 — **열린 입력 집합은 fail-closed**다.

| 자리 | 규칙 칸 — 분기마다 결과 | UT/IT 입력 칸 — 분기마다 입력(구별 값) |
|---|---|---|
| P1 기준 고정 | ① `run.startedAt < plan.lockedAt` → 그 run의 셀은 `기록 전용(합의 전)` ② `run.profile ∉ plan.profiles` → `미판정(프로필 불일치)` ③ 모든 셀에 `plan.revision` 표시 | U12: lockedAt보다 1ms 앞 / 같음 / 뒤 run · U6: 60Hz plan에 120Hz run · 출력의 `revision` 단언 |
| P2 원본 인계 | ① 셀 표본의 `rawRef.sha256` 누락·형식 오류 → `미판정(원본 없음)` ② `observation.runId ∉ manifest` → `unexpected`에 기록, 셀 불변 ③ `buildKind` 서로 다른 두 run 비교 → `미판정(빌드 종류 혼합)` | U6′: rawRef 없는 관측 · U8: manifest에 없는 runId · U16: 설치/진단 혼합 쌍 |
| P3 비교·집계 | ① p95 = 오름차순 `ceil(0.95N)`번째, max, median ② 같은 runId·metric·interval의 같은 해시·같은 값 → `duplicates`, 1회로 셈 ③ 같은 키 다른 값/해시 → `conflicts` + `미판정(충돌)` ④ 한 runId의 지표·구간 여럿 → 키마다 별도 셀 ⑤ `status:'absent'`(구 빌드) → 상대 비교 제외, 절대 규칙만 ⑥ `status:'failed'`(신 빌드) → `위반` ⑦ `censored`(`<16ms`) → 상한 비교가 결정되면 판정, 아니면 `미판정(검열)` ⑧ 상대 비교 분모 0 → `미판정(분모 0)` ⑨ 반복 3 중 누락 → `미판정(반복 부족)` + `missing`에 그 반복 키 | U10: N=1·19·20·21 p95 · U2: 같은 재제출 2회 · U3: 같은 키 값 다름 / 해시 다름 · U1: 한 runId에 지표 2·구간 2 · U4: before `absent` + 절대 규칙 있음/없음 · U5: after `failed` · U10′: `<16ms` vs `≤ 50` / `≤ 10` · U11: before 값 0 · U15: 반복 2 누락 |
| P4 판정 | ① 연산자 5종 각각 경계 전/같음/후 ② 미지원 연산자·단위·집계 → `미판정(지원 안 함)` ③ `required:false` → `기록 전용` ④ 전체: 위반 ≥1 또는 소유자 `FAIL` → `불합격` + 모든 미판정·결측을 `holds`에 함께 ⑤ 위반 0이고 필수 결측·미판정·소유자 `미완` ≥1 → `판정 보류` ⑥ 전건 충족 + `decision.confirmed !== true` → `판정 보류(사용자 확정 대기)` ⑦ 전건 충족 + 확정 → `합격` ⑧ 통과 셀의 run SHA가 `plan.integrationSha`와 다름 → 그 셀 `미판정(통합 SHA 아님)` | U9: `<,≤,=,≥,>` × 경계 −1/0/+1 · U9′: `≈` 연산자·`fps` 단위·`p99` 집계 · `required:false` 셀 · U7: 소유자 FAIL + 필수 결측 동시(둘 다 보고) · U14: 전건 충족 + confirmed 없음 / false / true · U13: 다른 SHA 통과 셀 |
| P5 원소유·공유 | ① 예정 필수 키 − 유효 실제 키 → `missing`(프로필·시나리오·하네스·반복·지표별 복원) ② 실제 − 예정 → `unexpected`(충족 수 불변) ③ 예정 필수 키 0 → exit 2 ④ 셀마다 `ownerMachine`·`ownerWindows`·`w`·`user` 네 열을 owners·decision에서 채운다(없으면 `미기록`) | U8: 제출자가 manifest에서 키 1개 삭제 · 예상 밖 키 1개 추가 · 빈 `cells` · 빈 observations(모든 셀 미판정) · U7′: owners 행 없는 셀 → `미기록` |
| C1~C4 CLI (VP-08) | C1 인자 `--plan --manifest --observations [--owners] [--decision]` 해석 ② C2 파일 읽기·JSONL 파싱 실패 → exit 2 + 파일명 ③ C3 판정 결과 → stdout JSON ④ C4 overall → exit code 0/1/2 | `windows-verdict.test.mjs:'report CLI …'` — 예제 입력 → 기대 출력 일치·exit 1 · 확정 추가 → exit 0 · 깨진 JSONL → exit 2 · `--owners` 생략 → `미기록` |

**자리 검색 명령.** 구현 뒤 `rg -n "operator|aggregate|status|missing|unexpected|conflicts|duplicates|overall|exitCode|process.argv" app/scripts/windows-verdict.mjs` 출력의 각 줄을 P1~P5·C1~C4 중 하나로 분류하고, 분류되지 않는 운반 줄은 사유와 함께 제외 줄로 적는다(`site_census.mjs`). 판독기는 신규 파일이라 rev 2 시점 출력은 0줄이다 — 분모는 위 규칙 칸 분기(P1 3 · P2 3 · P3 9 · P4 8 · P5 4 · C 4 = 31)이고 구현 diff 자리마다 sweep한다.

**예제 입력.** `app/scripts/windows-verdict/example/{plan,manifest,owners,decision}.json`·`observations.jsonl`·`expected-report.json`. 예제는 구현자 안내이자 계약 fixture라 `'report CLI …'` 첫 케이스가 예제 → 기대 출력을 단언한다. 예제는 최소 W1 셀 2개(충족 1·위반 1), 결측 1, 소유자 FAIL 1을 담는다.

### 10-B. 측정 도구 출처 (W-012)

| 자리 | 규칙 | 직접 oracle 좌표 · 구별 입력 |
|---|---|---|
| P6 stage-d | **SSOT** `stage-d/measurement.mjs`에 `MEASUREMENT_ENVIRONMENTS = new Set(['linux-electron','win32-electron'])` · `measurementEnvironment(platform = process.platform)` = `${platform}-electron` · `provenance({ platform, git })` = `{ environment, sha: git('rev-parse','HEAD'), dirty: git('status','--porcelain','--','src') !== '' }` · `stampProvenance(result, p)` = 최상위에 `environment`·`sha`·`dirty`를 넣되 결과에 이미 있는 같은 키는 **같을 때만 유지**, 다르면 `provenanceConflict: true`. 자리: S1 `measure-stage-d.mjs:51` · S2 `:114` · S3 `:128` · S4 `stage-d-host/electron-main.mjs:86` · S5 `stage-d-shell/probe.ts:281` — 리터럴 대신 `measurementEnvironment()` · S6 CLI 출력 `measure-stage-d.mjs:174-178` — 비교 모드가 아닌 모든 결과(`env:false` 포함)에 `stampProvenance` · S7 SHA 원천 3자리(`:48` · `host-runner.mjs:11` · `shell-runner.mjs:28`) → `provenance().sha`로 통일 · S8 `compatibleRun`(`measurement.mjs:63`) — `MEASUREMENT_ENVIRONMENTS.has(before.environment) && before.environment === after.environment` · S9 `compareEvidence` 결과에 양쪽 `environment` 표기 | `measure-stage-d.test.mjs` 추가: `'environment follows the generating platform'`(`win32`→`win32-electron` · `linux`→`linux-electron` · `darwin`→`darwin-electron`) · `'provenance stamps every scenario result'`(`{env:false}`·환경 없는 geometry 결과·같은 값 보유·다른 값 보유 → conflict) · `'comparison requires the same allowed environment'`(linux/linux 기존 `:68` fixture 유지 true · win32/win32 true · linux/win32 false · darwin/darwin false) · `'compare CLI …'` 2건: 자식 프로세스로 linux 쌍 → 호환 exit 0 · linux↔win32 → exit 1 |
| P7 stage-e | `BASELINE_HOST = { commit: '4412276f248ffe6a447760f56ad2fa424fa0e78a', path: 'app/scripts/stage-e/host.ts', blob: '1c4bcb1a7c0319ff9fdbff92cae8c220b3742a79' }` · `baselineHostSource(git)`: E1 `git('cat-file','-e', commit)` 실패 → `Error('baseline host commit missing')` · E2 `git('rev-parse', commit+':'+path) !== blob` → `Error('baseline host blob mismatch')` · E3 `git('merge-base','--is-ancestor', commit, 'HEAD')` 실패 → `Error('baseline host not reachable from HEAD')` · E4 통과 시 `git('show', …)` 텍스트 반환, `measure-stage-e.mjs:52`가 이 함수를 쓴다. 출력(`:91-96`)에 `stampProvenance`(P6 SSOT 재사용). `:14`·`:28`의 기준 앱 `7db1c7ce`는 유지 | `measure-stage-e.test.mjs`(신규) — 가짜 `git`으로 E1~E4 각각(커밋 없음 · blob 1글자 다름 · ancestor 실패 · 정상 → 텍스트) · 출력 스탬프는 P6 `stampProvenance` 케이스가 잠근다 |

**자리 검색 명령.** P6: `rg -n "linux-electron|win32-electron|environment|rev-parse|stampProvenance|compatibleRun" app/scripts/measure-stage-d.mjs app/scripts/stage-d app/scripts/stage-d-host app/scripts/stage-d-shell -g '!*.test.*'`. P7: `rg -n "7db1c7ce|3d8e1d90|4412276f|baselineHostSource|'show'|stampProvenance" app/scripts/measure-stage-e.mjs app/scripts/stage-e`. rev 2 시점 출력은 §8 두 행(P6 생산 5 · 소비 2 · SHA 3 / P7 3)이고 위 S1~S9·E1~E4가 그 줄 전부를 덮는다. 구현 뒤 다시 돌려 리터럴 `linux-electron`이 `MEASUREMENT_ENVIRONMENTS` 한 곳에만 남는지(테스트 fixture 제외) 확인한다.

### 10-C. 선택 적대 증거 · 선언 경계

- **선택 적대 증거**: VP-10 P4 ④~⑦은 순서 의존 판정이라 `위반 → 보류 → 확정` 순서를 맞바꾼 변이(⑤를 ④ 앞에)를 자리마다 심는다. VP-11 S8은 `has(...)` 항만 지운 변이와 `===` 항만 지운 변이를 각각 심는다. VP-12 E2·E3은 각 검사 한 줄 제거 변이. 이유: 셋 다 “통과시키지 않음”이 불변식이라 존재 단언만으로는 방향이 잡히지 않는다.
- **선언 경계**: 판독기는 원본 trace·로그 파일 자체를 열어 재계산하지 않는다 — `rawRef`의 해시·범위 형식만 검사하고 원본 재계산은 H5 사람 검증이다. 측정 도구 스탬프는 `process.platform`이 아는 플랫폼만 구별하며 Windows 버전·GPU 같은 장비 프로필은 manifest(H1) 몫이다. WU-M의 Linux 사전 실행이 Electron 바이너리 부재(exit 3)로 끝나면 그 실행은 `환경 없음`이고 VP-08~13 판정에 쓰지 않는다.
- **게이트가 green인 채로 남는 차이**: CI는 판독기 규칙과 도구 스탬프만 잰다. 목표 장비의 GPU·디스플레이·IME·native 앱 동작은 CI에서 측정되지 않는다(§17).

## 11. 구현 설계와 재현 가능한 판독

1. `manifest`는 시나리오 원문 revision·목표와 두 커밋 full SHA·바이너리 SHA-256·도구 버전·모델·하네스·시나리오 및 입력 해시·필수 셀 목록·측정자·시작/종료 UTC·프로필·캡처 종류·반복 번호를 가진다. 실제 세션은 익명 별칭·복원 스냅샷 해시·메시지/part/행 수로 식별한다.
2. 각 관측은 §10-A `observations` 형식이다. 표본이 여럿이면 원본 배열과 단위를 보존한다.
3. 판독기는 순수 함수 `evaluate({ plan, manifest, observations, owners, decision })`와 CLI 래퍼로 나눈다 — 시험은 순수 함수(UT)와 자식 프로세스 CLI(IT)를 따로 둔다. 새 의존성 없음(Node 표준 모듈만).
4. 측정 도구는 §10-B의 SSOT 함수만 더하고 측정 로직·판정 규칙(0328 R-H·R-W·R-R, 0329 `latencyGate`)은 바꾸지 않는다.

## 12. 종단 경로와 지연 귀속

설치본의 사용자 조작과 진단 빌드의 같은 조작을 각자 관측한다. 동일 요청/세션/작업으로 대응되는 구간만 연결하고, 호스트별 monotonic clock 값을 그대로 빼지 않는다.

| 구간 | 관측 위치 및 부하 구별 |
|---|---|
| agent → data 또는 창 | 세션·요청 식별자, 발행·수신 순서와 각 프로세스 처리 시간. 발행까지의 모델 대기는 UI 처리 구간과 별도 표기. |
| T09 일반 열기(W-009) | data 제한 페이지 조회 → IPC 응답 → `session-load.ts:91-119` `page()`의 `HistoryPageReplySchema.safeParse`·세션/요청/세대 대조 → store 반영 → 첫 실제 본문 paint. 행·바이트·호출 수, 취소·늦은 응답을 기록하고 **일반 열기에서 과거 전체 본문 읽기·조립 0회**를 확인한다. |
| T09′ 별도 행 | 구 빌드(`7db1c7ce` 이전)의 조각 수신 `:54` `SessionLoadChunkSchema` → `:63` `assembleSession`, 그리고 전체 archive가 필요한 실행 복구·분기. 주 경로와 섞지 않는다. |
| R → Web Worker → R | 요청·대기·처리·응답 revision. 진단 계측은 `startComputeTimings()` → 조작 → `finishComputeTimings()`(jobs·paints). 응답 폐기와 화면 반영을 구별한다. |
| 화면 | React Profiler commit, trace Layout, 표시 프레임. 마커가 없거나 요청을 식별할 수 없으면 `미관측(구간, 이유)`로 남겨 결과를 역산하지 않는다. |

## 13. 수명주기·오류·재시도

측정은 복원한 **격리 테스트 프로필**에서 한다. 두 버전 사이에 앱·호스트가 종료된 것을 확인한 뒤 프로필/userData와 native 세션을 같은 스냅샷으로 되돌린다. 로그 회전 파일까지 보존하고 구간 시각으로 선별한다. 기준선 앱이 종료되거나 기능이 없으면 에러/스크린을 증거로 남기고 다음 시나리오를 진행한다.

0324 AC22 시나리오 8에서는 테스트 세션의 **에이전트 호스트만** 종료하고 해당 세션 오류 알림, 입력창 사용 가능, 고아 하네스 프로세스 정리, 다음 전송 성공을 같은 실행에서 기록한다.

## 14. 지표·표본·사전 합의

| 지표 | 단위 · 원자료 · 집계 |
|---|---|
| 입력→paint·결과 paint | 이산 키/클릭은 Event Timing duration(ms). p95 = 정렬 표본의 ceil(0.95N)번째, 최대와 N도 적는다. Chrome 진단 trace의 Interactions 트랙 기본. PerformanceObserver는 `durationThreshold: 16`. 보고 하한 미만은 `<16ms` 검열 구간으로 유지한다. |
| 연속 입력·무입력 구간 | 휠·드래그·IME·스트림은 표시 프레임 간격·누락 프레임. 이산 Event Timing과 별도 열. |
| 누락·연속 누락 | Frames 트랙 dropped + partially presented, 분모(소유 표 정의), 가장 긴 연속 누락. 분모 0이면 보류. |
| React·layout·스레드 정지 | commit duration 합/최대, Layout 합/최대, raw task >50ms·≥160ms 수와 최장 정지. LoAF와 task를 따로 센다. 0326 셀은 D-109 시나리오별 규칙(H4). |
| 설치본 로그 | 구간과 `event=perf.stall` → `data.thread/source`별 건수·`data.count`·`data.durationMs` 최대·오류. 기록 0과 로그 부재를 구별한다. |
| 함수·자원·의미 | I/J/K는 Windows Node에서 같은 함수/입력끼리. 실창에는 마운트 DOM·행 방문·오프셋 오차(px), 복사 결과, 오류/프로세스. |
| 터치패드 제스처 | 0329 S-E2 — 플릭 1회당 이전 턴 요청 수, 이벤트 간격 분포(`HISTORY_GESTURE_GAP_MS = 200`, `historyGesture.ts:1` 검토용). |

**W-004 결정 서식**(판독기 `plan`·`decision` 파일과 1:1) — 사용자·일시·revision / Windows·CPU·GPU·RAM·모니터·해상도·Hz·배율·전원 / **한국어 IME·정밀 터치패드 유무** / 시나리오·하네스 / 지표·단위 / 집계(`p95`·`max`·`median`·`count`·`ratio`·`equal`) / 절대 또는 전후(`absolute`·`relative`) / 연산자(`<`·`≤`·`=`·`≥`·`>`)·경계값 / 필수 또는 기록 전용 / 구 빌드 기능 부재 셀의 사유와 신 빌드 절대 기준. 최소 입력→paint p95·최대, 누락·연속 누락, >50ms 및 ≥160ms 정지가 들어간다. T17 승인 commit·T18 paint·script·timer를 W 목표에 쓸지 표에 명시한다. 실측을 본 뒤 바꾼 기준은 새 revision으로 새 표본을 모은다.

**판정 순서** — 각 원소유자 규칙으로 해당 행을 먼저 계산한다. 같은 구간·단위끼리 합의 방식으로 모아 W 셀별로 `충족 / 위반 / 미판정 / 기록 전용`을 표시한다. 전체 판정은 §10-A P4 ④~⑦이다.

## 15. 외부 계약

테스터는 시나리오별 원본과 manifest를, 사용자는 W-004 결정을 제공한다. 공개 IPC·DB 스키마·출시 조건 변경은 없다. 판독기 입력 형식(§10-A)은 이 plan과 예제 fixture가 정본이다. 외부 공유본에는 계정·메시지 본문 대신 재현 별칭을 쓴다.

## 16. 기존 결정과의 관계

| 소유 규칙 | W 처리 |
|---|---|
| 0325 D-042·D-043 | 입력·반복·구/신 빌드 실패 의미를 승계한다. 조건부 T 행을 현행 유지로 닫을 때 입력 크기·장비·측정값과 적용 경계를 인용한다. |
| 0326 D-109(D-095·D-106 대체) | ① 110%·누락 증가는 S1·S2·S6·S7의 “비교 지표” 열에만 ② S1~S7·S7d(S5 포함) 160ms 정지 ③b S3·S4 50ms 초과 작업 >1 ④ 연속 누락 ≥3 ⑤ S4·S5 위치·선택 결과 — 각각 판정. S8/S9는 W 측정 전용. |
| 0327 D-025 · ΔV1(D-052) | AC30은 기록 완결로 판정한다. K12와 복사 전용 50ms는 폐기(W-008). |
| 0328 분기 규칙(plan:450-458) | R-H·R-W·R-R은 0328이 `linux-electron` 행으로 판정한다. Windows 기록은 W 셀과 소유자 Windows 열에만 쓴다. |
| 0329 §17 3,729ms | Linux 단독 실행 기준. `measure-stage-e.mjs` 출력의 `latencyGate`는 Windows에서 W 셀로 쓰지 않는다(W-004). |
| [앱 게이트와 DevTools 정책](../../../app/AGENTS.md) | 정상 설치본은 pristine 트리의 `build:win`. 진단 패치·profiler 환경·입력 fixture revision은 별도 기록한다. 새 스크립트는 `app/AGENTS.md` 스크립트 목록에 한 줄씩 더한다. |

## 17. 위험과 판정 한계

진단 빌드는 프로파일링 자체가 실행 시간에 영향을 준다. 진단↔진단, 설치↔설치만 비교한다. 모델 응답 길이·세션 원본·다중 세션 부하가 달라졌으면 해당 쌍에서 원인을 분리할 수 없다. Windows CI의 기계 게이트는 실제 목표 장비의 GPU·디스플레이·IME·native 앱 동작을 측정하지 않는다.

## 18. 영향 문서·실행 산출

| 파일 | 역할 | WU |
|---|---|---|
| `app/scripts/windows-verdict.mjs` · `windows-verdict.test.mjs`(신규) | 판독기·시험 | M |
| `app/scripts/windows-verdict/example/*`(신규) | 예제 입력·기대 출력 | M |
| `app/scripts/stage-d/measurement.mjs` · `measure-stage-d.mjs` · `stage-d-host/electron-main.mjs` · `stage-d-shell/probe.ts` · `stage-d/host-runner.mjs` · `stage-d/shell-runner.mjs` · `measure-stage-d.test.mjs` | 출처 스탬프(P6) | M |
| `app/scripts/measure-stage-e.mjs` · `measure-stage-e.test.mjs`(신규) | 기준선 소스 좌표(P7) | M |
| `app/AGENTS.md` 스크립트 목록 | `windows-verdict.mjs` 한 줄 · stage-d/e 스탬프 한 구절 | M |
| 이 폴더 `evidence/H1-0-linux.md`(신규) | WU-M 사전 실행 기록 | M |
| 이 폴더 `verify.md` · manifest·표본·결과표, 원소유자 verify AC 행 | WU-W 실행·판정 | W |

## 19. 실행·검증 게이트

### H1-0. WU-M 사전 실행(Linux, 지금)

| # | 명령(`app/`) | 기대 · 기록 |
|---|---|---|
| 1 | `node scripts/measure-ui-inputs.mjs --write-inputs <dir>` 후 파일별 `sha256sum` | 파일 수와 해시를 `evidence/H1-0-linux.md`에 기록 — 기대 파일: `inputFiles()` 전부 + F6 `artifact-1mb.md` · F7 `generated-5mib.ts` · F9 `table-1600.md`·`table-2001.md`·`footnote-60k.md`·`single-line-1mb.json` · `work-5mb.json` + F5 `git-50000/` + F8 `git-200-files/`(파일 수 200). 같은 인자는 같은 바이트(`measure-ui-inputs.mjs:178`)라 Windows H1의 해시가 이 값과 같아야 한다. |
| 2 | `npx electron-vite build && rg -c "__ooDev" out/renderer` / `VITE_OO_DIAGNOSTIC=1 npx electron-vite build && rg -c "__ooDev" out/renderer` | 0 / ≥ 1(W-006) |
| 3 | 깨끗한 worktree 두 개: `git worktree add --detach <m> <WU-M 커밋>` · `git -C <m> checkout 7db1c7ce -- app/src` 뒤 `xvfb-run -a node scripts/measure-stage-e.mjs --baseline --old-db small` · `… long`, 그리고 `<WU-M 커밋>` 그대로 `… --old-db small` · `… long` | 네 출력 모두 `environment`·`sha`·`dirty` 보유, baseline 둘은 `4412276f` blob 검증 통과. Electron 부재면 exit 3을 `환경 없음`으로 적는다(통과로 세지 않음). |
| 4 | `xvfb-run -a node scripts/measure-stage-d.mjs --geometry` · `--host` · `--host --baseline`(`c7d2adf2` 트리) · `--compare <기존 r1.2-host-baseline.json> <r1.2-host-applied.json>` | 새 출력에 `environment: linux-electron`·`sha`. 기존 Linux 증거 쌍 `--compare` 호환 유지. `--host`가 egress로 막히면 서명과 함께 기록(0328 verify:61 선례). |
| 5 | `node scripts/windows-verdict.mjs --plan windows-verdict/example/plan.json --manifest … --observations … --owners … --decision …` | `expected-report.json`과 같음 · exit 1(예제는 위반 포함) |

### H1. 빌드·장비·재현 입력을 고정한다(WU-W)

**필수 셀 분모를 먼저 만든다.** 검증자가 측정 결과를 열기 전에 ① §6의 각 소유 §19 표와 H4의 W1~W4·부하 쌍에서 시나리오·조작·하네스·빌드·계측 종류·지표·반복 수를 전개하고 ② W-004에서 확정한 목표 프로필과 W 필수 지표를 결합해 판독기 `plan.cells`로 고정한다. 키는 `소유자/revision × 시나리오/조작/부하수준 × 하네스 × 프로필 × 기준/후속 SHA × 설치/진단/Node × 반복 × 지표`다. 소유 표가 미지원으로 지정한 셀(예: 0326 S4의 설치본)은 사유를 보존한다.

**빌드 좌표**(W-007). 각 쌍은 full SHA로 checkout하고 빌드마다 설치 파일 SHA-256을 manifest에 넣는다. verify 커밋은 문서 전용이라 빌드 SHA로 쓸 수 있되 H1에서 `git diff --stat <구현 커밋> <verify 커밋> -- app`이 비었음을 기록한다.

| 비교축 | 이전 full SHA | 이후 full SHA | 원 브랜치 verify 사본 |
|---|---|---|---|
| ① 0325 AC19 | `ee8ac8173c83a97114a9dc8bd257ba770a7dc368` | `d86846844dc9ea092f394f942621b78dc3d50e02` | (같음 — `main`) |
| ② 0326 AC33 | `d86846844dc9ea092f394f942621b78dc3d50e02` | `7c241d191438e7aa9625a2914c38fe0a1b3d1bdd` | (같음) |
| ③ 0327 AC30 | `7c241d191438e7aa9625a2914c38fe0a1b3d1bdd` | `c7d2adf2ddb548a2ce897cfc4f19173a2879b77f` | `d30339868980d28a9ede14740e798984fbd21dd8` |
| ④ 0328 | `c7d2adf2ddb548a2ce897cfc4f19173a2879b77f` | `7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6` | (같음) |
| ⑤ 0329 | `7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6` | `eae9081b5536232da98ab918ed9f0c1b525660f6` | `421d2393d4cdb3bfe64d81d1cefe1dc729252531` |
| ⑥ W 통합 | `d86846844dc9ea092f394f942621b78dc3d50e02` | `(WU-W 착수 시 통합 SHA — 검증자 기입)` | — |

⑥의 구 빌드에 없는 E 전용 조작은 `N/A(이전 기능 없음)`으로 남기고 통합 쪽의 기능·절대 기준을 수행한다. AC19의 합의 전 기록은 참고 기준선이며 W-004 합의 전 실행을 W 최종 표본으로 승격하지 않는다(W-013).

```powershell
$repo = (git rev-parse --show-toplevel)
$runDir = Join-Path $env:TEMP ("orca-W-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $runDir | Out-Null
$beforeSha = "<비교축 이전 full SHA>"; $afterSha = "<비교축 이후 full SHA>"
git -C $repo worktree add --detach "$runDir/before" $beforeSha
git -C $repo worktree add --detach "$runDir/after" $afterSha
git -C $repo diff --stat "$beforeSha" "$afterSha" -- app | Out-File -Encoding utf8 "$runDir/app-diff.txt"
node --version
Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber
Get-CimInstance Win32_Processor | Select-Object Name
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory
Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,CurrentRefreshRate
powercfg /getactivescheme
foreach ($side in @("before","after")) {
  Push-Location "$runDir/$side/app"
  try {
    npm ci; if ($LASTEXITCODE -ne 0) { throw "npm ci failed: $side" }
    npm run build:win; if ($LASTEXITCODE -ne 0) { throw "build:win failed: $side" }
    Get-ChildItem -Recurse -Filter "*-setup.exe" | Get-FileHash -Algorithm SHA256
  } finally { Pop-Location }
}
```

Windows 디스플레이 설정에서 모니터·해상도·Hz·배율, 한국어 IME와 정밀 터치패드 드라이버를 확인한다. 같은 전원 모드, 최대화 창, 동일 GPU·드라이버, 동일 모델·버전으로 다른 앱을 종료한다. 앱을 동시에 띄우지 않는다.

**재현 입력.** 통합 쪽 트리에서 `node scripts/measure-ui-inputs.mjs --write-inputs "$runDir/inputs"`를 실행하고 파일별 SHA-256을 H1-0 1번 값과 대조한다 — F1~F5(0325) · F6~F9(0327 S-C4는 F6·F7·F9) · F8 `git-200-files`(S-C2). 다르면 그 입력의 셀은 측정하지 않는다. 함수 재측정은 `foreach ($repeat in 1..3) { foreach ($side in "before","after") { node scripts/measure-ui-inputs.mjs --src "$runDir/$side/app" | Out-File … } }`이다.

**측정 도구 좌표.** stage-d·stage-e는 WU-M 커밋(`(WU-M 구현 — 검증자 기입)`)의 도구를 쓴다. 0328 `--host`·`--shell`의 `--baseline`은 `c7d2adf2` 트리, 0329 `--baseline`은 H1-0 3번 절차(WU-M 커밋 worktree + `7db1c7ce`의 `app/src`)다. 출력의 `environment`가 `win32-electron`이 아니면 그 기록은 Windows 셀에 쓰지 않는다. 기존 Linux 원본(0328 `evidence/*.json`, 0329 r1.4 표)은 **인용**으로만 표시하고 새 Windows 실행과 다른 열에 둔다.

**진단 빌드 준비.** 설치본과 동일 SHA에서 별도 진단 worktree를 만들고 diff와 diff SHA-256을 보관한다.

1. `app/electron.vite.config.ts` renderer에서 `build.minify=false`, `react-dom/client` 정확 일치 alias → `react-dom/profiling`. 진단 전용 본창에서만 DevTools를 열고 release worktree의 DEV 가드는 유지한다.
2. `$env:VITE_OO_DIAGNOSTIC="1"`로 `npm run build:unpack` 후 unpacked 실행 파일을 시작하고 `finally { Remove-Item Env:VITE_OO_DIAGNOSTIC -ErrorAction SilentlyContinue }`로 복구한다.
3. **짧은 사전 실행**(판정 표본 아님, 빌드마다): DevTools 콘솔에서 `typeof window.__ooDev?.loadFixture === 'function'` · `typeof window.__ooDev?.loadToolCardFixture === 'function'` · `__ooDev.startComputeTimings(); …조작…; __ooDev.finishComputeTimings().jobs.length > 0` · Performance trace에 Frames·Layout·이름 있는 앱 함수 · React Profiler commit 번호·duration이 실제로 나오는지 기록한다. 기능이 없는 구 빌드는 그 항목을 `N/A(이전 기능 없음)`으로 적는다.
4. 설치본(pristine `build:win`)에서 DevTools가 열리지 않고 `__ooDev`가 없음을 확인한다(H1-0 2번의 Windows 대응 — 진단 기능 비노출).
5. 같은 시나리오에서 이전→이후를 3회 교차하고 매 실행마다 격리 프로필을 복원한다.

### H2. A의 기준선과 0324 실기를 함께 수집한다

0325 §19 S1~S8의 표본(긴 실제 세션, P1, 실행당 한글 200자·휠 10초, 폭 드래그 등)을 각 원문대로 한다. 타이핑 p95는 3회 표본 합산이며 0326의 시나리오별 3회 중앙값과 섞지 않는다. 0324 AC22의 8개 시나리오는 같은 실창 세션에서 별도 구간으로 연다. AC23·AC52′는 패키징 설치본에서 확인한다. 각 원래 verify와 W에 같은 식별자/구간을 인용한다.

### H3. B~E 증거를 인수한다

| 소유 행 · 유효 계약(W-007) | 확인할 차이와 W 처리 |
|---|---|
| 0326 AC33 — D-109 표(0326 plan §19 `:1705-1725`) | 시나리오별 결과와 Windows 장비 연결. S8(T17) Claude Work 20,000자 계획 승인 카드 표시 commit, S9(T18) Claude Code 하위 작업 10/50개·30초의 paint·script·timer를 각기 별도 행으로 둔다. |
| 0327 AC30 — 실행표(`:1994-2005`) · ΔV1 적용표(`:21-32`) | S-C0~S-C9 각 값. 진단 계측 이름은 H1 3번(실제 API). S-C8은 정상 복사·취소·재선택·패널 격리 기록이며 K12·복사 전용 50ms는 판정하지 않는다. |
| 0328 — 실행표·판단식(`:437-458`) | S-D1~S-D10 실제 행, S-D10a/b/c 각각. R-H는 같은 조작의 호스트·창 시간(ms)을, IPC 바이트·DOM 행 수는 별도 열. R-W·R-R 결정도 각각. |
| 0329 AC10 — 실행표(`:524-533`) | S-E1~S-E5, 구 DB 준비 전·중·후. E §8 합성 DB 시간은 조회 구간 참고값. |
| T01~T33 | 0325 §6-B 전체 ID와 결과 표 ID의 차집합, §6-C·§6-D 잔여 단위와 결과 표 단위의 차집합. T33 테마 재강조(C)·입력 높이(D), T09 크기 상한(A)·구간 측정(W)은 별도 행. |

### H4. 통합 빌드에서 복합 조작을 재생한다 — 사용자 동작과 기대 결과

매 행마다 장비별 동일 모델·복원 세션과 결과물 파일을 쓰고, 기준/통합·설치/진단을 분리한다. W1~W4는 Claude Code·Claude Work·OpenCode에서 **제공되는 같은 동작**으로 재생하고 해당하지 않는 셀의 이유를 판정 측정 전에 고정한다. 입력 부하 3축(화면 밖 이력 길이 / 현재 턴 크기 / 단일 출력 크기)은 한 번에 하나만 늘린다.

| ID · 사용자 동작 / 소유자 | Windows에서 확인할 기대 결과 |
|---|---|
| W1 긴 대화의 입력·스크롤·앞삽입 / 0326 AC33 D-109 | 가장 긴 실제 세션과 P1, 스트리밍 중 한글 200자 → 휠 10초, 패널 드래그 10초. **S1·S2·S6·S7**은 지정 비교 지표에만 110% 또는 누락 증가 규칙. **S3·S4**는 한 조작에 50ms 초과 작업 2건 이상이면 재작업. **S1~S7·S7d(S5 포함)**는 160ms 이상 정지 또는 3프레임 이상 연속 누락이면 재작업. S4/S5의 하단 고정·같은 문장 위치 오차(1px)와 선택 결과는 각각 판정. S8/T17·S9/T18은 별도 관측 행. |
| W2 저장된 대화 열기·상단 당김 / 0329 data·이력 뷰, 0326 viewport | **S-E1**: 같은 최신 턴에 과거 1/100/10,000턴, 최신 턴이 하단에 보이는 **첫 실제 본문 paint**(W-009 경로). 구 DB 색인 준비 전·중·후, 중단·재기동, 준비된 세션 재열기를 분리. **S-E2**: 짧은/긴 턴에서 정밀 터치패드 관성 플릭 1회당 이전 턴 요청 1회, 당김 표시·스피너, 중복 입력·실패·재시도·이력 끝, 드래그 중 앞삽입과 읽던 위치 ±1px. 휠·키보드·버튼과 구분하고 이벤트 간격 분포(200ms 경계 검토용)를 남긴다. |
| W2′ 과거를 읽는 중 live 결과·대형 턴 도착 / 0329 이력·세션 요약, 0326 live | **S-E3**: 현재 턴 delta·과거 턴 소유 결과·A→B→A 지연 응답이 맞는 세션·턴에 한 번만 반영. 이력 파생 패널은 세션 전체, 실행·취소·현재 턴 TODO는 live 소유. **S-E4**: 4MiB 본문·600메시지 턴·20만 빈 메시지 턴 구분. 첫 paint 뒤 유휴 시 같은 턴 잔여만 한 묶음씩, 입력 중 보류·세션 전환 시 정지·이웃 턴 자동 요청 0. 한 방향 오류 뒤에도 반대 방향 같은 턴 잔여는 계속 채우고 오류 방향은 사용자가 재시도. |
| W2″ 검색 결과 클릭·Enter / 0328 결과 목록, 0329 이동·강조 | 클릭과 Enter 각각의 선택 시작점 → 대상 행 첫 가시 프레임, 그때 시작한 강조 → 약 2초 뒤 해제를 따로 기록. 63턴 도착 → 62·64턴 양방향 읽기 → 100턴 최신 live 합류, 연속 선택의 늦은 응답·위치 소실·수동 스크롤·뒤로/앞으로·최신 복귀를 탐색 ID로 추적. 검색 순서·발췌문은 0328, 실제 도착 행·강조·복귀는 0329에 귀속. |
| W3 대화·Git·산출물에서 드래그하고 Ctrl+C / 0326 transcript, 0327 패널·내부 가상 행(W-008) | **정상 복사**: 선택 영역에 새 행이 마운트되지 않으면 부분·역방향 선택도 브라우저 기본 복사로 화면 텍스트와 일치. **선택 취소**: 해당 영역에 새 가상 행이 마운트되면 선택이 비고 같은 드래그에서 되살아나지 않으며 Ctrl+C 후 **기존 클립보드 값이 유지**. 놓고 재선택하면 새 내용이 복사. 다른 패널에서만 행이 바뀌거나 새 행 없이 스크롤하면 기존 선택 유지. J9·K12·복사 전용 50ms는 필수 셀 아님. F5와 0327 S-C1/S-C3을 쓴다. |
| W3′ 스트리밍 중 긴 Markdown·대형 diff·도구 카드 / 0327 워커·가시 뷰, 0326 스크롤 | AC30은 S-C0~S-C9 기록 완결로 판정. Markdown은 **미확정 꼬리 길이** ≤4,000자 렌더러 처리, 4,001~50,000자 워커 처리, ≥50,001자 새 파싱 요청 없이 원문 표시. 통합 기록에서 하단 추적·위에서 읽기·비활성 세션 복귀, OpenCode의 메시지 완료·턴 종료를 구분. S-C9는 선행 작업의 워커 점유·다음 가시 요청의 대기·결과의 첫 paint를 따로(`finishComputeTimings()`). 선행 기계 경계 시험은 0327 verify를 인용. |
| W4 이미지 5장 첨부 직후 전송·세션 전환 / 0328 컴포저, 0327 워커 | 썸네일 응답을 보류하고 원본이 입력 순서대로 한 번 전달되는지 본다. 수락과 같은 입력 처리 안에 초안·첨부가 비고 포커스가 돌아온다. 송신 시 미준비 이미지는 재시작 뒤에도 미리보기 없는 파일로 남고 후속 초안도 보존. 보내기 전 A→B 이동 시 초안·첨부·진행 중 작업 유지, B에서 보내면 B로. 전송 거부·IME 조합 중에는 초안과 첨부 유지. |
| W4′ 목록·패널·설치 로그·창 조작 / 0328 호스트·렌더러·셸 | S-D1~D10 실제 행, S-D10a/b/c 따로. R-H 호스트·창 시간(ms)과 IPC 바이트·DOM 행 수 별도 열, R-W·R-R 각각. S-D8 실제 설치 terminal 이벤트와 진단 1만 줄 폭주, S-D9 실제 한글 IME, S-D10 일반·최소·최대 창 종료 후 재실행을 구별. 긴 계획 댓글 패널 폭 드래그, 설치 로그를 위로 읽다가 종료 이벤트 수신을 다른 세션 스트리밍과 겹친다. |

| 변화시키는 축 | 낮은 입력 ↔ 높은 입력 | 고정할 것 · 실제 진입 |
|---|---|---|
| 화면 밖 이력 길이(W2) | 완결 과거 턴 1개 ↔ 100개(0326 S4 규모) | 마지막 턴·패널·창 크기 동일. E의 자료 경로는 복원 세션 둘에서 이전 턴 1개를 당긴다. 0326 진단 store 앞삽입(`prependFixtureTurn`)은 따로 표시. |
| 현재 한 턴의 길이(W1/W3) | 도구 호출·결과 짝 10개 ↔ 500개 | 이전 1턴, 각 결과 128자, 카드 상태 고정. 각 하네스의 실제 블록 수를 적는다. |
| 단일 출력의 크기(W3) | F5 앞 2,000줄 ↔ 50,000줄 | 과거 1턴, 호출·결과 1쌍, 같은 Git 패널에서 펼침·휠·복사. 줄 수·바이트·해시를 적는다. |

### H5. 원자료로 재계산한다

각 실행마다 시작·끝 시각과 trace 이벤트 범위를 남긴다. 설치본 로그는 `$env:USERPROFILE/.config/orcinus-orca/logs`의 원본 및 회전분을 해당 runDir로 복사한다. 검증자는 §14 방식으로 입력 p95/최대, thread별 개수와 최장 정지, 프레임 분모, 통과/미판정을 원자료에서 직접 다시 계산해 판독기 출력과 대조한다. 0326의 S1·S2·S6·S7은 비교 지표, S3~S5·S7d는 절대 기준으로 교차 확인한다.

### H6. 결과를 소유자에게 돌리고 사용자 판정을 기록한다

| 결과 표의 열(W-011) | 작성 단위 |
|---|---|
| 소유·커버리지 | T/잔여 단위 · 소유 AC/§19 · 유효 계약(W-007) · 처리(수정·검증 완료 / 근거와 현행 유지 / 미검증·잔여 위험) |
| 소유자 기계 PASS | 소유 verify 좌표와 판정(`PASS`·`FAIL`·`미완`) |
| 소유자 Windows 결과 | 소유 AC(AC19·AC33·AC30·0328 Windows 행·AC10)의 Windows 기록 좌표와 소유 규칙 판정 |
| W 통합 판정 | 프로필 · 기준 revision · 하네스 · 입력/세 축 크기 · 빌드 종류/양 SHA · 구간 · 3쌍 값/N·단위·rawRef · 집계 · 비교식 · 충족/위반/미판정/기록 전용(판독기 출력) |
| 사용자 확정 | 결정자·일시·W-004 revision |
| 최종 기록 | H1 예정 셀과 실제 셀의 양방향 차집합·중복·충돌 · 위반/빠진 셀과 소유자 · 합의 전/후 구분 · W verify 링크 · 원소유 verify와 INDEX 반영 상태 |

**재측정.** 수정 효과 확인은 영향 셀과 그 셀이 속한 교차 조작만 재실행할 수 있고 이전 SHA 결과를 보존한다. **최종 통합 PASS**는 하나의 통합 SHA와 하나의 기준 revision에 대한 W 필수 셀 전체가 필요하다 — 서로 다른 SHA의 통과 셀을 모아 만들 수 없다(판독기 P4 ⑧). 0329 NX1~NX3는 INDEX 후보 표의 기존 행으로 추적한다.

**운영 gate.**
- 설계 턴: 참조·보드 정합성, `git diff --check`, `cd app && node scripts/check-doc-inventory.mjs --check`.
- WU-M 구현 턴: `app/AGENTS.md`의 IMPL_DONE 전 로컬 확인 전부(`check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · `check-ui-thread` · `lint` · `typecheck` · 파일 필터 없는 `vitest run` · `node --test scripts/*.test.mjs` · `electron-vite build` + `smoke-hosts` + `smoke-preload`). 판독기·도구 시험은 `node --test scripts/windows-verdict.test.mjs scripts/measure-stage-d.test.mjs scripts/measure-stage-e.test.mjs`로 따로 결과를 적는다. H1-0 1~5 기록.
- WU-W: 통합 SHA의 CI 산출 확인 + Windows 실기. 기계 gate와 Windows 실기 결과는 별도 행으로 남긴다.

## READY self-review

- **WU-M READY · WU-W 대기(W-004 OPEN).** WU-M은 W-004 값과 무관하게 판독기가 결정 파일을 입력으로 받으므로 막히지 않는다. W-004는 측정 장비나 내부 stall 상수에서 추론할 수 없다.
- Ledger: W-003 → W-007 대체, W-007~W-013 추가. `ACTIVE 결정 ↔ AC` 대조 결과는 §3 갱신 메모(충돌 0).
- V: 모든 NEW 왼쪽 노드에 같은 레벨 REQUIRED pair(VP-01~13). 영향받은 상위 동작은 0328 VP-12·25 → VP-R1 REGRESSION. VP-01~07은 WU-W에서 닫는다.
- §10: 규칙 칸 분기마다 입력 칸 입력이 있다 — P1 3/3 · P2 3/3 · P3 9/9 · P4 8/8 · P5 4/4 · C 4/4 · P6 S1~S9 · P7 E1~E4. 판독기는 모르는 형태 fail-closed(§10-A 출력 문단). 자리 검색 명령과 rev 2 시점 출력은 §10-A·§10-B 말미와 §8.
- 인용 실측: 커밋 5개 조상 관계·tree 동일성, `3d8e1d90`/`4412276f` blob, `main.tsx:23-26`, `session-load.ts:91-119`, J3/J8, F9 파일명, 진단 다리 실제 이름, CI `fetch-depth: 0`·`npm test`를 이번 턴에 확인했다(§0·§8). 입력 파일 해시는 이 환경에 node_modules가 없어 재지 않았다 — H1-0 1번이 기록한다.
- 사람 실기로 미룬 순수 로직 없음: 판독 규칙·스탬프·좌표 검증은 전부 `node --test`. Windows 실기는 장비·IME·터치패드·GPU 관측만 남는다.

---
> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §9).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: … (Part I/II의 정확한 절 인용)
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

> `§10`의 `언제 강제` 칸은 **하나의 불변식이 성립해야 하는 지점 목록**이다. 한 지점만 닫아도
> 대표 경로 AC는 통과하므로 게이트 green은 전수를 뜻하지 않는다.
> **각 행의 `재현 명령 / 관측`은 이번 턴에 실제로 실행한 것만 적는다** — 산출물에서 표식을 다시
> 찾지 못하면 그 행은 닫힌 것이 아니다.
> **그 관측이 구조적 proxy·0건/전수 스윕·배선 존재 oracle이고 이번 턴에 장치를 만들거나 고쳤다면,
> 등록된 결함을 심어 실패하는지 먼저 확인한다** — 눈이 없는 장치의 `0건`은 전수의 증거가 아니다.
> 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개는 oracle 종류와 무관하게 돌린다(impl §3 sweep). 그 밖의 직접 oracle에는 mutation을 더 발명하지 않는다.
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §9).
> **`닫은 지점`은 §10 항목이 아니라 §10이 고정한 자리로 세고, 기록된 자리 검색 명령을 다시 돌린 출력과 목록의 차집합을 적는다** — 목록이 없거나 출력과 갈리거나 술어가 불변식의 주어가 아니거나 범위가 지적이 인용한 파일로 좁으면 `PLAN_GAP`이다(impl §2).
> **닫은 자리마다 직접 oracle 좌표(`파일:테스트명` / 실패 의미 red를 관측한 `gate:<명령>`)를 적는다** — typecheck·코드 읽기·일회성 실측만 있는 자리는 `남긴 곳`에 적고 세지 않는다(impl §2).
> **좌표는 그 테스트의 실행 구간(들어간 곳 → 관측한 곳, mock한 path 구성요소 제외) 안의 자리만 닫는다** — 안쪽 export로 들어가거나 한쪽 끝을 mock하거나 내부 상태만 단언하거나 production 조립이 주입하는 의존성을 빼 다른 분기를 탄 테스트가 건너뛴 자리는 `남긴 곳`이다. 운반 값을 기본값·빈 값·형제와 같은 값으로만 준 좌표, 자리 규칙이 적은 분기 중 입력이 없는 분기가 있는 좌표도 그 자리를 닫지 않는다(impl §2).
> **`§10이 적은 지점`은 그 pair의 §10 자리 전부다** — 재구현 턴에도 지목된 자리만 적지 않고, 닫지 않은 자리는 `남긴 곳`에 남긴다(impl §9).
> **`운반 항 · 구별 값 · 관측`은 닫힘으로 센 행마다 그 자리가 넘기는 항, 테스트의 구별 입력, 좌표가 관측하는 곳을 적는다** — 셋 중 하나가 빠진 항은 `남긴 곳`이고, 호출·분기를 바꾼 변이의 red로 인자 항을 채우지 않는다(`docs/handoff/AGENTS.md §공통 V`).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 · commit → `a.test.ts:'…'` · revoke → … | commit: `key`(형제와 다른 값 → 저장 결과 단언) · … / 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음 / … → 분류(impl §7): 목록 미고정 → PLAN_GAP · 현재 결함 → 선조치 또는 PLAN_GAP · 확장 후보 → 확장 창이 열려 있으면 PLAN_GAP 가능, 닫혔으면 보고 · 비귀속 → 별도 finding
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 / ID → 잡은 테스트 `파일:테스트명`(재실행 결과) 또는 `동치` 근거·확인 실행 — 분류가 이행·현재 결함이거나 설계자가 채택한 확장 행은 이번 턴에 닫는다. 후보 표로 간 행과 `경계` 행은 제외

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다. 이전 라운드 상태를 유지로 옮기는 행도 좌표를 인용하고, 좌표 없이 났던 `SELF_PASS`는 이번 턴에 재판정한다(impl §2).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | `파일:테스트명` … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> **열거 sweep**: 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개(제거 — 계약이 다른 형제 슬롯이 있으면 맞바꿈을 더함)를
> 심어 red인지 본다(impl §3, 하네스 `.agents/skills/handoff-verify/scripts/mutate.py`). 그 위에 pair가 선택한 적대 증거·
> 파생 이슈의 인용 변이·이번 턴에 만든 구조적 proxy·0건/전수·배선 oracle의 민감도를 심는다. 규칙 칸 분기와 여러 항을 적은
> §10 자리 문장의 항은 그것을 구현한 diff 자리(조건·조기 반환·후보를 합치는 항)마다 제거 변이를 심어 찾는다. 그 밖의 hunk에는 mutation을
> 새로 발명하지 않는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `sweep — §10 자리 / path edge / 규칙 칸 분기(diff 자리)` / `재앵커 — 원 ID` / `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 테스트 추가** / 동치 — 근거·확인 실행 |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K · sweep S = 표 행 T` — sweep S는 열거 항목 수와 같아야 한다. 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §9).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 분모는 직전 verify 고장 이력의 `잡음` 행 중 하한 ④와 같은 범위이고, 원문이 옮겨 갔으면 재앵커한 행이다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 / … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … / **표에 없음** | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

> 범위 밖이라 이번에 고치지 않더라도 **적는다** — 적지 않으면 그 선택지가 존재한 적도 없게 된다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 선조치(구현 세부) / 📝 **plan 수정 제안**(설계가 틀렸다는 증거) / ⚠️ 보고만(제품·AC·Decision·의존성) | … |

> 가운데 갈래가 구현 턴의 핵심 산출이다 — plan을 고치는 것은 설계자 책임이지만, **고쳐야
> 한다는 증거를 만드는 것은 구현자만 할 수 있다.** 무엇이 틀렸는지·코드에서 무엇을 봤는지·
> 어느 절을 어떻게 바꿔야 하는지를 함께 적는다.

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음 / …

> 차이가 있으면 **대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다 한 줄씩** 적고, 그 축에서 다시 확인한
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §7).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … / 해당 없음 + 근거 | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … / 해당 없음 + 근거 | … |
| 재진입 | … / 해당 없음 + 근거 | … |
| 다른 무효화 축 | … / 해당 없음 + 근거 | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | `ci.yml` 단계 전부의 로컬 대응(파일 필터 없는 테스트) — 테스트 N파일 / M케이스 · error·warning 수 · 돌리지 못한 단계와 이유 · 기준선 분리 근거(변경 전 실패 집합과 차집합 ∅ + 환경 원인, `docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only`로 뽑은 테스트 파일 N · 규칙별 위반 0(app: 시간 예산·호스트 격리·풀 분류) · 그 파일들의 규칙 가드 실패 0 — 테스트를 건드리지 않았으면 `해당 없음` |
| V-pair 자기확인 | `SELF_PASS N / SELF_BLOCKED M`; pair별 상세는 위 표 |
| 강제 지점 전수 | N/M |
| **AC 자기보고**(`Criteria-Met`) | N/M — 각 AC 옆에 **이번 턴에 재현한 관측값**을 적는다. 표식을 다시 찾지 못한 AC는 ✅로 세지 않는다 |
| **합계 검산** | `✅ N · ⚠️ M · ❌ K = 총 T` — 분모를 다시 세고 **이 줄을 쓴 뒤** 커밋 trailer를 적는다. 분모가 바뀌었으면(AC 분할·추가) 그 사실을 적고 이전 라운드 합계와 직접 비교하지 않는다 |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r<N> 구현 — 좌표는 INDEX)` — 자기 환경의 해시를 적지 않는다. 좌표 정본은 `INDEX.md` 한 곳이고 검증자가 채운다 |

## [구현자 기입] Review Signals — 사실만

> 원인 분류(A~F)와 지침 변경은 `handoff-review`가 한다.

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 / …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: 없음 / …
- 현재 라운드·impl 턴: `rN` / `rN.k` (verify 3·6회째 FAIL/RETURN_TO_PLAN 또는 verify 없는 impl 턴 3 초과면 — 사용자 요구 변경 턴 제외 — 다음 재구현 전에 `handoff-review`. verify 9회째가 PASS가 아니면 `verify/CLOSED` 종료)

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | … | verify r<N> · VP-… · AC<N> / §10 <N>행 / gate | … | 이행 / 현재 / 확장 / 경계 / 비귀속 | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | open / 구현중 / 해결 / 후보 표 |
