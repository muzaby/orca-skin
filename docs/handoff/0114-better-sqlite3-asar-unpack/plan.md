# Plan — 0114-better-sqlite3-asar-unpack

> 비기능(버그수정) = Claude 직접 구현. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0114-better-sqlite3-asar-unpack` |
| 작성자 | Claude Code |
| 일자 | 2026-07-16 |
| 매핑 | (PR — 이 브랜치) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "github workflow 에서 release 배포 생성 시 문제가 발생함. node_module 에서 better_sqlite3.node 를 찾고 있다." | 라이브 세션 요청 |
| 추론 의도 | (해석) 워크플로 자체는 성공하나 **packaged 설치본 실행 시** better-sqlite3 네이티브 바인딩 로드 실패 → asar 언팩 누락 | 아래 자료조사 |

## Context (왜)

릴리스(`release.yml`, `v*` 태그)로 배포한 **설치본을 실행하면** better-sqlite3 네이티브 바인딩
(`build/Release/better_sqlite3.node`)을 찾지 못해 DB 초기화가 실패한다. 워크플로 실행 자체는
성공한다(최근 `v0.2.0` run = success). 즉 **빌드/게시가 아니라 packaged 런타임 결함**이다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `better-sqlite3` 는 production dependency → electron-builder 가 `node_modules` 를 `app.asar` 로 포장 | 코드 `app/package.json:37` |
| 런타임 로드는 main `db/index.ts` 의 `import Database from 'better-sqlite3'` 1곳(값 import). queries/migrate 는 type-only | 코드 `app/src/main/infra/db/index.ts:1` · `queries.ts:1` · `migrate.ts:3` |
| 현행 `asarUnpack` 는 `resources/**` + Claude SDK 바이너리만 → better-sqlite3 미포함 | 코드 `app/electron-builder.yml:13-17` |
| **동일 버그 클래스 선례**: SDK `claude.exe` 가 asar 내부에 갇혀 실패(dev 미재현/packaged 만) → `asarUnpack` 추가로 해결 | `@docs/handoff/0105-native-binary-executable-resolve/plan.md` |
| 네이티브 `.node` 는 asar 아카이브 *내부*에서 로드 불가 → 실디스크(`app.asar.unpacked/`) 필요, Electron 이 로드를 리다이렉트 | Electron asar 통합 동작(0105 §Root Cause 동형) |
| `npm run dev` 가 DB 정상 = better-sqlite3 는 이미 external 로 해석됨. 문제는 오직 asar 언팩(번들링 아님) | 코드 `app/electron.vite.config.ts`(main 무설정) + dev 동작 사실 |
| `npmRebuild: false` — ABI 는 `ensure-sqlite-abi.mjs` 훅이 관리(별개 관심사) | 코드 `app/electron-builder.yml:47` · `app/scripts/ensure-sqlite-abi.mjs` |

### Root cause

better-sqlite3 는 asar 에 포장되고 런타임에 `require('better-sqlite3')` 로 외부 해석된다(그래서
asar 없는 dev 는 정상). 로더가 `build/Release/better_sqlite3.node` 를 로드하는데, 이 네이티브
바이너리가 asar *내부*에 있으면 로드 불가 → 설치본에서 "better_sqlite3.node 찾을 수 없음".
현행 `asarUnpack` 에 better-sqlite3 항목이 없어 `.node` 가 asar 에 갇힌다.

## 인수 기준 (Acceptance Criteria)

1. `app/electron-builder.yml` 의 `asarUnpack` 에 `node_modules/better-sqlite3/**` 가 추가되고, 기존
   2항목(`resources/**`, `@anthropic-ai/claude-agent-sdk-*/**`)은 유지된다.
2. 코드·ABI 스크립트·vite config·main 소스는 무변경(설정 1파일만 변경).
3. (CI/사람) packaged 설치본이 `better_sqlite3.node not found` 없이 부팅하고 DB 가 초기화된다.

## 범위 / 비범위

- **범위**: `asarUnpack` 에 better-sqlite3 native 바인딩 언팩 추가.
- **비범위**: ABI 관리(`ensure-sqlite-abi.mjs`) · `electron.vite.config.ts` 외부화 · 서명 · 다른
  네이티브 모듈. (모두 이 결함과 무관.)

## 의존 기술 / 전제

- electron-builder `asarUnpack` glob(0105 에서 이미 사용). 신규 의존성 없음.
- 전제: better-sqlite3 는 external 해석(dev DB 동작이 증거). `bindings`·`file-uri-to-path`(순수 JS)
  는 asar 에서 로드되고 언팩된 better-sqlite3 디렉토리로 경로를 해석하므로 별도 언팩 불필요.

## 설계

`app/electron-builder.yml` `asarUnpack` 에 1항목 추가(0105 주석 스타일 유지):

```yaml
asarUnpack:
  - resources/**
  - node_modules/@anthropic-ai/claude-agent-sdk-*/**
  # better-sqlite3 native binding(build/Release/better_sqlite3.node)은 asar 내부에서 로드 불가 …
  - node_modules/better-sqlite3/**
```

- 재사용: 0105 가 확립한 `node_modules/<pkg>/**` 언팩 패턴.
- 레이어 경계: 빌드 설정 변경 — 소스 경계 무영향.

## 파생 UX / 엣지케이스

- N/A (빌드 패키징 설정 변경, 런타임 UX 무변경).

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 이 환경(egress 403·비-Windows)에서 packaging 실기 불가 | CI(`workflow_dispatch` dry-run)·Windows 사람 실기로 최종 판정(0105/0102/0019 선례) |
| 설치본 크기 소폭 증가(.node 가 asar 밖) | 무시 가능 — 네이티브 로드에 필수 |

- 되돌리기 어려운 결정: 없음(설정 1줄, 순수 additive).

## 영향 받는 파일

- `app/electron-builder.yml` (asarUnpack 1항목 추가)

## 참고 문서

- `docs/handoff/0105-native-binary-executable-resolve/plan.md` (동일 버그 클래스 선례)
- `docs/guides/release-operations.md` (릴리스 절차·트러블슈팅)

## 게이트

- 소스/타입 무변경이라 lint/typecheck/test 는 이 변경과 무관(설정 파일). 회귀 게이트는 CI 빌드.
- 신규 테스트 요구: 없음(electron-builder 설정은 단위 테스트 대상 아님, 0105 도 동일).

---

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/electron-builder.yml` (asarUnpack 에 `node_modules/better-sqlite3/**` 1항목 + 주석 추가) |
| 실행 명령 | 설정 1파일 변경 — 소스/타입 무변경이라 lint/typecheck/test 무관(0105 선례) |
| 게이트 결과 | 해당 없음(빌드 설정). 정본 회귀는 CI windows-latest 빌드 |
| 블로커 / 역질문 | 없음. **패키징 실행 검증은 egress 403·비-Windows 로 이 환경 불가** → `build:win` 산출물 설치·부팅 실기는 CI dry-run/사람 대기 |
| 대상 커밋 | (push 후 기재) |

## 파생 이슈 (Derived Issues) — r2

### 설치본 ABI 불일치 (사용자 실기, 2026-07-16)

r1은 네이티브 바인딩의 **위치**만 수정했지만, 설치본은 다음 단계에서 부팅에 실패했다.

- 포장된 `better_sqlite3.node`: `NODE_MODULE_VERSION 127` (릴리스 러너 Node 22)
- Electron 39 런타임 요구 ABI: `NODE_MODULE_VERSION 140`

릴리스 순서는 `npm test`(pretest가 Node ABI로 rebuild) → `npm run build:win`이다
(`.github/workflows/release.yml`). `prebuild`의 별도 ABI 보장에 기대고 있었지만,
`electron-builder.yml`의 `npmRebuild: false`가 패키저 자체의 production native dependency rebuild를
명시적으로 차단했다. 그 결과 r1의 `asarUnpack`은 Node ABI 바이너리를 정상적으로 실디스크에
옮겼을 뿐이며, Electron ABI 호환성은 보장하지 못했다.

### r2 인수 기준

4. `electron-builder`의 패키징 직전 native dependency rebuild를 활성화한다
   (`npmRebuild: true`). 따라서 `npm test`가 Node ABI로 바꾼 바이너리를 패키징 대상 Electron
   버전/플랫폼/아키텍처에 맞게 다시 빌드한다.
5. r1의 `asarUnpack`을 유지해 ABI가 맞는 바인딩이 `app.asar.unpacked`에 배치되도록 한다.
6. Windows 릴리스/사람 실기에서 설치본 부팅 시 ABI mismatch 없이 DB가 초기화된다.

### r2 구현 보고

| 항목 | 내용 |
|---|---|
| 설계 리뷰 | r1의 “ABI 관리가 결함과 무관” 판단은 잘못됐다. 네이티브 모듈은 위치와 ABI가 모두 패키징 불변조건이다. |
| 변경 파일 | `app/electron-builder.yml` (`npmRebuild: false` → `true`, 원인 주석) |
| 놓친 잠재 문제 + 대응 | `ensure-sqlite-abi`만 성공해도 이후 단계가 바이너리를 바꿀 수 있으므로, 최종 패키저가 대상 ABI rebuild를 소유하도록 복구했다. |
| 검증 | YAML 파싱 및 `npmRebuild`/`asarUnpack` 설정값 확인. Windows 설치본 실기는 PR/release CI와 사용자 환경에서 최종 확인. |
