# Verify — 0145-composer-input-architecture

## 메타

| 항목 | 값 |
|---|---|
| slug | `0145-composer-input-architecture` |
| 검증자 | Codex (사용자 직접 “Verify까지 진행” 지시에 따른 검증 라우팅 예외) |
| 일자 | 2026-07-23 |
| 대상 커밋 | `4f597696f1949dab14f42476ac9a97fefd621cf4` |
| 라운드 | 1 |
| 상태 | **FAIL** |

> 코드·테스트·사용자 피드백으로 구조와 회귀 수정은 확인했지만, 이 성능 핸드오프의 종료 조건인 AC3 production main/PR trace가 없다. 수치를 추정하거나 사용자 실기 피드백을 성능 수치로 대체하지 않고 FAIL로 판정한다.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| controller 추출·visible mirror 제거·delta batch는 효과가 서로 다르지만 사용자가 최종 구조 전체를 승인했다. | 타당. 범위 결합 자체는 merge blocker가 아니며 각 경계가 독립 파일·테스트로 분리됐는지 확인했다. | AC1~AC3을 개별 증거로 판정하고 성능 개선의 인과는 trace 전까지 주장하지 않는다. |
| production input-to-paint trace는 GUI 없는 환경에서 검증 대기로 남겼다. | 구현 보고로는 정직하지만 인수 기준 충족 증거는 아니다. | AC3 FAIL 및 파생 D1로 이관했다. |
| 비동기 submit의 text revision과 attachment identity를 함께 검사했다. | 타당. 최신 초안/첨부의 부분 clear를 막고 연속 전송 clear 회귀도 고쳤다. | AC2 코드·순수 테스트·사용자 실기 증거에 반영했다. |
| decoration을 native glyph와 분리하고 마지막 완료 배경을 IME 중에도 유지한다. | 타당. 사용자 피드백에서 플리커·한글 입력 중 장식 소실이 해소됐다고 확인됐다. | AC2 충족 증거와 잔여 GUI 범위를 분리했다. |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | Persistent input controller와 상태 수명 | ✅ | `Composer.tsx:63-66,291-386` — draft를 셸에서 제거하고 `pendingPlanReview` 밖에서 controller를 항상 렌더. `ComposerInputController.tsx:70-145` — local snapshot, seed/restore 1회 ref, deferred derived channel. `draftSnapshot.test.ts:12-39` — revision/selection/IME/stale clear 순수 계약. 설계문의 사실과 달랐던 “memo된 leaf” 표현은 plan에서 삭제하고, 측정 전 memo를 요구하지 않도록 교정했다. |
| 2 | 긴급 입력 경로와 파생 채널 분리·회귀 보존 | ✅* | `ComposerInputSurface.tsx:88-112` — controlled native textarea가 glyph/placeholder/caret 소유. `ComposerDecorationLayer.tsx:14-53` — `aria-hidden` background-only deferred 장식. `ComposerInputController.tsx:140-147,160-225,230-279` — current revision 적용, IME Enter guard, accepted-submit atomic clear. `useAttachments.ts:41-51,159-170` — ref/state identity 단일 commit. 영향 테스트 6파일 **54/54 PASS**. 사용자 실기 피드백으로 키별 플리커 제거·한글 입력 중 하이라이트 지속·전송 후 clear를 확인했다. 단 caret/scroll/200% 확대·paste/undo/redo 전체 매트릭스는 GUI 환경에서 미실행이므로 `*`로 남긴다. |
| 3 | 스트리밍 경합 제한과 성능 검증 근거 | ❌ | `eventCoalescer.ts:35-82`, `chatStore.ts:228-257` 및 `eventCoalescer.test.ts:40-103`, `chatStore.test.ts:88-186`으로 flush당 단일 batch transaction·barrier·혼합 type·멀티세션은 확인했다. `scripts/analyze-composer-input-trace.mjs`와 스크립트 테스트 **3/3 PASS**로 동일 산식도 마련했다. 그러나 main/PR의 idle·streaming production trace 4종, p95, 50ms+ long task, React Profiler 셸 commit 증거가 모두 미실행이다. Electron payload·Chromium·Xvfb·display가 없는 현재 환경에서는 AC3 수치를 생성할 수 없다. |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0 error(기존 warning 1), typecheck PASS, 영향 54/54, 전체 Vitest 144/146 suites·1159/1160 tests, scripts 28/28 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | AC1 충족, AC2 충족*, AC3 미충족 |
| 레이어 경계 위반 0 | ✅ | — | eslint boundaries 포함 0 error |
| 문서 형식/링크/한국어 | ✅ | — | plan의 잘못된 memo 진술 교정, AC3 idle/streaming 분리 |
| AGENTS.md 위생 | ✅ | ✅ 최종 판단 | AGENTS.md 무변경, 신규 키·토큰·개인정보 없음 |
| 제품 의도 부합 | 보조 | ✅ | 사용자 피드백 3건 해소 확인 |
| Open Questions / 신규 의존성 | ✅ | ✅ | Open Question·신규 의존성 없음 |
| UI/UX 시각 검증 | ✖ | ✅ | 핵심 피드백 3건 확인, 나머지 IME/caret/scroll/200% 확대는 D2 대기 |
| 성능 production trace | 분석기·판정 | 동일 장비 GUI 실행 | **미실행 — D1, merge blocker** |
| PR 머지 승인 | ✖ | ✅ | PR #285 Draft 유지 |

## 게이트 재실행 결과

```text
$ cd app && npm run lint -- --no-cache
0 errors, 1 pre-existing react-hooks/incompatible-library warning

$ npm run typecheck
typecheck:node / typecheck:web / typecheck:test PASS

$ npx vitest run <0145 영향 테스트 6파일>
Test Files  6 passed (6)
Tests       54 passed (54)

$ npm test
Test Files  2 failed | 144 passed (146)
Tests       1 failed | 1159 passed (1160)
- chat-turn.continuity.test.ts: Electron payload 미설치
- attachments.test.ts 1건: read-only /root에서 mkdtemp EROFS

$ node --test scripts/*.test.mjs
tests 28 / pass 28 / fail 0

$ npm run build
FAIL before compile: @electron/rebuild가 read-only /root/.electron-gyp를 만들지 못함
```

전체 Vitest의 두 실패와 build preflight 실패는 변경 코드의 assertion 실패가 아니라 검증 컨테이너 제약이다. 다만 그 제약 때문에 production app을 띄울 수 없으므로 AC3 실패 판정 자체는 해제되지 않는다.

## 위생 검토

- `AGENTS.md`/`CLAUDE.md`, IPC, DB, dependency manifest 버전은 변경하지 않았다. `package.json`에는 기존 Node 런타임만 쓰는 trace 분석 명령 한 줄만 추가했고 lockfile 변경은 없다.
- 분석기 입력은 사용자가 로컬에서 내보낸 trace 파일이며 외부 전송·네트워크·credential 접근이 없다.
- `git diff --check`와 eslint boundaries를 통과했다.

## PHASES.md 정합성

- FAIL이므로 `docs/PHASES.md` 완료 표로 승격하지 않는다.
- PR #285는 Draft를 유지하고, `INDEX.md`는 `verify/FAIL`, 라운드 1, 다음=Codex로 갱신한다.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 처음부터 idle 타이핑과 타이핑-중-streaming을 분리하지 않았고, 구현되지 않은 `memoized leaf`를 계약처럼 적었다. 이번 라운드에서 두 문장을 교정했다.
- 구현 단계: visible mirror 제거, controller 추출, delta batch를 한 PR에 묶어 개선의 인과 귀속이 어렵다. 사용자가 최종 구조를 승인했으므로 되돌리지는 않되, 성능 주장은 AC3 trace 전까지 보류한다.
- 검증 단계: 실제 Electron/Chromium/IME 환경이 없어 production input-to-paint, React commit, caret/scroll/확대 검증을 수행하지 못했다. 합성 trace 단위 테스트는 분석 산식만 검증하며 실제 성능 증거가 아니다.

## 미충족 요구사항 (구현자 액션 아이템)

- [ ] **D1 / 기준 #3**: GUI 가능한 동일 장비에서 `main-idle`, `pr-idle`, `main-streaming`, `pr-streaming` production trace를 각각 실제 input 100개 이상으로 캡처하고 `npm run analyze:composer-input-trace` 결과를 plan/verify에 기록한다. p95와 50ms+ long task를 AC3로 판정한다.
- [ ] **D2 / 기준 #2·#3**: React DevTools dev trace로 draft 입력의 `Composer` 셸 commit 0을 확인하고, 실제 한글 IME·`/`/`@`·전송 clear·caret·scroll·paste/undo/redo·200% 확대를 실기한다.

## 결론 / 다음 단계

- 상태: **FAIL (2/3, AC2는 사람 실기 일부 대기)**.
- 구현 구조나 사용자 피드백 수정에 새 결함이 발견된 것은 아니다. merge blocker는 이 성능 PR의 핵심 주장에 대한 D1 수치와 D2 잔여 GUI 근거가 없다는 점이다.
- D1/D2 증거를 같은 handoff에 추가한 뒤 라운드 2 verify를 수행한다. 그 전에는 PR #285를 Ready 또는 PASS로 전환하지 않는다.
