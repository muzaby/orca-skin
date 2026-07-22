# Verify — 0144-debug-log-config

## 메타

| 항목 | 값 |
|---|---|
| slug | `0144-debug-log-config` |
| 검증자 | Claude Code |
| 일자 | 2026-07-22 |
| 대상 커밋 | `d531c56` |
| 라운드 | 1 |
| 상태 | PASS* (기계 충족 / 사람 실기 대기) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 부팅 순서 확인(orca-config 274 < registerMiscHandlers 490) | 타당 — 코드 라인으로 확인(`bootstrap.ts:274,490`) | 캐시 히트라 `getOrcaConfig()` dir/throw 없음. AC3/AC4 근거로 채택 |
| 도구 I/O(args/result) 유지 = 요구 범위 밖 | 타당 — 사용자 "메시지 본문만" 결정과 일치 | 후속 판단 여지로 observability §5 에 기록(파생 이슈 아님) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | orca.json `debug:true` 파싱 | ✅ | `orca-file.ts:68`(`debug: z.boolean().optional()`)·`:83`(조립) + `orca-file.test.ts` "debug 스위치(0144)를 파싱한다"/"불린 아니면 위반" green |
| 2 | prod `setDebugEnabled(true)`→debug 기록, off→info, dev 항상 debug | ✅ | `log-manager.ts:78-82`(`setDebugEnabled` minRank 재계산) + `log-manager.test.ts` "setDebugEnabled(true) 면 prod 도…"/"dev 는 항상 debug" green |
| 3 | 부팅 config→`setLogDebug` | ✅ | `bootstrap.ts:275-279`(`loadOrcaConfig()`→`setLogDebug(cfg.debug===true)`)·`infra/log/index.ts`(`setLogDebug` export) |
| 4 | prod wire 본문 제거(메타 유지) | ✅ | `wire-log.ts`(`stripMessageContent` 내용 키 `text`·`message`·`attachmentViews`·`delta` 제거)·`misc.ts:336-345`(prod sink) + `wire-log.test.ts` 4 케이스 green |
| 5 | 델타 2종 전 경로 미기록 | ✅ | `wire-log.ts:11`(`EXCLUDED_WIRE_LABELS`, 무변경) — prod sink 도 `wireLog` 경유라 진입 전 제외. `wire-log.test.ts` "excludes streaming delta events" green |
| 6 | DEV 무회귀(풀 payload + 콘솔 미러) | ✅(기계)/실기 대기 | `misc.ts:319-335` DEV 블록 payload sink·패널 토글 무변경 — 시각 실기는 사람 |
| 7 | 게이트·경계·의존성·IPC | ✅ | lint 0 error·typecheck 0·vitest 91/91·레이어 경계 0(app→infra 하향)·신규 의존성 0·IPC 채널 불변 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0e/typecheck 0/vitest 91 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 7/7 기계 충족 |
| 레이어 경계 위반 0 | ✅ | — | app→infra·infra→shared 하향, 위반 0 |
| 문서 형식/링크/한국어 | ✅ | — | observability.md 갱신·한국어 컨벤션 유지 |
| prod 실기(JSONL debug·wire 본문없음·델타없음) | ✖ | ✅ | 사람/CI 실기 대기 |
| DEV 무회귀 시각(패널 스위치→풀 payload) | ✖ | ✅ | 사람 실기 대기 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ npm run lint            → 0 error (1 warning: TanStack Virtual, 변경 무관 baseline)
$ npm run typecheck       → node/web/test 3분할 0 error
$ vitest run infra/log infra/ipc infra/config → Test Files 11 passed, Tests 91 passed
  (신규: orca-file debug 2 · log-manager setDebugEnabled 2 · wire-log stripMessageContent 4)
```

> DB/electron 로드 스위트는 egress 차단 ABI 제약으로 비실행 — 변경과 무관(app/AGENTS.md 제약환경 가이드). 최종 판정은 CI(windows)·사람 실기 몫.

## 위생 검토

- observability.md 변경 — 키/토큰/이메일/IP 패턴 없음. 결정 사항(0144)·표 위주 유지.

## PHASES.md 정합성

- 0123/0124 로깅 시스템 후속으로 PHASES 표 승격(형식/커밋 기재).

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계: prod wire 노출이 관측성 문서의 "wire=dev 전용" 결정을 개정 — 사용자 확정 후 진행해 리스크 해소. 도구 I/O 잔존은 명시적 범위 밖으로 분리(후속 여지 기록).
- 구현: 부팅 순서 의존을 라인으로 확인해 캐시 히트 보장. 레벨(bootstrap)·wire(misc) 배선 지점 분리가 다소 흩어짐 — 각각 소유 도메인(레벨=로그, wire=ipc)에 맞춰 의도적.
- 검증: prod 실파일/DEV 무회귀 시각은 electron 실기 필요라 기계 검증 불가 — 사람/CI 로 명시 이관.

## 결론 / 다음 단계

- 상태 **PASS\*** — 인수 7/7 기계 충족, 게이트 green. **사람 실기 대기**: prod 빌드 + orca.json `debug:true` → application.jsonl 에 debug 레코드·`ipc.wire.event` 본문 없음·델타 없음 확인 / `debug` off → info 만(무회귀) / DEV 패널 스위치 풀 payload 무회귀 / PR 머지.
