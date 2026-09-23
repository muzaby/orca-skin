# r1 — 결과 identity 비교 누락 재현

판정: **PLAN_GAP PG-01**. V1 rev.2 §10 EP-01은 `resultMap`까지 열거하지만, 이후 `reconcileSegments → resultEquals`가 결과 메타데이터의 변경을 버리는 경계는 포함하지 않는다.

## 코드 근거

| 경계 | 관측 |
|---|---|
| `app/src/renderer/src/features/chat/lib/parts.ts:565-568` | `resultEquals`는 `output`, `isError`, `durationMs`만 비교한다. |
| 같은 파일 `:599-612` | `toolCallEquals`가 참이면 새 call 대신 이전 call을 그대로 반환한다. |
| `components/transcript/AssistantMessage.tsx:40` | `messageSegments(message.parts)`의 출력을 `reconcileSegments`로 통과시킨다. |
| `lib/workActivity.ts:59` | 작업 활동 투영도 같은 reconciliation 함수를 사용한다. |

검색 명령: `git grep -n 'reconcileSegments' -- app/src/renderer/src`. 이 재현은 shared 타입·producer·`resultMap`을 구현하기 전에, plan이 운반하기로 한 결과 형상을 실제 reconciliation 함수에 직접 전달한다. SDK 수신부터 DOM까지의 종단 검증으로 주장하지 않는다.

## 재현

저장소 루트 PowerShell에서 실행한다. 임시 대상이 이미 있으면 덮어쓰지 않는다.

```powershell
$probePath = 'app/src/renderer/src/features/chat/lib/parts.handoff0239-probe.test.ts'
if (Test-Path -LiteralPath $probePath) { throw 'probe path already exists' }
Copy-Item -LiteralPath 'docs/handoff/0239-foreground-cancel-settlement/evidence/r1-reconcile-gap.test.ts.txt' -Destination $probePath
Push-Location app
try {
  npx.cmd vitest run src/renderer/src/features/chat/lib/parts.handoff0239-probe.test.ts src/renderer/src/features/chat/lib/parts.reconcile.test.ts --reporter=verbose
} finally {
  Pop-Location
  Remove-Item -LiteralPath $probePath
}
```

## 관측 — 2026-09-23, Vitest 4.1.10

| 사례 | 기대 | 실제 | 결과 |
|---|---|---|---|
| 기존 결과에 `nonExecution` 추가 | `user-rejected` 보존 | 필드 없음 | 실패 |
| 같은 id·본문에서 사유 변경 | `cancelled` | `user-rejected` 유지 | 실패 |
| 최신 결과에서 사유 제거 | 필드 없음 | `cancelled` 유지 | 실패 |
| 대조군: 본문도 변경 | 새 본문·새 사유 | 새 값 전달 | 통과 |
| 대조군: 값 동일 | 이전 배열 identity | 이전 배열 반환 | 통과 |
| 기존 `parts.reconcile.test.ts` | 기존 identity 보존 규칙 | 4케이스 통과 | 통과 |

실행 출력 요약: `Test Files 1 failed | 1 passed (2)` · `Tests 3 failed | 6 passed (9)` · exit 1. 환경 오류가 아니라 기대값과 실제 결과의 차이로 실패했다. 프로덕션 파일에 변이를 심지 않았고, 임시 테스트는 실행 후 이 evidence로 이동했다.

## 설계자에게 넘길 정정

- V1 rev.2를 보존하고 Delta V에 결과 reconciliation 경계를 추가한다. EP-01 및 VP-01·02·10의 표시 경로가 최소 검토 대상이며, `AssistantMessage`와 `workActivity` 소비 경로를 각각 연결한다.
- 최신 결과에서 `nonExecution`의 추가·교체·제거를 반영하는 직접 oracle과, 값이 같은 형제 카드의 identity 보존 회귀를 지정한다. 결과 본문·오류 플래그·duration이 같을 때도 단언해야 한다.
- AC5(last-wins)·AC8(라이브/재로드 동치)의 증거가 `resultMap`에서 끝나지 않도록 최종 소비자까지 연결한다. 이 보고는 기존 AC나 사용자 결정을 변경하지 않는다.
