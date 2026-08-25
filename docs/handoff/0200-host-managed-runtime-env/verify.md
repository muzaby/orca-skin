# Verify — 0200-host-managed-runtime-env

## 메타

| 항목 | 값 |
|---|---|
| slug | `0200-host-managed-runtime-env` |
| 검증자 | Claude Code |
| 일자 | 2026-08-25 |
| 대상 커밋/range | `ec7d17a..62f87ed` |
| 구현 전 plan 기준 | `ec7d17a` |
| 라운드 | 1 |
| 상태 | PASS |
| 자기 검증 여부 | 예 — 사용자 요청으로 한 턴에 plan·impl·verify 수행; 구현 보고를 증거로 쓰지 않고 diff·게이트·별도 변이를 재측정 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 구현자 기입 영역만 변경했다.
- 기준선이 diff로 성립하는가: 예, 설계 `ec7d17a`와 구현 `62f87ed`가 분리됐다.
- Decision Ledger/Product/UX/AC 변경: 없음.
- 채점 기준: `ec7d17a:docs/handoff/0200-host-managed-runtime-env/plan.md`의 D-001~D-004와 AC1~AC6.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·D-004 | host-managed 활성 시 settings env 전체가 spawn env로 이동 | settings → prepare → TurnRequest → adaptEnv → query |
| D-002 | runtimeEnv의 URL·token·model·flag가 같은 규칙의 최상위 | runtime augmenter → config.runtimeEnv → prepare → query |
| D-003 | runtime > settings > app > process | 네 producer → spread → PreparedHarnessConfig.env |

```text
네 환경 producer
  → prepareHarnessConfig의 최종 flag/병합/hoist/fingerprint
  → ClaudeAdapter options.env/options.settings
  → SDK query가 Claude Code 자식 프로세스 생성
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 닫힘 | settings/process에서만 flag가 켜지는 두 기존 누락 경로를 테스트가 재현한다. |
| false success 가능성 | 낮음 | 최종 env 값과 settings env 제거를 함께 단언한다. |
| partial failure/rollback | 해당 없음 | 순수 동기 조립이며 저장소 쓰기 없음. |
| 다른 B 구현 | 없음 | adapter 전역 env 변경 대신 실제 SDK spawn env를 조립한다. |
| 증상만 제거 | 없음 | fingerprint도 같은 final env를 계속 사용한다. |
| snapshot 부수효과 | 보존 | baseEnv는 한 번만 읽고 판정·조립에 재사용한다. |
| worst-case 상한 | 변화 없음 | 네트워크·출력·추가 query 0. |

## 3. 역방향 탐색

`scan-surface.sh ec7d17a..62f87ed`는 값 export 미사용·테스트 전용 참조·형제 정책 비대칭을 각각 0건 보고했다. `PrepareHarnessConfigInput` 타입 후보는 같은 파일의 exported 함수 signature가 소비하므로 정상이다.

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export | 정상 | 값 export 후보 0; 입력 타입은 공개 함수 시그니처다. |
| 테스트 전용 참조 | 정상 | 0건. |
| 형제 정책 비대칭 | 정상 | 0건. |
| producer↔consumer | 일치 | prepared env/settings를 두 query 경로가 그대로 소비한다. |
| 중복 규칙 | SSOT 유지 | flag 판정은 `harness-config.ts` 한 곳이다. |

## 4. 기존 테스트 / semantic 검증 확인

- 기존 static fast-path·전체 hoist·fingerprint 테스트가 실제 존재하고 관련 파일 전체 36건이 실행됐다.
- 핵심 입력은 settings-only, process-only flag, runtime 네 변수 충돌, 상위 `0`, 비공식 `true`다.
- structural proxy만으로 통과한 AC: 없음.
- 구현자 잠금과 별도로 검증자가 `=== '1'`을 `!== '1'`로 반전했다. 관련 포함 6건이 실패해 판정 방향과 비활성 fast path를 함께 검출했다.
- N회 기준: baseEnv 호출은 process flag 판정 케이스에서 1회로 관측했다.

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | settings-only host-managed 전체 hoist | ✅ | URL·token·model·기타 env와 settings 제거 단언 | settings→prepare→query |
| AC2 | runtimeEnv provider 값 최상위 | ✅ | 네 레이어 충돌에서 runtime 4변수 단언 | augmenter→prepare→query |
| AC3 | process flag 활성 | ✅ | baseEnv flag=`1`, settings URL hoist, read 1회 | process→prepare→query |
| AC4 | flag 우선순위와 상위 `0` | ✅ | runtime `0`이 settings/app/process `1`을 덮음 | 네 producer→prepare |
| AC5 | 비활성 static fast path | ✅ | `true`에서 env undefined·settings reference 동일 | settings→prepare |
| AC6 | fingerprint·정적 gate | ✅ | 관련 fingerprint suite 포함 36/36, lint/typecheck green | prepared→respawn |

- 합계 재측정: ✅ 6 · ⚠️ 0 · ❌ 0 = 총 6. 자기보고 6/6과 일치한다.
- 합계 사본: verify 6/6 ↔ 구현 trailer 6/6 ↔ archive 비고 6/6 일치.

### plan §10 강제 지점

| 계약/필드 | plan 지점 | 코드 확인 | 결과 |
|---|---|---|---|
| host-managed 활성값 | 네 레이어 | runtime/settings/app/process 우선 `??`, base lazy 판정 | ✅ 4/4 |
| env 우선순위 | 네 spread | base→app→settings→runtime | ✅ 4/4 |
| 전체 hoist | buildsEnv | host-managed 포함 buildsEnv와 기존 helper | ✅ 2/2 |
| runtimeEnv 전달 | 최종 spread | URL·token·model·flag | ✅ 4/4 |
| fingerprint | final env | 조립 뒤 동일 env digest | ✅ 1/1 |

- 강제 지점 합계: 15/15. 표 밖 같은 불변식 지점 없음.

## 6. 외부 포트 / 문서 계약

- 공개 shape 변경 없음. `runtimeEnv: Record<string,string>`의 기존 의미와 current-state `auth.md`가 구현과 일치한다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- production prepare 경로 2곳(resolved 직접·unresolved helper), Claude query 2곳(complete·send)을 다시 확인했다.
- 신규 요청·로그·저장·의존성·IPC·DB·UI는 0이다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| spawn 입력 조립 | pure seam으로 네 레이어·settings 제거·fingerprint 검증 | 없음 | — |

## 9. 게이트 재실행

- `cd app && ./node_modules/.bin/vitest run src/main/adapters/harness-config.test.ts`: 1파일 36/36 pass.
- `cd app && npm run lint`: 0 error, 기존 renderer warning 1.
- `cd app && npm run typecheck`: node/web/test 3/3 pass.
- `git diff --check`: pass.
- 게이트가 작업 트리를 바꾼 내용과 잔여물: 없음.

## 10. 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/test | 재실행 | — | PASS |
| AC↔production path | 1:1 대조 | — | PASS |
| 문서/레이어 | diff·scan | — | PASS |
| 제품 결정 | 사용자 요구 승계 | 결정 완료 | PASS |
| UI/의존성/PR | UI·신규 의존성 없음 | PR merge | 대기 |

## 11. Repository operation checks

- AGENTS 변경 없음; 위생/stub 검사 해당 없음.
- INDEX의 완료 행은 archive로 이동했고 다음 주체는 `—` 하나다.
- 대상 커밋 `ec7d17a`, `62f87ed`는 `git cat-file -t`에서 모두 commit이다.
- 구현 trailer는 `Agent/Handoff/Status/Criteria-Met/Verified-By` 전부 파싱됐다.
- 구현자 기입 필드는 설계 리뷰·강제 지점·잠금·Product/UX·잠재 문제·구현 보고·Review Signals 전부 존재한다.

## 12. 구현자 코멘트 / 선조치 경계

| 코멘트 | 판단 | 반영 |
|---|---|---|
| base snapshot 1회 | 타당 | process 판정과 spawn env의 TOCTOU 축을 제거한다. |
| 정확히 `1` | 타당 | `true` 오활성화를 테스트로 막았다. |

## 13. 파생 이슈

- 없음.

## 14. Review Signals

- 이전 라운드 없음. 사용자 결정 변경 없음. 환경 한계 없음.

## 15. 결론

- 상태: **PASS**.
- ACTIVE Decision과 AC 6/6, 강제 지점 15/15를 충족했다.
- 기준 밖 결함과 남은 사람 실기는 없다.
- 다음 단계: PR 검토/merge.
