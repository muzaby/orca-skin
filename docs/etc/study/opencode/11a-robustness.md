# 11a. 견고성 심화 (11장 보조자료)

[11-vision-and-modules.md](11-vision-and-modules.md) §C(견고성 / 비전 ③)의 보조자료.
"장기·자율 실행에서 흔히 무너지는 실패 모드를 코드에 미리 박아 막는다"는 설계를 네 갈래로
요약한다. 모든 항목에 코드 근거(`packages/opencode/src` 기준)를 단다.

## 요약: 실패 모드 → 전용 방어

| 실패 모드 | 방어 모듈 | 핵심 장치 |
|---|---|---|
| 컨텍스트 오버플로 | Compaction / Overflow | 20k 버퍼 + 요약(tail 보존·splitTurn) + 프루닝(40k 보호) |
| 무한 동일 툴콜 | Processor 둠루프 | 최근 3파트 동일 → `permission.ask` (사람에 위임) |
| 조기 종료(툴결과 미반환) | prompt.ts | `hasToolCalls` 로 종료 조건 보정 |
| 일시적 API 실패/레이트리밋 | retry.ts | 에러 분류 + `retry-after` 우선 백오프 |
| 취소·자원 누수 | Processor (Effect) | `onInterrupt` / `ensuring(cleanup)` / `Cause` 구분 |

## C-1. 3단 컨텍스트 관리

단순 truncate 가 아니라 **오버플로 감지 → 요약 압축 → 프루닝**.

- **오버플로 감지** (`session/overflow.ts:14-33`): `usable = model.limit.input − reserved`,
  `reserved` 는 항상 `COMPACTION_BUFFER(20,000)` 이상 확보 → 창을 끝까지 채우다 응답이
  잘리는 사고 방지. 누적 토큰 ≥ usable 이면 `isOverflow`. Processor 가
  `ctx.needsCompaction=true` 로 표시하고(`processor.ts:754,934`) 루프가 `"compact"` 로
  분기(`processor.ts:1030`).
- **요약 압축** (`compaction.ts:198` `select`): 오래된 본문은 요약, **최근 turn 은 원문 보존**.
  `tail_turns` 만큼 거꾸로 예산 안에 채우고, 경계 turn 은 `splitTurn` 으로 부분 보존(`:230`)
  → 작업 맥락이 요약 경계에서 끊기는 품질 저하 완화.
- **프루닝** (`compaction.ts:253` `prune`): 거대한 **툴 출력만** 선택적으로 비움. 뒤에서부터
  `PRUNE_PROTECT(40,000)` 토큰어치 툴콜은 보호, `skill` 툴은 항상 보호, 회수량이
  `PRUNE_MINIMUM(20,000)` 초과일 때만 실제 제거.

> 분업: 최근=원문 / 오래된 본문=요약 / 오래된 거대 툴출력=제거.

## C-2. 둠 루프 감지 (`processor.ts:522-545`)

같은 툴을 같은 인자로 반복 호출하는 무한 루프 차단.

```ts
const recentParts = parts.slice(-DOOM_LOOP_THRESHOLD)   // THRESHOLD = 3
if (recentParts.length === 3 && recentParts.every(p =>
      p.type === "tool" && p.tool === value.name &&
      JSON.stringify(p.state.input) === JSON.stringify(input))) {
  yield* permission.ask({ permission: "doom_loop", always: [value.name], ... })
}
```

자동 종료가 아니라 **사용자에게 개입 요청** → 견고성과 자율성의 균형. `always` 로 일괄
허용 UX 까지 제공.

## C-3. 종료 판정 보정 (`prompt.ts:1156-1168`)

프로바이더가 툴콜을 담고도 `finish:"stop"` 을 주는 흔한 버그 흡수. 종료 조건이
`finish==="stop"` 한 줄이 아니라 **"진짜 미처리 툴콜이 없는가"** 를 파트에서 확인.

```ts
const hasToolCalls = lastAssistantMsg?.parts.some(
  (part) => part.type === "tool"
    && !part.metadata?.providerExecuted        // 프로바이더 직접 실행 제외
    && !isOrphanedInterruptedTool(part),       // 인터럽트로 버려진 고아 제외
) ?? false
// finish 가 stop 이어도 hasToolCalls 면 break 하지 않음 → 툴 결과를 모델에 반환
```

자작 에이전트가 가장 자주 틀리는 부분(루프 조기 종료 → 툴 결과 미반환)을 정확히 막는다.

## C-4. 재시도 · 인터럽트 정책

에이전트 = "오래 도는 + 취소되는 + 실패하면 재시도하는" 워크로드. ad-hoc try/catch 가
아니라 Effect 스케줄/인터럽트로 일관 처리.

- **에러 분류** (`retry.ts:68-152` `retryable`): `ContextOverflowError` 는 재시도 X(압축이
  처리), 5xx 는 SDK 미표시여도 강제 재시도, 무료/Go 한도 초과는 업셀 액션으로 표면화,
  rate-limit/overloaded 는 재시도.
- **백오프** (`retry.ts:35-66` `delay`): `retry-after-ms` → `retry-after`(초/HTTP-date) →
  지수 백오프(`2s × 2^n`, 헤더 없으면 30s 캡). **서버가 알려준 대기 시간 최우선**.
- **적용** (`processor.ts:982-1027`): 스트림 전체에
  `Effect.retry(SessionRetry.policy(...))` 를 두르고, 재시도마다 `SessionEvent.Retried`/상태
  `"retry"`(attempt·next) 발행. `onInterrupt` 로 미완 assistant 를 `halt` 정리,
  `Cause.hasInterruptsOnly` 로 취소와 실제 에러 구분, `ensuring(cleanup())` 으로 자원
  누수·좀비 fiber 방지.

## 결론

견고성은 "기능별 패치"가 아니라 **실패 모드별 전용 방어 + Effect 토대**의 합이다. 각 방어가
스트림 파이프라인 한 곳에 선언적으로 합성돼 있어 **구조적 보장**으로 성립한다.

> 관련: [05-strengths.md](05-strengths.md) §5.2~5.7,
> [10-context-window-tracking.md](10-context-window-tracking.md)(임계 판정/트리거).
