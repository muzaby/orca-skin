# Plan — 0073-system-prompt-structured-header

## 메타

| 항목 | 값 |
|---|---|
| slug | `0073-system-prompt-structured-header` |
| 작성자 | Claude Code |
| 일자 | 2026-07-06 |
| 매핑 | 브랜치 `claude/system-prompt-injection-plan-qenkr7` / 라이브 세션 요청 |
| 상태 | READY → 구현 완료(Claude 직접, 비기능+소기능) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 사용자 정보 + 실행환경 구성을 **구조화해 매 턴 시스템 프롬프트에 주입**. 포맷 `# Orca`(정체성+version) · `# User`(Preferred language·Account instructions) · `# Project`(Active project). 참고: `study/opencode`·`study/hermes` 시스템프롬프트 주입 분석 2편. | 라이브 세션 지시문 + 포맷 예시 |
| 사용자 결정 | ① Preferred language 소스 = **`language` 설정 신규 추가**(기본 `한국어`, UI 셀렉터는 후속). ② 정체성 문구 = **"Windows desktop app"**. | AskUserQuestion 응답 2건 |
| 추론 의도 | 헤더는 프로젝트 지침 **앞**에 배치(framing 선행). 실행환경(cwd/platform/date)은 preset 동적섹션이 이미 주입하므로 재주입 안 함. | 추론 — 포맷 구조 + `excludeDynamicSections:false` 현행 |

## Context (왜)

Orca 는 매 턴 `claude_code` preset + `append` 로 시스템 프롬프트를 조립하나(`adaptSystemPrompt`),
현재 `append` 는 프로젝트 지침(DB) 단일 텍스트뿐이다(`features/extensions/builder.ts`). preset 은
CLI/터미널 가정의 실행환경을 주입하지만 **Orca 가 GUI 마크다운 데스크톱 앱이라는 framing 과
사용자/프로젝트 컨텍스트**는 주지 못한다. `settings.accountInstructions` 는 이미 영속화돼 있으나
"system prompt 배선은 추후"로 미배선 상태였다. 이 배선 + 구조화 헤더를 도입한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| append 조립·주입은 preset+append, 매 턴 호출 | `adapters/claude-adapt.ts:55` · `app/chat-turn.ts:477` |
| 정적 정책 체인 `prompts/` 는 0062 에서 데드코드 제거 → 깨끗한 슬롯 | `features/extensions/builder.ts:6` 주석 |
| `accountInstructions` 존재·영속, 미배선 | `shared/protocol.ts:365` · `shared/ipc.ts:699` |
| `language` 설정·i18n 미존재. 언어 플라이아웃 UI 는 코스메틱(한국어만) | grep 0건 · `renderer/app/SidebarUserButton.tsx` |
| 세션→프로젝트 조회는 instructions 만 반환(name 없음) | `infra/db/queries.ts:531` |
| version = `app.getVersion()`(index.ts 에서 electron `app` import 선례) | `main/index.ts:1` |
| study 2편 공통 교훈: 정체성/실행환경 framing 을 앞에 구조화, 변동분 뒤로(캐시) | `@docs/etc/study/opencode/system_prompt_injection_analysis_ko.md` · `@docs/etc/study/hermes-agent/12-시스템프롬프트-주입-분석.md` |
| Orca 매핑 정본(변동성 계층·단일 문자열 불변식) | `@docs/arch/backend/system-prompt.md §1·§3` |

## 인수 기준 (Acceptance Criteria)

1. `buildSystemHeader` 순수 함수가 `# Orca / # User / # Project` 섹션을 조립하고 빈 필드는 줄/섹션을 생략한다.
2. `# Orca` 섹션은 항상 포함되고 "Windows desktop app" framing + `Orca version: <app.getVersion()>` 를 담는다.
3. `settings.language`(신규, 기본 `한국어`)·`settings.accountInstructions` 가 `# User` 로 매 턴 주입된다.
4. 활성 프로젝트 name 이 `# Project` 로 주입된다(resume=세션 바인딩, 새 채팅=projectId). 프로젝트 없으면 섹션 생략.
5. `systemPromptAppend = 헤더 \n\n 프로젝트 지침`(헤더 먼저), 단일 문자열 불변식 유지.
6. 무캐시 유지 — 계정 지침/프로젝트 지침 편집이 같은 세션 다음 메시지부터 즉시 반영.
7. 게이트: lint(경계 0)·typecheck(3종)·test green. 신규 IPC 채널 0(Settings 스키마에 `language` 필드만 추가).

## 범위 / 비범위

- **범위**: `language` 설정(스키마 2곳), 순수 헤더 빌더 + 테스트, 세션→프로젝트 name 쿼리, 빌더 조립, 부팅 배선, 문서 정합.
- **비범위**: 언어 셀렉터 UI 배선(플라이아웃은 코스메틱 유지), i18n 도입, 메모리/volatile preamble, per-session cwd.

## 설계

- **`shared/protocol.ts`·`shared/ipc.ts`**: `language: z.string().default('한국어')` + `Settings.language: string`(동시 갱신).
- **신규 `features/extensions/system-header.ts`**: 순수 `buildSystemHeader({orcaVersion, language?, accountInstructions?, projectName?}) → string`. Orca→User→Project 순, 빈 필드 생략, 단일 문자열. + `system-header.test.ts`.
- **`infra/db/queries.ts`**: `getProjectInstructionsForSession` → `getProjectContextForSession(sessionId): {name, instructions} | null`(SELECT 에 name 포함, 1 round-trip). 새 채팅은 기존 `getProject` 재사용.
- **`features/extensions/builder.ts`**: ctor deps `settings: () => Settings` + `orcaVersion: string` 추가. build() 에서 name+instructions 조회 → `buildSystemHeader` → `[header, instructions]` join. + `builder.test.ts`(실 sqlite 조립 스모크).
- **`app/bootstrap.ts`**: `ExtensionBuilder(...)` 에 `() => this.settings.getAll()`·`app.getVersion()` 주입(electron `app` import).
- **재사용**: skills getter 패턴(동형 getter), `getProject`(ProjectRow), preset 동적섹션(실행환경 재주입 회피).

## 파생 UX / 엣지케이스

- 계정 지침/프로젝트명 공백 → 줄·섹션 생략(trim). 프로젝트 없는 세션 → `# Project` 생략. language 기본 `한국어` 상시 주입.
- 무캐시: 세션 중 계정 지침 편집 시 다음 메시지부터 반영(기존 지침 UX 불변식과 동일).

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| `language` 설정만 추가하고 UI 셀렉터 미배선 → 값 고정 | 현 플라이아웃이 한국어만 선택 가능(English disabled)이므로 기본값 `한국어` 로 일관. 셀렉터 배선은 후속 범위 |
| 매 턴 헤더 재조립 = prefix 캐시 | preset 동적섹션이 이미 cross-대화 캐시를 깨므로 캐시 중립(system-prompt.md §3). 세션 내 byte-stable |
| system-prompt.md §2 (`prompts/`) 가 0062 로 이미 폐기됐는데 미표기 | 본 핸드오프에서 §2A 신설 + §2 HISTORICAL 배너 + §3 갱신 |

- **단독 결정 금지 항목**: 없음(사용자 결정 2건 반영, 신규 의존성 0).

## 영향 받는 파일

- 신규: `app/src/main/features/extensions/system-header.ts`(+`.test.ts`) · `builder.test.ts`
- 수정: `builder.ts` · `infra/db/queries.ts` · `adapters/turn.ts`(주석) · `app/bootstrap.ts` · `shared/{protocol,ipc}.ts` · `docs/arch/backend/system-prompt.md` · `docs/IPC_CONTRACT.md`

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 순수 테스트: `system-header.test.ts`(5) + `builder.test.ts`(3, 실 sqlite 조립).

---

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 참조 |
| 실행 명령 | `npm run typecheck`(node/web/test) · `npm run lint` · `npx vitest run` |
| 게이트 결과 | typecheck ✅ · lint ✅(경계 0) · test **690 passed**(신규 8 포함). 3 test *파일* 은 electron 바이너리 미설치(egress 403)로 import 실패 — 변경 무관, 환경 제한. 직접 영향 스위트(extensions/queries) 52/52 green |
| 블로커 / 역질문 | 없음. 실 electron GUI 검증은 바이너리 미설치로 불가 → 사람 실기 확인 대기 |
| 대상 커밋 | (push 후 기재) |
