# Verify — 0288-cross-harness-mcp

## 메타

| 항목 | 값 |
|---|---|
| slug | `0288-cross-harness-mcp` |
| 검증자 | Claude Code |
| 일자 | 2026-10-29 |
| 대상 커밋/range | `f745cc7..0466f5c` (r1 `e537efc`, r1.2 `0466f5c`). 판정은 HEAD `81153e2` 위에서 수행 |
| 구현 전 plan 기준 | V1 `f745cc7` |
| V mode / 유효 V | Baseline V1. 후행 0289 V1+ΔV1이 일부 계약을 대체(아래 §0) |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — AC17(H1 사내 서비스·시각) 사람 실기 대기 |
| 자기 검증 여부 | 아니오 — 구현 codex |

## 0. 기준선 / 후행 정본

- 구현 커밋의 `plan.md` 변경은 메타·`[구현자 기입]`뿐이다(`git show e537efc|0466f5c -- plan.md`의 `-` 줄이 자리표시자·메타·이전 자기보고 행).
- 사용자 지시에 따라 **높은 번호(0289)가 정본**이다. 0288 계약 중 0289가 바꾼 것은 0289 기준으로 채점했다.

| 0288 계약 | 0289 대체 | 채점 |
|---|---|---|
| D-006 다음 턴 적용 | OpenCode 연결 선택은 live 적용(0289 D07·D28), 정의·auth·Claude는 다음 턴 유지 | 0289 VP03·VP08·VP11 PASS로 닫음 |
| AC2 disabled 제외 | OpenCode config에 안정된 비활성 정의 투영(0289 D09), 실행·후보 제외는 유지 | 0289 VP11·M11-K9로 닫음 |
| E7j `mcp-control.ts` | 0289 ΔV1에서 전면 재작성 | 0289 K4~K10 고장 이력으로 닫음 |
| 파생 D1 취소 오류 | 0289 AC1~2 | **0289에서 해결** — 0289 VP01 PASS |

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode / NEW ↔ REQUIRED | 유효 | 14 node·VP-01~14 전부 REQUIRED |
| §10 자리 목록 | 유효 | 67자리(E1~E7) 고정, Q1~Q5 검색 명령 기록 |
| 적대 증거 | 유효 | M1a~c·M2a~b·M3a~b 7개, 자리 명시 |

## 1. 구현 비판적 검토 / 역방향 탐색

| 질문 | 판정 | 근거 |
|---|---|---|
| credential 노출 | 없음 | bridge 토큰은 메모리, OpenCode에는 사용자 MCP 실행 값만(D-004). `mcp/bridge.ts:143` 매 요청 `authorized(id)` |
| 철회 후 호출 | 차단 | `bridge.ts:167` 도구 호출 시 재검사, M3b red |
| 늦은 관측 부활 | 없음 | revision·owner generation 폐기, M2a·B9·B10 red |
| 후행 변경과 충돌 | 없음 | 0289가 `bootstrap.ts:1090`에서 `kind !== 'connections'`일 때만 invalidate — B9·B10 변이가 그 분기 안에서 red |

## 2. 고장 이력 (HEAD `81153e2`에 재적용)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|---|---|
| M1a | `runtime-entry.ts:88` | 빈 값 | managedMcpRevision → undefined | 잡음 3/3 | `managed-mcp-revision` |
| M1b | `chat-turn-continuation.ts:83` | 빈 값 | 연속 턴 revision → undefined | 잡음 1/3 | 같음 |
| M1c | `session-runtime.ts:520` | 고정값 | spawn 기록 0 | 잡음 3/3 | 같음 |
| M2a | `opencode/v1/managed-mcp.ts:110` | 맞바꿈 | builtin↔user | 잡음 1/1 | preserves source identity through prepared and live views |
| M2b | `AttachMenu.tsx:74` | 다른 값 | Orca 슬롯에 native 항목 | 잡음 2/15 | shows all source groups directly for claude/opencode |
| M3a | `opencode/v1/adapter.ts` client | 제거 | bridge acquire | 잡음 2/2 | `managed-mcp-lifecycle` |
| M3b | `mcp/bridge.ts:167` | 제거 | 호출 시 권한 재검사 | 잡음 1/1 | serves only authorized application tools |
| B1~B10 | `bootstrap.ts` 배선 9자리 | 제거·빈 값·다른 값 | binding 빈 배열·source getter·acquire users·builder 주입·refresh 2·revision 0·close·invalidate 2 | 잡음 각 1/1 | wires the live MCP source into bootstrap consumers … |
| C1 | `ComposerInputController.tsx:482` | 맞바꿈 | managed capability → skill capability | 잡음 2/9 | `composerAttachMenu` |
| CI1/CI2 | `NewChatLandingPage.tsx:58` | 제거 / 맞바꿈 | 플러그인 callback 제거·usage callback 교환 | 잡음 1/6 각각 | 플러그인 관리 배선 (AC3 · W1) |
| CI3 | `project-resource-sync.ts:186` | 호출 대체 | watcher 읽기를 큐 밖 실행 | 잡음 1/10 | holds watcher broadcasts behind an in-flight project mutation |

- 검산: 시도 21(B는 B1~B10 중 B1·B2·B3·B4·B5·B6·B7·B8·B9·B10 10건) = 잡음 21 · 못 잡음 0 · 동치 0. 미시도: B11(prepared scope 오주입), D1(compile 음성 대조) — 시도하지 않은 고장은 결함 아님.
- 덮개 회귀: 이전 verify 없음. 구현 보고의 red 22건 중 위 21건이 HEAD에서도 red.

## 3. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| VP-12·13·14 (UT) | PASS | `managed-source`·`bridge.integration`·`composerAttachMenu` green, M3b·C1 red |
| VP-09·10·11 (IT) | PASS | `bootstrap.managed-mcp-wiring`·`managed-mcp-resources`·`managed-mcp-claude-regression` green(electron 설치 후), B1~B10·M2a red |
| VP-06·07·08 (ST) | PASS | `managed-mcp-lifecycle`·`managed-mcp-revision` green, M1·M3a red |
| VP-01·03·04·05 (AT) | PASS | 위 좌표 + 0289가 대체한 축은 0289 PASS |
| VP-02 (AT) | PASS(기계) / H1 대기 | AC17 사내 서비스·white/dark 시각 미실기 |

- AC 합계 재측정: ✅ 16 · ⚠️ 1(AC17) · ❌ 0 = 17. trailer `Criteria-Met: 16/17` 일치.
- §10 분모 67: 구현 evidence의 자리별 좌표를 출발점으로, 변이 21자리를 재측정. E7j는 0289 재작성으로 0289 분모에 편입.

## 4. 게이트

공통 게이트는 [0289 verify §6](../0289-opencode-runtime-retention/verify.md)과 같은 HEAD 실행이다 — typecheck·lint(0 error)·doc inventory PASS, Linux 전용 21 fail은 플랫폼 기준선, Windows CI run 40834862690 success. trailer 3커밋 파싱 정상.

## 5. 파생 이슈

| # | 이슈 | 분류 |
|---|---|---|
| D1 | 준비 중 관측 종료 오류 | closed — 0289에서 해결 |
| V1 | AC17 사내 서비스·시각 인수 | 사람 실기 |

## Review Signals

- 첫 verify. 독립 verify 전에 후행 handoff(0289)가 같은 표면을 재작성했다 — 채점 기준을 0289로 옮긴 행은 §0 표.
- r1.2 `0466f5c`의 watcher inline 재배치(CI3 red로 잠김)가 선행 0284의 `emit` 정의 변이 M2 좌표를 비웠다 — [0284 verify](../0284-native-toggle-self-write/verify.md) D1(BLOCKING, 0284 귀속). 0288 계약 위반은 아니다.
