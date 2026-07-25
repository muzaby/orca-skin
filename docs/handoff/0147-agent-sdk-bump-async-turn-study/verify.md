# Verify — 0147-agent-sdk-bump-async-turn-study

## 메타

| 항목 | 값 |
|---|---|
| slug | `0147-agent-sdk-bump-async-turn-study` |
| 검증자 | Claude Code |
| 일자 | 2026-07-25 |
| 대상 커밋 | `claude/agent-sdk-handoff-docs-uh96gv` HEAD (본 커밋) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 1 — plan 의 "egress 차단" 전제가 본 세션에 틀렸고, 방어적 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 이 오히려 게이트를 깨뜨렸다 | **타당.** 설계가 환경 가정을 무조건 적용한 것이 원인. 회수 조치(electron install → 전 스위트 green)가 옳다 | AC15 를 **예외 조항 없이** 판정 (베이스라인 분리 보고 불필요) |
| 이견 2 — 6장의 "`파일:라인` 인용" 요구가 미니파이 번들에 원천 부적용 | **타당.** `sdk.mjs` 140줄/최대 171 KB 줄은 라인 인용이 무의미. 대체 인용 규약(`sdk.mjs::<메서드>` / 원문 문자열)이 검증 가능성을 유지하므로 취지 충족 | AC10 을 대체 규약 기준으로 판정 |
| 우려(잔여) — AC11 의 "실측 비교" 방법을 plan 이 미명시 | **타당.** 설계 미흡. 구현이 절차를 만들어 7.5절 ⑤ 에 재사용 가능하게 남긴 것이 적절한 보상 | 검증 자기 리뷰에 기록 |
| 선조치 #1~#7 (전부 ✅ 구현함, ⚠️ 결정 필요 0건) | **전부 선조치 경계 내.** #4·#5 는 *정확성 교정*(문서 주장 약화), #6 은 *발견 사실 기록*, #1·#2·#3·#7 은 *구현 세부·누락 보완* — 어느 것도 인수 기준·제품 의도·의존성을 바꾸지 않았다 | 매트릭스에 반영, 파생 이슈 이관 **없음** |

> 특히 **#4·#5 는 검증 관점에서 가치가 높다.** 사용자 의문을 "맞다"로 확정하면서도 *과확대되는 지점*(모델용 블로킹 조회 도구 존재, Bash 도 백그라운드 가능)을 스스로 찾아 좁혔다. plan §1 검토의 정정(“일반 도구는 여전히 동기”)이 과했음을 구현이 실측으로 뒤집은 것이므로, **verify 는 5장의 서술을 plan §1 보다 우선한다**.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | lock 삭제 후 재생성, `lockfileVersion:3` · `packages[""].version === "0.3.1"` | ✅ | `python3` 판독 → `lockfileVersion: 3` / `root name/version: orca 0.3.1`. `rm package-lock.json && npm install` 로 재생성(exit 0) |
| 2 | `package.json` SDK `0.3.220`, 정확 핀 유지, 타 의존성 무변경 | ✅ | `app/package.json:34` → `"@anthropic-ai/claude-agent-sdk": "0.3.220"` (caret 없음). `git diff app/package.json` = 1줄 |
| 3 | lock 의 SDK 본체 + 플랫폼 8종 전부 `0.3.220` | ✅ | SDK 관련 엔트리 9개, `version !== '0.3.220'` 인 것 **0개** |
| 4 | `.github/workflows/{ci,release}.yml` 무변경 | ✅ | `git diff --stat main -- .github/` **빈 출력** |
| 5 | `README.md` + 7 챕터 존재, README 링크 전부 실재 | ✅ | 8 파일 1,786줄. README 인덱스 링크 7/7 `OK` |
| 6 | mermaid 7개 이상 · 동기 시퀀스 1+ · 05장 2+ · 콜스택 1+ | ✅ | 총 **9개** (01:1 · 02:2 · 03:2 · 04:1 · 05:**2** · 06:1). 동기 도구 시퀀스=`03-…md`, 05장 2개(전체 시퀀스 + stateDiagram), 콜스택 flowchart=`06-…md` §6.7 |
| 7 | 3장 (a) 블록 shape (b) 도구 3계열 (c) `canUseTool` 왕복 (d) 훅 개입 — 각각 `파일:라인` 근거 | ✅ | (a) `sdk.d.ts:2857`·`4153` (b) `sdk.d.ts:1068`·`1052-1063`·`3504`·`482`·`6940` (c) `sdk.d.ts:3597-3634`·`206-235`·`2114-2126` (d) `sdk.d.ts:3894-3899`·`835`·`4166` |
| 8 | 4장 (a) 도구 이름 확정 (b) 입력 스키마 (c) `parent_tool_use_id` (d) 컨텍스트 격리 | ✅ | (a) §4.1 — `Agent` 정본 판정 + `Task` 잔존 3곳 표기 + 미확정분 명시 (b) `sdk-tools.d.ts:484-521` 전문 (c) §4.5 다이어그램 + `sdk.d.ts:2857`/`4153` (d) §4.5 + `forwardSubagentText` `sdk.d.ts:1631-1638` |
| 9 | ★ 5장이 의문 (a)~(f) + (g) 대조표 + (h) opt-out 확정 | ✅ | (a) §5.1 `sdk-tools.d.ts:501-504` + CHANGELOG §2.1.198 (b) §5.2 `sdk-tools.d.ts:146-177` (c) §5.3 `sdk.d.ts:2986`·`2566-2571` (d) §5.4 `sdk.d.ts:4458-4520`·`2913` (e) §5.5 `sdk.d.ts:3487` (f) §5.6 — `Query` 에 조회 API 부재 + 36 subtype 에 상태질의 부재 (g) §5.7 3열 대조표 (h) §5.8 |
| 10 | 6장이 비동기 경로 분기 지점을 콜스택 상에 명시 | ✅ | §6.7 "분기 지점의 정확한 위치" 표 — wrapper 5개 층 전부 "차이 없음", **CLI 큐/drain 만 ★**. 결론: wrapper 에 대기 로직이 존재하지 않음 |
| 11 | 7장이 0.3.215→0.3.220 변화 여부를 실측 기록 | ✅ | §7.2 — 타입 11종 블록 대조 **전부 IDENTICAL**(증거 명령 포함). §7.3 — 관련 변경 1건(`interrupt.cancel_queued`) + 무관 변경 목록. §7.1 에 diff 절차 기재 |
| 12 | `app/src/**`·`docs/handoff/**` 인용 0, 확인 불가 항목 명시 | ✅ | `grep -rn 'app/src/\|docs/handoff/' docs/etc/study/claude/` → **CLEAN**. "코드에서 확인 안 됨" 표기 = 01·04·06(§6.8 표 7행)·07(§7.4 표 9행) |
| 13 | `docs/AGENTS.md` 인벤토리에 `etc/study/claude/` 행 추가 | ✅ | `docs/AGENTS.md:27` (hermes-agent 행 직후) |
| 14 | `docs/spec/claude/agent-sdk/**` 무변경 | ✅ | `git status --short docs/spec/` **빈 출력** |
| 15 | lint 0 error · typecheck 0 · test (베이스라인 분리 허용) | ✅ **예외 미사용** | lint `✖ 1 problem (0 errors, 1 warning)` — warning 은 pre-existing(0146 동일). typecheck 3분할 exit 0. test **146/146 files · 1165/1165 tests** + scripts **28 pass 0 fail**, exit 0 |
| 16 | `{plan,verify}.md` 존재 + `INDEX.md` 최종 갱신 | ✅ | 본 파일 + `plan.md`(구현자 블록 기입 완료) + `INDEX.md` 행 |

**16/16 충족.**

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행+출력 | — | **전부 green** (예외 조항 미사용) |
| 인수 기준 ↔ 산출물 1:1 대조 | ✅ 증거 첨부 | 이견 시 중재 | 16/16 |
| 레이어 경계 위반 0 | ✅ | — | `app/src/**` 무변경 → 해당 없음, lint boundaries 통과 |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — | 상호링크 전수 검사 깨진 링크 **0**, 전 챕터 한국어·표 위주 |
| 원문 미러 편집 금지 | ✅ | — | `docs/spec/` 무변경 |
| AGENTS.md 위생(키/토큰/PII) 스캔 | ✅ grep | ✅ 최종 판단 | 신규 문서에 비밀·PII·개인식별정보 0. 포함된 해시는 공개 배포물의 commit/checksum |
| SDK 기술 서술의 정확도 | ✖ 보조 의견 | ✅ **결정** | **사람 확인 대기** — 특히 5장 |
| 제품 의도 부합 | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | **해당 없음** — peer/optional 동일, 신규 선언 0 |
| lock 재생성 후 CI 실환경 `npm ci`→`build` | ✖ | ✅ | **사람/CI 확인 대기** (windows-latest) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)
   └ useTranscriptVirtualizer.ts:22 react-hooks/incompatible-library (pre-existing, 0146 동일)
LINT_EXIT=0

$ npm run typecheck
> typecheck:node  → tsc --noEmit -p tsconfig.node.json --composite false   (출력 없음)
> typecheck:web   → tsc --noEmit -p tsconfig.web.json  --composite false   (출력 없음)
> typecheck:test  → tsc --noEmit -p tsconfig.test.json                      (출력 없음)
TYPECHECK_EXIT=0

$ npm test
 Test Files  146 passed (146)
      Tests  1165 passed (1165)
# pass 28   # fail 0        (node --test scripts/*.test.mjs)
TEST_EXIT=0
```

추가 기계 검증:

```
$ git diff --stat main -- .github/ app/src/     → 빈 출력          (AC4 · 코드 무변경)
$ git status --short docs/spec/                 → 빈 출력          (AC14)
$ grep -rn 'app/src/\|docs/handoff/' docs/etc/study/claude/  → CLEAN  (AC12)
$ grep -c '```mermaid' docs/etc/study/claude/*.md → 합계 9        (AC6)
$ (챕터 상대링크 전수 검사)                      → 깨진 링크 0
```

## 위생 검토 (AGENTS.md 변경 시)

- **키/토큰/이메일/IP 스캔**: 신규 8문서 + `docs/AGENTS.md` 1행에 자격증명·개인정보 **0건**. 포함된 16진 문자열은 `manifest.json` 의 CLI commit 해시와 플랫폼 바이너리 sha256 checksum — **공개 npm 배포물의 공개 메타데이터**이며 비밀이 아니다.
- **변동성/일회성 정보 혼입**: `docs/AGENTS.md` 추가 행은 *역할 매핑*만 담고 버전·담당자·일정을 넣지 않았다. 버전 스냅샷(0.3.220/2.1.220)은 **분석 문서 본문**에 두고 §7.6 에 고지 절을 분리했다 — 위생 규칙(변동성은 AGENTS.md 밖) 준수.
- **장문 코드설명서 혼입**: `docs/AGENTS.md` 는 1행 요약만. 본문은 `etc/study/` 로 분리.

## PHASES.md 정합성

- **의도적 미갱신.** `docs/PHASES.md` 의 페이즈 표는 Phase 1~4 coarse-grained 단위이지 핸드오프별 행이 아니며(`PHASES.md:11-17` 은 보드 링크만 유지), 본 작업은 의존성 위생 + 문서라 페이즈 범위를 바꾸지 않는다. plan §절차에 사전 명시했고 그대로 이행했다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**:
  1. **환경 가정을 조건 없이 적용했다.** "egress 차단"을 기정사실로 깔아 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 를 무조건 권했고, 그것이 열린 환경에서 게이트를 깨뜨렸다. → 교훈: 환경 제약 대응은 **먼저 탐지하고 조건부로** 적용해야 한다.
  2. **AC11 의 실측 방법을 명시하지 않았다.** "실측 비교"라고만 쓰고 절차를 남기지 않아 구현이 새로 설계했다.
  3. **6장의 인용 규약을 소재 성격 확인 전에 규정했다.** 인벤토리를 먼저 하라고 지시해 놓고, 정작 인수 기준은 인벤토리 결과와 무관하게 `파일:라인`을 요구했다.
  4. **plan §1 검토의 정정이 과했다.** "일반 도구는 여전히 동기"는 `BashInput.run_in_background` 를 보지 못한 상태의 결론이었다. 핸드오프 이력만으로 가설을 확인하고 SDK 실물을 늦게 본 순서 문제.
- **구현 단계**: 근거 수집이 5장에 편중돼 2장(제어 프로토콜)의 `control_response` 성공/에러 페이로드 구조를 얕게 다뤘다. `ControlResponse`/`ControlErrorResponse` 내부 필드는 인용하지 못했다.
- **검증 단계 — 이번 verify 가 못 본 것**:
  1. **SDK 기술 서술의 사실 정확도를 에이전트가 최종 판정할 수 없다.** 매트릭스는 "해당 인용이 그 위치에 존재하는가"만 확인했지 "그 해석이 옳은가"는 사람 몫이다. 특히 5.5절의 auto-resume 기전은 **JSDoc 한 문단에서 추론한 것**이며 런타임 실측이 아니다.
  2. **런타임 검증이 0이다.** 실제로 서브에이전트를 백그라운드로 띄워 프레임 순서를 관측하면 5장을 실증할 수 있으나 이번 범위에 없었다 — 7.5절 ①(raw JSONL 덤프)이 그 후속 경로다.
  3. **`0.3.220` 실환경 동작 미검증.** typecheck·단위테스트는 green 이나 실제 `npm run dev`/`build` 로 SDK 를 구동하지 않았다.

## [FAIL 시] 미충족 요구사항

해당 없음 (PASS).

## 결론 / 다음 단계

- **상태: PASS (r1)** — 인수 기준 16/16, 게이트 lint 0 error · typecheck 3종 0 · vitest 146 files/1165 tests + scripts 28 전부 green(베이스라인 예외 미사용), 코드 변경 0, 범위 준수 grep CLEAN.
- **사용자 의문 검토 결론(재확인)**: **맞다.** `run_in_background` 기본 true(`sdk-tools.d.ts:501-504`) → `async_launched` 런치 영수증(`:146-177`) → 메인 턴 조기 종결(`sdk.d.ts:2986`) → CLI 내부 큐의 **auto-resume continuation** 을 drain 루프가 즉시 턴으로 전개(`sdk.d.ts:3487`). 호출자에게 상태 조회 API 자체가 없으므로 계약은 **listen**. 단 (i) 모델에게는 `TaskOutput({block:true})` 블로킹 조회가 있고 (ii) 번들된 MCP SDK 의 태스크 확장은 별개 폴링 메커니즘이라는 두 예외를 5.6절에 분리했다.
- **PHASES 승격 없음** (위 정합성 절 근거).
- **사람 확인 대기**:
  1. 5장을 중심으로 한 기술 서술의 정확도 최종 검토.
  2. CI(windows-latest)에서 재생성 lock 으로 `npm ci` → lint/typecheck/test green 확인.
  3. 실환경 `npm run dev`/`build` 로 SDK `0.3.220` 구동 확인.
- **후속 후보(별도 핸드오프)**: ① 7.5절 ①(raw JSONL 덤프)로 auto-resume 프레임 순서 실증 ② `claude.ts:78`·`:333` 주석이 참조하는 부재 "가이드" 를 본 분석 세트로 대체 ③ `@anthropic-ai/sdk`·`@modelcontextprotocol/sdk` 의 미선언 peer 직접 import 정리 ④ `docs/spec/claude/agent-sdk/` 미러 0.3.220 재동기화(사람 수동 절차).
