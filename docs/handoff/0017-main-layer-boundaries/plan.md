# Plan — 0017-main-layer-boundaries

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). **구조 견고화 2/3** — 디자인 리뷰(스탭1·2)의 후속 구현.
> 스탭2 **문제 2 (main 레이어 경계 무강제)** 의 채택안 **"렌더러처럼 상위 참조 금지 규칙 + 모듈별 구현 가이드"** 를 구현한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0017-main-layer-boundaries` |
| 작성자 | Claude Code |
| 일자 | 2026-06-13 |
| 매핑 | PHASES "구조 견고화(main 경계)" 행 (디자인 리뷰 스탭3) |
| 상태 | READY (다음=Codex — 사용자 지시로 구현은 Codex) |
| 선행 | `0016` 머지 후 착수(단일 브랜치 순차). |

## Context (왜)

renderer 4-layer 는 `eslint-plugin-boundaries` 가 빌드 때 강제해 **위반 0건**(별도 탐색 검증: cross-feature import 0, 순환 0). 그런데 **`main` 프로세스(SDK·IPC·DB·보안이 다 모이는 곳)에는 경계 강제가 전혀 없다** — `app/eslint.config.mjs:50` 의 `boundaries` 블록이 `src/renderer/src/**` 한정.

- 0011 이 `config ↔ mcp` **순환 import**(`mcp/crypto.ts → config`)를 사람이 손으로 찾아 고쳤지만, 재발을 막는 장치가 없다.
- 어댑터가 설정 모듈에 의존(`adapters/claude-adapt.ts:22 → settings/provider-settings`), 오케스트레이터 `ipc/chat/send.ts` 가 5개 모듈 reach-in 등 — main 의존 그래프가 평면이고 방향이 정의돼 있지 않다.
- `settings/provider-settings.ts` 는 4책임(provider 열거 + 모델 해석 + env 유틸 + 캐시 서비스)의 **junk-drawer**(주석 "구 config/provider-key.ts 에서 이전", "구 adapters/claude-env.ts 에서 이전" 이 증거 — 스탭1 D2).

**비유**: renderer 도로엔 "역주행 단속 카메라"가 있어 사고 0건인데, main 도로엔 카메라가 없어 다들 알아서 잘 달리길 바라는 상태 — 이미 한 번 역주행 사고(순환 import)가 났고 사람이 치웠다.

**채택안**: renderer 처럼 **상위 계층 참조를 금지하는 규칙(하향 의존만)** 을 main 에도 만들고, **모듈별(레이어별) 구현 가이드** 를 문서로 둔다.

## 인수 기준 (Acceptance Criteria)

1. **main 레이어 정의 문서**: `app/src/main/AGENTS.md`(+ `@AGENTS.md` import 하는 `CLAUDE.md` stub) 신설. 레이어 DAG 와 허용 의존 방향(하향만, **상위 참조 금지**)·각 레이어 책임·소속 디렉토리 매핑을 표로 명시. 제안 레이어:
   - **L0 `shared`** (`shared/ipc.ts`·`protocol.ts`·`permission-mode.ts`) — 순수 타입/상수. 내부 의존 0.
   - **L1 domain/infra** (`db`·`config`·`settings`·`usage`·`cost`·`runtime`·`mcp`·`runtime-errors`·`runtime-events`·`capabilities`·`extensions`·`deploy`·`skills`·`ask`·`installer*`) — L0 만 의존.
   - **L2 adapters** (`adapters/**`) — L0·L1 의존. ipc 의존 금지.
   - **L3 ipc** (`ipc/**` = router·handlers·chat = 컴포지션 루트/오케스트레이션) — 하위 전부 의존. **누구도 ipc 를 의존하지 않는다.**
   (정확한 레이어 분류·예외는 verify 가 1:1 대조 — 현행 코드의 실제 의존을 반영해 조정 가능.)
2. **eslint boundaries 확장**: `eslint.config.mjs` 에 `src/main/**` 대상 boundaries 블록 추가(renderer 와 동형 — 이미 의존성에 있는 `eslint-plugin-boundaries` 재사용). `elements`(shared/domain/adapters/ipc) + `dependencies` default `disallow` + 하향 허용 규칙. **상위 참조는 error.**
3. **순환 import 가드**: `import/no-cycle` 규칙을 main(또는 전역)에 활성화 — `config↔mcp` 류 순환 재발을 빌드 에러로 차단(0011 회귀 가드). 기존 순환 0 확인.
4. **D2 분해**: `settings/provider-settings.ts` 의 4책임을 응집 모듈로 분리(예: `provider-registry.ts`[열거] · `model-resolve.ts`[모델 해석] · `env-merge.ts`[env 유틸] · `provider-settings.ts`[해석 서비스 + 계약 타입]). 기존 import 경로는 갱신 또는 배럴 re-export 로 **무회귀**. 테스트도 분할/이동.
5. **위반 0**: 신규 boundaries·no-cycle 가 기존 코드에서 위반 0 이 되도록 필요한 **최소 이동/정리** 를 동반한다(실제 상위 참조·순환이 발견되면 수정, 구조적 모호함은 verify 로 에스컬레이트). `npm run lint` error 0.
6. 게이트 통과 + 문서: 루트 `AGENTS.md` "디렉토리 한눈에" 표에 `app/src/main/AGENTS.md` 추가, `app/AGENTS.md` "모듈 레이아웃" 에서 main 레이어 가이드 링크.

## 범위 / 비범위

- **범위**: 인수 1~6. lint 설정 + main 레이어 가이드 문서 + provider-settings 모듈 분해 + 최소 위반 정리.
- **비범위**: `dependency-cruiser` 도입(스탭2 2-B 비채택), 패키지 물리 분리(2-C 비채택), 기능 변경 0, renderer 코드 변경 0(eslint.config 는 공용 — renderer 블록 불변), 대규모 재배치.

## 설계

- **renderer 미러**: renderer boundaries 블록(`eslint.config.mjs:49-93`)의 `elements`/`dependencies` 패턴을 그대로 main 에 적용 — 팀이 이미 아는 멘탈 모델·도구. `boundaries/include` 를 `src/main/**` 로 확장한 별도 config 객체 추가.
- **`import/no-cycle` 보강 이유**: boundaries 는 *레이어 방향* 만 본다 — 같은 레이어 내부 순환(0011 의 config↔mcp 는 둘 다 L1)은 못 잡는다. `eslint-plugin-import`(tseslint 경유 사용 가능)의 `import/no-cycle` 로 동일-레이어 순환까지 차단해 0011 버그 클래스를 근본 방지.
- **재사용**: `eslint-plugin-boundaries`(기존 devDep), `eslint-plugin-import`(존재 확인 후 사용; 없으면 사용자 승인 — §위험), 디렉토리별 `AGENTS.md`+`CLAUDE.md` stub 규약(루트 AGENTS.md 의 기존 패턴).
- **D2 분해 무회귀 전략**: `provider-settings.ts` 의 export 를 새 모듈로 옮기되, 외부 import 가 많으면 `provider-settings.ts` 를 배럴(re-export)로 남겨 호출처 변경을 0 으로. 0016/0018 과 파일 충돌 최소화(단일 브랜치 순차).

## 영향 받는 파일

- `app/eslint.config.mjs` — `src/main/**` boundaries 블록 + `import/no-cycle`
- `app/src/main/AGENTS.md` (신규) + `app/src/main/CLAUDE.md` (stub)
- `app/src/main/settings/` — `provider-settings.ts` 분해(+ 신규 모듈 + 테스트 이동)
- (위반 발견 시) 해당 main 모듈의 import 경로 최소 정리
- `AGENTS.md`(루트 표) · `app/AGENTS.md`(모듈 레이아웃 링크) · `docs/PHASES.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `app/eslint.config.mjs:47-93` (renderer boundaries 원형) · `app/AGENTS.md`("모듈 레이아웃")
- 루트 `AGENTS.md`("AGENTS.md / CLAUDE.md 규약" · "디렉토리 한눈에")
- 스탭1·2 진단(A1·D2)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- **핵심 게이트**: `npm run lint` 가 신규 boundaries·no-cycle 로 **error 0**. 회귀 기준선 유지(테스트 수는 D2 분해로 파일 재배치되나 합계 무회귀).

## 위험

| 위험 | 완화 |
|---|---|
| 레이어 정의가 기존 위반을 노출 → 스코프 확대 | 인수 1 의 레이어는 *현행 의존 반영* 으로 조정 가능. 진짜 상위 참조만 고치고, 모호하면 verify 에스컬레이트(단독 결정 금지) |
| `import/no-cycle` 이 기존 순환 다수 검출 | 그게 목적(0011 클래스). 검출 시 최소 분해로 해소; 과다하면 라운드 분할 |
| `eslint-plugin-import` 미설치 | 설치 시 신규 의존성 — 사용자 승인 필요(TRD §2 밖). 대안: boundaries 만으로 1차 + no-cycle 후속 |
| D2 분해가 0016/0018 과 파일 충돌 | 단일 브랜치 순차 진행(선행=0016). 배럴 re-export 로 표면 변경 최소화 |

---

## [Codex 기입] 구현 체크리스트

- [ ] 인수 1 (main/AGENTS.md 레이어 가이드)
- [ ] 인수 2 (boundaries main 블록)
- [ ] 인수 3 (import/no-cycle)
- [ ] 인수 4 (provider-settings 분해)
- [ ] 인수 5~6 (위반 0 · 게이트 · 문서)

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` / `build` |
| 게이트 결과 | lint ☐ / typecheck ☐ / test ☐ (N passed) / build ☐ |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |
