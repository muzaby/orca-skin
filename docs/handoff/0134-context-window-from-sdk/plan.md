# Plan — 0134-context-window-from-sdk

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0134-context-window-from-sdk` |
| 작성자 | Claude Code |
| 일자 | 2026-07-21 |
| 매핑 | PHASES "현재 작업 중" |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "모델의 context window size (도넛패널) 및 모델 별 추정 사용금액과 그 합산이 잘 추적하고 있는지 검토하라" + "sonnet 5의 컨텍스트 윈도우 사이즈는 1M인데 앱에서 200k로 인식" + "package-lock.json 에서 마크한 sdk의 버전이 유효한지 검토" → 검토 보고 후 "핸드오프로 작업을 이어가도록 하라" | 라이브 세션 요청 (2026-07-21) |
| 추론 의도 | 검토에서 **앱 버그로 확정된 항목(도넛 분모)** 과 **재발 방지 권고(SDK 버전 핀)** 를 구현하라는 뜻으로 해석. 비용 추정 상이는 검토 결과 SDK(CLI) 내부 추정 단가와 실청구 인트로 가격의 차이로 앱 결함이 아니므로 **구현 비범위**(추론 — 검토 보고에서 "앱 수정 불요"로 제시했고 사용자가 이의 없이 핸드오프 진행을 지시함) | (근거) 검토 보고 요약표 |

## Context (왜)

컨텍스트 도넛/팝오버의 분모가 `contextWindowFor()` 문자열 휴리스틱("`1m`" 포함 여부)이라, 실제 1M 컨텍스트 윈도우인 현행 모델(Sonnet 5·Sonnet 4.6·Opus 4.6/4.7/4.8 등)이 전부 200k로 오인식된다 — 도넛 %가 5배 과대, `nearCompaction` 경고도 조기 점화. 한편 잠긴 SDK 는 result 메시지 `modelUsage[model].contextWindow` 로 **모델별 실제 윈도우를 이미 내려주는데** 앱이 버리고 있다. 이를 텔레메트리로 전달해 분모의 1차 소스로 쓰고, 휴리스틱은 폴백(복원·mock 경로)으로 강등하며 현행 모델 패밀리에 맞게 갱신한다. 부수 작업으로 `package.json` 의 SDK 스펙 `"latest"`(플로팅)를 lock 과 일치하는 정확 버전으로 핀 고정해 타입 드리프트 재발(0128 baseline TS2322)을 막는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 분모 휴리스틱: `'1m'` 포함 → 1M, 아니면 200k 고정 | `app/src/renderer/src/features/chat/lib/contextWindow.ts:5-7` |
| 도넛/상태 팝오버/패널 3곳이 같은 휴리스틱 소비 | `Composer.tsx:216,641` · `UsagePanel.tsx:31` |
| SDK `ModelUsage` 타입에 `contextWindow: number` 존재 (result 메시지 `modelUsage` per-model) | claude-agent-sdk 0.3.215 `sdk.d.ts:1246-1255` (npm tarball 확인) |
| CLI 2.1.215 내장 카탈로그: `claude-sonnet-5` = `context:{window:1e6, native_1m:!0}` | CLI 2.1.215 linux-x64 바이너리 문자열 분석 (2026-07-21) |
| 현행 모델 컨텍스트: Fable 5·Opus 4.6/4.7/4.8·Sonnet 5·Sonnet 4.6 = **1M**, Haiku 4.5 = **200K** | Anthropic 모델 카탈로그 (platform.claude.com/docs/en/about-claude/models/overview) |
| result 정규화 지점 — `modelUsage` 를 좁혀 읽되 `contextWindow` 는 현재 미추출 | `app/src/main/adapters/claude-map.ts:376-400,507-527` |
| 텔레메트리 타입 — `ProviderReportedTelemetry`/`TelemetryModelUsage` 전 필드 optional | `app/src/shared/ipc.ts:490-508` |
| 세션 재로드 복원은 DB 행 → `usageRowToTelemetry` 재조립 (contextWindow 비영속 → 복원 시 SDK 값 소실) | `app/src/main/app/handlers/session.ts:58` · `features/usage/usage-map.ts:14-39` |
| turn_usage 적재는 `hasContextTokens` 게이트 + 필드 그대로 저장 (스키마 변경 없이는 contextWindow 미영속) | `features/usage/subscriber.ts:18-63` |
| mock 어댑터는 `mock-sonnet` + 200k 상수로 도넛 비율 시뮬레이션 | `app/src/main/adapters/mock-scenarios.ts:36-37,660-667` |
| SDK 스펙 `"latest"` 플로팅, lock 은 0.3.215 (npm 최신 0.3.216, 유효) | `app/package.json:33` · `app/package-lock.json:12` · npm registry (2026-07-21) |
| `"latest"` 로 인한 타입 드리프트 전례 — `claude.ts:465 TS2322` baseline (`interrupt()` 타입) | `@docs/handoff/INDEX.md` 0128 행 비고 |
| telemetry 는 main→renderer 단방향 send — zod 검증 경로 없음(`protocol.ts` 는 타입 import 만) | `app/src/shared/protocol.ts:566` |

## 인수 기준 (Acceptance Criteria)

1. `claude-map.ts` 가 result `modelUsage[model].contextWindow` 를 숫자 가드로 추출해 `TelemetryModelUsage.contextWindow` 로 전달하고, 단일 모델 턴이면 top-level `ProviderReportedTelemetry.contextWindow` 도 채운다 (기존 `model` top-level 승격과 동형).
2. `shared/ipc.ts` 의 `ProviderReportedTelemetry`·`TelemetryModelUsage` 에 `contextWindow?: number` 가 추가되고, 기존 필드·소비자는 무변경으로 동작한다 (전 필드 optional 계약 유지).
3. renderer 에 단일 분모 헬퍼 `contextWindowOf(telemetry)` 가 생기고 우선순위는 ① `telemetry.contextWindow` ② `telemetry.modelUsage[telemetry.model].contextWindow` ③ `contextWindowFor(telemetry.model)` 폴백이다. 도넛(`Composer.tsx:641`)·상태 팝오버 뷰모델(`Composer.tsx:216`)·`UsagePanel.tsx:31` 3곳 모두 이 헬퍼를 쓴다.
4. 폴백 `contextWindowFor` 가 현행 모델 패밀리로 갱신된다: `sonnet-5`·`sonnet-4-6`·`opus-4-6`·`opus-4-7`·`opus-4-8`·`fable`·`mythos` 부분 문자열 → 1M, `'1m'` 포함 → 1M(기존 유지), 그 외(haiku·구형·`mock-sonnet` 포함) → 200k 기본값.
5. mock 어댑터 텔레메트리가 `contextWindow: 200_000` 을 명시해 (mock-sonnet 폴백값과 동일) SDK-실측 경로가 dev 에서도 관찰 가능하다. 도넛 비율 시뮬레이션(`usageForRatio`) 수치는 불변.
6. `package.json` 의 `@anthropic-ai/claude-agent-sdk` 스펙이 `"latest"` → `"0.3.215"` (정확 핀)로 바뀌고 `package-lock.json` 루트 스펙도 일치한다 (`npm ci` 정합).
7. 단위 테스트: (a) `contextWindow.test.ts` — 갱신된 폴백 매핑(sonnet-5→1M·sonnet-4-6→1M·opus-4-8→1M·haiku-4-5→200k·`1m` 변종→1M·미지 모델→200k) + `contextWindowOf` 우선순위 3단, (b) `claude-map.test.ts` — result `modelUsage.contextWindow` 전달 + 단일 모델 top-level 승격 + 비숫자 가드. 기존 테스트 무회귀.
8. 게이트: `npm run lint` 0 error + `npm run typecheck` 3분할 통과 + vitest 순수 스위트 green (DB 로드 스위트 실패는 better-sqlite3 ABI egress 베이스라인으로 분리 보고).
9. 문서 동기: `docs/IPC_CONTRACT.md` 의 telemetry(usage) 필드 서술과 `docs/arch/backend/provider-runtime.md` §8 텔레메트리 표(존재 시)에 `contextWindow` 추가.

## 범위 / 비범위

- **범위**: 위 인수 기준 1~9. main 어댑터 정규화 + shared 타입 + renderer 분모 헬퍼/폴백 + mock 패리티 + SDK 버전 핀 + 테스트/문서.
- **비범위**:
  - **비용 추정 보정** — 검토 결과 SDK(CLI 2.1.215)가 Sonnet 5 를 정가($3/$15)로 추정하고 실청구는 인트로($2/$10, ~2026-08-31)라 생기는 차이. 앱은 SDK 추정치를 충실히 중계 중이며(0002/0122 결·"예상치" 디스클레이머 커버) 앱측 보정은 이중 추정이 됨. 인트로 종료 후 자연 해소.
  - **contextWindow DB 영속**(turn_usage 컬럼 + 마이그레이션 0016) — 재로드 복원 시 SDK 실측을 유지하는 완전판이지만, 갱신된 폴백이 현행 모델을 전부 커버해 실익이 작다. 미지 신모델의 복원 분모만 다음 라이브 턴까지 폴백값 — 후속 필요 시 별도 핸드오프.
  - `AUTOCOMPACT_BUFFER`(33k) 재검토 — CLI 가변 추정값이라는 기존 주석 유지, 1M 분모에서도 `nearCompaction` 가드 수식은 유효.
  - subagent 자식 assistant usage 스냅샷 정밀화(멀티모델 턴 top-level model 미확정 동작)는 기존 동작 유지.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 의존: claude-agent-sdk 0.3.215 result `modelUsage[].contextWindow` (sdk.d.ts 로 확인, 좁히기 파싱이라 미제공 시 graceful 생략). 기존 `assignNums` 숫자 가드 재사용.
- 전제: telemetry 는 main→renderer send 전용이라 zod 스키마 변경 불요. renderer 4-layer·main DAG 경계 내 변경(어댑터→shared 타입→features/chat lib)이라 경계 위반 없음.
- **신규 의존성**: 없음.

## 설계

- **main (`adapters/claude-map.ts`)**: result 좁히기 타입의 `modelUsage` 항목에 `contextWindow?: number` 추가 → `normalizeResultTelemetry` 의 `assignNums(entry, {...})` 에 `contextWindow: mu.contextWindow` 한 줄 → 단일 모델 승격 분기(`models.length === 1`)에서 `out.model` 과 함께 `out.contextWindow` 도 그 항목 값으로 승격(값 존재 시).
- **shared (`shared/ipc.ts`)**: 두 인터페이스에 optional 필드 추가 + 주석(SDK 실측 컨텍스트 윈도우, 미제공 시 renderer 폴백).
- **renderer (`features/chat/lib/contextWindow.ts`)**:
  - `contextWindowFor` 를 패밀리 테이블 기반으로 갱신 — `WINDOW_1M_MARKERS: string[]` 상수 + `includes` 순회(모델 ID 가 bedrock `us.anthropic.claude-sonnet-5` 같은 프리픽스 변형이어도 부분 문자열 매칭으로 커버).
  - 신규 `contextWindowOf(t: ProviderReportedTelemetry): number` — AC3 우선순위. `Composer.tsx` 2곳·`UsagePanel.tsx` 1곳 치환(각 파일은 `contextWindowFor` 직접 호출 제거).
- **mock (`adapters/mock-scenarios.ts`)**: `usageForRatio` 반환에 `contextWindow: CONTEXT_WINDOW` 필드 추가.
- **버전 핀**: `package.json` 스펙 `"0.3.215"` + `package-lock.json` 루트 importer 스펙 동기(수기 편집 — resolved 는 이미 0.3.215 라 재해석 불요. `npm install` 재실행은 egress 제약 환경에서 electron postinstall 실패를 유발하므로 회피).
- 재사용: `assignNums`(claude-map)·`ifPresent`(usage-map, 변경 없음)·기존 테스트 픽스처 패턴.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **재로드 복원**: DB 재조립 텔레메트리엔 `contextWindow` 부재 → 헬퍼 ③ 폴백. 갱신된 패밀리 테이블로 sonnet-5 도 1M 복원. (미지 신모델만 다음 라이브 턴까지 200k — 비범위 문서화.)
- **멀티모델 턴**(서브에이전트 등): top-level `model`/`contextWindow` 모두 미설정 → 기존과 동일하게 폴백 경로(현행 동작 보존, 회귀 아님).
- **compaction/핸드오프 턴**(0065/0127): 컨텍스트 3종 토큰만 조작되고 `modelUsage`/`model` 은 유지되므로 분모 소스는 영향 없음.
- **경고 조기 점화 해소**: 1M 모델에서 `nearCompaction` 이 807k 부근으로 이동 — 의도된 수정 효과(기존엔 139k 부근에서 경고).
- 도넛 % 급변: 기존 사용자에겐 같은 세션 %가 1/5 로 보일 수 있으나 이것이 정답값. 테마/a11y/로딩 상태 변화 없음.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| SDK `contextWindow` 가 0/비숫자로 올 가능성 | `assignNums` 숫자 가드 + 헬퍼에서 `> 0` 확인 후 채택, 아니면 폴백 |
| 패밀리 테이블도 결국 정적 목록(신모델 드리프트) | 1차 소스가 SDK 실측이라 라이브 경로는 자동 정확. 테이블은 폴백 한정 — 주석에 갱신 지침 명시 |
| lock 수기 편집으로 `npm ci` 불일치 | 루트 importer 스펙만 `"0.3.215"` 로 동기(resolved 동일 버전이라 정합). verify 에서 lock lint(`npm ci --dry-run` 가능 환경이면) 또는 JSON 구조 검증 |
| 버전 핀으로 SDK 업데이트 자동 유입 중단 | 의도된 결정(재현성 우선). 업그레이드는 명시적 bump 로 — README/plan 에 기록 |

- 되돌리기 어려운 결정: 없음 (전부 additive/설정 변경).
- **단독 결정 금지 항목(Open Question)**: 없음 — 신규 의존성 0, PRD §11/TRD §15 비저촉. (contextWindow DB 영속은 후속 제안으로만 기록.)

## 영향 받는 파일

- `app/src/main/adapters/claude-map.ts` (+ `claude-map.test.ts`)
- `app/src/main/adapters/mock-scenarios.ts`
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/chat/lib/contextWindow.ts` (+ `contextWindow.test.ts`)
- `app/src/renderer/src/features/chat/components/Composer.tsx`
- `app/src/renderer/src/features/chat/components/UsagePanel.tsx`
- `app/package.json` · `app/package-lock.json`
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md`

## 참고 문서

- `docs/arch/backend/provider-runtime.md` §8 (ProviderReportedTelemetry)
- `docs/IPC_CONTRACT.md` §3 (telemetry variant)
- `docs/arch/backend/cost-tracking.md` (비용 = SDK 추정 결)
- `@docs/handoff/INDEX.md` 0122(상태 팝오버)·0127(도넛 승계)·0128(SDK 타입 드리프트 baseline)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + vitest 순수 스위트 (`./node_modules/.bin/vitest run` — DB 스위트는 ABI egress 베이스라인 분리).
- 신규 테스트 요구: 어댑터 정규화(contextWindow 전달/승격/가드) + 순수 변환기(`contextWindowFor` 매핑·`contextWindowOf` 우선순위).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론(비용 비범위 판단)은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·npm tarball·CLI 바이너리 분석·웹)를 붙였다.
- [x] 인수 기준 — 번호 1~9, 자료조사 근거, 검증 가능.
- [x] 의존 기술 — SDK 필드 존재를 d.ts 로 확인, 신규 의존성 0.
- [x] 파생 UX — 복원/멀티모델/compaction/경고 이동을 펼쳤다.
- [x] 리스크 — 폴백 드리프트·lock 수기 편집 리스크와 완화책을 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 버그수정 = Claude 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

- (구현 턴에서 기입)

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|

## [구현자 기입] 구현 체크리스트

- [ ] shared/ipc.ts 타입 확장
- [ ] claude-map.ts 추출/승격 + 테스트
- [ ] contextWindow.ts 헬퍼/폴백 + 테스트
- [ ] Composer/UsagePanel 치환
- [ ] mock 패리티
- [ ] 버전 핀 (package.json + lock)
- [ ] 문서 동기 (IPC_CONTRACT · provider-runtime)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | (기입) |
| 실행 명령 | (기입) |
| 게이트 결과 | (기입) |
| 블로커 / 역질문 | (기입) |
| 대상 커밋 | (기입) |
