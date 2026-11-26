# Plan — 0330 Windows 실창 반응성 통합 판정

> 입력(V1 rev 2): [PR #640 코멘트 — 0330 Windows 통합 판정 · 구현 전 plan 보완 요청](https://github.com/muzaby/orca-skin/pull/640#issuecomment-7179699819)(2026-11-26, 검토 기준 `eae9081b`). 지적별 코드 대조는 §0.
> 입력(V1 rev 3): [PR #655 코멘트 — V1 rev 2 재검토 · WU-M 착수 전 보완 요청](https://github.com/muzaby/orca-skin/pull/655#issuecomment-7181076179)(2026-11-26, 검토 기준 `ff5c6b02`). 지적별 대조는 §0-B.
> 입력(V1 rev 4): [PR #655 코멘트 2 — V1 rev 3 재검토 · 판독기와 Windows 실측 절차 보완 요청](https://github.com/muzaby/orca-skin/pull/655#issuecomment-7181696158)(2026-11-26, 검토 기준 `4eb44249`). 지적별 대조는 §0-C.
> 입력(V1 rev 5): [PR #655 코멘트 2 갱신 — V1 rev 4 재검토 · 남은 보완 요청](https://github.com/muzaby/orca-skin/pull/655#issuecomment-7181696158)(2026-11-26 03:40 갱신, 검토 기준 `cda149e3`). 지적별 대조는 §0-D.
> 입력(V1 rev 6): [PR #655 코멘트 2 재갱신 — rev 5 검토 · 구현에 반영할 보완점](https://github.com/muzaby/orca-skin/pull/655#issuecomment-7181696158)(2026-11-26 04:30 갱신, 검토 기준 `13c41374`). 지적별 대조는 §0-E.
> 입력(V1 rev 7): [PR #655 코멘트 2 — rev 6 검토 · K2 완료 조건](https://github.com/muzaby/orca-skin/pull/655#issuecomment-7181696158)(2026-11-26 04:48 갱신, 검토 기준 `33760ca6`). 지적별 대조는 §0-F.
> 입력(ΔV1): [verify 1회째 — RETURN_TO_PLAN](verify.md)의 PLAN_GAP D1·D2 · 사용자 지시 “330 D1·D2 정정하라”(2026-11-26). 정정 내용은 §20.

## 메타

| 항목 | 값 |
|---|---|
| slug · 작성 · 일자 | `0330-windows-responsiveness-verdict` · Codex(V1) → Claude Code(V1 rev 2·rev 3) · 2026-11-20 / 2026-11-26 |
| 상태 | **verify/RETURN_TO_PLAN — WU-M 기계 범위 (V1 rev 7 + ΔV1 · r2 · verify 2).** D1·D2 닫힘. [verify.md](verify.md) 확장 PLAN_GAP D4·D5 → 설계자. WU-W(판정용 Windows 실측)는 W-004 사전 합의와 H1 필수 셀 목록 고정 뒤 착수한다(W-013). |
| 기준 트리 | `ff5c6b02`(PR #655 head). 앱 코드는 `eae9081b`와 같다(`git diff --quiet eae9081b ff5c6b02 -- app` → exit 0). V1의 기준 `62125eaa`는 PR 이력에 없어 rev 2가 대체했다. |
| V mode · 기준 V · revision | **Delta V** — 기준 `V1 rev 7`(설계 `a8bbe99a`, 구현 r1 `ae27c4f7`·`f5ce4ca9`, verify 1 `b7e59da4` — 모두 PR #655 브랜치, `main` 미병합) · 이번 revision **ΔV1**(§20) · 유효 V = `V1 rev 7 + ΔV1`. rev 1~6 = `a680ee0`·`ff5c6b02`·`4eb44249`·`cda149e3`·`13c41374`·`33760ca6` |
| 작업 단위와 판정 구분 | §7-A “세 구분” 표가 정본이다(W-018) — WU-M 기계(지금) · 참고 기준선(0325 AC19, 지금) · WU-W 실측(W-004 뒤). |

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

## 0-B. PR #655 피드백 대조 — 지적 13건 재현, 수용

| # | 지적 | 재현 명령 → 관측 | 판정 · 반영 |
|---|---|---|---|
| G1 | 실패 예제가 확정 뒤 exit 0을 요구 | rev 2 §10-A 예제 = 위반 1·결측 1·소유자 FAIL 1인데 C 칸이 “확정 추가 → exit 0”. 같은 절 P4 ④는 위반이 있으면 `불합격` — plan 내부 불일치 | 수용 → 예제 둘(실패·충족) · §10-A C · AC7 |
| G2 | 필수 소유 판정 결측이 `미기록`만 | rev 2 P5 ④ | 수용 → P5 ④ `판정 보류` |
| G3 | 셀 키·실행 짝·표본 구분 필드 부재 | rev 2 `cells`에 조작·부하·구간·짝·표본 종류 없음, `manifest.runs`에 전후 구분 없음 | 수용 → §10-A 입력 스키마 · P3 ⑭ |
| G4 | 통합 SHA 검사 범위 | rev 2 P4 ⑧이 모든 통과 셀에 `integrationSha`를 요구 → 정상 이전 빌드·소유자 표본이 불일치가 된다 | 수용 → W-016 · P4 ④ |
| G5 | `count/ratio/equal`·세 반복 집계 미정 | rev 2 `rule`에 피연산자·`combine` 없음 | 수용 → §10-A `rule` 표 |
| G6 | 합의·확정 구분, 같은 시각, 실물 없는 원본, T33 | rev 2 P4가 `decision.confirmed`만 본다. P1 ①은 `startedAt < lockedAt`만 정의, P2는 `rawRef` 형식만 본다 | 수용 → W-015 · P1 · P2 · P5 ⑤ |
| G7 | 0329 기준선 절차 | 깨끗한 worktree(`ff5c6b02`)에서 `git checkout 7db1c7ce -- app/src` → 추가 파일 48개 잔존, `git diff --quiet 7db1c7ce -- src` exit 1. `git restore --source=7db1c7ce --staged --worktree -- app/src` → exit 0 · 미추적 0 · `git write-tree --prefix=app/src/` = `9235fa7c…` = `git rev-parse 7db1c7ce:app/src` | 수용 → W-014 · H1-0 3 · P7 |
| G8 | 0329 Windows 종료 코드 | `measure-stage-e.mjs:98` `verdict`에 `latencyGate.pass`가 들어가고 `:109` `selectionExitCode`(`check-transcript-selection.mjs:95-99`)가 exit 1 | 수용 → W-017 · AC10 · P8 |
| G9 | 0328 기준선 도구 배치 | `git ls-tree -r --name-only c7d2adf2 -- app/scripts \| grep -c stage-d` → 0. `measure-stage-d.mjs:49` · `host-runner.mjs:12` · `shell-runner.mjs:29`가 HEAD `c7d2adf2`를 요구 | 수용 → W-014 · P6 S10 |
| G10 | 출처 충돌·환경 부재 표본 | rev 2 P6 S8은 `provenanceConflict`를 만들지만 소비하지 않는다 | 수용 → P6 S8 · 판독기 P2 ④ |
| G11 | H1 두 쌍·예제 경로·fixture 목록 | rev 2 PowerShell은 비교축 쌍만 diff. H1-0 5번 경로가 `app/` 기준이 아니다. fixture 해시 목록이 없다 | 수용 → H1 (a)/(b) · H1-0 · `evidence/inputs-sha256.txt` |
| G12 | §7 R 수준 pair · `BLOCKED_BY:W-004` | rev 2 §7-A에 R-07~09 pair 없음. pair 결과는 `PASS`·`PAIR_FAIL`·`BLOCKED_BY:<root-pair>`·`NOT_REQUIRED`뿐이다(`docs/handoff/AGENTS.md:82`) | 수용 → VP-14~17 · W-018 세 구분 |
| G13 | T09 적용 경계 | `7db1c7ce`가 0329 기준선(전량 열기, 0329 plan:517)인데 rev 2 §12는 “`7db1c7ce` 이전”. 0329 AC1(plan:228)은 출판된 세션만, AC11(:238)은 미준비 첫 클릭 | 수용 → W-019 · §12 |

(표의 G1~G13은 코멘트 3절을 지적 단위로 나눈 것이다. 코멘트가 이미 확인했다고 적은 항목 — 여덟 시나리오·담당 구분·유효 계약·D-109·J9/K12 폐기·검색 첫 가시 프레임·W-004 서식 — 은 바꾸지 않았다.)

## 0-C. PR #655 코멘트 2 대조 — 지적 5건 재현, 수용

| # | 지적 | 재현 → 관측 | 판정 · 반영 |
|---|---|---|---|
| K1 | 셀 목표와 실제 런타임·수집 성공 대조 | rev 3 P2 ④는 `MEASUREMENT_ENVIRONMENTS`(`linux-electron`·`win32-electron`) 안이면 통과 → Windows 실창 셀에 Linux 자료가 들어간다. Node 함수 측정의 런타임 값과 `env:false` 전달 칸이 없다 | 수용 → W-020 · P2 ④⑦ · P4 ③ · U25~U27 |
| K2 | 원본 구간 실재 · T33 규칙 모순 | rev 3 P2 ③은 `range` 빈 값만 본다. P5 ⑤는 “셀 **또는** owners 행”인데 U17은 owners 행 누락을 `missing`으로 요구 — plan 내부 불일치 | 수용 → W-021 · P2 ③ · P5 ⑤ · U17 · U28 |
| K3 | 입력·필터·결과 단위 | rev 3 `rule.unit` 하나뿐이고 대조 단계가 없다. 집계 표에 `bytes` 없음 | 수용 → W-022 · 집계 표 · P3 ⑮ · U29 |
| K4 | 0327 대체 조회 오류 | `git log -1 --grep="Handoff: docs/handoff/0327" --grep="Status: implemented" --all-match c7d2adf2` → `3550306f`, 앱 diff 65파일. 실제 대응 `7ab3f912`는 `Status: partial`. 판정 구현 `a1d1b49c`·`b5101150`은 PR 이력 밖(`git merge-base --is-ancestor … eae9081b` 실패) | 수용 → H1 (a) 표에 대체 SHA 5개 명시, 조회 규칙 삭제 |
| K5 | 도구 사전 점검 ↔ 소유자 후속 실행 | rev 3 H1-0 3·4의 후속 실행은 HEAD(WU-M) 앱이라 `appSource.commit` = WU-M → 소유자 셀의 `pair.afterSha`(`7db1c7ce`·`eae9081b`)와 P4 ④에서 어긋난다 | 수용 → W-023 · `--app-source` · H1-0 3·4 용도 분리 |

코멘트가 확인했다고 적은 항목(기준선 복원 diff 0·미추적 0·tree 일치, 입력 216개 해시 일치, 기존 0328 `--compare` exit 0, 예제 판정 정리, 합의·확정 분리, SHA 범위, 0329 Linux 전용 기준, T09 경계)은 바꾸지 않았다.

## 0-D. PR #655 코멘트 2 갱신본 대조 — 지적 4건 재현, 수용

| # | 지적 | 재현 → 관측 | 판정 · 반영 |
|---|---|---|---|
| K1′ | H1과 P2의 런타임 규칙 불일치 · Node 수집 성공의 출처 | rev 4 H1 “측정 도구 좌표”는 `environment`가 `win32-electron`이 아니면 제외 → P2 ④의 `win32-node`와 모순. `measure-ui-inputs.mjs:914-916`는 `Node <버전> · <platform>/<arch>` 줄과 측정표만 쓰고 `env` 필드가 없다 — rev 4의 `collected`(도구 `env`)는 Node에서 출처가 없다 | 수용 → W-024(W-020 대체) · P2 ④⑦ · H1 문장 · U25·U26 |
| K2′ | 첫 가시 프레임·첫 본문 paint의 원본 | rev 4 `trace-ts`는 구간 안 이벤트 1개로 통과. 앱은 대상 식별 trace 기록을 내지 않는다 — `rg -n "performance\.(mark\|measure)\(" app/src/renderer/src` → `oo-selection-cancel` 1건(`TranscriptViewport.tsx:671`). DOM 식별자 `data-message-id`는 `7c241d19`부터, `data-history-highlight`는 `eae9081b`부터 있다(`git grep -l` 0325 0 / 0326~0329 3 · 0329만 3) | 수용 → W-025 · W-027 · P2 ⑧ · P9 · U31 |
| K3′ | `equal`과 상대 비교 | rev 4 집계 표가 상대 비교를 “모든 집계”에 적용 | 수용 → W-026 · 집계 표 · P3 ⑯ · U30 |
| K4′ | PowerShell 자리표시자 | rev 4 H1 예제가 `<판정 구현 SHA>` — 표는 PR 대체 SHA를 쓰라고 한다 | 수용 → `<PR 이력의 대체 SHA>` |

코멘트가 확인했다고 적은 항목(T33 보류·exit 2, 정지 건수·IPC 바이트 예제, 도구 점검/소유자 기준/후속 분리와 세 소스 버전 복원)은 바꾸지 않았다.

## 0-E. PR #655 코멘트 2 재갱신본 대조 — 지적 4건 재현, 수용

| # | 지적 | 재현 → 관측 | 판정 · 반영 |
|---|---|---|---|
| K1″ | Node 행은 실패해도 같은 ID로 나온다 · 실행 원본·장비 기록의 역할 | `measureCase`(`measure-ui-inputs.mjs:202-216`)는 함수 없음 → `N/A(함수 없음)`, 예외 → `N/A(실패: …)`, 정상 → `formatCell`(`:218-222`) `<중앙값>ms / <최대>ms` — 셋 다 같은 `\| <id> \|` 행이라 rev 5 P2 ③ `table-row` 존재 검사는 셋 모두 참. 앱 로그는 플랫폼을 남기지 않는다(`boot-report.ts:64-69` 필드 4개) | 수용 → W-029(W-024 대체) · P2 ⑦⑨ · U34·U35 |
| K2″ | 표시 시각을 만드는 쪽의 대상 식별·시작점 | rev 5 P9 M1은 아무 메시지 행이나 고른다 — 근거로 든 `stage-e/probe.tsx:125-129`는 본문 문자열까지 확인한다. rev 5 P9 M3은 `pointerdown`에 재무장, P2 ⑧은 `click` 뒤 기록을 요구해 시작점이 다르다 | 수용 → W-030·W-031(W-025·W-027 대체) · P2 ⑧ · P5 ④ · P9 · U31~U33 |
| K3″ | 상대 비교의 단위 문장 | rev 5 집계 표 “두 집계는 입력 단위 그대로” — 정지 건수 비교면 전후 집계는 `건`이다 | 수용 → W-032(W-026 대체) · 집계 표 |
| D1 | 문서 일치 | rev 5 W-021·§10-C가 구간 형식 3종만 적고 `table-row`·`trace-marker`가 빠짐. READY 점검이 `VP-01~17`, 운영 gate 시험 목록에 `diagnostic-overlay.test.mjs` 없음 | 수용 → W-028(W-021 대체) · §10-C · READY · H6 운영 gate |

코멘트가 완료로 확인한 K4(PowerShell 대체 SHA)는 바꾸지 않았다.

## 0-F. PR #655 코멘트 2 rev 6 검토 대조 — K2 세 조건 · 정리 3건 재현, 수용

| # | 지적 | 재현 → 관측 | 판정 · 반영 |
|---|---|---|---|
| K2-1 | 선택한 세션의 실제 본문 | 시험 데이터가 세션마다 같은 `native-<j>`·`fixture message <j>`를 만든다(`stage-e/host.ts:42-54`). transcript DOM에는 세션 식별자가 없다 — `data-session-id`는 사이드바 행뿐(`SessionRow.tsx:134`·`:223`·`:251`). 세션별 재마운트는 정책에 따른다(`ChatTile.tsx:147` `remountTranscriptBySession`). 행은 `sessions[activeKey].session.messages`에서 그려진다(`chatStore.ts:3119-3121`, `ChatTile.tsx:58`·`:62` 같은 슬롯) · transcript 경로의 `useDeferredValue`·`startTransition` 0건 | 수용 → W-033(행 소유 세션 DOM 표식) · W-035 · P9 M1 · P10 · VP-19 |
| K2-2 | 선택·반복별 귀속 | rev 6은 `opId`를 셀 `target`에 넣어 H1 사전 고정 항목과 실행 시점 값이 섞였다 | 수용 → W-034 · 스키마(`cell.target` = 목표, `run.selections` = `opId` 대응) · P2 ⑧⑩ · U36 |
| K2-3 | 구 빌드 관측 불가 | rev 6 §10-C가 `d8684684` 첫 본문 셀을 `absent`로 적었다 — P3 ⑨′·H1은 `unobservable` | 수용 → §10-C 정정. `absent`는 기능 자체가 없을 때만 |
| D2 | 값 열 이름 · 다른 실행 원본 | rev 6 P2 ⑨가 `rawRef.column`, 스키마는 `range.column` · 표 행을 같은 run의 `runRef`와 대조하는 규칙 없음 | 수용 → P2 ⑨ `rawRef.range.column` · P2 ⑩ · U37 |
| D3 | `target` 누락 위치 참조 | rev 6 §0-E·갱신 메모가 “P5 ⑧” — 본문은 P5 ④. P5 분모 8은 ①~⑦에 ⑥ a·b를 따로 센 값 | 수용 → 참조 정정 · 분모 표기 `P5 8(①~⑦, ⑥ a·b)` |

코멘트가 반영 완료로 확인한 K1 정상 수치·0·N/A, K3 상대 단위, K4 대체 SHA는 바꾸지 않았다.

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
| W-009 | 일반 열기의 주 측정 경로는 **제한 페이지 조회 → IPC 응답 → 창의 `HistoryPageReplySchema` 검증 → 상태 반영 → 첫 실제 본문 paint**다. 구 빌드의 조각 조립과 전체 archive가 필요한 실행 복구·분기는 별도 행이다. | PR #640 코멘트 §1 · F6 | SUPERSEDED → W-019 |
| W-010 | 판독기는 `app/scripts/windows-verdict.mjs`·`windows-verdict.test.mjs`에 둔다 — `npm test`의 `node --test "scripts/*.test.mjs"`를 통해 `ci.yml` test 단계가 그대로 실행하므로 CI 파일을 바꾸지 않는다. V1의 handoff 폴더 위치를 대체한다. | 설계 판단(되돌리기 쉬움) · PR #640 코멘트 §3 “PR 자동 게이트로 운영할 경우 CI에 해당 명령을 연결” | ACTIVE |
| W-011 | 결과표는 **소유자 기계 PASS · 소유자 Windows 결과 · W 통합 판정 · 사용자 확정**을 별도 열로 둔다. 최종 통합 PASS는 하나의 통합 SHA와 하나의 기준 revision에 대한 W 필수 셀 전체가 필요하다. 수정 효과 확인은 영향 셀·교차 조작만 재실행할 수 있고 다른 SHA의 통과 셀을 합쳐 PASS를 만들지 않는다. | PR #640 코멘트 §3 · V1 H6 | ACTIVE |
| W-012 | 측정 기록은 **생성한 프로세스의 실제 플랫폼과 앱 트리 SHA**를 원본에 남긴다. 기준선 측정 소스는 PR에서 도달 가능한 커밋과 blob 해시로 고정하고, 해시가 다르거나 도달 불가면 측정을 시작하지 않는다. | PR #640 코멘트 §1 · F4·F5 | ACTIVE |
| W-013 | 순서: 지금 plan 개정·WU-M·0325 AC19 참고 기준선. W-004 확정과 H1 필수 셀 목록 고정 뒤에 판정용 Windows 실측(WU-W). 합의 전 실행은 W 최종 표본으로 승격하지 않는다. | PR #640 코멘트 “진행 순서” | ACTIVE |
| W-014 (rev 3) | 기준선 측정 모델은 stage-d·stage-e 공통으로 **도구 체크아웃 + 기준 앱 소스 복원**이다. 측정 전용 worktree에서 HEAD = 도구 커밋, `git restore --source=<기준> --staged --worktree -- app/src`로 앱 소스만 되돌린다. 기준선 검사는 HEAD가 아니라 `app/src` 내용(기준과 diff 0 · 미추적 0)으로 하고, 출력은 `tool`(HEAD)과 `appSource`(기준 커밋·tree)를 따로 남긴다. 포기한 것: 기준 앱 HEAD에 도구를 복사하는 방식(0329 plan:1068) — 도구 출처가 HEAD에 남지 않고 stage-e의 PR 도달 검사(P7 E3)와 양립하지 않는다. | 설계 판단 · PR #655 §2 “도구에 앱 트리를 넘기는 방법” · G7·G9 | ACTIVE |
| W-015 (rev 3) | 사전 합의(`agreement`)와 최종 확정(`confirmation`)은 별도 기록이고 둘 다 `plan.revision`과 같아야 한다. 합의 시각보다 **뒤**(`startedAt > lockedAt`, 같은 시각은 합의 전)에 시작한 W 표본만 필수 셀을 채운다. 필수 원본(`rawRef` 파일·SHA-256·구간)과 도구 기록은 판독기가 `--raw-root`로 전수 대조하고 누락 셀을 `미판정`으로 보류한다. 구간 내용 재계산은 H5 사람 검증이다. | PR #655 §1 · G6 | ACTIVE |
| W-016 (rev 3) | 통합 SHA 일치는 **W 표본의 이후 쪽**에만 건다. W 표본 이전 쪽은 `plan.wBaselineSha`, 소유자 표본은 그 셀의 `pair` SHA와 대조한다. | PR #655 §1 · G4 | ACTIVE |
| W-017 (rev 3) | 0329 구 DB 측정 도구는 **기능 충족**(`functional`)·**Linux 기준**(`linuxLatencyGate`, 3,729ms)·**W-004 판정**(판독기 셀)을 따로 낸다. 시간 기준이 `verdict`·종료 코드에 들어가는 것은 `linux-electron`에서만이다. | PR #655 §2 · 0329 §17(Linux 단독 실행 기준) · G8 | ACTIVE |
| W-018 (rev 3) | 판정 구분은 셋이다 — **WU-M 기계**(VP-08~19·VP-R1 — rev 5가 VP-18, rev 7이 VP-19를 더함, WU-M verify가 닫음) · **참고 기준선**(0325 AC19, 0325 소유, W에서는 `기록 전용`) · **WU-W 실측**(VP-01~07). W-004는 pair가 아니라 WU-W 착수 조건이며, WU-M verify는 VP-01~07에 pair 결과를 주지 않고 `미착수(WU-W)`로 적는다. | PR #655 §3 · `docs/handoff/AGENTS.md:82` · G12 | ACTIVE |
| W-019 (rev 3) | W-009의 주 경로를 승계하고 적용 경계를 정한다: 과거 전체 본문 읽기·조립 0회는 **색인이 준비된 세션의 일반 열기**에 적용한다. **색인 미준비 구 DB의 첫 열기**는 0329 AC11대로 색인 준비 비용(변환 시간·디스크·읽은 bytes)과 첫 실제 본문 paint를 분리한다. `7db1c7ce` **포함** 이전 빌드는 조각 조립 경로(T09′)다. | PR #655 §3 · G13 | ACTIVE |
| W-020 (rev 4) | 셀의 기대 런타임 = 셀 프로필의 `os` + 측정 종류(`install`·`diagnostic` → `electron`, `node` → `node`)이고, run의 실제 런타임(`runtime`)이 같아야 그 셀을 채운다. 허용 런타임은 `linux-electron`·`win32-electron`·`linux-node`·`win32-node`. 수집이 실패한 run(`collected:false` — 도구 `env:false`)과 출처 충돌 run은 필수 셀을 채우지 않는다. Linux 참고 자료는 `sample:'reference'` 셀에서 집계만 하고 `기록 전용(참고)`으로 둔다. | PR #655 코멘트 2 · K1 | SUPERSEDED → W-024 |
| W-021 (rev 4) | 원본 **구간의 실재**는 판독기가 대조한다 — `range.kind`가 `lines`(1부터 닫힌 구간)·`trace-ts`(µs 닫힌 구간에 이벤트 ≥1)·`json-pointer`(RFC 6901 경로가 해석됨) 중 하나이고 원본에서 확인돼야 그 셀을 채운다. 모르는 `kind`는 보류다. 구간 안 수치의 재계산은 H5 사람 검증이다. | PR #655 코멘트 2 · K2 | SUPERSEDED → W-028 |
| W-022 (rev 4) | 단위는 셋이다 — 입력 단위(`observation.unit` = `rule.inputUnit`), 필터 단위(`where.unit` = 입력 단위), 결과 단위(`rule.unit` = 집계가 정하는 단위). 셋 중 하나라도 어긋나면 그 셀은 `미판정(단위 불일치)`이다. 지원 입력 단위는 `ms`·`px`·`frames`·`bytes`·`건`·`text`다. | PR #655 코멘트 2 · K3 | ACTIVE |
| W-023 (rev 4) | 측정 도구는 `--app-source <full SHA>`로 **소유자 후속 앱**을 지정할 수 있다 — 측정 전용 worktree에서 그 SHA의 `app/src`를 복원하고, 도구가 diff 0·미추적 0을 확인한 뒤 `appSource.commit`을 그 SHA로 기록한다. HEAD 앱 그대로의 실행은 **도구 사전 점검**이고 소유자 판정 표본이 아니다. | PR #655 코멘트 2 · K5 | ACTIVE |
| W-024 (rev 5) | W-020의 대조 규칙을 승계하되 **실제 런타임과 수집 성공을 manifest가 아니라 원본에서 유도**한다. run마다 `runRef`(도구 원본 출력)를 두고 종류별로 읽는다: `electron-json`(stage-d·e stdout) → `environment` 필드 · 수집 성공 = `env === true` 그리고 `error` 없음 / `node-stdout`(`measure-ui-inputs.mjs --src`) → `Node … · <platform>/<arch>` 줄의 `<platform>-node` · 수집 성공 = 기록된 종료 코드 0 그리고 그 지표의 표 행이 원본에 있음 / `device-record`(H1 장비 기록) → `Caption`이 `Microsoft Windows`면 `win32-electron`. manifest의 `runtime`이 유도값과 다르면(예: Linux 원본을 Windows로 기재) 그 run은 셀을 채우지 않는다. 기대 런타임은 Windows 설치·진단 = `win32-electron`, Windows Node 함수 = `win32-node`이고 H1 문장도 같은 규칙을 쓴다. | PR #655 코멘트 2 갱신 · K1′ | SUPERSEDED → W-029 |
| W-025 (rev 5) | **첫 가시 프레임·첫 본문 paint 셀**(`cell.target`이 있는 셀)의 원본은 `trace-marker` 구간이어야 한다 — 같은 trace에서 그 조작의 입력 이벤트(`EventDispatch` `click`·`keydown`)와, 그 뒤 구간 안에 대상을 식별하는 User Timing 표시 `oo-visible:<kind>:<messageId>`가 둘 다 있어야 원본 검사를 통과한다. 입력만 있으면 `미판정(대상 표시 기록 없음)`이다. 소요 시간 재계산은 H5 검증자 몫이다. | PR #655 코멘트 2 갱신 · K2′ | SUPERSEDED → W-030 |
| W-026 (rev 5) | `equal`은 절대 일치 비교 전용이다 — `equal` + `relative`, `equal` + `median-of-runs`는 `미판정(지원 안 함: 조합)`. 수치 상대 비교는 두 집계를 입력 단위(예: ms)로 낸 뒤 이후/이전을 결과 단위 `비`로 판정한다. | PR #655 코멘트 2 갱신 · K3′ | SUPERSEDED → W-032 |
| W-027 (rev 5) | 대상 표시 기록은 **진단 빌드 전용 콘솔 스크립트** `app/scripts/diagnostic-overlay/visibility-marks.js`가 낸다 — 앱 소스를 바꾸지 않고 DevTools 콘솔에서 실행하므로 소유 빌드 SHA마다 같은 파일(SHA-256 기록)을 쓴다. 대상 판정은 `stage-e/probe.tsx:121-131`과 같은 술어(뷰포트와 겹치고 높이 > 0인 `[data-message-id]` 행 · 검색 대상은 `[data-history-highlight]` 행)다. 설치본은 이 기록을 낼 수 없으므로 첫 가시·첫 본문 셀은 진단 빌드 셀이다. | 설계 판단 · K2′ | SUPERSEDED → W-031 |
| W-028 (rev 6) | 원본 구간 형식은 다섯 가지이고 판독기가 원본에서 실재를 확인한다: `lines`(1부터 닫힌 줄 구간) · `trace-ts`(µs 닫힌 구간에 이벤트 ≥1) · `json-pointer`(RFC 6901 경로 해석) · `table-row`(`\| <id> \|` 행 + 값 칸 해석, W-029) · `trace-marker`(선택 표시와 대상 표시의 짝, W-030). 그 밖의 형식은 보류다. 구간 안 수치의 재계산은 H5 사람 검증이다. | PR #655 코멘트 2 재갱신 · D1 | ACTIVE |
| W-029 (rev 6) | 런타임과 수집 성공은 **측정 출력 원본**(`runRef`)에서만 유도한다. `electron-json`(stage-d·e stdout) → `environment` · 성공 = `env === true`·`error` 없음·`provenanceConflict` 아님. `node-stdout`(`measure-ui-inputs.mjs --src`) → `Node … · <platform>/<arch>` 줄 · 성공 = 기록된 종료 코드 0 **그리고** 그 지표 행의 값 칸이 `<수>ms / <수>ms`로 해석됨(0도 유효) — `N/A(…)`는 원 사유를 보존하고 수치 집계에서 뺀다. 실창 캡처(`trace`·`app-log`)는 출력에 플랫폼이 없으므로 OS를 같은 세션의 장비 기록 `profileRef`(H1 PowerShell 출력)에서 읽어 `<os>-electron`으로 정한다. `runRef`가 `--raw-root` 밖이거나 해시가 다르면, 또는 `profileRef`만 있고 측정 출력이 없으면 수집 성공이 아니다 — 장비 기록은 OS·장비 프로필의 근거로만 쓴다. | PR #655 코멘트 2 재갱신 · K1″ | ACTIVE |
| W-030 (rev 6) | 첫 가시 프레임·첫 본문 paint 셀은 **같은 선택 조작**을 시작점으로 쓴다 — 진단 스크립트가 그 조작의 입력 이벤트(`click` 또는 `Enter` `keydown`)에서 `oo-select:<opId>`를, 목표 메시지 본문이 처음 보인 프레임에서 `oo-visible:<kind>:<messageId>:<opId>`를 남기고, 판독기는 셀의 `target.opId`·`messageId`가 같은 짝만 인정한다. 다른 선택·다른 메시지의 표시는 그 셀을 채우지 않는다. 지표 ID가 `first-`로 시작하는 셀에 `target`이 없으면 입력 오류(exit 2)다. DOM 식별자가 없는 구 빌드에서 스크립트가 낸 `oo-unobservable:<opId>:<사유>`는 관측 상태 `unobservable`로 사유를 보존한다. | PR #655 코멘트 2 재갱신 · K2″ | SUPERSEDED → W-034 |
| W-031 (rev 6) | 진단 콘솔 스크립트 `visibility-marks.js`(W-027 승계 — 앱 소스 불변, 파일 SHA-256 기록)는 측정자가 선택마다 `__ooVisibility.arm({ opId, kind, messageId, input })`로 무장한다. 대상 판정은 `data-message-id`가 목표와 같고 높이 > 0·뷰포트와 겹침·본문 문자열이 비지 않은 행이다(`stage-e/probe.tsx:125-129`의 본문 확인과 같은 방향). 검색 대상은 `data-history-highlight`도 요구한다. 무장한 선택은 여럿이 동시에 대기할 수 있고 각자 자기 `opId`로만 기록한다. | 설계 판단 · K2″ | SUPERSEDED → W-035 |
| W-032 (rev 6) | `equal`은 절대 일치 비교 전용이다(W-026 승계). 수치 상대 비교는 전후 각각 **그 집계의 결과 단위**로 집계한 뒤 이후/이전을 `비`로 판정한다 — p95면 ms → ms → 비, 160ms 이상 정지 수면 입력 ms → 전후 `건` → 비. | PR #655 코멘트 2 재갱신 · K3″ | ACTIVE |
| W-033 (rev 7) | transcript 스크롤 루트(`[data-behavior="virtualizable"]` — Claude·OpenCode `Timeline.tsx:121`)에 `data-transcript-session="<sessionId>"`를 둔다. 값은 **그 commit에서 행을 그린 `messages`와 같은 세션 슬롯의 `sessionId`**다 — 선택 상태가 아니다. 제품 화면·동작은 바뀌지 않는 식별 속성이며, 진단 스크립트가 같은 메시지 ID·같은 본문이 여러 세션에 있어도 행의 소유 세션을 가른다. 이 속성은 WU-M에서 생기므로 그 전 빌드(0326~0329)는 첫 표시 셀이 `unobservable(no-session-owner)`이다. | 설계 판단 — PR #655 코멘트 2 “세션을 식별하는 방법은 선택할 수 있습니다” · K2-1 | ACTIVE |
| W-034 (rev 7) | 첫 표시 셀은 **선택 조작(클릭 또는 Enter) → 그 선택이 가리키는 세션의 목표 본문이 처음 보인 프레임**을 잰다. 선택마다 최대 1건이다. H1이 미리 고정하는 셀 `target`은 `{ kind, sessionId, messageId }`이고, 실행 시점의 `opId`가 어느 실행·반복·선택인지는 manifest `runs[].selections[]`가 갖는다. 판독기는 관측의 `opId`가 그 run의 선택이고 그 선택의 목표가 셀 `target`과 같을 때만 인정한다 — 다른 반복·다른 선택의 표시는 셀을 채우지 않는다. 지표 ID가 `first-`로 시작하는 셀에 `target`이 없으면 exit 2다. 검색 대상은 강조가 목표 행 하나에만 있어야 하고 다른 행 강조가 기록되면 그 선택은 `failed`다. | PR #655 코멘트 2 rev 6 검토 · K2-1~3 · W-030 승계 | ACTIVE |
| W-035 (rev 7) | 진단 콘솔 스크립트는 `arm({ opId, kind, sessionId, messageId, expectText, input })`로 무장한다(W-031 승계). 목표 행 = `data-message-id`가 같고 `closest('[data-transcript-session]')`의 값이 `sessionId`이며 본문에 `expectText`가 들어 있고 높이 > 0·뷰포트와 겹치는 행 — 빈 행·본문 열기 버튼 행·다른 세션 행은 건너뛴다. 표시 이름은 `oo-visible:<kind>:<sessionId>:<messageId>:<opId>`다. 관측 불가 사유는 `no-message-id`(식별자 없음 — `d8684684`)와 `no-session-owner`(W-033 이전 빌드)다. | 설계 판단 · K2-1 | ACTIVE |
| W-036 (rev 7) | `runRef`를 가리키는 관측(`table-row`·`trace-marker`·`electron-json`의 `json-pointer`)은 `rawRef.path`·`sha256`이 **그 관측 run의 `runRef`와 같아야** 한다. 다른 실행의 정상 행·표시로는 그 반복을 채울 수 없다. 값 열 이름은 `rawRef.range.column`이다. | PR #655 코멘트 2 rev 6 검토 · D2 | ACTIVE |
| W-037 (ΔV1) | 측정 기록의 `environment`·`tool`·`appSource`·`sha` 출처는 **CLI 진입의 부모 스탬프 하나**다 — `measure-stage-d.mjs:36-37`(`provenance` → `stampProvenance`)와 stage-e E6. Electron 자식 기록(host `stage-d-host/electron-main.mjs`, shell `stage-d-shell/probe.ts`)은 `environment`를 내지 않는다. 자식 사본은 독립 정보가 없다 — 같은 실행·같은 장비의 값이고 host 자식의 `sha`는 부모가 넘긴 값이다(`electron-main.mjs:10`). 이로써 P6의 모든 자리가 Electron 없이 `node --test`로 닫힌다(§10-C). | verify 1 D1 · 설계 판단(더 작은 해법 — 사본 제거) | ACTIVE |
| W-038 (ΔV1) | 소유자 판정 값의 근거 규칙: **`FAIL`은 근거 좌표(`machineRef`·`windowsRef`)가 없어도 소유자 FAIL로 센다** — `ownerFailures`에 넣어 전체를 `불합격`으로 만들고 hold `소유 판정 근거 없음`을 더한다. `PASS`·`미완`은 근거 좌표가 있어야 그 값으로 읽고, 없으면 `미기록`이다. FAIL을 근거 결손 때문에 버리면 Part I R-05 “원소유자의 FAIL이 보존된다”를 어긴다 — 부정 정보는 근거가 약해도 합격 쪽으로 기울지 않게 남긴다. | verify 1 D2(확장 후보 채택) · 설계 판단 | ACTIVE |

**갱신 메모(rev 3).** 추가 W-014~W-019, 대체 W-009 → W-019. rev 2의 추가 W-007~W-013·대체 W-003 → W-007은 유지한다. `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — W-014 ↔ AC8·AC9(기준선 모델), W-015 ↔ AC7(P1 ①②④·P2), W-016 ↔ AC7(P4 ④), W-017 ↔ AC10, W-018 ↔ §7-A 세 구분·AC1~AC6(WU-W), W-019 ↔ AC4(T09 행)를 나란히 읽었다. rev 2 대조(W-008 ↔ AC4 · W-010 ↔ AC7 · W-011 ↔ AC6·AC7 · W-012 ↔ AC8·AC9 · W-013 ↔ AC1·AC6)는 그대로다. W-004의 빈 값으로 통과할 수 있는 셀은 없다(P1 ①④ · P4 ⑥⑦).

**갱신 메모(rev 4).** 추가 W-020~W-023, 대체 없음. `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — W-020 ↔ AC7(P2 ④⑦·P4 ③), W-021 ↔ AC7(P2 ③), W-022 ↔ AC7(P3 ⑮), W-023 ↔ AC8·AC9(`--app-source`)를 나란히 읽었다. W-015의 “구간 내용 재계산은 H5”와 W-021의 “구간 실재는 판독기”는 서로 다른 검사라 충돌하지 않는다.

**갱신 메모(rev 5).** 추가 W-024~W-027, 대체 W-020 → W-024. `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — W-024 ↔ AC7(P2 ④⑦), W-025 ↔ AC7(P2 ⑧)·AC4(검색·첫 본문 셀), W-026 ↔ AC7(P3 ⑯), W-027 ↔ AC7(P9)·AC4(진단 빌드 셀)를 나란히 읽었다. W-023의 “앱 소스 복원”과 W-027의 “앱 소스를 바꾸지 않는 콘솔 스크립트”는 같은 방향이다.

**갱신 메모(rev 6).** 추가 W-028~W-032, 대체 W-021 → W-028 · W-024 → W-029 · W-025 → W-030 · W-027 → W-031 · W-026 → W-032. `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — W-028 ↔ AC7(P2 ③), W-029 ↔ AC7(P2 ④⑦⑨), W-030 ↔ AC7(P2 ⑧·P5 ④)·AC4, W-031 ↔ AC7(P9), W-032 ↔ AC7(집계 표)을 나란히 읽었다. 대체된 다섯 항목의 시험 입력(U25·U26·U28~U31)은 같은 번호로 새 규칙에 옮겨 갔다.

**갱신 메모(rev 7).** 추가 W-033~W-036, 대체 W-030 → W-034 · W-031 → W-035. `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — W-033 ↔ AC11(신규 — 렌더러 표식), W-034 ↔ AC7(P2 ⑧·P5 ④)·AC4, W-035 ↔ AC7(P9), W-036 ↔ AC7(P2 ⑨⑩)을 나란히 읽었다. W-033은 앱 소스를 바꾸므로 W-023(소유자 후속은 `--app-source`로 그 소유자 앱을 복원)·W-031의 “앱 소스 불변”은 **진단 스크립트 자체**에 대한 문장으로 남는다.

**갱신 메모(ΔV1).** 추가 W-037·W-038, 대체 없음(W-012의 “생성 시점 출처”는 W-037이 부모 스탬프로 구체화). `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — W-037 ↔ AC8(모든 시나리오 출력의 `environment`는 부모 스탬프에서 온다 — 출력 계약 불변), W-038 ↔ AC7(근거 없는 소유자 FAIL → `불합격`) · AC6(위반·결측 동시 보고)을 나란히 읽었다.

## 4. 요구 비판적 검토

- 설치본의 `perf.stall`은 50ms 미만 작업·페인트·읽던 문장의 위치를 보여주지 않는다. 설치본은 로그와 화면 동작을, 같은 소스의 진단 빌드는 프레임·React commit·layout을 관측한다.
- `build:win`은 일반 production 설치본을 만든다. `VITE_OO_DIAGNOSTIC=1`이 켜는 것은 진단 다리 등록(`main.tsx:23-26`)뿐이고 React profiling 번들·비압축·DevTools는 H1의 진단 오버레이가 따로 만든다.
- 소유자 자체 실기 기준(0324 AC22, 0326 D-109, 0328 분기 규칙, 0329 3,729ms)은 각자 판정하고 W 장비 목표로 바꾸지 않는다. 특히 `measure-stage-e.mjs`의 `latencyGate`(3,729ms, `:88-89`)는 Linux 기준이라 Windows 출력의 그 필드를 W 셀에 쓰지 않는다.
- 측정 도구 수정(F4·F5·G7~G9)은 0328·0329 소유 도구지만 둘 다 PASS 종료라 0330 WU-M이 W 재현을 위해 고친다. 0328의 분기 판정(R-H·R-W·R-R)은 `linux-electron` 행 기준 그대로다(0328 plan:450). 0329의 3,729ms는 `linux-electron` 종료 코드에만 남는다(W-017).

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
| R-07 ↔ AT-07 / AC7 (rev 3) | 판독기 CLI가 **실패 예제**에서 확정 전후 모두 `불합격`·exit 1을 내고 위반·결측·소유자 FAIL 목록을 함께 보인다. **충족 예제**는 확정 전 `판정 보류(사용자 확정 대기)`·exit 1 → 확정 후 `합격`·exit 0이다. U1~U39 입력마다 §10-A 규칙 칸 결과를 낸다. 셀 목표와 다른 런타임(원본에서 유도)·수집 실패·없는 원본 구간·대상 표시 기록 없는 첫 가시 셀·단위 불일치·지원 안 하는 집계 조합은 필수 셀을 채우지 않는다. 모르는 지표·단위·연산자·집계·구간 형식·키는 `충족`이 되지 않는다. 근거 좌표 없는 소유자 `FAIL`도 `불합격`이다(ΔV1 CHANGED — W-038). | `app/scripts/windows-verdict.test.mjs` — CLI 자식 프로세스(AT-07·IT-01) + 순수 `evaluate`(UT-01·UT-02). `npm test`의 `node --test scripts/*.test.mjs` | 테스터 파일·원본 폴더 → CLI → 보고서 JSON · exit code |
| R-08 ↔ AT-08 / AC8 (rev 3) | `measure-stage-d.mjs`의 모든 시나리오 출력에 `environment`(`<process.platform>-electron`)·`tool`(HEAD)·`sha`(= `appSource.commit`)·`appSource`(commit·tree·dirty)가 있다. 기준선은 W-014 모델로, 소유자 후속은 `--app-source <SHA>`(W-023)로 실행되며 그 SHA가 `appSource.commit`에 남는다. `--compare`는 허용 환경이 같고, 양쪽에 출처 충돌이 없고, 앱 소스가 다를 때만 호환이다. 기존 Linux 증거 쌍(`r1.2-host-baseline.json` ↔ `r1.2-host-applied.json`)은 계속 호환이다(현재 exit 0). | `measure-stage-d.test.mjs` 추가(UT-03) + `--compare` 자식 프로세스(AT-08) | CLI → 측정 → 스탬프 → stdout / 증거 → `--compare` |
| R-09 ↔ AT-09 / AC9 (rev 3) | `measure-stage-e.mjs --baseline`은 앱 소스가 `7db1c7ce`와 같고(diff 0 · 미추적 0) PR 도달 커밋 `4412276f`의 host blob이 `1c4bcb1a…`일 때만 **Electron을 띄우기 전에** 통과한다. 하나라도 어긋나면 측정 없이 exit 1이다. `--app-source eae9081b…`는 앱 소스가 그 SHA와 같을 때만 통과하고 `appSource.commit`을 그 SHA로 기록한다. 출력에 `environment`·`tool`·`appSource`가 있다. | `measure-stage-e.test.mjs`(신규 — UT-04) + `--baseline` 자식 프로세스(AT-09 — 현 트리는 앱 소스가 다르다) | `--baseline` → 앱 소스 검사 → host 소스 해석 → esbuild stdin |
| R-10 ↔ AT-10 / AC10 (rev 3) | 같은 측정 결과에서 `functional`·`linuxLatencyGate{limitMs:3729, pass, applies}`·`verdict`를 따로 읽는다. **시간만** 3,729ms를 넘은 긴 DB 결과는 `linux-electron`에서 `verdict:false`·exit 1, `win32-electron`에서 `verdict:true`·exit 0이고 두 경우 모두 `linuxLatencyGate.pass:false`가 남는다. 기능 실패는 두 환경 모두 exit 1이다. | `measure-stage-e.test.mjs`(UT-05 — `stageEVerdict` + `selectionExitCode`) | 측정 결과 → `stageEVerdict()` → 출력 · `process.exitCode` |
| R-11 ↔ AT-11 / AC11 (rev 7) | Claude Code·Claude Work·OpenCode transcript 스크롤 루트의 `data-transcript-session`이 매 commit에서 **그 행들을 그린 세션**의 `sessionId`와 같다. A를 보다가 B를 선택해 B가 아직 비어 있거나 불러오는 중이어도 속성과 행이 같은 세션을 가리키고, A·B에 같은 메시지 ID·같은 본문이 있어도 속성으로 갈린다. 화면 표시·스크롤·선택 동작은 바뀌지 않는다. | renderer vitest(IT-03) — 세 하네스 Timeline을 실제 store로 렌더 | store `sessions[activeKey]` → `ChatTile` → Timeline 루트 DOM 속성 |

## 7-A. Baseline V / Trace Matrix

좌·우 노드는 모두 NEW다(VP-01~10 = V1, VP-11~13 = rev 2, VP-14~17 = rev 3, VP-18 = rev 5, VP-19 = rev 7). A~E의 기존 V는 변경하지 않는다. `P`는 §10 자리, `H`는 §19 실제 장비 증거, `U`는 §10-A 입력이다.

**세 구분(W-018 — §19 H6·INDEX와 같은 표기)**

| 구분 | 대상 | 언제 · 누가 닫나 |
|---|---|---|
| WU-M 기계 | VP-08~19 · VP-R1 · AC7~AC11 | 지금. WU-M verify가 pair 결과(`PASS`·`PAIR_FAIL`)로 닫는다 |
| 참고 기준선 | 0325 AC19(H2) | 지금 수집 가능. 판정은 0325 소유. W 판독기에서는 합의 전 표본이라 `기록 전용` |
| WU-W 실측 | VP-01~07 · AC1~AC6 | W-004 사전 합의 + H1 필수 셀 고정 뒤. WU-M verify에서는 pair 결과 없이 `미착수(WU-W)` |

| Pair · 노드 | requiredness · 구분 | 생산 경로 `start → edges → end` | §10 자리 · 직접 좌표 |
|---|---|---|---|
| VP-01 R-01 ↔ AT-01 | REQUIRED · WU-W | 프로필 잠금 → 3쌍 실행 → 비교 행 | P1·P3; H1·H6 |
| VP-02 R-02 ↔ AT-02 | REQUIRED · WU-W | AC19 실창 → 원자료 → 두 소유 verify → W | P2·P5; H2 |
| VP-03 R-03 ↔ AT-03 | REQUIRED · WU-W | B/C/D/E 시나리오 → 소유 결과 → T 행 | P2·P5; H3 |
| VP-04 R-04 ↔ AT-04 | REQUIRED · WU-W | 통합 설치본·진단 조작 → 구간별 결과·첫 paint | P2·P3; H4 |
| VP-05 R-05 ↔ AT-05 | REQUIRED · WU-W | raw 관측 → 유효성/집계 → 셀 | P3·P4; H5 |
| VP-06 R-06 ↔ AT-06 | REQUIRED · WU-W | 합의 원본 → 셀 결과 → 사용자 확인 결과·공유 보드 | P1·P4·P5; H6 |
| VP-07 SD-01 ↔ ST-01 | REQUIRED · WU-W | 수집/재시도 → 합의·증거 여부 → 최종 상태 | P1~P5; H6 + 판독기 실제 입력 실행 |
| VP-08 AR-01 ↔ IT-01 | REQUIRED · WU-M | CLI 인자 → 파일 읽기·파싱 → `evaluate` → stdout·exit code | C1~C4; `windows-verdict.test.mjs:'cli …'` 3건(§10-A C 칸) |
| VP-09 MD-01 ↔ UT-01 | REQUIRED · WU-M | 표본·단위·구간 → 집계/분모/결측 | P2·P3; `windows-verdict.test.mjs` U1~U5·U10·U11·U15·U16·U19~U23·U25·U26·U28~U38 |
| VP-10 MD-02 ↔ UT-02 | REQUIRED · WU-M | 예정 셀·판정식·합의/확정 → 누락·셀·전체 결과 | P1·P4·P5; U6~U9·U12~U14·U17·U18·U24·U27·U33·U39(ΔV1) |
| VP-11 MD-03 ↔ UT-03 (rev 2·3) | REQUIRED · WU-M | `process.platform`·git → `provenance()`·`appSourceIdentity()` → `stampProvenance()` / 기록 쌍 → `compatibleRun()` | P6 S1~S3·S6~S11 + §20 P6′ 목록(ΔV1 — S4·S5 SUPERSEDED); `measure-stage-d.test.mjs` 추가 케이스(§10-B P6) |
| VP-12 MD-04 ↔ UT-04 (rev 2·3) | REQUIRED · WU-M | 앱 소스 검사 → 고정 좌표 → `baselineHostSource(git)` → 소스 / 오류 | P7 E0~E7; `measure-stage-e.test.mjs`(§10-B P7) |
| VP-13 AR-02 ↔ IT-02 (rev 2) | REQUIRED · WU-M | `--compare a b` 자식 프로세스 → `compareEvidence` → `compatibleRun` → stdout·exit | P6 S8·S9; `measure-stage-d.test.mjs:'compare CLI …'` 3건 |
| VP-14 R-07 ↔ AT-07 (rev 3) | REQUIRED · WU-M | 예제 폴더 → CLI → 보고서·exit code | P4 ⑤~⑧ · C4; `windows-verdict.test.mjs:'report CLI: failing example …'` · `'report CLI: passing example …'` |
| VP-15 R-08 ↔ AT-08 (rev 3) | REQUIRED · WU-M | 기존 Linux 증거·Windows 변형 증거 → `--compare` → exit | P6 S8·S9; VP-13 좌표 3건 공유 |
| VP-16 R-09 ↔ AT-09 (rev 3) | REQUIRED · WU-M | `node scripts/measure-stage-e.mjs --baseline --old-db small`(현 트리) → 앱 소스 검사 → exit 1 | P7 E0·E5; `measure-stage-e.test.mjs:'baseline CLI refuses …'` · `'app-source CLI refuses …'`(rev 4) |
| VP-17 R-10 ↔ AT-10 (rev 3) | REQUIRED · WU-M | 측정 결과 → `stageEVerdict` → `selectionExitCode` | P8 V1~V5; `measure-stage-e.test.mjs:'stage-e verdict …'` |
| VP-18 MD-05 ↔ UT-06 (rev 5~7) | REQUIRED · WU-M | `arm(opId, kind, sessionId, messageId, expectText, input)` → 그 입력 이벤트 → 프레임마다 행 식별자·소유 세션·본문·사각형·강조 → `pick` → `performance.mark` 이름 | P9 M1~M7; `diagnostic-overlay.test.mjs` 7건(§10-B P9) |
| VP-19 AR-03 ↔ IT-03 (rev 7) | REQUIRED · WU-M | store `sessions[activeKey].session`(`messages`·`sessionId`) → `ChatTile` → `TranscriptView` → Claude·OpenCode `Timeline` 루트 `data-transcript-session` | P10 R1~R3; renderer vitest `'transcript root names the session that rendered its rows'`(§10-B P10) |
| VP-R1 0328 VP-12·VP-25 | REGRESSION · WU-M | 0328 EP12 판정 함수 | INHERITED `0328:V1 rev 5 + ΔV1@7db1c7ce` — `measure-stage-d.test.mjs` 기존 7케이스(`:11`~`:64`) 전부 green, `:64` fixture는 그대로 `true` |

VP-16의 좌표는 현 트리의 앱 소스가 `7db1c7ce`와 다르다는 사실에 기대므로 `fetch-depth: 0` 이력이 필요하다(`ci.yml:39`). 얕은 클론에서 git 오류로 나는 exit 1은 그 좌표를 닫지 않는다 — 테스트는 오류 문구를 단언한다.

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
| stage-e 기준선 소스 | `rg -n "7db1c7ce|3d8e1d90|'show'" app/scripts/measure-stage-e.mjs` | 3 — `:14` 기준 앱 · `:28` src 대조 · `:48` `git show 3d8e1d90:…`. `3d8e1d90` PR 미도달, 같은 blob이 `4412276f`에 있음 → §10 P7 |
| 일반 열기 경로 | `rg -n 'HistoryPageReplySchema|SessionLoadChunkSchema|assembleSession' app/src/renderer/src/shared/api/transport/session-load.ts` | 페이지 `:91-119`(현행 주 경로) · 조각 `:54`·`:63`(구 빌드·복구) → §12 |
| T 분모 | `rg -c '^\| T[0-9]{2} \|' docs/handoff/0325-ui-responsiveness-followup/plan.md` | T01~T33. 0325 §6-D 단계분담과 함께 읽어 복수 소유(T01, T33 등)의 잔여를 가르지 않는다 |
| CI 실행 | `.github/workflows/ci.yml:36-40`·`:83` | `fetch-depth: 0`(전체 이력) · test = `npm test`(vitest + `node --test "scripts/*.test.mjs"`) → W-010 |
| 기준선 앱 소스 복원(rev 3) | `git worktree add --detach <w> ff5c6b02` → `git -C <w> checkout 7db1c7ce -- app/src` / `git -C <w> restore --source=7db1c7ce --staged --worktree -- app/src` → `git diff --quiet 7db1c7ce -- src` | checkout: 추가 파일 48 잔존 · exit 1 / restore: exit 0 · 미추적 0 · `git write-tree --prefix=app/src/` = `9235fa7c` → W-014 |
| 0328 기준 트리의 도구(rev 3) | `git ls-tree -r --name-only c7d2adf2 -- app/scripts \| grep -c stage-d` | 0 — 기준 트리에 도구가 없다 → W-014 |
| node 테스트 범위(rev 3) | `grep -n '"test"' app/package.json` | `:14` `node --test scripts/*.test.mjs` — 하위 폴더 시험은 실행되지 않는다 → 새 시험은 `scripts/` 최상위 |
| stage-e 실행 방식(rev 3) | `sed -n 106,113p app/scripts/measure-stage-e.mjs` | import 시 `measure()`를 실행한다 → 순수부는 별도 seam 파일 |
| 재현 입력 고정 목록(rev 3) | §19 H1-0 1번 명령 2회(`ff5c6b02`) | 216줄 · 두 번 동일 → `evidence/inputs-sha256.txt` |
| 후보 표 | INDEX `## 새 handoff 후보` | 0330 파일과 겹치는 행 없음. 0329 NX1~NX3는 유지 |

## 9. 구조와 책임 변화

| 단계 | 현재 | rev 2 |
|---|---|---|
| 생성 | 소유자별 측정 도구가 `linux-electron`을 하드코딩하고 일부 시나리오는 환경·SHA를 남기지 않는다. | 모든 stage-d·stage-e 출력이 생성 시점 `environment`·`sha`·`dirty`를 갖는다(W-012). |
| 재현 | 0329 기준선이 PR 밖 커밋에 의존하고 재현 문장이 커밋을 특정하지 않는다. | 고정 좌표 + blob 검증 + H1 명령. |
| 소비 | 소유 verify의 범위·대상 빌드가 다르다. 판독기는 계획만 있다. | `app/scripts/windows-verdict.mjs`가 예정 셀 대비 차집합·셀·전체 결과·네 열을 낸다(W-010·W-011). |
| 결정 | 0325 D-025가 열려 있다. | W-004 결정 파일(`decision`)을 판독기 입력으로 묶고 최종 결정은 W verify에 둔다. |

## 10. 계약과 강제 지점

### 10-A. 판독기 `app/scripts/windows-verdict.mjs` (rev 3)

**CLI.** `node scripts/windows-verdict.mjs --plan <f> --manifest <f> --observations <f.jsonl> --raw-root <dir> [--owners <f>] [--decision <f>]`. 순수 함수 `evaluate({ plan, manifest, observations, owners, decision, readRaw })`와 CLI 래퍼를 나눈다(`readRaw(path)` → 바이트 또는 `null`). 새 의존성 없음.

**입력 스키마**(JSON, UTF-8. `?`는 선택)

| 파일 | 필드 |
|---|---|
| `plan` | `revision` · `lockedAt`(ISO) · `wBaselineSha` · `integrationSha` · `profiles[]: { id, os: 'win32'\|'linux', … }` · `tasks[]: { id, owners[] }` · `cells[]` |
| `plan.cells[]` | `key` · `task` · `owner` · `ownerRevision` · `sample: 'owner'\|'w'\|'reference'` · `scenario` · `operation` · `load` · `harness` · `profile` · `pair: { id, beforeSha, afterSha }` · `side: 'after'\|'pair'\|'before'` · `buildKind: 'install'\|'diagnostic'\|'node'` · `metric` · `interval` · `target?: { kind: 'search-target'\|'first-body', sessionId, messageId, expectText }`(W-034 — H1이 미리 고정, 지표 ID가 `first-`로 시작하면 필수) · `repeats`(기본 3) · `required` · `ownerChecks: { machine, windows }` · `rule` |
| `plan.cells[].rule` | `aggregate` · `combine: 'pooled'\|'median-of-runs'\|'each'` · `operator: '<'\|'≤'\|'='\|'≥'\|'>'` · `value` · `inputUnit`(입력 단위) · `unit`(결과 단위) · `mode: 'absolute'\|'relative'` · `where?: { operator, value, unit }`(count) · `numerator?`·`denominator?`(ratio 지표 이름) |
| `manifest.runs[]` | `runId` · `sample` · `pairId` · `side: 'before'\|'after'` · `runtime: 'linux-electron'\|'win32-electron'\|'linux-node'\|'win32-node'` · `runRef: { path, sha256, kind: 'electron-json'\|'node-stdout'\|'trace'\|'app-log' }`(측정 출력, W-029) · `profileRef?: { path, sha256 }`(장비 기록 — OS·프로필 근거만) · `selections?: [{ opId, input: 'click'\|'enter', target: { kind, sessionId, messageId } }]`(W-034 — 이 run·반복의 선택) · `exitCode?`(node — 수집자가 기록) · `sha`(= 도구 출력 `appSource.commit`) · `tool` · `appSource` · `binarySha256` · `buildKind` · `profile` · `harness` · `scenario` · `operation` · `load` · `repeat` · `startedAt` · `endedAt` · `tools: { <이름>: { version, environment, provenanceConflict? } }` |
| `observations`(JSONL) | `runId` · `metric` · `interval` · `unit` · `values[]` 또는 `status: 'absent'\|'failed'\|'censored'\|'unavailable'\|'unobservable'` + `reason?` + `bound?` · `rawRef: { path, sha256, range: { kind: 'lines'\|'trace-ts'\|'json-pointer'\|'table-row'\|'trace-marker', start?, end?, pointer?, id?, column?, opId? } }` |
| `owners?` | `rows[]: { task, owner, key?, machine: 'PASS'\|'FAIL'\|'미완', machineRef, windows?: 'PASS'\|'FAIL'\|'미완', windowsRef? }` |
| `decision?` | `agreement: { revision, lockedAt, by }` · `confirmation?: { revision, confirmedAt, by }` |

관측은 `runId`의 실행 속성(시나리오·조작·부하·하네스·프로필·반복·전후·짝)과 `metric`·`interval`로 셀에 대응한다 — 같은 실행·지표의 다른 구간은 다른 셀이다. **이전 쪽 run과 이후 쪽 run은 같은 `pairId`·같은 `repeat`로 짝짓는다.**

**집계(`rule`)** — 입력 단위는 `rule.inputUnit`, 결과 단위는 아래 열이 정하고 `rule.unit`과 같아야 한다(W-022).

| `aggregate` | 피연산자 · 입력 단위 | 결과 · 결과 단위 |
|---|---|---|
| `p95` · `max` · `median` | 수치 `values` · `ms`·`px`·`frames`·`bytes`·`건` | p95 = 오름차순 `ceil(0.95N)`번째 · median = N 짝수면 가운데 둘의 평균 · 결과 단위 = 입력 단위 |
| `count` | `values` 중 `where`(연산자·값·단위 = 입력 단위)를 만족하는 수 | 결과 단위 `건` — 예: `[159,160,161]` ms에 `≥160 ms` → `2건` |
| `ratio` | Σ `numerator` 지표 값 / Σ `denominator` 지표 값(같은 run·interval · 둘의 단위가 같음) | 결과 단위 `비` · 분모 0 → `미판정(분모 0)` |
| `equal` | 문자열 `values`가 전부 `rule.value`와 같은가 · 입력 단위 `text` · 연산자 `=`만 · `mode: absolute`와 `combine: pooled`·`each`만(W-032) | 결과 단위 `text` · `relative`·`median-of-runs`와 함께면 `미판정(지원 안 함: 조합)` |
| `mode: relative`(수치 집계만 — `equal` 제외, W-032) | `side: pair` 셀에서 전후 각각 그 집계의 결과 단위로 집계한 뒤 이후 / 이전 | 결과 단위 `비` — 예: p95 이전 100 ms · 이후 105 ms → 1.05 비 · `≤ 1.10` 충족 / 160ms 이상 정지 수 입력 ms → 이전 2건 · 이후 3건 → 1.5 비 |

| `combine` | 세 반복을 합치는 법 |
|---|---|
| `pooled` | 반복 셋의 표본을 합친 뒤 한 번 집계(0325 타이핑 p95) |
| `median-of-runs` | 반복마다 집계한 뒤 그 중앙값(0326 D-090) |
| `each` | 반복마다 판정, 하나라도 위반이면 위반 |

`mode: 'relative'`는 `side: 'pair'` 셀에서 `이후 집계 / 이전 집계`를 `value`(예: `≤ 1.10`)와 비교한다. 모르는 `aggregate`·`combine`·`operator`·`inputUnit`·`unit`·`mode`·`status`·`range.kind`는 그 셀을 `미판정(지원 안 함: <값>)`으로 만든다 — **열린 입력 집합은 fail-closed**다.

**출력**(stdout JSON) `{ revision, cells[]: { key, status: '충족'|'위반'|'미판정'|'기록 전용', aggregate, n, unit, rawRefs[], reason?, ownerMachine, ownerWindows, w, user }, violations[], missing[], unexpected[], duplicates[], conflicts[], ownerFailures[], holds[], overall: '합격'|'불합격'|'판정 보류', overallReason }`. exit code: 0 `합격` · 1 `불합격`·`판정 보류` · 2 입력 오류.

| 자리 | 규칙 칸 — 분기마다 결과 | 입력 칸 — 분기마다 입력(구별 값) |
|---|---|---|
| P1 기준 고정 | ① `agreement.revision ≠ plan.revision` 또는 `agreement.lockedAt ≠ plan.lockedAt` → 모든 W 셀 `미판정(합의 불일치)` + hold ② W run `startedAt ≤ lockedAt` → 그 run의 셀 `기록 전용(합의 전)`, 필수 키를 채우지 않는다 ③ run·셀 `profile` 불일치 또는 `profiles` 밖 → `미판정(프로필 불일치)` ④ `confirmation` 없음 → hold `사용자 확정 대기` · `confirmation.revision ≠ plan.revision` → hold `확정 revision 불일치` · `confirmedAt` < 마지막 W run `endedAt` → hold `확정이 실행보다 앞섬` ⑤ 보고서·셀에 `plan.revision` | U18: agreement revision 다름 / lockedAt 다름 · U12: `startedAt` = lockedAt −1ms / 같음 / +1ms · U6: 60Hz 셀에 120Hz run · U18′: 확정 없음 / revision 다름 / `confirmedAt` 앞섬 · 출력 `revision` 단언 |
| P2 원본 인계 | ① `rawRef` 없음 · `path`가 `--raw-root` 밖(`..`·절대 경로) · 파일 없음 → `미판정(원본 없음)` ② 파일 SHA-256 ≠ `rawRef.sha256` → `미판정(원본 해시 불일치)` ③ 구간 실재(W-028): `lines`는 `1 ≤ start ≤ end ≤ 파일 줄 수` · `trace-ts`는 `traceEvents`(또는 최상위 배열)에 `start ≤ ts ≤ end`인 이벤트 ≥1 · `json-pointer`는 경로 해석 · `table-row`는 `\| <id> \|`로 시작하는 표 행 존재 — 아니면 `미판정(구간 없음\|지표 없음)`, 빈 값·모르는 `kind`는 `미판정(구간 형식 지원 안 함)` ④ 런타임(W-029): `electron-json` `environment` · `node-stdout` 머리 줄 · `trace`·`app-log`는 `profileRef`의 `Caption`(`Microsoft Windows` → `win32`) — 못 읽으면 `미판정(런타임 불명)` · manifest `runtime` ≠ 유도값 → `미판정(런타임 불일치: 원본)` · 유도값 ≠ 셀 기대 런타임(`profile.os` + `install`·`diagnostic` → `electron` / `node` → `node`) → `미판정(런타임 불일치)` ⑤ `observation.runId ∉ manifest` → `unexpected`, 셀 불변 ⑥ 짝의 `buildKind`가 다름 → `미판정(빌드 종류 혼합)` ⑦ 수집 성공(W-029): `runRef` 없음 · `runRef`가 `--raw-root` 밖 · `runRef` 해시 불일치 · `profileRef`만 있음 · `electron-json` `env !== true`·`error`·`provenanceConflict` · `node-stdout` `exitCode ≠ 0` → 그 run은 셀을 채우지 않고 `미판정(수집 실패\|도구 출처 불명)`, 필수 키는 `missing`에 남는다 ⑧ 대상 표시(W-034): `cell.target`이 있으면 `range.kind`가 `trace-marker`이고 `range.opId`가 그 run의 `selections`에 있으며 그 선택의 `target`이 셀 `target`과 같아야 한다 — 아니면 `미판정(다른 선택)` · 구간 안에 `oo-select:<opId>`와 그 ts 이후·`end` 이전의 `oo-visible:<kind>:<sessionId>:<messageId>:<opId>`가 있어야 한다 — 아니면 `미판정(대상 표시 기록 없음)` · `oo-unobservable:<opId>:<사유>` → 관측 `unobservable`(사유 보존) · `oo-highlight-other:<opId>` → 관측 `failed`(다른 행 강조) ⑨ Node 값(W-029): `table-row` 값 칸이 `<수>ms / <수>ms`(`(시도 N)` 꼬리 허용)면 `rawRef.range.column`(`median`·`max`)의 값이 수치 표본 · 관측 `values` ≠ 그 값 → `미판정(원본 값 불일치)` · `N/A(함수 없음)`·`N/A(실패: …)` → 관측 `unavailable` + 원 사유, 수치 집계에서 뺀다 · 그 밖의 문자열 → `미판정(값 해석 불가)` ⑩ 같은 실행(W-036): `table-row`·`trace-marker`·`electron-json` 대상 `json-pointer` 관측의 `rawRef.path`·`sha256` ≠ 그 run의 `runRef` → `미판정(다른 실행의 원본)` | U19: rawRef 없음 / `../x` / 없는 파일 / 해시 1글자 다름 · U28: 10줄 로그에 `lines 900-910` → 보류 / `lines 3-5` → 유효 · trace 이벤트 ts `100`·`200`에 `trace-ts 150-160` → 보류 / `100-150` → 유효 · `json-pointer /commits/2` 있음 / 없음 · `kind: 'frames'` · 빈 range · U25: Windows 진단 셀 + `electron-json` `environment: linux-electron`(manifest `win32-electron`) → 원본 불일치 / Windows `node` 셀 + `Node v22.12.0 · win32/x64` → 유효 / 같은 셀 + `· linux/x64`(manifest `win32-node`) → 원본 불일치 / Windows 진단 `trace` + `profileRef` `Caption : Microsoft Windows 11 Pro` → `win32-electron` 유효 / `profileRef` 없는 `trace` → 런타임 불명 · U8′ · U16 · U23·U26: `env:false` / `provenanceConflict` / `exitCode: 1` / 지표 행 없음 → 필수 키 `missing` 유지 · U35: `runRef` `../out.json` / `runRef` 해시 다름 / `profileRef`만 있고 `runRef` 없음 → 수집 실패, OS는 프로필 근거로만 · U34: `\| I3 \| … \| 12.34ms / 15.00ms \|` `column: median` → 12.34 / `0.00ms / 0.00ms` → 0 유효 / `N/A(함수 없음)` → unavailable(사유 `함수 없음`) / `N/A(실패: fixture unavailable)` → unavailable(사유 보존) / `abc` → 해석 불가 / 관측 `values: [12.0]` vs 원본 12.34 → 원본 값 불일치 · U31: `oo-select:op1` ts 100 + `oo-visible:search-target:sB:m63:op1` ts 180 → 통과 / `oo-select:op1`만 → 미판정 / 표시 세션 `sA`(같은 `m63`) → 미판정 / 표시 id `m64` → 미판정 / 표시 ts 90(선택 전) → 미판정 / `cell.target` 있는데 `trace-ts` 구간 → 미판정 · U32: 연속 선택 `op1`·`op2` — `oo-visible:…:op1`이 `oo-select:op2` 뒤에 도착 → op1 셀 통과, op2 셀 미판정 · U36: 반복 1~3이 `op-r1`·`op-r2`·`op-r3`로 각 1건 → 세 반복 모두 인정 / 반복 2 관측이 `op-r1`을 가리킴(반복 2 `selections`에 없음) → 반복 2 미판정·`missing` / 선택 목표 `sB`·`m63`인데 셀 `target` `m64` → 미판정 · U37: 반복 2 Node 관측의 `rawRef.path`가 반복 1 `runRef` → 다른 실행의 원본 · U38: `oo-highlight-other:op1` → `failed` → 위반 · U33′: `oo-unobservable:op1:no-message-id` / `…:no-session-owner` → `unobservable`, 사유 각각 보존 |
| P3 비교·집계 | ① p95·max·median ② count `where` ③ ratio(분모 0 → 미판정) ④ equal ⑤ combine 3종 ⑥ 같은 키·같은 해시·같은 값 → `duplicates`, 1회로 셈 ⑦ 같은 키 다른 값/해시 → `conflicts` + `미판정(충돌)` ⑧ 한 runId의 지표·구간 여럿 → 키마다 별도 셀 ⑨ 이전 `absent`(또는 Node `unavailable` 사유 `함수 없음`) → 상대 비교 `미판정(이전 기능 없음)`, 같은 키의 절대 셀은 계속 · ⑨′ `unavailable`(그 밖의 사유)·`unobservable` → 수치 집계에서 빼고 `미판정(측정 불가\|이 방식으로 관측 불가: <사유>)`, 필수 키는 `missing`에 사유와 함께 남는다 ⑩ 이후 `failed` → `위반` ⑪ `censored`(bound 16): `≤ 50` → 결정, `≤ 10` → `미판정(검열)` ⑫ 상대 비교 이전 집계 0 → `미판정(분모 0)` ⑬ `repeats` 중 누락 → `미판정(반복 부족)` + `missing`에 그 반복 키 ⑭ 상대 셀의 짝(같은 pairId·repeat) 없음 → `미판정(짝 없음)` ⑮ 단위(W-022): `observation.unit ≠ rule.inputUnit` · `where.unit ≠ rule.inputUnit` · `rule.unit ≠` 집계 결과 단위 · ratio 분자·분모 단위 다름 → `미판정(단위 불일치)` ⑯ 조합(W-032): `equal` + `relative` · `equal` + `median-of-runs` → `미판정(지원 안 함: 조합)` | U10: N=1·19·20·21 p95, N=2 median · U20: `where ≥160` 값 `[159,160,161]` → 2 · ratio `[3]/[0]`·`[3]/[60]` · equal `['a','a','b']` vs `'a'` · U21: 반복 `[10,10,100]`·`[10,10,10]`·`[10,10,10]`, `p95 ≤ 50` → pooled 위반 / median-of-runs 충족 / each 위반 · U2 · U3: 값 다름 / 해시 다름 · U1: 한 runId에 지표 2 × 구간 2 · U4: absent + 절대 셀 있음/없음 · U34′: 이전 `unavailable(함수 없음)` → 상대 제외·절대 계속 / 이후 `unavailable(실패: …)` → 미판정·missing에 사유 · U33″: 이전 `unobservable(no-message-id\|no-session-owner)` → 상대 미판정·사유 보존 · U5 · U10′ · U11 · U15: 반복 2 누락 · U22: pairId 다름 / repeat 짝 없음 · U29: `[159,160,161]` ms + `where ≥160 ms` → `2건`·충족 판정 가능 / 같은 값을 `frames`로 제출 → 단위 불일치 / `where.unit: frames` → 불일치 / count 셀의 `rule.unit: ms` → 불일치 / T09 `replyJsonBytes` `[11017,11020,11015]` bytes `max ≤ 262144` → 충족 / ratio `frames`÷`ms` → 불일치 · U30: `equal`+`relative` / `equal`+`median-of-runs` → 미판정 / 이전 p95 `100` ms · 이후 `105` ms · `≤ 1.10` → `1.05` 비 충족 / 이후 `111` ms → `1.11` 비 위반 |
| P4 판정 | ① 연산자 5종 경계 −1/0/+1 ② 미지원 연산자·단위·집계·combine·mode → `미판정(지원 안 함)` ③ `required: false` → `기록 전용` · ③′ `sample: 'reference'` → 집계는 하고 `기록 전용(참고)`, 전체 판정에 들어가지 않는다 ④ SHA(W-016): W·이후 `sha ≠ integrationSha` → `미판정(통합 SHA 아님)` · W·이전 `sha ≠ wBaselineSha` → `미판정(기준 SHA 아님)` · 소유자 표본 `sha`(= `appSource.commit`, W-023) `≠ cell.pair.<side>Sha` → `미판정(소유 SHA 아님)` ⑤ 전체: 위반 ≥1 또는 `ownerFailures` ≥1 → `불합격`, `holds`에 미판정·결측·확정 상태를 함께 ⑥ 위반 0 + 필수 결측·미판정·소유 판정 결측/`미완`·합의 불일치 ≥1 → `판정 보류` ⑦ 전건 충족 + P1 ④ hold → `판정 보류(<사유>)` ⑧ 전건 충족 + 확정 정상 → `합격`. 확정은 `불합격`을 바꾸지 않는다 | U9: `<,≤,=,≥,>` × 경계 −1/0/+1 · U9′: `≈`·`fps`·`p99`·`combine: 'mean'` · `required:false` 셀 · U27: Linux 프로필 `reference` 셀 + `linux-electron` run → 집계값 있음·`기록 전용(참고)`·overall 불변 · U13: W 이후 SHA 다름 / W 이전 = `wBaselineSha`(유효) / 소유자 표본 SHA = pair SHA(유효)·다름 · U7: 위반 + 결측 + 소유자 FAIL, 확정 없음·있음 → 둘 다 `불합격`이고 세 목록이 비지 않음 · U14: 전건 충족 + 확정 없음 / revision 다름 / 정상 |
| P5 원소유·공유 | ① 예정 필수 키 − 유효 실제 키 → `missing`(프로필·시나리오·하네스·반복·지표별 복원) ② 실제 − 예정 → `unexpected`(충족 수 불변) ③ 예정 필수 키 0 → exit 2 ④ 지표 ID가 `first-`로 시작하는 셀에 `target` 없음 → exit 2 + 셀 키(W-034 — 일반 trace 검사로 우회 불가) ⑤ `ownerChecks.machine`·`windows`가 요구하는데 owners 행이 없거나 그 칸이 없음 → 열 `미기록` + `판정 보류(소유 판정 없음)` ⑥ `tasks[].owners`의 소유자마다 (a) 그 소유자의 예정 셀이 plan에 ≥1 — 없으면 exit 2(분모 결함) (b) 그 task·소유자의 owners 행(요구된 `machine`·`windows` 칸 포함)이 있어야 한다 — 없으면 `missing`에 `<task>/<owner>` + `판정 보류` ⑧(ΔV1 — W-038) 소유 판정 값의 근거: (a) `FAIL`은 근거 좌표가 없어도 `ownerFailures`에 넣고 hold `소유 판정 근거 없음`을 더한다 (b) `PASS`·`미완`은 근거 좌표가 없으면 `미기록`으로 읽는다 ⑦ 셀마다 네 열(`ownerMachine`·`ownerWindows`·`w`·`user`)을 채운다 | U8: 제출자가 manifest에서 키 1개 삭제 / 예상 밖 키 1개 추가 / 빈 `cells` / 빈 observations(모든 셀 미판정) · U39(ΔV1): `machine: FAIL`·`machineRef` 없음 → `ownerFailures`에 그 키·overall `불합격`·hold `소유 판정 근거 없음`·열 `FAIL` / `machine: PASS`·`machineRef` 없음 → 열 `미기록`·`판정 보류` / `FAIL`·`machineRef` 있음 → `불합격`·근거 없음 hold 없음 · U33: `first-body-paint` 셀에 `target` 없음 → exit 2 / 있음 → 통과 · U24: `ownerChecks.windows: true`인데 windows 칸 없음 · U17: T33 소유 `0327`·`0328`의 예정 셀은 둘 다 있고 owners에 `0328` 행만 없음 → `missing`에 `T33/0328`·overall `판정 보류` / `0328` 예정 셀 자체가 없음 → exit 2 |
| C1~C4 CLI | C1 `--plan`·`--manifest`·`--observations`·`--raw-root` 필수 — 하나라도 없으면 exit 2 · C2 파일 읽기·JSON/JSONL 파싱 실패 → exit 2 + 파일명 · C3 판정 결과 → stdout JSON · C4 `overall` → exit 0/1 | AT-07 `'report CLI: failing example …'`: 실패 예제 확정 없음·있음 → 둘 다 exit 1·`불합격`, `violations`·`missing`·`ownerFailures` 비지 않음, `expected.json`·`expected.confirmed.json` 일치 · `'report CLI: passing example …'`: 확정 없음 → exit 1·`판정 보류(사용자 확정 대기)` · 확정 → exit 0·`합격` · IT-01 `'cli rejects …'`: `--raw-root` 누락 → 2 / 깨진 JSONL → 2 + 파일명 / `--owners` 생략 → 소유 열 `미기록`·ownerChecks 셀 `판정 보류` |

분기 수: P1 5 · P2 10(①~⑩) · P3 17(①~⑯ + ⑨′) · P4 9(①~⑧ + ③′) · P5 10(①~⑧, ⑥ a·b, ⑧ a·b — ΔV1이 ⑧ 추가) · C 4 = **55**. 판독기 자리 검색 명령: `rg -n "operator|aggregate|combine|status|missing|unexpected|conflicts|duplicates|ownerFailures|holds|overall|exitCode|process.argv|readRaw|lockedAt|confirm|runtime|runRef|profileRef|selections|range|inputUnit|reference|target|opId|trace-marker|table-row|unavailable|unobservable|Ref\]" app/scripts/windows-verdict.mjs`의 각 줄을 P1~P5·C 중 하나로 분류하고 운반하지 않는 줄은 사유와 함께 제외 줄로 적는다(`site_census.mjs`).

**예제(계약 fixture).** `app/scripts/windows-verdict/example/failing/`과 `…/passing/`에 각각 `plan.json`·`manifest.json`·`observations.jsonl`·`owners.json`·`decision.json`(합의만)·`decision.confirmed.json`(합의 + 확정)·`raw/`(작은 원본 파일)·`expected.json`·`expected.confirmed.json`. failing = W1 셀 2(충족 1·위반 1) + 결측 1 + 소유자 FAIL 1. passing = 같은 셀 구성에서 전건 충족 + 소유 판정 전부 PASS + T09 `replyJsonBytes` bytes 셀 1(W-022) + Windows Node 함수 셀 1(`node-stdout` 원본, W-029) + S-E5 첫 가시 셀 1(`trace-marker` 원본에 같은 run `selections`의 선택·대상 표시 둘 다, W-034). failing에는 같은 S-E5 셀을 입력만 있는 trace로 넣어 `미판정(대상 표시 기록 없음)`을 보인다. AT-07 두 케이스가 이 폴더를 그대로 읽는다.

### 10-B. 측정 도구 출처·기준선 (W-012 · W-014 · W-017)

| 자리 | 규칙 | 직접 oracle 좌표 · 구별 입력 |
|---|---|---|
| P6 stage-d | **SSOT** `stage-d/measurement.mjs`: `MEASUREMENT_ENVIRONMENTS = new Set(['linux-electron','win32-electron'])` · `measurementEnvironment(platform = process.platform)` = `${platform}-electron` · `appSourceIdentity({ git, baseline })` — baseline이면 `git diff --quiet <baseline> -- src` 실패 또는 `git ls-files --others --exclude-standard -- src` 비어 있지 않음 → `Error('Baseline application sources must equal <baseline>')`, 통과면 `{ commit: <baseline full>, tree: git rev-parse <baseline>:./src, dirty: false }` · baseline 아니면 `status --porcelain --untracked-files=all -- src` 비었을 때 `{ commit: HEAD, tree: HEAD:./src, dirty: false }`, 아니면 `{ commit: HEAD, tree: null, dirty: true, diffSha256 }` · `provenance({ platform, git, baseline })` = `{ environment, tool: HEAD, appSource, sha: appSource.commit }` · `stampProvenance(result, p)` — 결과에 이미 같은 키가 있고 값이 다르면 `provenanceConflict: true`. 자리: **S1** `measure-stage-d.mjs:51` · **S2** `:114` · **S3** `:128` · ~~**S4** `stage-d-host/electron-main.mjs:86` · **S5** `stage-d-shell/probe.ts:281`~~(ΔV1 SUPERSEDED → W-037: 자식 기록은 `environment`를 내지 않는다 — §20 P6′) · rev 3 문구: 리터럴 대신 `measurementEnvironment()` · **S6** CLI 출력 `measure-stage-d.mjs:174-178` — 비교 모드가 아닌 모든 결과(`env:false` 포함)에 `stampProvenance` · **S7** SHA 원천 `:48` · `host-runner.mjs:11` · `shell-runner.mjs:28` → `provenance()` · **S8** `compatibleRun`(`measurement.mjs:61-85`) — 양쪽 `environment`가 허용 집합 안이고 같다 · 양쪽 `provenanceConflict` 아님 · 양쪽에 `appSource.tree`가 있으면 서로 다르다 · 기존 `sha`·전기·측정 항목 규칙 유지 · **S9** `compareEvidence`(`:182-206`) 결과에 양쪽 `environment`·`tool`·`appSource` · **S10** 기준선 검사 `measure-stage-d.mjs:49` · `host-runner.mjs:12`·`:15-21` · `shell-runner.mjs:29` → `appSourceIdentity({ baseline: 'c7d2adf2ddb548a2ce897cfc4f19173a2879b77f' })`(HEAD 요구 제거) · **S11** `--app-source <full SHA>`(W-023) — `parseMeasureArgs(argv, { fixedBaseline })`(SSOT `stage-d/measurement.mjs`)가 해석하고 `appSourceIdentity({ git, expected })`가 diff 0·미추적 0을 확인해 `appSource.commit = expected`·`baseline: false`. 값 없는 `--app-source`, `--baseline`과 다른 SHA를 함께 준 경우는 측정 없이 exit 1 | `measure-stage-d.test.mjs` 추가: `'environment follows the generating platform'`(`win32`·`linux`·`darwin`) · `'provenance stamps every scenario result'`(`{env:false}` · 환경 없는 geometry 결과 · 같은 값 보유 → 유지 · 다른 값 → conflict) · `'baseline identity checks application sources, not HEAD'`(가짜 git: diff 0·미추적 0 → identity / diff 1 → throw / 미추적 1 → throw / 비기준 dirty → `tree: null`) · `'comparison requires the same allowed environment and distinct sources'`(`:64` fixture 그대로 true · win32 쌍 true · linux↔win32 false · darwin 쌍 false · 한쪽 conflict false · 한쪽 environment 없음 false · 같은 tree false) · AT-08 `'compare CLI …'` 3건: 기존 `docs/handoff/0328-…/evidence/r1.2-host-baseline.json` ↔ `r1.2-host-applied.json` → exit 0 · 한쪽 environment를 `win32-electron`으로 바꾼 임시 사본 → exit 1 · 한쪽 `provenanceConflict: true` → exit 1 · `'app-source names the owner follow-up application'`(가짜 git: 기대 SHA와 diff 0 → `commit` = 기대 SHA / diff 1 → throw · `parseMeasureArgs`: 값 없음 → 오류 / `--baseline --app-source <다른 SHA>` → 오류 / `--baseline`만 → 고정 기준) |
| P7 stage-e | seam 파일 `stage-e/baseline-source.mjs`(`measure-stage-e.mjs`는 import 시 측정을 실행하므로 같은 파일에 둘 수 없다): **E0** `appSourceIdentity({ baseline: '7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6' })`(P6 SSOT) — `measure-stage-e.mjs:28-34` 대체 · **E1** `git cat-file -e <commit>` 실패 → `baseline host commit missing` · **E2** `git rev-parse <commit>:app/scripts/stage-e/host.ts ≠ 1c4bcb1a7c0319ff9fdbff92cae8c220b3742a79` → `baseline host blob mismatch` · **E3** `git merge-base --is-ancestor <commit> HEAD` 실패 → `baseline host not reachable from HEAD` · **E4** 통과 → `git show` 텍스트(`:48` 대체, commit = `4412276f248ffe6a447760f56ad2fa424fa0e78a`) · **E5** E0~E4를 `resolveElectron()`(`:22`) **앞**에서 실행 · **E6** 출력(`:91-99`)에 `stampProvenance` · **E7** `--app-source <full SHA>` — P6 S11과 같은 SSOT(`fixedBaseline` = `7db1c7ce…`) | `measure-stage-e.test.mjs`(신규, `scripts/` 최상위 — `node --test scripts/*.test.mjs`가 하위 폴더를 읽지 않는다): `'baseline host source is pinned'` 가짜 git으로 E1~E4 각각(커밋 없음 / blob 1글자 다름 / ancestor 실패 / 정상 → 텍스트) · E0은 P6 `'baseline identity …'` 공유 · AT-09 `'baseline CLI refuses mismatched application sources'`: 자식 프로세스 `node scripts/measure-stage-e.mjs --baseline --old-db small` → exit 1 · 출력에 `Baseline application sources must equal 7db1c7ce` · AT-09′ `'app-source CLI refuses mismatched application sources'`: `--app-source 7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6 --old-db small`(현 트리와 다름) → exit 1 · 출력에 `Application sources must equal 7db1c7ce` |
| P8 stage-e 판정 | seam 파일 `stage-e/verdict.mjs`: `stageEVerdict(result, { isBaseline, size, environment })` → `{ functional, bounded, linuxLatencyGate, verdict }`. **V1** functional = `:71-77` 조건 · **V2** bounded = `:78-86` 조건 · **V3** `linuxLatencyGate` = 긴 DB·비기준이면 `{ limitMs: 3729, pass: clickToBodyFrameMs ≤ 3729, applies: environment === 'linux-electron' }`, 아니면 없음(`:87-90` 대체) · **V4** `verdict = functional && bounded && (gate?.applies ? gate.pass : true)`(`:98` 대체) · **V5** 종료 코드는 `selectionExitCode`(`:109`) 그대로 | `measure-stage-e.test.mjs:'stage-e verdict …'`: 긴 DB 정상 결과 `clickToBodyFrameMs` 3730 → linux `verdict:false`·exit 1 / win32 `verdict:true`·exit 0 / 둘 다 `pass:false` · 3729 → linux `verdict:true` · `visible:false` → 두 환경 모두 exit 1 · small → gate 없음 · baseline → gate 없음 · `replyJsonBytes` 256KiB+1 → bounded false |
| P9 대상 표시 스크립트(rev 5~7) | `app/scripts/diagnostic-overlay/visibility-marks.js`(신규 — 모듈 문법 없는 스크립트, DevTools 콘솔에 붙여 실행). `globalThis.__ooVisibility = { pick, createWatcher, arm }` — `createWatcher({ raf, mark, listen, queryRows, viewport })`는 주입형이고 `arm`은 실제 DOM 바인딩이다. 행 입력은 `{ messageId, owner, text, top, bottom, height, highlighted }`(`owner` = `closest('[data-transcript-session]')` 값). **M1** `pick(rows, viewport, { kind: 'first-body', sessionId, messageId, expectText })` = `messageId`·`owner`가 목표와 같고 `text`에 `expectText`가 있고 높이 > 0·뷰포트와 겹치는 행 · **M2** `kind: 'search-target'`이면 `highlighted`도 참 · **M3** `arm({ opId, kind, sessionId, messageId, expectText, input })` 뒤 다음 `input`(`click` 또는 `Enter` `keydown`, capture 단계) 이벤트에서 `oo-select:<opId>`를 남기고 감시 시작 · **M4** M1·M2가 처음 참인 프레임에서 `oo-visible:<kind>:<sessionId>:<messageId>:<opId>`를 한 번 남기고 그 선택 종료 · **M5** 무장한 선택 여럿이 독립적으로 대기하고 각자 자기 `opId`만 쓴다 · **M6** 감시 600프레임 동안 `[data-message-id]`가 0개면 `oo-unobservable:<opId>:no-message-id`, 식별자는 있는데 `[data-transcript-session]`이 0개면 `…:no-session-owner`, 둘 다 있는데 대상이 안 보이면 `oo-timeout:<opId>` · **M7** `search-target` 감시 중 목표가 아닌 행(다른 세션 또는 다른 id)에 강조가 보이면 `oo-highlight-other:<opId>`를 한 번 남긴다 | `diagnostic-overlay.test.mjs`(신규, `scripts/` 최상위 — `vm.runInNewContext`로 파일을 읽어 `pick`·`createWatcher` 사용): `'first body belongs to the selected session'` — A·B 모두 `native-5`·`fixture message 5`, 프레임 순서 (1) 소유 `sA` 본문 (2) 소유 `sB` 빈 행 (3) 소유 `sB` 본문 열기 버튼 행(본문 문자열 없음) (4) 소유 `sB` 본문 (5) 같은 화면 → B 선택의 표시 누적 `0 → 0 → 0 → 1 → 1`, `click`·`Enter` 각각 · `'search target needs owner and highlight; other highlights are reported'`(강조 없음 → 0 / 목표 강조 → 1 / 다른 세션 같은 id 강조 → `oo-highlight-other` 1 · 목표 표시 0) · `'select mark is the armed input event'`(`pointerdown`만 → 표시 없음 / `click` → `oo-select:op1` / `Enter` → `oo-select:op1`) · `'visible mark once per selection'`(두 프레임 연속 보임 → 1회) · `'repeats and concurrent selections keep their own opId'`(반복 3회 `op-r1~r3` 각 1건 · `op1` 대기 중 `op2` 선택 뒤 `op1` 목표 표시 → `…:op1`만) · `'unobservable reasons'`(행 0개 → `no-message-id` / 행은 있고 소유 속성 0개 → `no-session-owner` / 다른 행만 → `oo-timeout`) · `'pick skips empty and other-session rows'`(높이 0 · 뷰포트 밖 · `expectText` 없음 · `owner` 다름 → 없음) |
| P10 행 소유 세션 표식(rev 7) | **R1** `features/chat/harnesses/claude/transcript/Timeline.tsx:121` 스크롤 루트 · **R2** `features/chat/harnesses/opencode/transcript/Timeline.tsx:121` 스크롤 루트에 `data-transcript-session={<행을 그린 세션의 sessionId>}` · **R3** 값의 출처 = 행을 그린 `messages`와 같은 슬롯(`ChatTile.tsx:58`·`:62` — `useChatSession`이 `sessions[activeKey].session`에서 둘 다 읽는다). 값은 그 슬롯에서 props로 내려 보내고, 선택 상태(`activeKey` 변경 직후의 다른 슬롯)나 다른 store 구독에서 따로 읽지 않는다. 화면·접근성·스크롤 동작 불변 | renderer vitest(신규 — 위치는 구현자, `[test-pools]` unit) `'transcript root names the session that rendered its rows'`: Claude Code·Claude Work·OpenCode 각각 — 세션 `sA`·`sB`에 같은 `native-5`·`fixture message 5` → `sA` 활성 → 속성 `sA` · `sB` 선택 직후 `sB`가 아직 비어 있음(불러오는 중) → 속성과 행이 둘 다 `sB` 쪽(행 0개)이거나 둘 다 `sA` 쪽 — 서로 다르면 실패 · `sB` 메시지 commit → 속성 `sB`·행 `native-5` |

**자리 검색 명령 · rev 3 출력.**
- P6: `rg -n "linux-electron|win32-electron|environment|rev-parse|startsWith\('c7d2adf2'\)|'--porcelain'|stampProvenance|compatibleRun|appSourceIdentity|app-source|parseMeasureArgs" app/scripts/measure-stage-d.mjs app/scripts/stage-d app/scripts/stage-d-host app/scripts/stage-d-shell -g '!*.test.*'` → 17줄. 분류: S1 `:51` · S2 `:114` · S3 `:128` · S4 `electron-main.mjs:86` · S5 `probe.ts:281` · S7 `:48`·`host-runner.mjs:11`·`shell-runner.mjs:28` · S8 `measurement.mjs:61`·`:63`·`:64` · S9 `:188` · S10 `:49`·`host-runner.mjs:12`·`:15`·`shell-runner.mjs:29`. 제외 1: `measure-stage-d.mjs:4`(import — 값 운반 없음). S6(`:174-178`)과 `host-runner.mjs:21`은 술어 밖이지만 path edge라 목록에 넣었다.
- P7·P8: `rg -n "7db1c7ce|3d8e1d90|4412276f|'show'|'--quiet'|ls-files|resolveElectron|latencyGate|verdict|exitCode|app-source|parseMeasureArgs" app/scripts/measure-stage-e.mjs app/scripts/stage-e -g '!*.test.*'` → 13줄(rev 3 본문의 “15줄”은 오기 — rev 4 재계수). 분류: E0 `:14`·`:28`·`:30` · E4 `:48` · E5 `:22`·`:24` · V1 `:71` · V3 `:87`·`:97` · V4 `:98` · V5 `:109`·`:112`. 제외 1: `:7`(import).
- 구현 뒤 같은 명령을 다시 돌려 리터럴 `linux-electron`이 `MEASUREMENT_ENVIRONMENTS` 한 곳(테스트 fixture 제외)에만, `3d8e1d90`이 0곳에 남는지 확인한다.

### 10-C. 선택 적대 증거 · 선언 경계

- **선택 적대 증거**: VP-10 P4 ⑤~⑧은 순서 의존이라 `위반 → 보류 → 확정` 순서를 맞바꾼 변이(⑥을 ⑤ 앞에, ⑧을 ⑤ 앞에)를 자리마다 심는다. VP-11 S8은 허용 집합 항·같음 항·conflict 항·tree 항을 하나씩 지운 변이 4개. VP-12 E0·E2·E3은 각 검사 한 줄 제거. VP-17 V3은 `applies` 항 제거(linux 3730이 exit 0이 되면 red). VP-18 M1은 `messageId` 대조 항·`owner` 대조 항·`expectText` 항을 하나씩 지운 변이(앞의 둘은 “같은 id·같은 본문” 시험이 red), M3은 무장 입력을 `pointerdown`으로 맞바꾼 변이, P2 ⑧은 `opId`∈`selections` 항 제거 변이(U36이 red)와 표시 이름의 `sessionId` 항 제거 변이(U31 `sA` 입력이 red), P2 ⑩은 같은 run 대조 제거 변이(U37이 red), P10 R3은 값 출처를 `activeKey`로 맞바꾼 변이(불러오는 중 단계가 red), P2 ⑨는 `N/A` 분기 제거 변이(U34가 red). 이유: 모두 “통과시키지 않음”이 불변식이라 존재 단언만으로는 방향이 잡히지 않는다.
- **선언 경계**: 판독기는 원본 파일의 존재·SHA-256과 구간의 실재(`lines`·`trace-ts`·`json-pointer`·`table-row`·`trace-marker` — W-028)까지 본다 — 구간 안의 수치를 다시 계산하는 것은 H5 사람 검증이다. React Profiler 내보내기처럼 다른 형식의 구간은 `json-pointer`로 가리킨다. 대상 표시 기록(W-030·W-031)은 DOM 식별자가 있는 빌드에서만 나온다 — `first-body`는 `7c241d19` 이후, `search-target`은 `eae9081b` 이후다. 그래서 W ⑥ 축의 이전 빌드 `d8684684`의 첫 본문 셀은 `unobservable(no-message-id)`(P3 ⑨′ — 대화 열기 기능은 있으므로 `absent`가 아니다)이고 0326~0329 빌드는 `unobservable(no-session-owner)`(W-033)다. 상대 시간은 미판정이고 통합 쪽 절대 셀은 계속 판정한다. 콘솔 스크립트의 rAF 시점은 표시 프레임과 최대 1프레임 차이가 날 수 있으며, 이 차이는 H5 재계산이 trace Frames로 확인한다. 도구 스탬프는 `process.platform`만 구별하고 Windows 버전·GPU 같은 장비 프로필은 manifest(H1) 몫이다. W-014 모델의 기준선은 앱 `src`만 기준으로 되돌리므로 `package.json`·의존성은 도구 커밋 것을 쓴다 — 이 차이는 manifest의 `tool`·`appSource` 두 칸으로 드러나고 판정 셀에는 영향을 주지 않는다.
- **환경 한계**: WU-M의 Linux 사전 실행이 Electron 바이너리 부재(exit 3)로 끝나면 그 실행은 `환경 없음`이고 VP-08~17 판정에 쓰지 않는다 — VP-08~19의 좌표는 전부 Electron 없이 도는 `node --test`·renderer vitest다 — ΔV1(W-037)이 Electron 자식 기록의 출처 사본을 없애 P6에 Electron 전용 자리가 없다.
- **게이트가 green인 채로 남는 차이**: CI는 판독 규칙과 도구 출처·기준선 검사만 잰다. 목표 장비의 GPU·디스플레이·IME·native 앱 동작은 CI에서 측정되지 않는다(§17).

## 11. 구현 설계와 재현 가능한 판독

1. `manifest`는 시나리오 원문 revision·목표와 두 커밋 full SHA·바이너리 SHA-256·도구 출처(`tool`·`appSource`·`environment`)·모델·하네스·시나리오 및 입력 해시·필수 셀 목록·측정자·시작/종료 UTC·프로필·캡처 종류·반복 번호·전후·짝 ID를 가진다(§10-A 스키마). 실제 세션은 익명 별칭·복원 스냅샷 해시·메시지/part/행 수로 식별한다.
2. 각 관측은 §10-A `observations` 형식이다. 표본이 여럿이면 원본 배열과 단위를 보존한다.
3. 판독기는 순수 `evaluate`와 CLI 래퍼로 나눈다 — 시험은 순수 함수(UT)와 자식 프로세스 CLI(IT·AT)를 따로 둔다. 원본 읽기는 `readRaw` 주입으로 순수부를 파일 시스템에서 떼어 낸다. 새 의존성 없음(Node 표준 모듈만).
4. 측정 도구는 §10-B의 SSOT 함수와 seam 파일만 더한다. 측정 로직과 소유 판정 규칙(0328 R-H·R-W·R-R, 0329 기능·크기 조건)은 바꾸지 않고, 0329 시간 기준이 종료 코드에 걸리는 환경만 `linux-electron`으로 좁힌다(W-017).

## 12. 종단 경로와 지연 귀속

설치본의 사용자 조작과 진단 빌드의 같은 조작을 각자 관측한다. 동일 요청/세션/작업으로 대응되는 구간만 연결하고, 호스트별 monotonic clock 값을 그대로 빼지 않는다.

| 구간 | 관측 위치 및 부하 구별 |
|---|---|
| agent → data 또는 창 | 세션·요청 식별자, 발행·수신 순서와 각 프로세스 처리 시간. 발행까지의 모델 대기는 UI 처리 구간과 별도 표기. |
| T09 일반 열기(W-019) | **색인이 준비된 세션**: data 제한 페이지 조회 → IPC 응답 → `session-load.ts:91-119` `page()`의 `HistoryPageReplySchema.safeParse`·세션/요청/세대 대조 → store 반영 → 첫 실제 본문 paint. 행·바이트·호출 수, 취소·늦은 응답을 기록하고 **과거 전체 본문 읽기·조립 0회**를 확인한다(0329 AC1). |
| T09″ 색인 미준비 구 DB 첫 열기 | 0329 AC11대로 색인 준비 비용(변환 시간·디스크 증가·읽은 과거 본문 bytes)과 첫 실제 본문 paint를 분리하고, 준비 중 화면과 첫 본문 시각을 따로 남긴다. 이 행은 AC1의 0회 규칙을 받지 않는다. |
| T09′ 구 빌드·복구 | `7db1c7ce` **포함** 이전 빌드의 조각 수신 `:54` `SessionLoadChunkSchema` → `:63` `assembleSession`(0329 기준선 = 전량 열기), 그리고 전체 archive가 필요한 실행 복구·분기. 주 경로와 섞지 않는다. |
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
| 0329 §17 3,729ms | Linux 단독 실행 기준. 도구 출력 `linuxLatencyGate`는 `linux-electron`에서만 `verdict`·종료 코드에 들어가고 Windows에서는 `applies:false`로 기록만 한다. W 셀은 원값으로 판독기가 판정한다(W-017). |
| [앱 게이트와 DevTools 정책](../../../app/AGENTS.md) | 정상 설치본은 pristine 트리의 `build:win`. 진단 패치·profiler 환경·입력 fixture revision은 별도 기록한다. 새 스크립트는 `app/AGENTS.md` 스크립트 목록에 한 줄씩 더한다. |

## 17. 위험과 판정 한계

진단 빌드는 프로파일링 자체가 실행 시간에 영향을 준다. 진단↔진단, 설치↔설치만 비교한다. 모델 응답 길이·세션 원본·다중 세션 부하가 달라졌으면 해당 쌍에서 원인을 분리할 수 없다. Windows CI의 기계 게이트는 실제 목표 장비의 GPU·디스플레이·IME·native 앱 동작을 측정하지 않는다.

## 18. 영향 문서·실행 산출

| 파일 | 역할 | WU |
|---|---|---|
| `app/scripts/windows-verdict.mjs` · `windows-verdict.test.mjs`(신규) | 판독기·시험(§10-A) | M |
| `app/scripts/windows-verdict/example/{failing,passing}/*`(신규) | 예제 입력·원본·기대 출력 | M |
| `app/scripts/stage-d/measurement.mjs` · `measure-stage-d.mjs` · `stage-d-host/electron-main.mjs` · `stage-d-shell/probe.ts` · `stage-d/host-runner.mjs` · `stage-d/shell-runner.mjs` · `measure-stage-d.test.mjs` | 출처 스탬프·기준선 검사(P6) | M |
| `app/scripts/stage-e/baseline-source.mjs` · `stage-e/verdict.mjs`(신규 seam) · `measure-stage-e.mjs` · `measure-stage-e.test.mjs`(신규, `scripts/` 최상위) | 기준선 좌표·판정 분리(P7·P8) | M |
| `app/scripts/diagnostic-overlay/visibility-marks.js` · `diagnostic-overlay.test.mjs`(신규, `scripts/` 최상위) | 진단 빌드 콘솔용 대상 표시 기록(P9 · W-031) | M |
| `app/src/renderer/src/features/chat/harnesses/claude/transcript/Timeline.tsx` · `…/opencode/transcript/Timeline.tsx` · 값 전달 경로(`ChatTile.tsx` → `TranscriptView`) · renderer vitest 1파일(신규) | 행 소유 세션 표식(P10 · W-033) | M |
| `app/AGENTS.md` 스크립트 목록 | `windows-verdict.mjs` 한 줄 · stage-d/e의 기준선 모델(W-014)과 `linuxLatencyGate` 구절 | M |
| 이 폴더 `evidence/inputs-sha256.txt` | 재현 입력 고정 목록(rev 3 설계 턴 생성) | — |
| 이 폴더 `evidence/H1-0-linux.md`(신규) | WU-M 사전 실행 기록 | M |
| 이 폴더 `verify.md` · manifest·표본·결과표, 원소유자 verify AC 행 | WU-W 실행·판정 | W |

## 19. 실행·검증 게이트

### H1-0. WU-M 사전 실행(Linux, 지금)

모든 명령은 `app/`에서 실행한다. 결과는 `evidence/H1-0-linux.md`에 적는다.

| # | 명령 | 기대 · 기록 |
|---|---|---|
| 1 | `node scripts/measure-ui-inputs.mjs --write-inputs <dir>` → `(cd <dir> && find . -type f -not -path '*/.git/*' \| LC_ALL=C sort \| sed 's\|^\./\|\|' \| xargs sha256sum) > inputs.sha256` → `cmp inputs.sha256 ../docs/handoff/0330-windows-responsiveness-verdict/evidence/inputs-sha256.txt` | 216줄(F8 `git-200-files/` 200 + 나머지 16, F5 `git-50000/generated.ts` 포함 · `.git/` 내부 제외)이 고정 목록과 같다. 고정 목록은 rev 3 설계 턴에 `ff5c6b02` 도구로 두 번 생성해 같음을 확인한 값이다(목록 파일 SHA-256 `07b4cfc85c5e522b11c5de73611bceaba2665b12e4bf6e50e8e6e5c8488631aa`). |
| 2 | `npx electron-vite build && rg -c "__ooDev" out/renderer` / `VITE_OO_DIAGNOSTIC=1 npx electron-vite build && rg -c "__ooDev" out/renderer` | 0 / ≥ 1(W-006) |
| 3 | stage-e — 용도 셋을 나눈다(W-023). (i) **도구 사전 점검**: worktree `<p>`(WU-M 커밋 그대로)에서 `xvfb-run -a node scripts/measure-stage-e.mjs --old-db small` · `… long` (ii) **소유자 기준**: `<m>`에서 `git -C <m> restore --source=7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6 --staged --worktree -- app/src` → `… --baseline --old-db small` · `long` (iii) **소유자 후속**: `<f>`에서 `restore --source=eae9081b5536232da98ab918ed9f0c1b525660f6 …` → `… --app-source eae9081b5536232da98ab918ed9f0c1b525660f6 --old-db small` · `long`. (ii)·(iii) 전에 `git -C <w>/app diff --quiet <SHA> -- src`(exit 0)·`ls-files --others --exclude-standard -- src`(0줄) | (i) `tool` = `appSource.commit` = WU-M — 도구 점검 전용이며 소유자 셀에 쓰지 않는다. (ii) `tool` = WU-M · `appSource.commit` = `7db1c7ce…` · tree `9235fa7cb7ea2506abd5a6b38bda665ded21882b`. (iii) `tool` = WU-M · `appSource.commit` = `eae9081b…` · tree `6d2962222fe8c1629a937c1b10cabd5839bc1a07`. (ii)·(iii)의 `appSource.commit`이 0329 셀의 `pair.beforeSha`·`afterSha`와 같다. 모두 `environment: linux-electron`. Electron 부재면 exit 3 → `환경 없음`(통과로 세지 않음) |
| 4 | stage-d — 같은 셋. (i) `<p>`에서 `--host` · `--geometry` (ii) `<d>`에서 `restore --source=c7d2adf2ddb548a2ce897cfc4f19173a2879b77f …` → `--host --baseline` (iii) `<g>`에서 `restore --source=7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6 …` → `--host --app-source 7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6`. 그다음 `--compare <(ii) 출력> <(iii) 출력>` · `--compare ../docs/handoff/0328-composer-panels-lists-shell/evidence/r1.2-host-baseline.json ../docs/handoff/0328-composer-panels-lists-shell/evidence/r1.2-host-applied.json` | (i) 도구 점검 전용. (ii) `appSource.commit` = `c7d2adf2…` · tree `cd989a2f9b8c2689fcb467d3fa2e655d66228cc5`. (iii) `appSource.commit` = `7db1c7ce…` · tree `9235fa7c…`. (ii)·(iii)이 0328 셀의 짝과 같다. 두 `--compare` 모두 exit 0. `--host`가 egress로 막히면 서명과 함께 기록(0328 verify:61 선례) |
| 5 | `node scripts/windows-verdict.mjs --plan scripts/windows-verdict/example/failing/plan.json --manifest scripts/windows-verdict/example/failing/manifest.json --observations scripts/windows-verdict/example/failing/observations.jsonl --owners scripts/windows-verdict/example/failing/owners.json --decision scripts/windows-verdict/example/failing/decision.confirmed.json --raw-root scripts/windows-verdict/example/failing/raw` · 같은 명령의 `passing/` + `decision.json` / `decision.confirmed.json` | failing: `expected.confirmed.json`과 같고 exit 1. passing: exit 1(`판정 보류(사용자 확정 대기)`) → exit 0(`합격`) |

### H1. 빌드·장비·재현 입력을 고정한다(WU-W)

**필수 셀 분모를 먼저 만든다.** 검증자가 측정 결과를 열기 전에 ① §6의 각 소유 §19 표와 H4의 W1~W4·부하 쌍에서 시나리오·조작·하네스·빌드·계측 종류·지표·반복 수를 전개하고 ② W-004에서 확정한 목표 프로필과 W 필수 지표를 결합해 판독기 `plan.cells`로 고정한다. 키는 `소유자/revision × 시나리오/조작/부하수준 × 하네스 × 프로필 × 기준/후속 SHA × 설치/진단/Node × 반복 × 지표`다. 소유 표가 미지원으로 지정한 셀(예: 0326 S4의 설치본)은 사유를 보존한다.

**빌드 좌표**(W-007). 두 쌍을 구별한다 — **(a) 동일성 쌍**: 소유 verify가 판정한 구현 커밋과 PR 빌드 SHA의 앱이 같은가. **(b) 비교축 쌍**: 이전 단계 빌드와 이후 단계 빌드의 성능 비교. 각 빌드의 설치 파일 SHA-256을 manifest에 넣는다.

| 소유 | (a) 판정 구현 커밋(소유 verify 메타 · 원 브랜치) | PR 이력의 대체 SHA — **이 값을 쓴다** | (a) 확인 `git diff --quiet <대체> <빌드> -- app` |
|---|---|---|---|
| 0325 | `3867427`(verify 3 — r3 · 가져온 ref에 없음) | `a2ad3a5397bc6479edf9c0914bce6bb121cd7fea` | ↔ `d8684684` exit 0 · `app` tree 같음 |
| 0326 | `7244c0c`(verify 7 — r7 · 없음) | `98ec1b1d06ca780d2d0013e2e0c119b44950a88d` | ↔ `7c241d19` exit 0 · tree 같음 |
| 0327 | `a1d1b49c`(verify 5 — r5 · `origin/ccr-4767226e-xqwgpk`에만) | `7ab3f9125a92315c5d4c08511b2127483f259996`(trailer `Status: partial`) | ↔ `c7d2adf2` exit 0 · tree 같음 |
| 0328 | `dc6f69a`(verify 2 — r2 · 없음) | `498cc3d356dd9ea683a5ac80be7618c5942de448` | ↔ `7db1c7ce` exit 0 · tree 같음 |
| 0329 | `b5101150`(verify 5 — r5 · `origin/ccr-ca3d795a-2t0cmj`에만) | `df92cddd0662fe6e76d337a52c0377623c3c563b` | ↔ `eae9081b` exit 0 · tree 같음 |

대체 SHA는 rev 4 설계 턴에 고정한 값이며 trailer 조회로 다시 고르지 않는다 — `Status: implemented` 조회는 0327에서 `3550306f`(앱 diff 65파일)를 고른다(K4). 원 브랜치 ref가 있는 체크아웃은 판정 구현 커밋으로도 같은 diff 0을 확인할 수 있다(0327·0329 — rev 3 턴 실행).

| (b) 비교축 | 이전 full SHA | 이후 full SHA |
|---|---|---|
| ① 0325 AC19 | `ee8ac8173c83a97114a9dc8bd257ba770a7dc368` | `d86846844dc9ea092f394f942621b78dc3d50e02` |
| ② 0326 AC33 | `d86846844dc9ea092f394f942621b78dc3d50e02` | `7c241d191438e7aa9625a2914c38fe0a1b3d1bdd` |
| ③ 0327 AC30 | `7c241d191438e7aa9625a2914c38fe0a1b3d1bdd` | `c7d2adf2ddb548a2ce897cfc4f19173a2879b77f` |
| ④ 0328 | `c7d2adf2ddb548a2ce897cfc4f19173a2879b77f` | `7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6` |
| ⑤ 0329 | `7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6` | `eae9081b5536232da98ab918ed9f0c1b525660f6` |
| ⑥ W 통합 | `d86846844dc9ea092f394f942621b78dc3d50e02`(`plan.wBaselineSha`) | `(WU-W 착수 시 통합 SHA — 검증자 기입)`(`plan.integrationSha`) |

⑥의 구 빌드에 없는 E 전용 조작은 이전 셀을 `absent`로 두고(P3 ⑨) 통합 쪽의 절대 셀을 수행한다. AC19의 합의 전 기록은 참고 기준선이며 W-004 합의 전 실행을 W 최종 표본으로 승격하지 않는다(W-013 · P1 ②).

```powershell
$repo = (git rev-parse --show-toplevel)
$runDir = Join-Path $env:TEMP ("orca-W-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $runDir | Out-Null
# (a) 동일성 쌍 — 소유마다 한 번
git -C $repo diff --quiet "<PR 이력의 대체 SHA>" "<빌드 SHA>" -- app
if ($LASTEXITCODE -ne 0) { throw "PR substitute differs from build" }
# (b) 비교축 쌍 — 빌드
$beforeSha = "<비교축 이전 full SHA>"; $afterSha = "<비교축 이후 full SHA>"
git -C $repo worktree add --detach "$runDir/before" $beforeSha
git -C $repo worktree add --detach "$runDir/after" $afterSha
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

**재현 입력.** 통합 쪽 트리의 `app/`에서 `node scripts/measure-ui-inputs.mjs --write-inputs "$runDir/inputs"`를 실행하고 `.git/` 내부를 뺀 파일별 SHA-256을 고정 목록(`evidence/inputs-sha256.txt`, 216줄)과 대조한다 — PowerShell은 `Get-ChildItem -Recurse -File "$runDir/inputs" | Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' }`의 상대 경로(`/` 구분)·`Get-FileHash`를 같은 순서로 정렬해 비교한다. 목록은 F1~F5(0325 — F5 `git-50000/generated.ts`) · F6 `artifact-1mb.md` · F7 `generated-5mib.ts` · F8 `git-200-files/` 200 · F9 `table-1600.md`·`table-2001.md`·`footnote-60k.md`·`single-line-1mb.json` · `work-5mb.json`이다. 다른 줄이 있으면 그 입력의 셀은 측정하지 않는다. 함수 재측정은 `foreach ($repeat in 1..3) { foreach ($side in "before","after") { node scripts/measure-ui-inputs.mjs --src "$runDir/$side/app" | Out-File … } }`이다.

**측정 도구 좌표(W-014).** stage-d·stage-e는 WU-M 커밋(`(WU-M 구현 — 검증자 기입)`)의 도구를 쓰고, 기준선은 H1-0 3·4번과 같은 측정 전용 worktree(HEAD = 도구 커밋, `git restore --source=<기준> --staged --worktree -- app/src`)에서 실행하고, 소유자 후속은 같은 worktree 모델에 `--app-source <후속 SHA>`(W-023 — 0328 `7db1c7ce`, 0329 `eae9081b`)를 붙인다. 기준은 0328 `c7d2adf2`, 0329 `7db1c7ce`다. HEAD 앱 그대로의 실행은 도구 사전 점검이며 소유자 셀에 쓰지 않는다. Node 함수 측정(`measure-ui-inputs.mjs --src`)은 stdout 전체를 `runRef`(`node-stdout`)로 보관하고 `$LASTEXITCODE`를 manifest `exitCode`에 적는다 — 런타임은 그 출력의 `Node … · win32/x64` 줄에서, 지표 값은 표 행의 `<수>ms / <수>ms` 칸에서 판독기가 읽는다 — `N/A(…)` 행은 사유와 함께 측정 불가로 남는다(W-029). 실창 캡처(trace·설치본 로그)는 같은 세션의 H1 장비 기록을 `profileRef`로 붙인다. 출력의 `tool`과 `appSource`를 manifest의 두 칸으로 옮긴다. 원본의 런타임이 셀 기대값과 다르거나(Windows 설치·진단 = `win32-electron`, Windows Node 함수 = `win32-node`) 수집이 실패했거나 `provenanceConflict`가 있으면 그 기록은 Windows 셀에 쓰지 않는다(판독기 P2 ④⑦ — W-029). 기존 Linux 원본(0328 `evidence/*.json`, 0329 r1.4 표)은 **인용**으로만 표시하고 새 Windows 실행과 다른 열에 둔다. 0329 도구의 `linuxLatencyGate`는 Windows에서 `applies:false`이고 W 셀은 원값 `clickToBodyFrameMs`로 판독기가 판정한다(W-017).

**진단 빌드 준비.** 설치본과 동일 SHA에서 별도 진단 worktree를 만들고 diff와 diff SHA-256을 보관한다.

1. `app/electron.vite.config.ts` renderer에서 `build.minify=false`, `react-dom/client` 정확 일치 alias → `react-dom/profiling`. 진단 전용 본창에서만 DevTools를 열고 release worktree의 DEV 가드는 유지한다.
2. `$env:VITE_OO_DIAGNOSTIC="1"`로 `npm run build:unpack` 후 unpacked 실행 파일을 시작하고 `finally { Remove-Item Env:VITE_OO_DIAGNOSTIC -ErrorAction SilentlyContinue }`로 복구한다.
3. **짧은 사전 실행**(판정 표본 아님, 빌드마다): DevTools 콘솔에서 `typeof window.__ooDev?.loadFixture === 'function'` · `typeof window.__ooDev?.loadToolCardFixture === 'function'` · `__ooDev.startComputeTimings(); …조작…; __ooDev.finishComputeTimings().jobs.length > 0` · Performance trace에 Frames·Layout·이름 있는 앱 함수 · React Profiler commit 번호·duration이 실제로 나오는지 기록한다. 같은 콘솔에서 `app/scripts/diagnostic-overlay/visibility-marks.js`를 실행(파일 SHA-256 기록)하고, `__ooVisibility.arm({ opId: 'pre-1', kind: 'first-body', sessionId: '<열 세션 id>', messageId: '<목표 메시지 id>', expectText: '<목표 본문 일부>', input: 'click' })` 뒤 세션을 클릭해 trace에 `oo-select:pre-1`과 `oo-visible:first-body:<세션>:<id>:pre-1`이 남는지 확인한다(W-035 — `search-target`은 `eae9081b` 이후 빌드, `d8684684`는 `oo-unobservable:…:no-message-id`, W-033 이전 빌드는 `…:no-session-owner`). 판정 실행에서는 선택마다 새 `opId`로 무장하고 `{ opId, input, target }`을 그 run·반복의 manifest `selections`에 적는다 — 셀 `target`은 H1에서 미리 고정한 값 그대로다(W-034). 기능이 없는 구 빌드는 그 항목을 `N/A(이전 기능 없음)`으로 적는다.
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

**구분 표기**는 §7-A “세 구분” 표와 같다 — 결과 표의 모든 행에 `WU-M 기계` · `참고 기준선` · `WU-W 실측` 중 하나를 적는다.

| 결과 표의 열(W-011) | 작성 단위 |
|---|---|
| 소유·커버리지 | T/잔여 단위(복수 소유는 소유자마다 한 행 — 예: T33/0327 · T33/0328) · 소유 AC/§19 · 유효 계약(W-007) · 처리(수정·검증 완료 / 근거와 현행 유지 / 미검증·잔여 위험) |
| 소유자 기계 PASS | 소유 verify 좌표와 판정(`PASS`·`FAIL`·`미완`) |
| 소유자 Windows 결과 | 소유 AC(AC19·AC33·AC30·0328 Windows 행·AC10)의 Windows 기록 좌표와 소유 규칙 판정 |
| W 통합 판정 | 프로필 · 기준 revision · 하네스 · 입력/세 축 크기 · 빌드 종류/양 SHA · 구간 · 3쌍 값/N·단위·rawRef · 집계 · 비교식 · 충족/위반/미판정/기록 전용(판독기 출력) |
| 사용자 확정 | 사전 합의(revision·lockedAt) · 최종 확정(revision·confirmedAt·결정자) |
| 최종 기록 | 판독기의 `missing`·`unexpected`·`duplicates`·`conflicts`·`ownerFailures`·`holds` · 합의 전/후 구분 · W verify 링크 · 원소유 verify와 INDEX 반영 상태 |

**원본 전수 대조(W-015).** 판독기가 `--raw-root`로 모든 `rawRef`의 파일 존재·SHA-256·구간 칸과 run의 도구 기록을 대조하고, 누락 셀은 `미판정`으로 보류한다. 검증자는 판독기 출력의 보류 목록을 보고서에 그대로 옮기고, H5에서 셀 하나 이상을 원본 구간에서 다시 계산한다.

**재측정.** 수정 효과 확인은 영향 셀과 그 셀이 속한 교차 조작만 재실행할 수 있고 이전 SHA 결과를 보존한다. **최종 통합 PASS**는 하나의 통합 SHA와 하나의 기준 revision에 대한 W 필수 셀 전체가 필요하다 — 서로 다른 SHA의 통과 셀을 모아 만들 수 없다(판독기 P4 ④). 0329 NX1~NX3는 INDEX 후보 표의 기존 행으로 추적한다.

**운영 gate.**
- 설계 턴: 참조·보드 정합성, `git diff --check`, `cd app && node scripts/check-doc-inventory.mjs --check`.
- WU-M 구현 턴: `app/AGENTS.md`의 IMPL_DONE 전 로컬 확인 전부(`check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · `check-ui-thread` · `lint` · `typecheck` · 파일 필터 없는 `vitest run` · `node --test scripts/*.test.mjs` · `electron-vite build` + `smoke-hosts` + `smoke-preload`). 판독기·도구 시험은 `node --test scripts/windows-verdict.test.mjs scripts/measure-stage-d.test.mjs scripts/measure-stage-e.test.mjs scripts/diagnostic-overlay.test.mjs` + P10 renderer vitest로 따로 결과를 적는다. H1-0 1~5 기록.
- WU-W: 통합 SHA의 CI 산출 확인 + Windows 실기. 기계 gate와 Windows 실기 결과는 별도 행으로 남긴다.

## 20. ΔV1 — verify 1 PLAN_GAP 정정 (D1·D2)

**판정: 두 PLAN_GAP 모두 정정 → READY.** D1은 plan 내부 불일치(이행), D2는 창 안 확장 후보를 **채택**한다. Product/UX·W-001~W-036은 바뀌지 않는다. 구현은 r2에서 코드 3곳(자식 기록 2 · 판독기 1)과 시험만 바꾼다.

### 20-A. 조사

| 대상 | 검색 · 관측 | N · 의미 |
|---|---|---|
| 자식 기록의 출처 필드 | `rg -n "environment" app/scripts/stage-d-host app/scripts/stage-d-shell -g '!*.test.*'` | 2 — `electron-main.mjs:87`·`probe.ts:282`, 둘 다 `measurementEnvironment()` |
| 그 값의 소비 | `rg -n "environment" app/scripts/stage-d/host-runner.mjs app/scripts/stage-d/shell-runner.mjs` | 0 — 러너는 자식 결과를 그대로 넘긴다. 부모 `main`이 `stampProvenance(…, stamp)`로 덮는다(`measure-stage-d.mjs:36-37`) |
| host 자식의 `sha` | `electron-main.mjs:10` `const { bundle, sha, baseline, flows } = JSON.parse(options)` | 부모가 넘긴 값의 사본 — `stampProvenance`가 같은 값이면 유지, 다르면 `provenanceConflict` |
| verify 1 변이 | S4·S5 `environment: undefined` → `node --test scripts/measure-stage-d.test.mjs scripts/measure-stage-e.test.mjs` green · S5만 Xvfb 하네스 red | 최종 출력 계약(부모 스탬프) 밖의 중간 기록이라 시험이 닿지 않는다 |
| 소유자 열 판독 | `windows-verdict.mjs:640` `row[kind + 'Ref'] ? row[kind] : undefined` | 근거 없는 `FAIL`이 `undefined` → `미기록` → `ownerFailures` 누락(`evidence/verify1-axes.txt` `ownerFailNoRef`) |

### 20-B. Delta V

| 노드 · pair | provenance | requiredness | 변경 · 좌표 |
|---|---|---|---|
| R-07 ↔ AT-07 / VP-14 | CHANGED(ΔV1) | REQUIRED | AC7에 근거 없는 FAIL 문장 추가. 좌표: 기존 `report CLI: failing/passing example …` + 신규 `windows-verdict.test.mjs:'report CLI: owner FAIL without evidence still fails'`(passing 예제 사본의 `owners.json` 첫 행 `machine: FAIL`·`machineRef` 삭제 → exit 1 · `불합격` · `ownerFailures` 1 · hold `소유 판정 근거 없음`) |
| MD-02 ↔ UT-02 / VP-10 | CHANGED(ΔV1) | REQUIRED | P5 ⑧ a·b — U39 세 입력(§10-A P5 입력 칸) |
| MD-03 ↔ UT-03 / VP-11 | CHANGED(ΔV1) | REQUIRED | S4·S5 SUPERSEDED → P6′ 목록(아래). 좌표: 기존 `measure-stage-d.test.mjs:'provenance stamps every scenario result'`(`{env:false}`·환경 없는 geometry 결과 → 부모 스탬프의 `environment`) · `'environment follows the generating platform'` + 신규 `'child records carry no provenance of their own'`(`electron-main.mjs`·`probe.ts` 원문을 읽어 `measurementEnvironment`·`environment:` 0건 — 양성 짝은 앞의 스탬프 시험) |
| AR-02 ↔ IT-02 / VP-13 · R-08 ↔ AT-08 / VP-15 | INHERITED(V1 rev 7) | REGRESSION | `compare CLI …` 3건 재실행 — 기존 Linux 증거 쌍 exit 0 유지 |
| AR-01 ↔ IT-01 / VP-08 · MD-01 ↔ UT-01 / VP-09 | INHERITED(V1 rev 7) | REGRESSION | 같은 파일(`windows-verdict.mjs`)·같은 시험 파일이라 전체 재실행 |
| VP-12·VP-16·VP-17·VP-18·VP-19·VP-R1 | INHERITED(V1 rev 7) | NOT_REQUIRED | r2가 닿지 않는 파일(stage-e·진단 스크립트·렌더러·0328 판정 함수). 기존 증거 = verify 1 §5 PASS 좌표 |
| VP-01~07 | INHERITED(V1 rev 7) | — | WU-W 미착수(W-018) |

### 20-C. §10 정정

| 자리 | 규칙 | 직접 oracle · 구별 입력 |
|---|---|---|
| **P6′** (ΔV1 — P6 목록 재고정) | 자리 검색 `rg -n "environment\|measurementEnvironment\|provenance\|stampProvenance\|appSourceIdentity\|compatibleRun\|parseMeasureArgs\|rev-parse\|'--porcelain'\|linux-electron\|win32-electron" app/scripts/measure-stage-d.mjs app/scripts/stage-d app/scripts/stage-d-host app/scripts/stage-d-shell -g '!*.test.*'` → ΔV1 시점 32줄. **운반 24** — S6 스탬프 `measure-stage-d.mjs:37`·`measurement.mjs:68`·`:72` · S7 출처 `measure-stage-d.mjs:36`·`measurement.mjs:57`·`:58`·`:60`·`:61` · 환경 SSOT `measurement.mjs:10` · S8 `measurement.mjs:9`·`:135`·`:137`·`:138`·`:139`·`:141` · S9 `measure-stage-d.mjs:194`·`:199`·`:200` · S10 `measurement.mjs:27`·`:45`·`:46`·`:47` · S11 `measure-stage-d.mjs:175`·`measurement.mjs:16`. **제외 6** — import(`measure-stage-d.mjs:5`·`:6`·`:7`·`:8`·`probe.ts:1`·`electron-main.mjs:1`). **SUPERSEDED 2** — `electron-main.mjs:87`·`probe.ts:282`(r2가 지운다. 두 import 줄도 함께 지운다). r2 뒤 기대 출력 28줄(32 − 자식 줄 2 − import 2) | 운반 24줄의 좌표는 rev 3 P6 칸의 시험 그대로다. 자식 출처 사본이 없다는 것은 신규 `'child records carry no provenance of their own'`이 잡고(r2 뒤 두 파일 `environment:` 0건), 부모 스탬프가 최종 기록의 `environment`를 정한다는 것은 `'provenance stamps every scenario result'`가 잡는다 — 음성·양성 짝 |
| **P5 ⑧** (ΔV1 NEW) | §10-A P5 칸의 ⑧ a·b(W-038) — 구현 자리는 소유 열 판독(`windows-verdict.mjs:639-649` `column`)과 전체 판정 앞의 hold 집계 | U39 세 입력 + 신규 AT `report CLI: owner FAIL without evidence still fails` |

**고장 이력 처리.** verify 1의 S4·S5 행(`못 잡음` · S4 ⑦ 잔여)은 W-037이 그 동작(자식 기록의 출처 사본) 자체를 없애므로 이 절을 근거로 닫는다. 같은 실수(최종 기록에 환경 누락)는 지금 사는 자리 S6(`measure-stage-d.mjs:37` 스탬프 호출 제거)으로 재앵커해 r2와 verify 2에서 돌린다 — verify 1 원장 S6 행이 이미 red다.

**선택 적대 증거(ΔV1).** P5 ⑧ a의 `ownerFailures` 추가 항만 지운 변이(U39·신규 AT가 red), ⑧ b를 맞바꿔 근거 없는 PASS를 PASS로 읽는 변이(U39 둘째 입력이 red). P6′는 r2 뒤 자식 파일에 `environment: measurementEnvironment()` 한 줄을 되살리는 변이(신규 `child records …`가 red).

**선언 경계(ΔV1).** 자식 Electron 기록이 부모와 다른 플랫폼에서 돌 가능성(에뮬레이션 등)은 다루지 않는다 — 부모와 자식은 같은 실행·같은 장비이고, 그 차이는 manifest의 장비 기록(`profileRef`)이 드러낸다.

**r2 운영 gate.** §19 H6 “WU-M 구현 턴” 목록 전부 + `node --test scripts/windows-verdict.test.mjs scripts/measure-stage-d.test.mjs scripts/measure-stage-e.test.mjs scripts/diagnostic-overlay.test.mjs` + P6′ 자리 검색 재실행(28줄·자식 파일 0줄). H1-0 4번 Electron 실행은 사전 점검이며 VP 좌표가 아니다.

## READY self-review

- **ΔV1(verify 1 정정)**: D1 → W-037(자식 Electron 기록의 출처 사본 제거, P6′ 목록 32줄 재고정 — 운반 24·제외 6·SUPERSEDED 2), D2 → W-038 채택(P5 ⑧ a·b, U39, 신규 AT 1). CHANGED 노드 R-07·MD-02·MD-03에 같은 레벨 REQUIRED pair(VP-14·VP-10·VP-11), 영향 상위 VP-08·09·13·15 REGRESSION, 나머지 NOT_REQUIRED(근거 §20-B). 분기 55. `ACTIVE 결정 ↔ AC` 대조는 갱신 메모(ΔV1) — 충돌 0. 확장 창: verify 1 뒤라 창 안이며, 이번 ΔV1은 verify 2회째 뒤 설계 턴이 아니므로 열거 원문을 늘릴 수 있다.

- **WU-M READY · WU-W 대기(W-004 OPEN).** WU-M은 판독기가 합의·확정 파일을 입력으로 받으므로 W-004 값과 무관하게 막히지 않는다. W-004는 측정 장비나 내부 stall 상수에서 추론할 수 없다.
- Ledger: rev 3이 W-014~W-019를 추가하고 W-009를 W-019로 대체했다. rev 4가 W-020~W-023을, rev 5가 W-024~W-027을 추가하고 W-020을 W-024로 대체했다. rev 6이 W-028~W-032를 추가하고 W-021·W-024·W-025·W-026·W-027을 대체했다. rev 7이 W-033~W-036을 추가하고 W-030·W-031을 대체했다. `ACTIVE 결정 ↔ AC` 대조 결과는 §3 갱신 메모(rev 3~7 모두 충돌 0).
- V: 모든 NEW 왼쪽 노드에 같은 레벨 REQUIRED pair(VP-01~19 — VP-18은 진단 스크립트, VP-19는 렌더러 표식). R-07~R-10은 VP-14~17이, R-11은 VP-19가 닫는다. 영향받은 상위 동작은 0328 VP-12·25 → VP-R1 REGRESSION. VP-01~07은 WU-W이며 WU-M verify에서 pair 결과를 받지 않는다(W-018).
- §10: 규칙 칸 분기마다 입력 칸 입력이 있다 — P1 5/5 · P2 10/10 · P3 17/17 · P4 9/9 · P5 8/8(①~⑦, ⑥ a·b) · C 4/4 · P6 S1~S11 · P7 E0~E7 · P8 V1~V5 · P9 M1~M7 · P10 R1~R3. 판독기는 모르는 형태 fail-closed. 자리 검색 명령과 rev 3 출력(P6 17줄 · P7·P8 13줄, 제외 각 1 — rev 4 술어 추가 뒤에도 같음)은 §10-B 끝. P9는 신규 파일이라 0줄, P10은 `rg -n 'data-behavior="virtualizable"' app/src/renderer/src -g '*.tsx' -g '!*.test.*'` → 2줄(R1·R2). WU-M verify가 닫는 시험은 `windows-verdict.test.mjs`·`measure-stage-d.test.mjs`·`measure-stage-e.test.mjs`·`diagnostic-overlay.test.mjs`와 P10 renderer vitest 1파일이다.
- 예제 정합: 실패 예제는 확정 전후 모두 `불합격`·exit 1, 충족 예제만 확정으로 exit 0이 된다 — P4 ⑤·⑧과 C4가 같은 문장을 쓴다(G1 해소).
- 인용 실측(rev 3 턴): `checkout` vs `restore` 재현(48 · exit 1 / exit 0 · tree `9235fa7c`), `c7d2adf2`의 stage-d 도구 0개, 판정 구현 ↔ 빌드 앱 diff 5/5 exit 0, 기존 Linux 증거 `--compare` exit 0, 입력 216줄 두 번 생성 동일, `node --test` glob이 `scripts/*.test.mjs` 최상위만 읽음(`package.json:14`), `measure-stage-e.mjs`가 import 시 측정을 실행(`:106-113`).
- 인용 실측(rev 4 턴): 0327 trailer 조회 `3550306f`·앱 diff 65 / `7ab3f912` `Status: partial`, 대체 SHA 5개 ↔ 빌드 `app` tree 5/5 같음, `a1d1b49c`·`b5101150` PR 이력 밖, `app/src` tree `c7d2adf2`=`cd989a2f`·`7db1c7ce`=`9235fa7c`·`eae9081b`=`6d296222`.
- 인용 실측(rev 5 턴): `measure-ui-inputs.mjs:914-916` 출력 형식(`Node <버전> · <platform>/<arch>` + 표, `env` 없음), renderer `performance.mark|measure` 1건(`TranscriptViewport.tsx:671`), `data-message-id` 보유 파일 0325 0 · 0326~0329 3, `data-history-highlight` 0329만 3, 대상 술어 `stage-e/probe.tsx:121-131`.
- 인용 실측(rev 6 턴): `measureCase`·`formatCell`(`measure-ui-inputs.mjs:202-222`)의 세 출력 형태, `boot.sequence.completed` 필드(`boot-report.ts:64-69` — 플랫폼 없음), 본문 확인 술어 `stage-e/probe.tsx:125-129`.
- 인용 실측(rev 7 턴): 세션마다 같은 `native-<j>`·본문(`stage-e/host.ts:42-54`), `data-session-id` 사이드바 3곳만, `remountTranscriptBySession` 정책 의존(`ChatTile.tsx:147`), `messages`·`sessionId` 같은 슬롯(`chatStore.ts:3119-3121`·`ChatTile.tsx:58`·`:62`), transcript 경로 `useDeferredValue`·`startTransition` 0건, 스크롤 루트 2곳(`Timeline.tsx:121` ×2).
- 사람 실기로 미룬 순수 로직 없음: 판독 규칙·스탬프·기준선 검사·종료 코드는 전부 `node --test`. Windows 실기는 장비·IME·터치패드·GPU 관측만 남는다.

---
> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §9).

## [구현자 기입] 설계 리뷰

- **동의 / 그대로 진행**. §10·§19 H1-0에 따라 WU-M r1에서 AC7~11을 구현했다.
- **이견 / 현실성 문제**. §14·§19의 목표 Windows 장비와 사용자 합의는 WU-W에서 확인한다.
- **ACTIVE Decision과 충돌하는 설계 발견**. 해당 없음.

W-004와 H1의 필수 셀은 Windows 측정자가 확인할 항목으로 남겼다. 도구·실측·판독기 실행 기록은 [H1-0-linux.md](evidence/H1-0-linux.md)에 있다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

아래의 U 번호는 `scripts/windows-verdict.test.mjs`의 테스트명이다. S는 `measure-stage-d.test.mjs`, E·V는 `measure-stage-e.test.mjs`, M은 `diagnostic-overlay.test.mjs`를 사용했다. 원문 변이와 실패한 테스트명은 [r1-mutations.tsv](evidence/r1-mutations.tsv)에 있다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-08 | CLI 입력·출력 | C1~C4 | 4/4 | `cli rejects…`·`report CLI…` 두 예제 | 누락 인자·깨진 JSONL → 2와 원인, 유효 JSON → 0/1 | — |
| VP-09 | 원본·집계 | P2·P3 | 27/27 | U1~5·U8~11·U15~16·U19~23·U25~26·U28~38 | 원본 경로·해시·run·opId를 바꾸면 보류, 다른 행 강조는 위반. p95·건수·비·bytes를 각각 단언 | — |
| VP-10 | 기준·전체·소유 | P1·P4·P5 | 22/22 | U6~9·U12~14·U17~18·U24·U27·U33 | 전후 1ms, W·소유 SHA, 다른 소유자, 독립 확정 상태 → 네 열과 전체 판정 | — |
| VP-11 | 출처 | S1~S11 | 11/11 | `environment follows…`, `provenance stamps…`, `baseline identity…`, `app-source names…`, `comparison requires…`; H1-0 D 및 S4/S5 실제 프로세스 | win32/linux/darwin, 다른 tree·source sha·도구 SHA, 충돌·미추적 소스 | — |
| VP-12 | 기준 소스 | E0~E7 | 8/8 | `baseline host source is pinned`, `baseline CLI refuses…`, `app-source CLI refuses…`, `non-comparison CLI…`; H1-0 E | 다른 blob·ancestor·앱 tree → 실행 전 실패, 실제 baseline·후속 → 서로 다른 commit | — |
| VP-13·15 | CLI 비교 | S8·S9 재사용 | 2/2 | `compare CLI…` 네 사례 | 기존 Linux 기록은 0, 혼합·충돌 1, 양쪽 출처가 stdout에 남음 | — |
| VP-14 | 예제 인수 | P4 ⑤~⑧·C4 재사용 | 5/5 | `report CLI…` 두 사례 | 합의와 확정, 실패와 충족을 교차한 기대 JSON 네 벌 | — |
| VP-16 | 기준선 거부 | E0·E5·E7 재사용 | 3/3 | 두 `CLI refuses mismatched application sources` 및 Electron 미설치 대조 | baseline·app-source의 서로 다른 오류 문구와 종료 1 | — |
| VP-17 | 기능·크기·시간 | V1~V5 | 5/5 | `stage-e verdict keeps Windows…`; H1-0 E | 3729/3730ms, 256KiB+1, 빈 본문, warm 전송량 → Linux와 Windows 종료 코드 | — |
| VP-18 | 선택 프레임 | M1~M7 | 7/7 | `first body belongs…`부터 `an older search trace…`까지 | 같은 ID와 본문·다른 세션, 두 입력·다른 강조, 599/600프레임 → trace 표식 | — |
| VP-19 | 행 소유 세션 | R1~R3 | 3/3 | `ChatTile.transcriptSession.test.ts` 3개 하네스 | 같은 본문을 가진 A와 B 사이의 빈 슬롯에서 DOM 소유자와 행을 함께 확인 | — |
| VP-R1 | 0328 기존 판정 | 상속 | 기존 7/7 | `measure-stage-d.test.mjs`의 R-W·R-H·R-R·요약·비교 사례 | 기존 Linux evidence 쌍으로 CLI 0 재현 | — |

P5 ⑥은 예정 셀 존재(a)와 소유자 결과 존재(b)를 따로 센다. 공유 지점을 한 번씩 세면 판독기 53, stage-d 11, stage-e 13, 진단 스크립트 7, 렌더러 3이다. 검색으로 찾은 줄의 분류와 제외 근거는 [H1-0의 자리 재검색](evidence/H1-0-linux.md)에 있다. §10 자리 목록 밖에서 본 운반 자리는 0개였다. 직전 verify 고장 이력의 `못 잡음` 행은 첫 구현이라 해당 없음.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-08·14 | REQUIRED | SELF_PASS | 두 `report CLI…`, `cli rejects…` | C1~C4 · P4.priority5/8 |
| VP-09·10 | REQUIRED | SELF_PASS | U1~U38 · `a selection produces…` | P2.8a/b·P2.9a·P2.10·P4.priority5/8 |
| VP-11·13·15 | REQUIRED | SELF_PASS | S1~S11·compare CLI | S8a~e |
| VP-12·16·17 | REQUIRED | SELF_PASS | E0~E7·V1~V5·두 CLI 거부 | E0·E2·E3·V3a |
| VP-18·19 | REQUIRED | SELF_PASS | M1~M7·세 하네스 DOM | M1a/b/c·M3a·R3 |
| VP-R1 | REGRESSION | SELF_PASS | 변경 전부터 있던 stage-d 7개 테스트 | 직접 판정 |

## [구현자 기입] 이번 라운드 수정의 잠금

[변이 원장](evidence/r1-mutations.tsv)은 한 행에 변경한 항, 원문 좌표, 최초·최종 결과와 실패한 테스트를 남긴다. `mutate.py`는 매 실험 뒤 원문 바이트를 복원했다. S4·S5는 Electron 생산자 반환값을 직접 읽어 환경 필드 누락을 검사했다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 원장의 선택 증거 20행 | §10-C | 최초 | 행별 직접 좌표 | 검출 |
| 원장의 sweep 124행 | §10-A·B | 최초 | 행별 직접 좌표 | 검출 |

분모 검산은 선택 증거 20 · 인용 변이 0 · 새 구조 oracle 0 · sweep 124 = 원장 144행. 최종 검출 144/144. P1.4d는 종료 시각이 비어 있는 재시도가 함께 제출돼도 마지막 유효 실행보다 앞선 확정을 보류한다. 해당 단언은 수정 전 실패, 수정 후 통과했다. 최초 검사에서 생존한 P3.1c·P5.3·P5.6b·C1은 단위·필수 셀·소유 필드·누락 인자 단언을 보강한 뒤 네 건 모두 검출됐다. 첫 구현으로 이전 라운드 덮개 회귀는 해당 없음.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 결과를 누가 읽는가 | CLI JSON과 종료 코드가 테스터에게 위반·결측·소유 결과·사용자 결정을 전달한다. | H5에서 실제 원본 1셀을 재계산한다. |
| 정리 코드의 스코프 | stage-d/e의 probe와 임시 번들은 기존 finally에서 정리한다. | H1-0 반복 실행 |
| 이번에 만든 실패 경로의 Part I 상태 전이 | 원본·도구 불일치는 미판정, 기능 실패는 위반, 합의 전 실행은 기록 전용이다. | 해당 셀에 사유와 반복 키를 남겼다. |
| 실패의 화면 표시 | JSON은 위반·결측과 원인을 셀·반복별로 보여 준다. | 실패 예제에서 스크롤 위반과 검색 대상 결측을 확인했다. |
| 늦은 선택 표시 | op1의 늦은 프레임을 op2에 넘겨도 U32가 보류를 확인한다. | 실창 H4 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 행 소유자 속성이 없는 구버전에서도 강조된 행이 보인다. | 소유자 없는 강조에서는 기존 빌드의 관측 불가 사유를 보존한다. | `an older search trace without a session owner stays unobservable` |
| 2 | 한 실행에서 선택 둘이 같은 지표·구간을 쓴다. | 관측 키에 선택 opId를 포함하고 run의 선택 목표와 대조한다. | U32 |
| 3 | Node ABI와 Electron ABI가 다르다. | Node 22 로컬 헤더로 테스트 바인딩을 만들고 Electron 측정은 별도 바인딩으로 실행했다. | 전체 Vitest·H1-0 E/D |

종료 시간이 없는 재시도를 유효한 실행과 함께 제출하면 이전 코드는 이른 확정을 허용했다. 마지막 유효 종료 시각으로 비교하도록 수정했다. U18은 이 입력에서 `확정이 실행보다 앞섬`을 확인하고, P1.4d는 해당 검사를 제거하면 기댓값이 실패하는 것을 확인했다.

### 설계 대비 명시적 차이

stage-d S1~S3·S7·S10은 진입 시 한 번 구한 출처를 하위 측정에 전달한다. H1-0에서 기준·후속 SHA와 tree를 각각 확인했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 실행 도중 소스 변경 | H1-0은 분리한 worktree의 고정 소스로 실행 |
| 공유 | 여러 시나리오에서 출처 혼동 | S6은 매 `main` 호출에서 stamp 생성 |
| 재진입 | 연속 실행 간 stamp 재사용 | D/E 기준·후속의 서로 다른 tree 확인 |
| 다른 무효화 | 생산자·부모 환경 불일치 | S8에서 conflict를 넣으면 비교 종료 1 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | §18의 WU-M 도구, 예제, 진단 스크립트, transcript 소유 속성 및 시험. [사전 실행](evidence/H1-0-linux.md) · [변이 원장](evidence/r1-mutations.tsv) |
| 실행 명령 | §19 H1-0 1~5 및 H6 로컬 CI 명령 |
| 관측한 게이트 산출 | 가드 5개·lint(오류 0, 경고 12)·typecheck·번들·host/preload smoke 통과. Node 테스트 1150건 통과. 아래 Vitest 기준선 대조. |
| 추가·수정 테스트의 subtree 규칙 | Node 스크립트 시험 4파일, renderer unit 1파일. `check-test-budgets`가 시간 예산 위반 0을 확인했다. 추가된 renderer 시험은 프로세스·Git·SQLite를 생성하지 않으며 unit 풀에서 3/3 통과했다. |
| V-pair 자기확인 | WU-M SELF_PASS 13 / SELF_BLOCKED 0(REQUIRED 12·REGRESSION 1). VP-01~07은 WU-W 미착수. |
| 강제 지점 전수 | §10 분기·자리 87/87(공유 자리 중복 제외) |
| AC 자기보고 | AC7 CLI 기대 JSON 4개, AC8 stage-d 두 비교, AC9 E 기준·후속 tree, AC10 Linux/Windows 3730ms 대조, AC11 renderer 3개 하네스. 직접 Node 시험 53건 통과. |
| 합계 검산 | ✅ 5 · ⚠️ 6 · ❌ 0 = 총 11. AC1~6은 WU-W 실측 대상. |
| 블로커 / 역질문 | WU-W는 사용자 W-004 합의와 H1 필수 셀 고정 대기. 0325 AC19 참고 기준선은 소유자 소관. |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

전체 Vitest 관측은 `9 failed | 1140 passed | 4 skipped (1153) / 22 failed | 10903 passed | 1 expected fail | 11 skipped (10937)`다. 동일 Node 22 ABI로 설계 트리와 구현 트리의 실패 테스트 이름을 대조했다. 양방향 차집합은 0건이다. 실패 좌표와 OS 서명은 [사전 실행 기록](evidence/H1-0-linux.md)에 있다.

## [구현자 기입] Review Signals — 사실만

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가**. 해당 없음(첫 구현).
- **그것을 막았어야 할 plan 지침·AC가 있었는가**. §10 단일 항 변이에서 생존한 네 항의 단언을 추가해 모두 재현했다.
- **반복해서 부딪히는 환경 한계**. Linux에서는 Windows 장비의 IME·GPU·터치패드 실측이 남는다. Linux 전체 테스트의 기존 실패는 H1-0에 대조했다.
- **현재 라운드·impl 턴**. r1. 다음 주체는 WU-M 독립 검증자다.

---

## [구현자 기입] 설계 리뷰 (r2)

- **동의 / 그대로 진행**. ΔV1의 W-037·W-038을 구현했다. 호스트·셸 기록은 CLI의 환경 값을 공유한다. 소유자 실패와 근거 누락은 한 보고서에서 함께 읽을 수 있다.
- **이견 / 현실성 문제**. 해당 없음. 자식 필드와 import를 제거한 뒤 §20-C의 P6′ 검색이 32줄에서 28줄로 줄었다.
- **ACTIVE Decision과 충돌하는 설계 발견**. 해당 없음. U39에서 참고 셀은 소유자 열에 실패를 표시하고 전체 합격은 유지했다.

## [구현자 기입] 강제 지점 전수 (§10 대조 · r2)

판독기는 `windows-verdict.test.mjs`, stage-d는 `measure-stage-d.test.mjs`에서 확인했다. 아래 U 번호는 판독기 테스트의 이름이다. 실행별 값과 비교 대상은 [Linux 사전 실행](evidence/H1-0-linux.md#r2-사전-실행)에 있다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-08 | CLI 입력과 결과 | C1~C4 | 4/4 | `cli rejects…`, `report CLI…` 3건 | 파일 누락·파싱 오류는 2, 확정 예제와 무근거 실패는 각각 0·1 | — |
| VP-09 | 원본과 집계 | P2 ①~⑩·P3 ①~⑯ 및 ⑨′ | 27/27 | U1~5·U10~11·U15~16·U19~23·U25~26·U28~38 | 해시·반복·선택 ID는 제출한 run의 원본과 대조. 중앙값·최댓값을 바꾼 X5.1 검출 | — |
| VP-10 | 결정·전체 판정·소유 열 | P1 5·P4 9·P5 10 (§20-C 포함) | 24/24 | U6~9·U12~14·U17~18·U24·U27·U33·U39 | machine/windows 각각 FAIL·PASS·미완과 근거 유무, 같은 소유자 복수 행·참고 셀. U39가 열·ownerFailures·hold·전체를 직접 확인 | — |
| VP-14 | CLI 인수 예제 | C4·P4 ⑤~⑧·P5 ⑧ a·b 공유 | 7/7 | `report CLI: failing/passing example …`와 `report CLI: owner FAIL without evidence still fails` | 확정된 passing 예제의 machine 한 행을 바꾸면 T17/0326·근거 없음 hold 한 건씩, 불합격·1 | — |
| VP-11 | 부모 출처와 자식 필드 제거 | P6′ 24줄·제거 대상 S4/S5 | 24/24, 두 자식 파일 0줄 | `environment follows…`·`provenance stamps…`·`child records carry…`·`baseline identity…`·`app-source names…`·`non-comparison CLI…`·`comparison requires…`·`compare CLI…` | linux/win32/darwin, tool·appSource, 기준·후속 SHA, dirty·충돌, CLI 측정 실패·geometry. 자식마다 필드·import 재도입 검출 | — |
| VP-13·VP-15 | 비교 CLI와 출처 | P6′의 S8·S9 공유 | 9/9줄 | `compare CLI…` 4건 및 0328 보관 쌍 재실행 | 양쪽 source·sha를 보존. 보관 Linux 쌍 0, 혼합 환경·충돌 1 | — |

- §10 자리 목록 밖에서 본 운반 자리 없음. 판독기 검색 결과 184줄은 운반 180·제외 4, P6′는 명세 좌표 24·import 4였다. 각 검색과 좌표 목록의 양방향 차집합은 0줄이다. 부록에 파일별 줄을 남겼다.
- 직전 verify의 S4·S5는 W-037로 제거했다. S4의 미실행 잔여와 S5의 Electron 의존을 대체하는 Node 검사는 두 파일에 값을 되살렸을 때 각각 실패했다. 최종 환경을 붙이는 S6은 CLI 호출 제거로 다시 검출했다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-10 | REQUIRED | SELF_PASS | U7·U14·U24·U39 | P4.priority5/8·P5.8a/b 검출 |
| VP-11 | REQUIRED | SELF_PASS | `child records carry no provenance of their own`, `provenance stamps every scenario result`, `non-comparison CLI…` | host·shell 필드 복원, S6와 S8a~e 검출 |
| VP-14 | REQUIRED | SELF_PASS | 기존 CLI 예제 2건과 무근거 FAIL CLI 인수 시험 | 무근거 FAIL 누락 변이 P5.8a 검출 |
| VP-08·VP-09 | REGRESSION | SELF_PASS | 판독기 시험 파일 전체 | 원본 연결 P2.8a/b·9a·10 및 CLI 종료 코드 검출 |
| VP-13·VP-15 | REGRESSION | SELF_PASS | `compare CLI…` 4건 | 비교의 환경·충돌·앱 tree 대조를 지우면 실패 |

VP-12·16·17·18·19·R1은 §20-B의 NOT_REQUIRED다. 이전 독립 검증 좌표는 [verify 1 §5](verify.md#5-v-pair-closeout)에 있다. VP-01~07은 WU-W에 남는다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| P5.8a/b·양쪽 자식 필드 복원 등 선택 증거 15행 | §10-C·§20-C | 신규 4, 상속 11 red | U39·무근거 FAIL CLI·자식 원문 검사 등 원장 행별 좌표 | 15/15 |
| S6 부모 스탬프 호출 제거 | D1 인용 변이 재앵커 | S6 red, 자식 S4/S5는 Node 검사에서 green | `non-comparison CLI…` | 1/1 |
| host·shell 각각 import만 복원하거나 환경 값을 리터럴로 재도입 | 새 구조 검사 민감도 | 최초 | `child records carry…` | 4/4 |
| §10 자리·분기와 형제 교환, 새 소유자 근거 처리 | 열거 sweep | 이전 결과와 현재 결과는 원장에 기록 | P6-parent-after는 전달을 끊어도 최초 green. 다른 40자 SHA를 인자로 주고 종료 1과 해당 SHA를 포함한 진단을 확인한 뒤 red | 116/116 |

- 분모 검산은 선택 증거 15·인용 변이 1·새 구조 검사 4·sweep 116 = 136행이다. D2의 무근거 FAIL 누락은 P5.8a와 같은 행이다. 각 행에 변경한 원문·좌표·실패한 테스트와 명령을 적었다. [r2 변이 원장](evidence/r2-mutations.tsv)
- 덮개 회귀는 이번 범위의 이전 100행과 verify 1 형제 교환 4행에서 0건이다. S4·S5 자리 삭제와 S6 재앵커는 별도로 확인했다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 사용자 대면 문구·상태의 소비자 | CLI 보고서에서 테스터가 실패한 소유자와 `소유 판정 근거 없음`을 함께 읽는다. | 근거가 추가되면 hold가 사라지는 U39 대조 |
| 정리 코드의 스코프 | 자식 기록 객체의 필드와 import 두 쌍만 제거했다. | 동일한 Linux 창에서 host·shell 프로세스 종료 확인 |
| 실패 경로와 Part I 상태 전이 | P4 ⑤. 소유자의 FAIL이 있으면 다른 결측·확정 상태와 함께 불합격을 표시한다. | 확정된 passing 예제로 CLI 검사 |
| 사용자가 실패를 식별할 수 있는가 | 소유자 열에 FAIL, 결과에 T17/0326이 남고 CLI는 1을 반환했다. | AT-07 |
| 늦게 도착한 응답 | 판독은 입력 파일 한 벌을 동기적으로 평가한다. 같은 소유자 두 행은 각각 자기 근거를 사용한다. | U39 복수 행 검사 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 링크가 없는 다른 행이 근거 있는 FAIL에 결손을 잘못 붙이거나, 근거 있는 형제가 무근거 FAIL을 가릴 수 있다. | 실패를 기록한 해당 열·행에서 근거를 확인한다. | U39 · P5.8-own-ref/mixed-fail/ref-column |
| 2 | stage-d CLI의 후속 SHA 인자가 부모 스탬프까지 전달되지 않아도 기존 인자 형식 검사가 통과했다. | 소유 앱과 다른 유효 SHA를 줘 실제 거부 문구와 종료 코드를 검사했다. | P6-parent-after 최초 green → red |

### 설계 대비 명시적 차이 (r2)

W-037·W-038과 다른 구현 없음.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음. 출처 스탬프는 CLI 실행마다 만든다. | AC8 · S6 제거 검출 |
| 공유 | 해당 없음. 소유 열·행마다 근거를 평가한다. | AC7 · U39의 형제 열·복수 행 |
| 재진입 | 해당 없음. 보류 사유는 `evaluate` 호출에 속한다. | U39의 실패·성공 연속 실행 |
| 다른 무효화 | 해당 없음. 같은 장비의 자식 기록은 부모 환경을 따른다. | 자식 원문 검사와 부모 스탬프 시험 |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | 판독기와 시험, stage-d 호스트·셸 생산자, stage-d 시험. 생산자 두 곳에서 import 한 줄·필드 한 줄씩 제거했다. |
| 실행 명령 | §19 H6 전체, §20-C 네 스크립트 시험, P6′ 재검색, H1-0 및 실제 셸 시나리오. [사전 실행과 게이트](evidence/H1-0-linux.md#r2-사전-실행) |
| 관측한 게이트 산출 | 가드 5개·타입 검사·일반/진단 빌드·host/preload smoke 통과. lint 오류 0·경고 12. Node 1,153건 통과. Linux 전체 Vitest는 10,903건 통과·22건 실패였다. 변경 전과 실패 테스트 이름 차집합은 양방향 0이다. |
| 추가·수정 테스트의 subtree 규칙 | Node 내장 시험 2파일. 임시 디렉터리는 테스트 종료 시 제거하고 실제 앱 CLI는 자식 Node로 실행한다. 새 시간 예산·실제 Git 스위트·Vitest 풀 추가 0. |
| V-pair 자기확인 | REQUIRED 3·REGRESSION 4 모두 SELF_PASS, SELF_BLOCKED 0. |
| 강제 지점 전수 | 판독기 §10-A 55/55분기, P6′ 24/24좌표, 호스트·셸의 중복 환경 필드를 제거한 생산자 2/2곳. |
| AC 자기보고 | AC7 확정 예제의 무근거 FAIL이 불합격·1, AC8 부모 스탬프와 두 기준·후속 비교 정상. AC9~11은 verify 1 PASS이며 이번 실행에서도 stage-e 출처·시간 분기 및 세 렌더러 하네스 통과. |
| 합계 검산 | ✅ 5 · ⚠️ 6 · ❌ 0 = 총 11. |
| 블로커 / 역질문 | WU-W(AC1~6)는 W-004 사용자 합의와 H1 필수 셀 고정 대기. |
| 대상 커밋 | (r2 구현 — 좌표는 INDEX) |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식은 이전 검증에서 열렸던 출처 단일화(D1)와 소유자 실패 정보 보존(D2)이다.
- ΔV1 §20에 두 자식의 음성 검사와 CLI의 양성 검사, 무근거 실패의 최종 판정을 명시했다. r1의 설계는 이 입력·좌표를 정하지 않았다.
- Linux 전체 테스트의 기존 Windows 경로·플러그인 제어 실패와 목표 장비 측정 한계는 H1-0에 기록했다.
- 현재 라운드·구현 턴은 r2다. 다음 주체는 WU-M 독립 검증자다.

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | §10-C “VP-08~17 좌표 = `node --test`”와 P6 S4(`stage-d-host/electron-main.mjs:87`)·S5(`stage-d-shell/probe.ts:282`)의 실제 잠금이 어긋난다 — 두 변이가 `node --test`에서 green이고 커밋 안 된 Electron 하네스로만 red(S5 재현, S4는 이 환경에서 미실행) | verify r1 · VP-11·VP-15 · AC8 / §10-B P6 S4·S5 · §10-C | 생산자 하네스를 커밋된 `gate:` 명령으로 등록하거나 `node --test` seam을 두고 §10-C를 정정 | 이행(plan 내부 불일치 — oracle 없는 자리) | PLAN_GAP | **closed**(verify 2) · W-037 — P6-child·property·import ×2·S6 red, P6′ 28줄 일치 |
| D2 | 근거 좌표(`machineRef`·`windowsRef`) 없는 소유자 `FAIL` 행이 `미기록`으로 읽혀 `ownerFailures`·`불합격`에서 빠지고 `판정 보류`가 된다(`evidence/verify1-axes.txt` `ownerFailNoRef`) | verify r1 · VP-10 · AC7 / §10-A P4 ⑤·P5 ⑤ | 근거 없는 `FAIL`을 `불합격`(+ 근거 없음 표시)으로 채택하거나 경계 선언 | 확장(창 안) | PLAN_GAP | **closed**(verify 2) · W-038 — `ownerFailNoRef` → `불합격`, P5.8a/b red |
| D3 | 관측 `values`를 `trace-marker` 표시 시각 차와 다르게 적어도 통과(`valueMismatchMarker`) | verify r1 · VP-09 / §10-C 선언 경계 | — | 경계 | — | 기록만 |
| D4 | 근거 좌표가 공백·비문자열이면 “없음”으로 읽지만(`textValue`, `windows-verdict.mjs:642`) 잠금이 없다 — truthy 판정으로 바꾼 `V2.textValue-truthy`가 `windows-verdict.test.mjs` 전체에서 green | verify r2 · VP-10 / §10-A P5 ⑧ · W-038 | U39에 공백·비문자열 근거 입력을 채택하거나 경계 선언 | 확장(창 안) | PLAN_GAP | 열림 |
| D5 | owners 행의 `task`·`owner`·`key`가 plan 셀과 맞지 않으면 무시되어 그 행의 `FAIL`이 버려지고 `합격`·exit 0(`evidence/verify2-axes.txt` `keyedUnknownCellFailNoRef`·`unknownTaskFailNoRef`) | verify r2 · VP-10·VP-14 / §10-A P5 · W-038 · R-05 | 맞지 않는 owners 행을 fail-closed(exit 2 또는 `unexpected`+보류)로 채택하거나 경계 선언 | 확장(창 안) | PLAN_GAP | 열림 |
