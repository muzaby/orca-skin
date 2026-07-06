# Verify — 0073-system-prompt-structured-header (PASS)

## 결과 요약

**PASS** — 인수 기준 7/7 충족, 게이트 typecheck(3종)·lint(경계 0)·test green(신규 8 통과).
비기능+소기능 = Claude 직접 구현(plan→impl→verify). 구조화 시스템 프롬프트 헤더(`# Orca/# User/# Project`)를
`claude_code` preset append 앞단에 매 턴 주입하도록 배선했다. 주입 메커니즘(preset+append)은 무변경,
append **내용**만 확장. `accountInstructions` 미배선("추후") 해소 + `language` 설정 신규.

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `buildSystemHeader` 순수·빈 필드 생략 | ✅ | `system-header.ts` · `system-header.test.ts`(5 케이스: 전필드/Orca-only/language-only/공백 생략/trim) |
| 2 | `# Orca` 항상 + Windows framing + version | ✅ | `system-header.ts:ORCA_IDENTITY`("Windows desktop app") + `Orca version: ${orcaVersion}` |
| 3 | `language`(신규)·`accountInstructions` → `# User` | ✅ | `protocol.ts`(`language` z.string().default('한국어')) · `ipc.ts` · `builder.ts`(settings 조회) |
| 4 | 프로젝트 name → `# Project`(resume/새채팅), 없으면 생략 | ✅ | `queries.ts:getProjectContextForSession`(name+instructions) · `builder.test.ts`(3 경로) |
| 5 | `헤더 \n\n 지침`, 단일 문자열 | ✅ | `builder.ts`(`[header, instructions].filter().join('\n\n')`) · builder.test 순서 단언 |
| 6 | 무캐시 즉시 반영 | ✅ | `builder.ts` 매 턴 `settings()`+DB 조회, 캐시 없음(주석·system-prompt.md §3) |
| 7 | 게이트 green · 신규 IPC 채널 0 | ✅ | 아래 게이트. Settings 스키마에 `language` 필드만 추가(채널 수 불변) |

## 게이트 (에이전트 실행)

| 게이트 | 결과 |
|---|---|
| `npm run typecheck`(node/web/test) | ✅ PASS |
| `npm run lint`(eslint-boundaries·no-cycle) | ✅ PASS (경계 위반 0) |
| `npx vitest run` | ✅ **690 passed**. 3 test *파일*(chat-turn.continuity·runtime-resilience·history/writer)은 electron 바이너리 미설치(egress 403)로 import 단계 실패 — **본 변경 무관, 환경 제한**. 직접 영향 스위트 `features/extensions`+`db/queries` **52/52** green |
| 신규 순수 테스트 | ✅ `system-header.test.ts`(5) + `builder.test.ts`(3, 실 in-memory sqlite 조립·순서·경로) |

## 검증 책임 분리 (사람 / 에이전트)

| 항목 | 에이전트 | 사람 |
|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — |
| 인수 기준 ↔ 코드 1:1 | ✅ 증거 | — |
| 레이어 경계 | ✅ 위반 0(system-header=builder 동일 slice) | — |
| **실 GUI 턴 주입 육안 확인**(preset 뒤 `# Orca/# User/# Project`) | ✖ electron 바이너리 미설치로 불가 | ✅ `npm run dev` 실기 |
| 계정 지침 세션중 편집 즉시 반영 실기 | ✖ | ✅ |
| 정체성 문구 어감 | ✖ | ✅ |

## 위생

- AGENTS.md 위생(키/토큰/이메일/IP): 신규 코드에 비밀 0.
- 문서 정합: `system-prompt.md`(§2A 신설·§2 HISTORICAL·§3 갱신) · `IPC_CONTRACT.md`(Settings `language`) 갱신.
- 스테일 정정: `system-prompt.md` §2 가 0062 로 폐기된 `prompts/` 를 현행처럼 기술하던 것을 배너로 교정.

## 검증 자기 리뷰

- 설계: 실행환경 재주입 회피(preset 동적섹션 존치)를 명시해 중복 방지 — 적절.
- 구현: electron 바이너리 미설치로 실 GUI 턴은 미검증. 대신 실 sqlite 조립 스모크(`builder.test.ts`)로
  end-to-end 조립·순서·쿼리를 커버해 정적 검증 한계를 보완. 실 GUI 육안 확인은 사람 몫으로 분리.

---

## 라운드 2 — `# Project` 섹션에 프로젝트 지침 포맷화 편입 (PASS)

**사용자 후속 요청**: 프로젝트 name 과 **지침을 `# Project` 섹션 안에 함께 포맷화**하고, 프로젝트가
없으면 둘 다 제외. (라운드 1 은 지침을 헤더 밖에서 `[header, instructions].join('\n\n')` 로 뒤에
라벨 없이 이어붙였음.)

- **변경**: `buildSystemHeader` 에 `projectInstructions?` 추가 → `# Project` 를 `Active project: <name>`
  + (지침 있으면) `Project instructions:\n<본문>` 로 조립. `projectName` 부재면 섹션 통째(지침 포함) 생략.
  `builder.ts` 는 지침을 헤더로 이관하고 `systemPromptAppend = 헤더 단일 문자열`(별도 join 제거).
- **포맷**:
  ```
  # Project
  Active project: <name>
  Project instructions:
  <지침 본문>
  ```
- **게이트**: typecheck 3종 ✅ · lint(경계 0) ✅ · `vitest` extensions **41/41**(system-header 7 케이스로
  확장: name+지침/ name만/ 프로젝트 부재 시 지침 무시/ 3-필드 trim/ 지침 공백 생략) + queries 포함 **55/55**.
- **문서**: `system-prompt.md` §2A.1 포맷 블록·§2A.2 표(`# Project` 지침 행)·§1·§3(`append=헤더`) 정합.
- **경계**: 순수 함수 확장 + 빌더 조립만 변경, 레이어 경계·IPC·의존성 무변경. 인수 기준 1·4·5 재확인 PASS.
- 사람 확인 대기(불변): 실 `npm run dev` 로 `# Project` 안 name+지침 육안 확인.
