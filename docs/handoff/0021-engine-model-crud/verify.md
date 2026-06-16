# Verify — 0021-engine-model-crud

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 문서는 0021 엔진&모델 CRUD 구현(Codex)의 검증.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0021-engine-model-crud` |
| 검증자 | Claude Code |
| 일자 | 2026-06-16 |
| 대상 커밋 | `91be400`(+ `e820163` 보강) — 실제 브랜치 hash. INDEX 기재 `50b8dce` 는 Codex 환경 hash(위생 노트 ①) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 엔진 추가 모달 — 활성화 + 블러/딤 배경 | ✅ | `features/engine/components/EngineFormModal.tsx:77` (`fixed inset-0 z-50 … bg-black/40 … backdrop-blur-sm`). providerCatalog 기반 3단계 마법사로 확장(AC2 요건 보존). |
| 2 | 모달 입력 — claude-code only 드롭다운 · provider trim 검증 · settings textarea + JSON 검증 | ✅ | `lib/providerCatalog.ts:16-21`(claude-code `enabled`, opencode `enabled:false`); `EngineFormModal.tsx:65`(`provider.trim()`)·`:125`(nameError)·`:146` `disabled={!canSubmit}`; `:348` monospace textarea + `:66` `JSON.parse` try/catch 인라인 에러. |
| 3 | 즉시 생성(write IPC) — 원자적 settings.json + 중복/빈값 거부 | ✅ | `ipc/handlers/engine.ts:32` `engineAdd`; `settings/engine-write.ts:179-205` `writeProviderSettings`/`addProviderSettings`(`writeJsonAtomic` + `existsSync` 중복 거부); `normalizeProvider`(:43) 빈값/문자 위반 거부. |
| 4 | 모델 추출 → meta.json (+ 폴백) + 단위 테스트 | ✅ | `engine-write.ts:136` `extractModels`(env `ANTHROPIC_DEFAULT_{SONNET,HAIKU,OPUS}_MODEL`→family·`ANTHROPIC_MODEL`/`model`→default·`1m`→`family·1m`)·`:164` `updateMeta`; 인식 0개 → `[]`(SDK 폴백). 테스트 `engine-write.test.ts`(1m 변형·top-level·빈 폴백·CRUD 라이프사이클). |
| 5 | 카드 부분 리렌더(구조 분해) | ✅ | `components/{AgentEnvironmentView,EngineCard,EngineModelList}.tsx` 분해 + `hooks/useEngines.ts:32` mutation 후 `refreshAgents()`(뷰 전체 리마운트 없음). |
| 6 | Composer 싱크 (공유 store) | ✅ | `shared/stores/agentStore.ts` + `shared/hooks/useAgents.ts:3`(셀렉터 유지·Composer 호출부 무변경); `useEngines` 의 `refreshAgents()` 가 카드+ModelMenu 동시 갱신. |
| 7 | 편집(프리필)/삭제(디렉토리 제거) | ✅ | `engine.ts:49` `engineRead`→`readProviderSettings`(:217 raw settings.json); `engineDelete`→`deleteProviderSettings`(:231 `rmSync(dir,{recursive})` + meta 엔트리 제거). |
| 8 | 모델 표시 디자인 (실모델명 primary) | ✅ | `EngineModelList.tsx:21`(모델명 `font-mono text-[12.5px] font-semibold text-ink`)·`:18`(family 태그 `text-[10px] uppercase`)·`:25`(default `bg-rust-soft text-rust ✓ default`). |
| 9 | 계약·게이트 — IPC_CONTRACT 갱신 + 4종 | ✅ | `docs/IPC_CONTRACT.md`: §2 총 40채널·engine 도메인 4채널 신설(`:23`,`:25`,`:55-58`). 게이트 아래 ✅. |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 통과(390/390) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 충족 |
| 레이어 경계 위반 0 | ✅ | — | lint 통과(agentStore=shared, engine=feature 경계 준수) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT 동기화 확인 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0(package.json 무변경) |
| 제품 의도 부합 | ✖ 보조 | ✅ | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | **사람 확인 대기** (모달 3단 마법사·블러 배경·카드 모델 row 시각) |
| 실환경 동작 | ✖ | ✅ | **사람 확인 대기** (provider 추가→Composer 모델 메뉴 즉시 반영·deploy 재배포 후 런타임 적용·bedrock provider) |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint        # PASS (eslint boundaries 포함, 위반 0)
$ cd app && npm run typecheck   # PASS (node + web + test)
$ cd app && npm rebuild better-sqlite3 && npm test
  Test Files  53 passed (53)
       Tests  390 passed (390)
$ cd app && npm run build       # PASS (electron-vite build)
```

> better-sqlite3 는 설치 시 Electron ABI 로 빌드되므로 vitest(Node ABI) 실행 전 `npm rebuild` 필요 — 0019(`pretest` self-ABI) 미구현 상태의 기존 운영 절차. 변경과 무관.

## 위생 검토

- `docs/AGENTS.md` 의 IPC_CONTRACT 인벤토리가 "총 36 채널" 로 정체 → 0021 의 engine 4채널 반영해 **"총 40 채널 … engine 4 …" 로 갱신**(본 검증 라운드에서 정정). SSOT 인 `IPC_CONTRACT.md` 는 0021 구현 시 이미 40 으로 갱신됨.
- AGENTS.md 키/토큰/이메일/IP 스캔: 해당 없음(코드 변경은 Codex `app/**`, 본 라운드 문서 변경엔 비밀 혼입 0).

## PHASES.md 정합성

- 페이즈 표에 "엔진&모델 페이지 CRUD (handoff `0021`)" 행 승격(커밋 `91be400`). 형식 정합.

## 결론 / 다음 단계

- **상태: PASS** — 인수 9/9 충족, 게이트 4종 통과(390/390), 레이어 경계 0, 신규 의존성 0.
- INDEX `verify/PASS` → PHASES 승격. 사람 확인 대기: UI 시각 검증 · 실환경 provider 추가/싱크/bedrock.
