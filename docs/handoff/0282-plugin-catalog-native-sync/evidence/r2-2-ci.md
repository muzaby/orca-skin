# 0282 r2.2 — CI Test gate 수정

[실패 실행](https://github.com/muzaby/orca-skin/actions/runs/40065554161)은 lint·typecheck까지 성공하고 Test에서 4파일이 실패했다. 이 추가 턴은 테스트 호환 수정이며 production 코드는 변경하지 않는다.

| 파일 | 실패 원인 | 수정 | 동일 4파일 재실행 |
|---|---|---|---|
| `app/src/main/app/bootstrap.harness.test.ts` | ΔV6 뒤에도 전역 선택을 빈 객체로 기대 | 서로 다른 Claude/OpenCode 저장 fixture 값과 비교 | 2/2 |
| `app/src/renderer/src/features/chat/components/Composer.approvalQueue.test.ts` | Zustand mock에 새 `useStore` export 부재 | 실제 vanilla store + 기존 fake React 구독 binding | 10/10 |
| `app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/NativeResources.test.ts` | 실제 Zustand React binding과 fake React 런타임 불일치 | 기존 renderHarness의 구독 hook으로 연결 | 3/3 |
| `app/src/renderer/src/pages/NewChatLandingPage.harness.test.ts` | IPC mock의 `sessionApi` 부재 및 같은 React binding 문제 | 원래 IPC export 보존·구독 binding 정합 | 3/3 |

- 수정 전 로컬: 4파일 실패, 12케이스 실패·3케이스 통과·Landing 수집 오류. CI와 같은 실패를 재현했다.
- 수정 후 동일 집합: 4파일, 18/18, 실패·skip 0.
- 확장 집합: r2 177파일 + renderer 전체 + Bootstrap harness의 합집합 530파일. `prior - expanded = []`.
- 확장 결과: 530파일 중 **529파일·4578케이스 통과**. `settlement.integration.test.ts`의 5케이스는 DB 생성 시 SQLite ABI 140↔127 불일치로 실패했다. skip 0. 기존 r2 177파일 실패는 0이다. 실행 결과의 실제 파일 집합과 요청 집합 차집합은 양방향 모두 `[]`.
- lint: 0 error, 기존 warning 2(`Timeline`·`useTranscriptVirtualizer`). typecheck: node/web/test 모두 성공.
- 문서 inventory/prose 정상. 링크 오류는 기존 ignored `.tmp/opencode-dev`·`app/.temp/opencode`의 10건이며 두 폴더 제외 후 `[]`.
- `r2-sites.py`: 121줄 분류·보충 18·고정 117자리, `unclassified=[]; missing=[]; extra=[]`.
- `r2-gates.py`: 제거/owner 검색 0, 문서 11절 존재·누락 감도 11/11. r2의 runtime 변이 결과는 보존하며 이 턴에 재실행했다고 보고하지 않는다.

재실행: 저장소 루트에서 `python docs/handoff/0282-plugin-catalog-native-sync/evidence/r2-2-tests.py`. runner는 `work/handoff-0282-r2-2/files.json`과 `regression.json`을 생성한다. SQLite ABI를 바꾸지 않는다.

독립 검증은 다음 Claude 턴에 맡긴다. AC18 수동 인수는 계속 보류다.
