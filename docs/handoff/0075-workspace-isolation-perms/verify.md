# Verify — 0075-workspace-isolation-perms

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0075-workspace-isolation-perms` |
| 검증자 | Claude Code |
| 일자 | 2026-07-06 |
| 대상 커밋 | `389cbe1` (r1) · r2(`~/.claude` write 예외) · r3(Bash 스크린 제거 + `# Tools` 정책) |
| 라운드 | 1 (+r2·r3 amend) |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: 훅 조각을 `makeSteerGateHook` 동형으로 두고 `mergeHooks` 합성한 배치가 최소 침습 | 타당 | 매트릭스 #1·#2 에서 배선·공존 확인 |
| 선조치 #1: Bash 정규식이 URL·literal `~/.claude` 오차단 가능 → 코드 주석+한계 명시(✅) | 타당(best-effort 한계 수용) | §검증 자기 리뷰·매트릭스 #8 한계로 기록 |
| 선조치 #2: `guardToolAccess`/`screenBashCommand` 순수 분리로 단위 테스트(✅) | 타당 | 매트릭스 #6 증거 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | sendMessage 옵션에 PreToolUse 가드 배선, 밖 경로 Read/Write/Edit/Glob/Grep/Bash deny | ✅ | `claude.ts` mergeHooks 에 `makeWorkspaceGuardHook(cwd, additionalDirectories)` 추가 / test "밖 절대경로 Write·Read·Grep deny"·"밖 절대경로·상위 탈출 deny" |
| 2 | 안·예외는 `allow` 아닌 pass-through(`{}`) — 승인 카드·permissionMode 흐름 유지 | ✅ | `workspace-guard.ts:151-153`(deny 아니면 `{}`), 콜백에 `allow` 미사용 / test "안 경로는 pass-through({}) — allow 아님". `makeCanUseTool` 무변경(가드는 앞 계층) |
| 3 | 예외 2분(r2): `~/.claude`=write 예외, `~/.config/orca`·런타임=read-only, 세션 cwd=write 허용 | ✅ | `workspace-guard.ts` `writeExceptionRoots()`=`~/.claude` → writeRoots. test "~/.claude 는 Write 허용(plan 산출물·skill 설치)"·"~/.config/orca 는 read-only — cwd 밖(sources) Write 차단"·"예외의 예외: 세션 cwd 하위 Write 허용"·"read 예외 경로는 Read 허용" |
| 4 | additionalDirectories 기본 `[]`, 옵션·훅 단일 배열 공유 | ✅ | `claude.ts` `const additionalDirectories: string[] = []` → 옵션 `additionalDirectories,` + 훅 인자 동일 참조 / test "additionalDirectories 확장" |
| 5 | 모드 독립 — permissionMode 강제·dontAsk 도입 없음 | ✅ | permissionMode 배선 무변경(`claude.ts` 기존 `...(permissionMode ? …)` 유지), `dontAsk` 문자열 미도입(grep 0). 훅이 평가 1순위(W1) |
| 6 | 순수 로직 단위 테스트 + 게이트 통과 | ✅ | `workspace-guard.test.ts`(guardToolAccess·resolveGuardRoots·makeWorkspaceGuardHook; r3 에서 screenBashCommand 테스트 제거) + `system-header.test.ts` 8. 게이트 아래 |
| 9 (r3) | `screenBashCommand` 제거·Bash pass-through | ✅ | `workspace-guard.ts` Bash 분기 삭제 / test "Bash 는 명령 내용과 무관하게 pass-through"(밖 경로 명령도 가드 미차단) |
| 10 (r3) | opencode 참고 `# Tools` 정책 추가(전용툴 라우팅 + Bash workspace 스코프) | ✅ | `system-header.ts` `TOOLS_SECTION`(buildSystemHeader 항상 포함) / test "# Tools 정책 섹션을 항상 포함하고 Bash·전용툴 규칙을 담는다" |
| 7 | runCompletion 은 도구 0 이라 가드 미적용 명시 | ✅ | `workspace-guard.ts:1-11` + plan §설계 "미변경" 에 근거(claude.ts:229 `allowedTools:[]`) |
| 8 | 74 가이드 참조 + 구현 편차 문서화 | ✅ | `workspace-guard.ts` 주석이 가이드 정본 링크·`isWithinDir` 재사용·Bash §3.5 한계·runCompletion 제외 명시 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | typecheck 3종·lint(경계 0)·test 22/22 신규 + 694 passed |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 (증거 `파일:라인`/테스트) |
| 레이어 경계 위반 0 | ✅ | — | adapters→infra(paths) 하향, lint 경계 error 0 |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX/PHASES 한국어·표 |
| 모드별 실 격리(default/acceptEdits/plan) | ✖ | ✅ | 사람 확인 대기 |
| `/etc/passwd` 실 차단·AskUserQuestion/ExitPlanMode 자동거부 안 됨 | ✖ | ✅ | 사람 확인 대기 |
| node/python skill 실행 정상(readRoots 튜닝) | ✖ | ✅ | 사람 확인 대기 |
| PR 머지 승인 | ✖ | ✅ | 요청 시 |

## 게이트 재실행 결과

```
$ npm run typecheck        # tsc node/web/test 3종 → 통과
$ npm run lint             # eslint --cache --fix ./src → 경계 위반 0 (prettier 정렬만)
$ npx vitest run src/main/adapters/workspace-guard.test.ts
  Test Files 1 passed (1) / Tests 23 passed (23)   # r2: ~/.claude write 예외 케이스 +1
$ npx vitest run           # 전체
  Test Files 6 failed | 85 passed (91)
  Tests     21 failed | 694 passed (715)
  # 21 fail = 전부 "Could not locate the bindings file"(better-sqlite3 네이티브 미빌드)
  #           + electron 미설치 — `npm install --ignore-scripts`(네트워크 CDN 403) 환경 제한.
  #           본 변경(순수 어댑터 로직)과 무관, 0007 이후 누적 계열.
```

## 위생 검토 (AGENTS.md 변경 시)

- AGENTS.md 변경 없음(코드 + 핸드오프/PHASES 문서만). 키/토큰/이메일/IP 혼입 0.

## PHASES.md 정합성

- `docs/PHASES.md` 표에 `0075-workspace-isolation-perms` 행 승격(커밋 `389cbe1`, "완료 (push 후)"). 형식 = 기존 행 동일.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 충분. SDK 필드명(`additionalDirectories`·`PreToolUseHookSpecificOutput`)을 d.ts 로 실검증한 것이 배선 리스크를 줄였다.
- 구현 단계: Bash 정적 스크리닝의 false-positive(URL `//host`·literal `~/.claude`)는 가이드 §3.5 한계 계승이라 코드로 고치지 않고 주석/문서로 남겼다 — 구조 파일툴(Read/Write/Edit)은 절대경로 정상 판정이라 실 skill 실행(절대경로 경유)은 통과하므로 실효 위험은 낮다.
- 검증 단계: 게이트가 **순수 로직 단위**까지만 커버한다. 실제 CLI 서브프로세스가 밖 경로를 deny 하는지·모드별 흐름 유지·node/python skill 실행은 auth 필요 E2E 라 사람 검증으로 분리했다(위 책임표). readRoots 의 런타임 루트(`dirname(process.execPath)`)가 패키지 앱에서 정확한지도 실기 확인 항목.

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격 완료. 다음 = 사람 검증(모드별 실 격리·skill 실행) + (요청 시) PR. Open Question 없음.
- **r2 amend**: 사용자 정정으로 `~/.claude` 를 read-only 예외 → **write 예외**로 이동(`writeExceptionRoots()` 분리) — plan 모드 산출물·skill 설치(`~/.claude/skills/<name>`)가 쓰기를 요구하기 때문. `~/.config/orca`(cwd 제외)·런타임은 read-only 유지. 가이드(0074 §3.2) 기본 read-only 스탠스에서의 Orca 편차로 코드 주석·본 verify 에 기록.
- **r3 amend**: (1) `screenBashCommand` **제거** — 정적 파싱이 eval·$HOME·파이프·base64 우회를 못 잡고 URL·literal `~` 를 오차단해 실효가 없었다(사용자 판단). Bash 는 이제 가드 pass-through. (2) opencode `anthropic.txt` "Tool usage policy" 를 Orca 격리에 맞춰 `# Tools` 시스템 프롬프트 섹션(`system-header.ts TOOLS_SECTION`)으로 추가 — 파일 작업을 전용 툴(가드가 강제)로 라우팅 + Bash 를 workspace 안으로 스코프하도록 유도. **격리 모델 갱신**: 구조 파일툴(Read/Write/Edit/Glob/Grep)=코드로 강제(가드 훅), Bash=프롬프트로 유도(코드 강제 불가 — 정직히 명시). 게이트 재통과(typecheck·lint·workspace-guard+system-header 테스트 green). 0074 가이드 §3.5 Bash 스크리닝은 supersede(가이드에 노트).
