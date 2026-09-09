# 시스템 프롬프트 · 정책 append 관리 (Orca / Claude Agent SDK)

> **정본 우선**: 어댑터 내부 구현은 [`adapters.md`](./adapters.md), 배포 계층은
> [`standardization.md`](./standardization.md), 런타임 정규화는
> [`provider-runtime.md`](./provider-runtime.md). 본 문서는 **시스템 프롬프트를 어떻게 주입하고
> 정책 텍스트를 어디에 두며 어떻게 조립하는가** 만 다룬다.
>
> 출처: Opus 4.8 작성 "시스템 프롬프트 관리 가이드 ver2"(`@anthropic-ai/claude-agent-sdk` 일반론)를
> Orca 실제 코드·확정 핸드오프 결정과 1:1 대조해 교정한 결과 (handoff `0030-system-prompt-policy-structure`).
> 아래 설명은 현재 Orca의 세션 스코프 query와 warm 재사용을 기준으로 한다.

## 1. 현 구현 (Orca 가 이미 하는 것)

가이드 1~3장의 결론은 대부분 Orca 현 설계와 **이미 일치**한다. 근거 파일과 함께:

| 항목 | Orca 구현 | 근거 |
|---|---|---|
| `claude_code` preset + `append` | `adaptSystemPrompt()` 가 `{type:'preset', preset:'claude_code', append}` 반환 | `app/src/main/adapters/claude-adapt.ts` |
| `append` 는 **단일 문자열** | 빌더가 구조화 헤더(지침 포함) 단일 string 조립(다중 블록 4-블록 버그 회피) | `app/src/main/features/extensions/builder.ts` |
| 세션 스코프 `query()` + 입력 스트림 | spawn에서 query를 만들고 후속 입력은 같은 LiveTurn으로 전달한다. 재생성이 필요하면 `resume`한다 | `app/src/main/adapters/claude.ts` · `features/sessions/session-runtime.ts` |
| 제품 에이전트 프로필 | Work만 `# Agent` 지침을 추가한다. Code는 기존 append와 동일하다 | `features/agents/profiles.ts` · `system-header.ts` |
| `excludeDynamicSections` 생략(=false) | 미사용 → cwd/플랫폼/메모리 경로 동적섹션을 시스템 프롬프트에 유지 | grep 0건 |
| 출력 스타일 미사용 | 정책은 전부 `append` 로 주입 | — |

> 즉 **주입 메커니즘은 변경 대상이 아니다** (preset+append 그대로). append 의 내용은
> `구조화 헤더` 하나이고 프로젝트 지침은 `# Project` 섹션 안에 포맷화되어 편입된다 (§2A).
> 정적 정책 체인을 두지 않는 이유는 §2.

## 2A. 구조화 시스템 프롬프트 헤더 (`features/extensions/system-header.ts`, handoff 0073)

**현행 append 조립의 정본.** 역할·사용자 정보 + 실행환경 구성을 `# Orca / # Agent / # Tools / # User / # Project` 마크다운
섹션으로 구조화해 프로젝트 지침 **앞**에 붙인다. study/opencode·hermes 의 "정체성/실행환경 framing 을
프롬프트 앞에 구조화" 교훈을 Orca 경량판으로 적용한 것.

### 2A.1 포맷

```
# Orca
You are running inside Orca — a Windows desktop app for engineers and AI beginners,
not a terminal CLI. Responses render as rich markdown in a GUI transcript.
Orca version: <app.getVersion()>

# Agent
<Work 프로필 지침 — Code이면 섹션 전체 생략>

# Tools
Prefer dedicated file tools over shell commands (Read/Edit/Write, not cat/sed/echo);
reserve Bash for real shell needs. Work only inside the workspace — file tools are
restricted to it; Bash is not path-restricted, so keep every command scoped yourself.

# User
Preferred language: <settings.language>
Account instructions: <settings.accountInstructions>

# Project
Active project: <프로젝트 name>
Project instructions:
<프로젝트 지침 본문>
```

### 2A.2 소스·조립

| 섹션 | 필드 | 소스 | 조건 |
|---|---|---|---|
| `# Orca` | 정체성 framing + version | 상수 + `app.getVersion()`(bootstrap 주입) | 항상 |
| `# Agent` | 문서·자료 정리·분석 역할과 완성 산출물 게시 지침 | `features/agents/profiles.ts`를 app에서 해석해 builder에 전달 | Work만 |
| `# Tools` | 도구-사용 정책(전용툴 우선 + workspace 스코프) | 상수 `TOOLS_SECTION`(opencode `anthropic.txt` 적용, handoff 0075 r3) | 항상 |
| `# User` | Preferred language | `settings.language`(default `한국어`) | 값 있을 때 |
| `# User` | Account instructions | `settings.accountInstructions` | trim 후 비지 않을 때 |
| `# Project` | Active project | 프로젝트 `name`(세션 바인딩 / 새 채팅 projectId) | 프로젝트 소속 시 |
| `# Project` | Project instructions | 프로젝트 `instructions`(DB) | 프로젝트 소속 + 지침 trim 후 비지 않을 때 |

- **순수 함수 `buildSystemHeader(input): string`** — 존재하는 섹션만 `'\n\n'` join, **단일 문자열**
  반환(4블록 버그 회피). 빈/공백 필드는 줄/섹션 생략. **프로젝트 name·지침은 `# Project` 섹션 안에
  함께 포맷화**되며, `name` 부재(프로젝트 없음)면 섹션 통째(지침 포함) 생략. 지침은 다줄 가능이라
  `Project instructions:` 라벨 줄 + 다음 줄부터 본문. 헤더는 `# Orca` 상시라 `append = 헤더`(빈 문자열 불가).
- **실행환경 재주입 안 함**: cwd/platform/date/도구목록은 preset 동적섹션(`excludeDynamicSections:false`)이
  이미 주입 → 헤더는 preset 이 주지 못하는 Orca framing(GUI/markdown 표면)만 얹는다.
- 근거 코드: `features/extensions/system-header.ts`(+`.test.ts`)·`builder.ts`(조립)·`app/bootstrap.ts`(version/settings 주입).

## 2. 정적 정책 append — 미채택

현행 append 조립은 §2A 헤더 하나다. `app/src/main/prompts/` 의 정적 정책 체인(레지스트리 + `policies/*.md` + `buildAppend`)은 소비자가 생기지 않아 빈 레지스트리로 남았고 제거됐다.

Decision rationale: [ADR-002 feature slice boundaries](../../decisions/002-feature-slice-boundaries.md).


## 3. 변동성 계층 (캐시 레이아웃) — Orca 매핑

| tier | 내용 | Orca 위치 |
|---|---|---|
| STABLE | Orca 정체성 framing + version | `# Orca` 헤더 (`system-header.ts`, version=프로세스 고정) |
| STABLE — 역할 | 세션 출생 때 고정한 Work/Code | Work의 `# Agent`와 `agentProfileKey`; Code는 둘 다 생략 |
| CONTEXT — 커스텀 지시 | 선호 언어·계정 지침·프로젝트 지침(DB/설정) | 빌더가 매 턴 재조회하되 SDK append는 query 생성 시 적용 |
| CONTEXT — cwd/작업공간 | 실행 환경 | preset 동적 섹션 (SDK 자동, `excludeDynamicSections:false`) |
| VOLATILE | 날짜·메모리 스냅샷 | **현재 없음** (§4 참조) |

append는 Orca→Agent(Work만)→Tools→User→Project 순서의 단일 문자열이다. 같은 입력이면 동일한 문자열을 만든다. 공급자의 실제 캐시 적중은 별도 관측이 필요하다.

**조립과 실행 적용은 다르다.** 빌더가 최신 지침을 읽어도 살아 있는 query의 시스템 프롬프트가 교체되지는 않는다. SDK 옵션은 spawn/respawn에서 적용된다. 프로필 key는 최초 전송·자동 연속 전송 모두 기존 respawn 판정에 포함되어, 같은 key는 warm 재사용하고 변경된 key는 다음 실행에 반영한다. 계정·프로젝트 지침 편집 자체의 즉시 반영 정책은 별도로 확장하지 않는다.

## 4. 전제 차이 (가이드가 Orca 와 다른 부분)

가이드의 일부 전제는 현 Orca 와 맞지 않는다. 결론값이 우연히 같아도 *이유*는 다르다.

| 가이드 전제 | Orca 현실 |
|---|---|
| 3장 "대화마다 고유 cwd" | 현재 cwd 는 **프로젝트 단위**다 — `Bootstrap.getCwd(projectId)`(`app/bootstrap.ts`·`app/context.ts`)가 프로젝트 미소속이면 `projects/default`, 소속이면 `projects/<이름>-<프로젝트ID8>` 을 준다. **대화(세션)마다 고유 cwd 는 아니다** — Future Scope. `excludeDynamicSections:false` 결정은 유효하나 근거는 "동적섹션 유지" 자체이지 per-session cwd 가 아님 |
| 6장 VOLATILE = 날짜·**메모리 스냅샷** → 첫 user 메시지 | Orca 에 **메모리 기능 없음**. 날짜는 preset 동적섹션이 이미 주입. 현재 격리할 volatile preamble 자체가 없음 → 미구현(기능 도입 시 재검토) |
| 5.3 `src/agent/systemPrompt/` 경로 | Orca 엔 미존재. main feature 슬라이스에 맞춰 `features/extensions/system-header.ts`(빌더 동일 slice)로 매핑 |

## 5. Open Questions — 재검토 대상 (가이드 ↔ Orca 확정결정 충돌)

가이드 4·8장의 SDK 처방 3건은 **이미 확정된 핸드오프 결정과 충돌**한다. 사용자 결정(2026-06-18):
**자동 기각도 자동 변경도 아니며 재검토 대상으로 등재**한다. 아래는 분석 + 권고일 뿐, **실제 변경은
사용자 결정 후 별도 핸드오프**에서만 한다 (root `AGENTS.md` "확정 결정 임의 변경 금지").

### A. 설정 탐색 범위

| | 내용 |
|---|---|
| 가이드 처방 | `settingSources:["user","project"]` — env 충돌 회피 위해 `local` 제외 |
| Orca 현재 | `adaptSettingSources()`가 `['project','local']`을 명시한다. 사용자 전역 설정은 제외하며 사용자 스킬은 별도 wrapper plugin으로 제공한다 |
| 분석 | 가이드는 env 를 `options.settings.env` 로 주입한다고 가정 → `local` 이 그보다 우선이라 충돌. **Orca 는 다른 메커니즘**(OQ-B): provider env 를 `options.settings`(=`--settings` flag)에 실으며, 이는 우선순위 체인 `managed>CLI flags>local>project>user` 에서 `local` 보다 **위**다 → `local` 제외 불필요 |
| 범위 | 현재 명시적 탐색 범위를 유지한다. 추가 변경은 별도 결정이 필요하다 |

### OQ-B. env 를 `settings:{env}` 단일 주입?

| | 내용 |
|---|---|
| 가이드 처방 | `settings:{ env: appEnv }` — 앱 env 를 settings 에 단일 주입 |
| Orca 확정 | provider env→`options.settings`(JSON 문자열, `adaptSettings`) / 시스템(턴) env→`options.env`(`adaptEnv`)로 **분리**. 분리 지점은 `adapters/claude-adapt.ts` 의 `adaptSettings`/`adaptEnv` 두 함수다. (0015/0018 의 `splitProviderSettings`·branded 타입 컴파일타임 강제는 **0028 이 제거**했다 — [security.md §1.7](./security.md) 이력.) handoff 0015/0018/0028 |
| 분석 | Orca 분리 모델이 더 정밀(어떤 env 가 어느 레이어로 가는지 타입으로 고정). 가이드의 단일 주입은 이 구분을 잃음 |
| 권고 | **현행 유지**(분리) |

### C. 지침 조회와 warm 실행

| | 내용 |
|---|---|
| 가이드 처방 | 8장 — 옵션을 세션당 1회 빌드 후 캐시, "설정 변경" 시에만 무효화 |
| Orca 현재 | `ExtensionBuilder`는 매 턴 DB 지침을 읽는다. `SessionRuntime`은 살아 있는 query를 재사용하며 append를 hot-update하지 않는다 |
| 역할 변경 | host가 만든 `agentProfileKey`를 spawn 당시 값과 비교한다. 프로필 지침 변경 시 key도 갱신해야 한다 |
| 범위 | 별도 옵션 캐시·지침 편집 전용 respawn 정책을 추가하지 않는다 |
