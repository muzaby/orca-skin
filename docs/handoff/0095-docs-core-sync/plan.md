# Plan — 0095-docs-core-sync

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 비기능(문서) 작업 = Claude 직접 plan → impl → verify. 0094(arch 문서 동기화)의 후속편.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0095-docs-core-sync` |
| 작성자 | Claude Code |
| 일자 | 2026-07-11 |
| 매핑 | PHASES 미승격 예정 → verify 시 결정 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "`docs/` 경로에서 `docs/spec`·`docs/etc` 제외한 다른 문서들을 업데이트하라" | 라이브 세션 요청 (2026-07-11) |
| 추론 의도 | (추론) 0094 와 같은 의미의 "업데이트" = 코드 현실과의 동기화. `docs/handoff/**` 의 plan/verify 는 역사 기록이라 재작성 대상이 아니고(INDEX 는 절차상 갱신), `CLAUDE.md` stub 은 편집 금지, `ARCHITECTURE.md`·`arch/**` 는 0094 에서 직전 완료 — 잔여 = PRD·TRD·IPC_CONTRACT·GLOSSARY·PHASES·git-template·claude-code-spec·docs/AGENTS.md 잔여·guides 2종 | 루트 `@AGENTS.md` 규약 + 0094 범위 |

## Context (왜)

0094 가 아키텍처 문서를 동기화했지만, 제품 정의(PRD)·구현 사양(TRD)·SSOT(IPC_CONTRACT·GLOSSARY)·이력(PHASES)·협업 가이드(git-template)·해설 미러(claude-code-spec)·가이드(guides) 는 0077~0091 시점에 멈춰 있다. 특히 0094 파생 이슈 **D1**(IPC_CONTRACT §2.4 stale)이 사용자 결정 대기였는데, 본 요청이 IPC_CONTRACT 를 범위에 포함하므로 D1 을 여기서 해소한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `CHANNELS` 실측 = **64 채널·20 도메인**(notify 1 포함). IPC_CONTRACT §1 "18개"·§2 분포 라인(63 합계)이 notify(+boot) 누락 | `app/src/shared/ipc.ts:8-80` · `docs/IPC_CONTRACT.md:11,25` |
| IPC_CONTRACT §2.4: theme enum `classic\|dark\|cool`(실제 `white\|dark`)·`spendingLimitUsd`/`scheduler` 누락(15→17 키)·`SettingsPatch` shape 상이 | `app/src/shared/ipc.ts:758,777-811` · `protocol.ts:404-463` — 0094 파생 이슈 D1 |
| §2.13 `DebugMockState` 에 `wireLog` 4번째 필드 누락 | `app/src/shared/ipc.ts:161-167` · `protocol.ts:148-155` |
| §3 NormalizedEvent 19 variant·§4 ErrorCategory 8종은 정확(전수 대조) | `ipc.ts:369-513,263-271` · `infra/errors.ts:32-41` |
| TRD §6.7 settings "6 키·classic/dark/cool" — 실제 17 키·white/dark | `protocol.ts:404-439` |
| TRD §4 line 87 "6 키"·line 93 Playwright "확정"(미설치)·line 73/91/§9:555 OQ3 "미정"(0084~0089 확정)·§5 "11 채널/총 36" | `app/package.json`(playwright 부재·electron-updater ^6.8.9) |
| PRD §11: OQ1(react 19 출시로 해소)·OQ3(0084~0089 확정)·OQ8(Phase 3 세션 사이드바로 해소) 이 미정 잔존. PRD 관례 = ~~취소선~~+확정(OQ2 선례) | `docs/PRD.md` §11 · `docs/PHASES.md` 0084~0089 행 |
| PHASES: 0090(`119132f`)·0092(`2681732`)·0093(`e85c7d4`)·0094(`04aa676`) PASS 행 미승격. 0086 은 INDEX 에 "PHASES 승격" 문구 없는 dev 하네스 | `docs/handoff/INDEX.md` 말미 · `docs/PHASES.md` |
| git-template 말미 캐비앗: "세션 URL 은 Key: value 형식이 아니다" — 현행은 `Claude-Session:` **trailer 키** | `git log -1 --format=%B \| git interpret-trailers --parse` |
| claude-code-spec §11/§14.3: `--model`·`--effort` "❌ 미사용" — 실제 0010/0020 으로 per-turn 채택 | `docs/PHASES.md` 0010·0020 행 · `SendChatMessage.modelFamily/effort`(ipc.ts:616-648) |
| guides/workspace §3.2/§3.4: `~/.claude` write 차단 표기 — 0075 r2 에서 write 허용으로 교정됨 | `app/src/main/adapters/workspace-guard.ts` · PHASES 0075 행 |
| guides/release-operations.md 는 코드·CI 와 전수 일치(무수정) | `app/package.json` scripts · `.github/workflows/{ci,release}.yml` |
| GLOSSARY: Python Runtime/uv/buildPyEnv 3항은 제거된 서브시스템(0050 PR-B)·Project "mockup" 오기·NormalizedEvent `provider` 필드 주장(0016 에서 제거) | `docs/IPC_CONTRACT.md:247` · `ipc.ts:287,366-368,976-1001` |

## 인수 기준 (Acceptance Criteria)

1. `IPC_CONTRACT.md`: §2.4 Settings 블록 17 키·white/dark·`SettingsPatch` 실제 shape / §1 도메인 20개 / §2 분포 라인 notify 포함 합계 64 / §2.1 `chat:event` 라벨 `NormalizedEvent` / §2.13 `wireLog` / 헤더 날짜 갱신. (**D1 해소**)
2. `GLOSSARY.md`: Python Runtime·uv·buildPyEnv 정리, Project 구현 완료 반영, NormalizedEvent `provider` 주장 삭제 + §3 포인터화, Skill 스캔 루트·코드 ref 정정, Credential 부분 구현 반영, SessionRuntime/Backend/Delta ref 정정, Scheduler·사용량 한도 항목 신설.
3. `TRD.md`: §6.7 17 키 / §4 스택 표(17 키·white/dark·Zustand 완료·Playwright 미설치·electron-updater/diff 추가·OQ3 확정) / §5 채널 수 64 + `NormalizedEvent` 라벨 + 누락 도메인 포인터 / §2 F10 정정 + 신규 기능 F11+ 요약 / §9 scripts·CI/CD / §10 해소 anchor 표기 / §11 Playwright 정정.
4. `PRD.md`: §11 OQ1·OQ3·OQ8 해소 표기(관례 준수)·OQ9 부분 진전 주석 / §7.1 구현 완료 반영 / §7.3 NormalizedEvent / §8 완료분 표기 / §6.1 F10·§10 테마 2종 / §9 Engine·MCP·Projects ✅.
5. `PHASES.md`: 0090·0092·0093·0094 행 승격(형식 준수, hash = INDEX 와 일치) + "현재 상태" 문단 갱신. 0086 생략 판단 기록.
6. `git-template.md`: `Claude-Session:` trailer 캐비앗 정정 + 예시 푸터 갱신.
7. `claude-code-spec.md`: `--model`/`--effort` 채택 표기 정정, OQ9 관련 문구에 0022/0075 반영.
8. `guides/workspace-isolation-permissions.md`: `~/.claude` write 허용 정정 + §3.4 `screenBashCommand` 잔재 정리.
9. `docs/AGENTS.md`: IPC 행 분포에 notify 추가(합계 64 정합·도메인 수 정정), backend 행에 scheduler·자동 업데이트 반영.
10. 0094 `verify.md` 파생 이슈 D1 상태 open→**해결**(0095 로 마감) 표기 + INDEX 0094 비고 갱신.
11. 문서 인용 경로·수치가 코드와 일치(실존/실측 대조), `docs/spec/**`·`docs/etc/**`·`CLAUDE.md` stub·`guides/release-operations.md`·코드(`app/**`) 무변경.

## 범위 / 비범위

- **범위**: 위 9개 문서 + 핸드오프 산출물(0095 plan/verify·INDEX·0094 verify D1 마감).
- **비범위**: `docs/spec/**`·`docs/etc/**`(사용자 명시 제외), 과거 handoff plan/verify 재작성, 루트 `AGENTS.md`(Criteria-* 문구 이견은 보고만), 코드 변경, PRD/TRD 의 *설계 변경*(기확정 사실 전사만 — 미해소 OQ 는 그대로 둔다).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- Explore 감사 3건(TRD / IPC_CONTRACT+GLOSSARY / PRD·PHASES·기타) + 코드 실측이 근거. 신규 의존성: 없음.
- 전제: IPC_CONTRACT §6 변경 절차는 "코드↔문서 동시 갱신"을 요구하나 본 건은 코드가 진실이고 문서만 정정하는 doc-sync — 채널 추가/변경이 아니므로 코드 무변경이 절차 위반이 아니다.

## 설계

- 각 문서의 관례를 따른다: PRD OQ 는 ~~취소선~~+**확정**(OQ2 선례), PHASES 행은 3열 bold, IPC_CONTRACT 는 표 안 정정(§ 구조 보존), GLOSSARY 는 용어 표 행 단위 수정.
- 제거된 기능(Python Runtime)은 행 삭제 대신 "제거됨(0050 PR-B)" 1행으로 압축해 어휘 이력을 남긴다 — GLOSSARY 의 "사용 금지 어휘" 관례와 정합.
- TRD 신규 기능은 F11+ 로 최소 행만 추가(상세는 handoff/arch 문서 포인터) — TRD 비대화 방지.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

N/A (문서 전용). 단 SSOT 간 수치(64 채널·20 도메인·17 키)가 IPC_CONTRACT·TRD·docs/AGENTS.md 세 곳에서 일치해야 한다 — verify 에서 3중 대조.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| PRD 는 제품 의도 문서 — 사실 전사가 의도 변경으로 읽힐 여지 | 해소 표기만 하고 미해소 OQ(기본 권한 정책 등)는 그대로 둠. 의도 변경 없음 명시 |
| PHASES 행 신설 시 hash 오기 | INDEX PASS 행 hash 를 grep 으로 재확인 |
| TRD F11+ 추가가 §번호 앵커를 흔들 위험 | 기존 F1~F10 번호·절 구조 불변, 말미 추가만 |

- 되돌리기 어려운 결정: 없음.
- 단독 결정 금지 항목: 없음 (기확정 사실 전사만).

## 영향 받는 파일

- `docs/{IPC_CONTRACT,GLOSSARY,TRD,PRD,PHASES,git-template,claude-code-spec,AGENTS}.md`
- `docs/guides/workspace-isolation-permissions.md`
- `docs/handoff/0095-docs-core-sync/{plan,verify}.md` · `docs/handoff/INDEX.md` · `docs/handoff/0094-arch-docs-sync/verify.md`(D1 마감)

## 참고 문서

- `docs/handoff/0094-arch-docs-sync/verify.md` (D1 원 기록)
- `app/src/shared/{ipc,protocol}.ts` (수치 실측 원천)

## 게이트

- 코드 게이트 N/A (문서 전용). 대신: 수치 3중 대조(64/20/17) + 인용 경로 실존 + 위생 grep + PHASES hash 정합.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 요청 인용, handoff/stub 제외 해석은 추론 표기.
- [x] 자료조사 — 전 항목 코드/문서 레퍼런스.
- [x] 인수 기준 — 11개 번호, 검증 가능.
- [x] 의존 기술 — 신규 의존성 없음, IPC_CONTRACT §6 전제 명시.
- [x] 파생 UX — N/A + 3중 수치 정합 항목.
- [x] 리스크 — PRD 의도 오독·hash 오기·앵커 파손 완화책.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 감사 목록대로 수행. PRD 는 해소 표기만(의도 변경 0), IPC_CONTRACT 는 § 구조 보존.
- 이견 / 보정 2건:
  - **guides/workspace `~/.claude` write**: 코드(`workspace-guard.ts:25-27`)가 스스로 "가이드의 read-only 기본값에서 Orca 가 의도적으로 넓힌 **편차**"라고 문서화하고 있어, 가이드 표를 뒤집지 않고 **편차 노트**로 병기했다(일반 방법론 문서 성격 보존).
  - **PHASES 신규 행의 대상 커밋**: INDEX 기재 해시(`119132f` 등)는 본 클론에서 미해석 — 기존 행들(9805bc4·fb72b1e 등)도 동일하게 미해석임을 확인, **INDEX 기재 해시를 그대로 쓰는 기존 관례**(위생 노트 ① — 환경별 해시 편차)를 따랐다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | GLOSSARY §2 의 `capabilities/{claude-probe,revert-manager}.ts`·`extensions/{builder,types}.ts` 경로가 0062 재편 이전 — RevertManager seam 파일은 아예 제거되고 `RevertCapabilities` DTO 만 잔존 | ✅ 경로 현행화 + "설계 어휘 / seam 제거·DTO 잔존" 으로 정정 | `grep -rln RevertManager` = 주석 1건 · `adapters/descriptor.ts:21` |
| 2 | GLOSSARY §2 Frame/Screen 행이 PR #29 이전 디렉토리(`frame/`·`screens/registry.ts`) 잔존 (frontend terms.md 0094 정정과 동계열) | ✅ 함께 정정 | `ls app/src/renderer/src` |
| 3 | TRD §4 Python 런타임 행·PRD §9 Python 런타임 ✅ 행이 "채택/구현"으로 잔존 — 서브시스템은 0050 PR-B 에서 제거됨 | ✅ "제거됨" 으로 정정 (감사 범위 밖이었으나 GLOSSARY 정리와 동일 사실) | IPC_CONTRACT §2.11 주석 |
| 4 | 루트 `AGENTS.md` 커밋 프로토콜의 "`Criteria-*` = 구현 커밋(Codex)만" 이 git-template 의 일반화("구현 에이전트" — Claude 비기능 포함)와 불일치 | ⚠️ 보고만 — 루트 AGENTS.md 는 본 요청 범위 밖(`docs/` 한정) | git-template.md 필드 표 · 0092~0095 실커밋 |

## [구현자 기입] 구현 체크리스트

- [x] AC1 IPC_CONTRACT (D1)
- [x] AC2 GLOSSARY
- [x] AC3 TRD
- [x] AC4 PRD
- [x] AC5 PHASES (0090/0092/0093/0094 승격 + 0086 생략 판단 기록)
- [x] AC6~8 git-template·claude-code-spec·guides/workspace (release-operations 무수정)
- [x] AC9 docs/AGENTS.md
- [x] AC10 D1 마감 (verify 턴에서 0094/verify.md 갱신)
- [x] AC11 대조 검사 (분포 합계 64·17 키·잔존 stale grep 0·인용 경로 실존)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 9개 — `IPC_CONTRACT`·`GLOSSARY`·`TRD`·`PRD`·`PHASES`·`git-template`·`claude-code-spec`·`AGENTS`(docs)·`guides/workspace-isolation-permissions` (+165/-123) |
| 실행 명령 | 분포 합계 python 검산(=64)·`SettingsSchema` 17 키 실측·잔존 stale grep(classic/cool·11 채널·총 36 = 0)·인용 경로 `[ -e ]` 검사·위생 grep 0 |
| 게이트 결과 | N/A (문서 전용 — `app/**`·`docs/spec/**`·`docs/etc/**` 무변경) |
| 블로커 / 역질문 | 없음. 잠재 문제 #4(루트 AGENTS.md 문구)는 사용자 결정 대기 |
| 대상 커밋 | (구현 커밋 hash — 커밋 후 INDEX 기재) |
