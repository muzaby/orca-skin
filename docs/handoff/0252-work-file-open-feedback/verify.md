# Verify — 0252-work-file-open-feedback

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0252-work-file-open-feedback` |
| 검증자 | Claude Code |
| 일자 | 2026-10-06 |
| 대상 커밋/range | `eff720e7..5564f28a` = r1 `cdf54798` + r1.2 `5564f28a` |
| 구현 전 plan 기준 | `788c7415` (V1 설계, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `788c7415:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-11(AC14) Windows 사람 실기 대기(비차단) |
| 자기 검증 여부 | 아니오 — 설계·검증 Claude, 구현 Codex(`Agent: codex`). 그래도 독립 축 X1~X5를 추가했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: 메타 `상태` 1행 + `[구현자 기입]` 절(r1 `@@ -524`), r1.2는 `[구현자 기입] (r1.2)` 추가와 `[검증자 기입]` 1행.
- `[검증자 기입]` 1행은 CI 실패(외부 피드백)를 구현자가 이관한 것 — `docs/handoff/AGENTS.md §외부 리뷰` 절차와 맞고 규범 행이 아니다. 이번 턴에 상태를 갱신했다.
- 기준선이 diff로 성립하는가: 예 — 설계 `788c7415`와 구현 `cdf54798`·`5564f28a`가 별도 커밋.
- Decision Ledger · Product/UX · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점 기준: `788c7415:plan.md` §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 0242는 종료 handoff — INHERITED/CHANGED 노드로 `0242:plan@3569f57d` 참조 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | R-01·03~07·10·11, SD-01, AR-01~03, MD-01·02 → VP-01·03~07·10~17 |
| INHERITED ↔ REGRESSION | 유효 | R-02·R-08·R-09 → VP-02·08·09 |
| pair별 path·§10 전수·직접 oracle | 유효 | 17행 모두 path·EP·oracle |
| 선택적 적대 증거 | 유효 | 음성 불변식·순서·보안 판정 pair에만 M1~M9 |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 운영 gate | 유효 | §7-A 4종 |

- root PLAN_GAP: 없음. 구현자 지적(§7 shell 호출부 예상 2 → 실제 3)은 AC·§10 계약과 무관한 사전 조사 수치 차이다 — 재측정 `rg -n "shell\.(openPath|showItemInFolder)" app/src/main/app/handlers/files.ts` = 6줄(기존 3 + 신설 3).

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·003 | busy 카드는 disabled만 바뀐다 | `ArtifactCard.tsx` 상태 줄 블록 삭제 |
| D-004·012 | 파일명 표시, title = 전체 경로, 첨부는 원래 이름 | `TaskContextContent.tsx:157-178` |
| D-005~011 | 범위 → 존재 → 실경로 → 허용 형식 open / 폴백 reveal / missing toast | 클릭 → `fileApi.openContextFile` → preload → `filesOpenContextFile`(`files.ts:161`) → `resolveContextFile`(`context-file.ts:45`) |
| D-009 | 두 입구 같은 해석기 | `files.ts:124`(reveal+sessionId) · `files.ts:166`(open) |
| D-013 | 폴더 칩 무변경 | `mode === 'directory'` → `fileApi.openPath` |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | stat 오류 중 ENOENT·ENOTDIR만 missing, 나머지 throw → toast openFailed |
| false success | 없음 | `openPath` 오류 문자열 → reveal 폴백(M5 red); 성공·폴백 toast 0(X2 red) |
| 보안 경계 | 유지 | missing은 문자열 범위 안에서만(M8 red), open 입구도 연결 경로 검사(M9 red), 실경로 확장자(M6 red) |
| Product/UX의 A가 아닌 B | 아님 | 허용 목록 23종이 D-007 원문과 일치(`context-file.ts:15-39`) |
| 늦은 응답 | 계약대로 | 세션 이동 뒤 missing toast 유지(테스트 `keeps one in-flight file request and still reports missing…`) |
| TOCTOU | plan §17 수용 | 판정과 `openPath` 사이 교체 창은 기존 reveal과 같다 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh eff720e..5564f28`

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export `CONTEXT_FILE_OPEN_EXTENSIONS` | 정상 | `opensWithDefaultApp`이 같은 파일에서 사용, §10이 export 지정 |
| 테스트 전용 `ContextFileScope` | 정상 | 타입 — `files.ts` 구조적 객체가 만족 |
| 나머지 1a/2 항목 | 비귀속 | 기존 심볼(`protocol.ts`·`ipc.ts`) — 이번 diff 밖 |
| 형제 정책 비대칭 | 없음 | 스크립트 §3 0건 |
| 신규 채널의 기존 소비처 | 회귀 → 수정됨 | r1 CI run `37424040442` 실패(`misc-split.test.ts` 기대 집합) → r1.2에서 기대값 추가, run `37425385848` success |
| 동일 규칙 중복 | SSOT 유지 | `rg "export async function resolveContextFile" app/src/main` = 1, 호출 2 |

## 4. 기존 테스트 / semantic 검증 확인

- 선택된 적대 증거 재측정: 등록 M1~M9 11자리 + r1.2 등록 삭제 probe 1 = 12건 중 검출 12 · 미검출 0.
- 자기검증 분모: 구현자 ≠ 검증자. 독립 축 X1~X5 추가 — 전부 red.
- 실행: 검증자 스크립트가 변이를 심고 관련 12경로(62파일·875케이스)를 실행 후 원본 복원. 최종 `git status` 빈 트리.

| 변이 (검증자 재현) | 결과 | 귀속 |
|---|---|---|
| M1 busy 상태 줄 복원 | red 1 (AC1 마크업 비교) | VP-01 |
| M2 busy `aria-live` span 삽입 | red 1 | VP-01 |
| M3 파일 텍스트↔title | red 7 | VP-03 |
| M3 첨부 텍스트↔title | red 2 | VP-03·D-012 |
| M4 핸들러 허용 판정 제거 / 판정 함수 항상 true | red 4 / red 19 | VP-05·16 |
| M5 open 오류 시 폴백 제거 | red 7 | VP-05 |
| M6 요청 경로 확장자로 판정 | red 1 | VP-05 |
| M7 realpath를 stat 앞에 | red 6 | VP-06 |
| M8 범위 검사 없는 missing | red 2 | VP-06 |
| M9 open 입구에 문자열 범위만 보는 사본 | red 6 (junction·세션 재확인) | VP-08·14 |
| r1.2 `filesOpenContextFile` 등록 제거 | `misc-split` red 1 · 형제 1 green | VP-10·13 |
| X1 reveal+sessionId missing을 조용히 성공(독립) | red 1 | VP-08 |
| X2 opened/revealed에도 toast(독립) | red 3 | VP-17 EP-06 |
| X3 missing toast title을 openFailed로 맞바꿈(형제 슬롯, 독립) | red 2 | VP-06·17 |
| X4 폴더 칩을 새 채널로(독립) | red 1 | VP-09 |
| X5 reveal 입구가 공유 해석기를 우회(독립) | red 13 | VP-08·14 |

- M5 red 수가 보고(1)보다 많다 — `open` 입구의 공유 보안 사례가 `openPath`를 `'no app'`으로 두고 폴백 reveal로 허용을 관측하기 때문이다(`files.contextDirectory.test.ts:173`). 방향 판정은 같다.
- 동작 보존 추출: `files.ts` reveal 인라인 판정 → `resolveContextFile` 이동은 추출이므로 hunk 되돌림이 아니라 우회 변이(X5)·사본 변이(M9)로 잠금을 쟀다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | requiredness | 결과 | 직접 검증 증거 | §10 |
|---|---|---|---|---|
| VP-16 MD-01↔UT-01 | REQUIRED | PASS | `context-file.test.ts` 허용 23·거부 표·대문자·끝 점·ADS · M4 | EP-03 2/2 |
| VP-17 MD-02↔UT-02 | REQUIRED | PASS | 결과 4종 → toast 표 · X2·X3 | EP-06 3/3 |
| VP-13 AR-01↔IT-01 | REQUIRED | PASS | 스키마 accept/reject · preload wire · 등록 전수 · r1.2 probe | EP-08 7/7 |
| VP-14 AR-02↔IT-02 | REQUIRED | PASS | 두 입구 같은 보안 사례 · M9·X5 | EP-05 2/2 |
| VP-15 AR-03↔IT-03 | REQUIRED | PASS | `resources.test`·`reportSites.registry.test` green · ko/en 3키씩 | EP-09 6/6 |
| VP-12 SD-01↔ST-01 | REQUIRED | PASS | main 결과표(`files.contextDirectory.test.ts` Context file open 블록) + renderer 결과표 | EP-02·04·06 |
| VP-01 R-01↔AT-01 | REQUIRED | PASS | `ArtifactCard.render.test.ts` busy/idle 마크업 · M1·M2 | EP-01 1/1 |
| VP-02 R-02↔AT-02 | REGRESSION | PASS | `ArtifactCards.lifecycle`·`artifactViewerStore` green | 0 + 이유 |
| VP-03 R-03↔AT-03 | REQUIRED | PASS | Windows/POSIX 파일명·title·aria, 첨부 원래 이름 · M3 | EP-07 3/3 |
| VP-04 R-04↔AT-04 | REQUIRED | PASS | `opens an approved file with the actual path and no reveal` + renderer toast 0 | EP-03·08 |
| VP-05 R-05↔AT-05 | REQUIRED | PASS | native 오류 폴백 · py/exe/무확장자 · M4~M6 | EP-03·04 |
| VP-06 R-06↔AT-06 | REQUIRED | PASS | 범위 안 missing·shell 0, 범위 밖 reject · M7·M8 | EP-02 2/2 |
| VP-07 R-07↔AT-07 | REQUIRED | PASS | reject → toast openFailed·alert 0 | EP-06 |
| VP-08 R-08↔AT-08 | REGRESSION | PASS | 보안 사례 reveal/open · X1·X5 | EP-05 |
| VP-09 R-09↔AT-09 | REGRESSION | PASS | directory 기존 사례 + renderer directory · X4 | 0 + 이유 |
| VP-10 R-10↔AT-10 | REQUIRED | PASS | IPC 문서 행 · inventory 102 · `ipc-documentation.test` | EP-08·09 |
| VP-11 R-11↔AT-11 | REQUIRED | NOT_REQUIRED(기계) — 사람 실기 대기 | §8 | 0 + 이유: 실기 |

- root `PAIR_FAIL`: 없음 · `BLOCKED_BY`: 없음. VP-11은 plan이 사람 실기로 지정 — 0247~0250 선례대로 기계 범위 PASS 후 실기를 남긴다.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | M1·M2 red |
| AC2 | ✅ | 기존 toast 사례 green |
| AC3·AC4 | ✅ | M3 red, 첨부 `openContextFile` 호출 |
| AC5·AC6·AC7 | ✅ | main 통합 + renderer, M4~M6 red |
| AC8 | ✅ | missing 2사례 + detail `gone.md: 파일이 없습니다…` · M7·M8·X3 red |
| AC9 | ✅ | reject toast·alert 0 |
| AC10 | ✅ | 정의 1 · 호출 2 · M9·X5 red |
| AC11 | ✅ | X4 red |
| AC12 | ✅ | 스키마·등록(r1.2)·preload·문서·inventory 102 |
| AC13 | ✅ | i18n·레지스트리 green |
| AC14 | ⚠️ | Windows 실기 대기 |

- 합계 재측정: ✅ 13 · ⚠️ 1 · ❌ 0 = 14.
- 사본 대조: plan 구현 보고 13/14 ↔ trailer `Criteria-Met: 13/14`(두 커밋) ↔ INDEX `AC 13/14` — 일치. `Criteria-Pending` 문구는 trailer "실제 카드 높이 실기" ↔ plan "시각 실기"로 표현만 다르다(D2).

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts:22`); 실행 후 트리 무변경 |
| typecheck | PASS | 3구성 오류 0 |
| 관련 vitest | PASS | 62파일·875케이스 green(DB 스위트 Node ABI) |
| 전체 vitest | PASS | 620파일 pass · 1 skip(환경 분리는 0251 verify §9와 같은 실행) |
| doc inventory | PASS | 102 channels · prose·links ok |
| trailer 파싱 | PASS | `cdf54798`·`5564f28a` 각 6키 |
| 원격 CI | PASS | r1 run `37424040442` failure → r1.2 run `37425385848`(head `5564f28a`) success |

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 실기 |
|---|---|---|
| AC14 | 허용 판정·존재·범위·결과→toast·마크업 높이 불변(문구 0) | Windows `npm run dev` Work 세션: ①파일명만·hover 전체 경로 ②`.pdf`·`.txt` 기본 앱 ③`.py` 탐색기 선택 ④파일 삭제 후 클릭 → toast ⑤카드 다운로드·탐색기에서 보기 중 높이 불변. 연결 프로그램 없는 `.md` 동작 기록 |

## 11. Repository operation checks

- INDEX: 상태 `IMPL_DONE`·다음 주체 Claude 일치. 비고 4줄. 대상 커밋 → 이번 턴 기입(`788c7415`·`cdf54798`·`5564f28a`, 모두 `git cat-file -t` = commit).
- `[구현자 기입]` 7필드: r1·r1.2 모두 존재(r1.2는 해당 없음 필드를 문장으로 명시).
- AGENTS.md 변경: 없음.

## 13. Finding disposition / 파생 이슈

| # | finding | disposition | 후속 |
|---|---|---|---|
| D1 | r1 CI 등록 기대 집합 누락(구현자 이관) | 닫힘 — r1.2 수정, 검증자 probe red, 원격 CI success | — |
| D2 | `Criteria-Pending` 문구가 trailer와 plan에서 표현이 다르다 | NON_BLOCKING | 값(13/14·AC14)은 같다 |
| D3 | r1 구현 보고의 관련 테스트 목록이 기존 등록 전수 테스트를 빠뜨려 CI에서 처음 드러났다 | NON_BLOCKING(Review Signal) | 신규 IPC 채널 handoff의 §19 목록에 `misc-split.test.ts` 같은 등록 전수 테스트 포함 여부는 review 판단 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(최초 verify).
- 관련 plan 지침: §19 관련 테스트 목록에 `misc-split.test.ts`가 없었고 r1 CI가 이를 잡았다.
- 사용자 결정 변경: 없음.
- 반복된 환경 한계: OS 기본 앱·탐색기 창·카드 시각 높이는 사람 실기(0247~0250과 같은 유형).

## 15. 결론

- 상태: **PASS (기계 범위)**
- pair: REQUIRED/REGRESSION 16 PASS · VP-11 사람 실기 대기 · PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음 · AC ✅13 ⚠️1 ❌0
- 운영 gate: 전부 PASS(원격 CI 포함)
- 다음 단계: 사람 AC14 실기 → 이상 없으면 archive 이동
