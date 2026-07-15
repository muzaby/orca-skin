# Plan — 0105-native-binary-executable-resolve

> 비기능(버그수정) = Claude 직접 구현. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0105-native-binary-executable-resolve` |
| 작성자 | Claude Code |
| 일자 | 2026-07-15 |
| 매핑 | (PR 미요청) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "빌드후 실행 시 `claude code native binary at <경로>/node_modules/.../claude.exe exists but failed to launch` 에러. 클로드 설치는 오피셜 설치 뿐 아니라 npm install 로도 할수있다" | 라이브 세션 |
| 명시 요구 ② | 공식 인스톨러(`install.ps1`/`install.cmd`)로 설치된 경로도 지원 — **공식/PATH 우선**, env override 불필요 | 라이브 세션(AskUserQuestion) |

## Context (왜)

패키징된 앱 실행 시 Claude 턴이 시작되지 못하고 `... claude.exe exists but failed to launch` 로 실패.

### Root Cause (SDK v0.3.143 소스 확인)

`app/src/main/adapters/claude.ts` 가 `@anthropic-ai/claude-agent-sdk` 의 `query()` 를 호출한다.
SDK 내부(`sdk.mjs`)는 `options.pathToClaudeCodeExecutable` 미지정 시 `createRequire(import.meta.url)`
로 native binary 서브패스(`@anthropic-ai/claude-agent-sdk-<plat>-<arch>/claude[.exe]`)를 `require.resolve`
해 얻고, `existsSync` 통과 시 그 경로를 **직접 spawn** 한다(`Fx()` = 비-.js 확장자 → native 취급).

electron-builder 는 `node_modules` 를 `app.asar` 아카이브로 묶는다:
- 해석 경로 = `…/resources/app.asar/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe`
- `existsSync` → **true** (Electron asar-aware fs 가 아카이브 내부를 투명하게 읽음)
- `spawn` → **실패** (asar *내부* 파일은 실디스크 실행 파일이 아니라 OS CreateProcess 불가)
- SDK 가 정확히 "native binary at … exists but failed to launch" 를 던진다.

현행 `electron-builder.yml` 의 `asarUnpack` 는 `resources/**` 만 → SDK native binary 는 asar 에 갇힘.
(dev = `npm run dev` 는 asar 없음 → 재현 안 됨. **빌드 후에만** 발생.)

### 결정: 공식/PATH 우선 → 번들 asar-언팩 폴백

SDK 는 native binary 를 npm `optionalDependencies` 로 동봉하지만, 공식 네이티브 인스톨러
(`irm .../install.ps1 | iex`, `install.cmd`)로도 설치 가능하며 이는 `claude.exe` 를
`%USERPROFILE%\.local\bin` 에 두고 PATH 에 등록한다. `options.pathToClaudeCodeExecutable` 는 임의
실행 파일 경로를 받으므로, **PATH → 공식 설치 위치 → 번들 언팩본** 순으로 실경로를 골라 넘긴다.

## 설계

### 1. `app/electron-builder.yml` — 번들 native binary 언팩(폴백 보장)

```yaml
asarUnpack:
  - resources/**
  - node_modules/@anthropic-ai/claude-agent-sdk-*/**
```

→ `app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-*/claude[.exe]` 실파일 생성
(`*` 가 설치된 플랫폼 패키지만 매칭 — npm 은 os/cpu 일치본만 설치).

### 2. `app/src/main/adapters/claude-executable.ts` (신규) — 실행 파일 해석기

순수 함수 + 의존성 주입(테스트 용이, `builtin-resources.ts` 패턴):
- `toUnpackedPath(p)`: `app.asar` 세그먼트 → `app.asar.unpacked` 리맵(posix/win 양쪽).
- `findOnPath(env,platform,exists)`: PATH 디렉토리에서 `claude`(win=`claude.exe`) 탐색.
  win 은 실행 가능한 `.exe` 만(.cmd/.bat 은 shell 없이 spawn 불가).
- `officialInstallPath(platform,home,exists)`: `~/.local/bin/claude[.exe]` 존재 시 반환.
- `resolveBundledExecutable(requireFn,platform,arch)`: SDK Q2 후보(linux 는 glibc/musl 둘 다)를
  `require.resolve` → **asar 경로일 때만** 언팩 리맵, 비패키징(dev)이면 undefined(SDK 기본 위임).
- `resolveClaudeExecutable()`: `findOnPath() ?? officialInstallPath() ?? resolveBundledExecutable()`.

### 3. `app/src/main/adapters/claude.ts` — 옵션 주입

모듈 상수 `const claudeExecutable = resolveClaudeExecutable()` 1회 계산 후,
`runCompletion()` 와 `sendMessage()` 의 `query()` options **양쪽**에:
`...(claudeExecutable ? { pathToClaudeCodeExecutable: claudeExecutable } : {})`.

설계 근거: native 실경로를 명시하면 SDK 가 그 실파일을 직접 spawn → asar 우회. Electron 의
child_process asar 패치 동작에 의존하지 않는 결정적 방식(언팩=실파일 존재 전제, 실경로 주입=보장).

### 4. `app/src/main/adapters/claude-executable.test.ts` (신규)

주입 fake(`exists`/`env`/`home`/`requireFn`)로 순수 검증 + `node:fs`/`node:os` mock 으로 우선순위
(PATH > official > bundled) 회귀 고정.

## 잠재 리스크

- 공식 설치본(사용자 머신 버전)이 SDK 0.3.143 과 버전 상이 → 제어 프로토콜 mismatch 이론상 가능.
  SDK↔CLI 는 대체로 호환 범위 유지. 사용자 우선순위 결정(공식/PATH 우선) 존중.

## [구현 보고]

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/electron-builder.yml` · `app/src/main/adapters/claude-executable.ts`(신규) · `app/src/main/adapters/claude.ts` · `app/src/main/adapters/claude-executable.test.ts`(신규) |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `vitest run src/main/adapters/` |
| 게이트 결과 | typecheck 3종 0 · lint 0 errors(경고 1=0102 TanStack, 무관) · 어댑터 224/224 green(신규 12 포함) |
| 레이어 경계 | 전부 `adapters/` 내부 → boundaries 안전(위반 0) |
| 블로커 / 역질문 | 없음. **패키징 실행 검증은 egress 403·비-Windows 로 이 환경 불가** → `npm run build:win` 산출물 실기(케이스 A 공식설치본 / 케이스 B 번들 폴백)는 CI(windows-latest)/사람 실기 대기. |
