# 구현 결과 — Artifact publisher

> 아래는 V1 라운드 1 기록이다. 최신 작업 패널 출력 통합과 카드 변경 결과는 [ΔV1 구현 보고](ui-impl.md)에 있다.

작성자: Codex · 2026-09-08 · V1 rev.4 / 구현 라운드 1

게시 도구·저장 원장·대화 카드·산출물 타일·파일 관리 코드를 구현했다. **인수 검증은 부분 완료**다. 실제 Claude 호출은 초기화 뒤 시간 초과됐고 설치 앱의 native 파일 대화상자·탐색기 종단, 키보드와 긴 transcript 비교가 남아 있다. 독립 verify는 수행하지 않았다.

## 구현 구조와 사용자 동작

- `orca_artifacts / publish_artifact({path,title?})`를 기존 registry에 등록했다. 도구 지침이 최종 전달물 선택을 설명한다. 자동 파일 감지·watcher·hook·추가 분류 모델·뷰어는 없다.
- Main의 `features/artifacts/{tool,validation,files,service}`가 파일 검증·보관·상태·휴지통을 맡는다. SQLite 쿼리는 기존 연결을 공유하며 새 서버·의존성·범용 플러그인 플랫폼을 만들지 않았다.
- 파일과 세션 게시 참조를 먼저 확정하고, 실제 도구 결과 영수증을 원래 toolRunId의 메시지에 연결한다. 목록 알림은 transcript 귀속이나 타일 자동 선택에 사용하지 않는다.
- 보관 파일은 `~/.config/orca/artifacts/<fileId>/<filename>`에 둔다. 개발 파일은 `.dev` 하위다. 입력 파일을 복사하고 입력 변경·삭제 이후에도 보관 경로를 추적한다. 세션 삭제는 참조만 지우며 마지막 참조가 사라져도 파일은 유지한다.
- 공통 카드와 기존 우측 패널 타일을 재사용했다. 파일 없음·접근 오류·과거 휴지통 이력을 구분하고, 현재 바이트 저장·탐색기 선택·휴지통·재확인을 제공한다. 본문 IPC·HTML 실행·미리보기는 없다.

## 실행 증거

| 검사 | 실제 관측 | 한계 |
|---|---|---|
| 전체 Vitest | 394 파일, 3,654 통과·0 실패·모델 실기 1개 skip | 마지막 DB 재열기 사례 추가 전 실행. 아래 해당 suite 추가 검증 |
| 추가 실제 DB 재열기 | service 18/18 통과. SQLite 파일을 닫고 입력 삭제 후 다시 열어 list/status/export/partFromRow 확인 | 실제 Electron 앱 재시작은 아님 |
| repository script tests | 109/109 통과 | 모델 시험과 별도 |
| 평가 분류 oracle | `node --test docs/handoff/0223-artifact-publisher/evaluation-oracle.test.mjs` 6/6 통과 | 합성 분류 기준만 검증 |
| 타입 | `npm run typecheck` 세 구성 통과 | live fixture의 마지막 관측 보완은 별도 test 타입 검사 통과 |
| lint | `node node_modules/eslint/bin/eslint.js src scripts --quiet` exit 0 | warning을 숨기는 명령이며 warning 0 주장 아님. 수정 소유 파일 scoped lint도 실행 |
| 문서·마이그레이션·test budgets | 각각 필수 script exit 0, `git diff --check` 통과 | 최종 문서 반영 뒤 재검사 |
| Electron 빌드 | 아래 최종 게이트 기록 참조 | 설치본 인수 시험과 별도 |
| native 휴지통 | Windows Electron 39.8.10에서 합성 MD 이동 후 ENOENT, 없는 대상 이동 reject, exit 0 | 앱 창/카드→IPC 전체 흐름은 아님 |
| 실제 SDK | SDK 0.3.220·CLI 2.1.220, init model `claude-sonnet-5`, P02 두 실행이 각 90초 timeout | 원인 미확정. 실제 publisher 호출 수집 없음. 평가표 전체 미실행 |

전체 시험 첫 실행은 기존 FS 시험의 sandbox EPERM과 새 메뉴/문서 기대값에서 실패했다. 메뉴와 IPC 도메인 문서를 고친 뒤 합성 홈을 지정한 별도 실행에서 전체 통과했다. 실제 사용자의 Confluence 다운로드 폴더를 시험 대상으로 삼지 않았다. 처음 전체 실행 중 짧은 reducer 변이와 HMR이 겹쳤으므로 그 실행을 최종 통과 근거로 사용하지 않았다. 최종 전체 실행은 변이 원복 뒤 수행했다.

전체 실행 명령은 `app`에서 `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=<임시 결과>`이며, 자식 프로세스의 USERPROFILE만 요청 소유 임시 홈으로 지정했다. 결과 JSON/log는 `app/node_modules/.cache/orca/artifact-publisher-check/full-vitest.{json,log}`에 있다. 원본 사용자 홈과 게시 루트는 시험 정리 대상이 아니었다.

## 실제 UI 관측

Codex in-app browser에서 실제 `ArtifactCards`, `RightPanel`, 테마 제공자와 기존 확인창을 사용한 임시 fixture를 실행했다. 파일 API는 합성 응답이므로 아래는 UI 직접 관측이지 native 액션 종단 증거가 아니다. 검증용 화면·서버 파일은 최종 코드에서 제거했다.

| 조작 | 관측 |
|---|---|
| white/normal → dark/compact, 가용 폭 760px | 카드의 제목·파일명·상태·명시 액션 유지, 테마 토큰 적용 |
| plan 선택 후 배경 게시 | fixture 부팅 값 1 유지, 목록에 새 게시 추가, scrollLeft 0→0, 현재 타일 유지 |
| 좁은 폭에서 artifacts/task/subagent/diff/plan 명시 열기 | 각 대상 열이 viewport에 다시 나타남. scrollLeft 약 723/366/0/358/0 |
| scrollLeft 4에서 첫 열 손잡이를 왼쪽으로 드래그 | 첫 열 폭 360→392, 스크롤 4 유지. 처음 빗나간 클릭은 성공으로 집계하지 않음 |
| 마지막 산출물 열 닫기 | scrollLeft 약 389, 허용 최대 390 이내로 보정 |
| 삭제 확인 취소 | 파일 있음 카드 유지 |
| 합성 삭제 성공 | 원래 카드 메타데이터 유지, 파일 없음으로 갱신 |
| 묶음 저장 | HTML 저장됨, missing/access 오류 파일은 항목별 건너뜀과 사유 표시 |

초기 배경 게시 실험은 파일 포맷 중 Vite HMR로 fixture가 재초기화되어 무효였다. 재초기화 계수와 fixture 상태 보존을 보완하고 코드 변경이 없는 연속 실행으로 다시 확인했다. 제품 `artifact.published` 처리에는 타일 선택 쓰기가 없으며 해당 경로의 store 구독 불변 시험도 통과했다.

## 강제 지점 전수 대조

아래 수치는 §10에 등록된 **77개 위치의 구현/계층 증거 대조**다. SDK 모델·native 앱 종단을 전부 통과했다는 합계로 읽지 않는다. 판정 단위별 미완료는 다음 표에 별도로 둔다.

| EP | 위치 대조 | 생산 경로와 증거 |
|---|---|---|
| 01 | a–f 6/6 | tool 선언, Bootstrap 등록, registry revision/충돌, builder snapshot, 실제 in-memory SDK MCP adapter, Claude query 승인명. 모델 호출 종단 미완료 |
| 02 | a–h 8/8 | turn 포트, query wrapper, cold 문맥, history/promotion 후 확정, warm/listen, interrupt/close/respawn, wait gate, commit 재검사. runtime/coordinator/서비스 시험 |
| 03 | a–d 4/4 | path/형식/상한, 실체와 roots, 안정 읽기, commit 취소. 실제 FS·오류 주입 |
| 04 | a–f 6/6 | temp/rename, DB transaction, 요청 소유 cleanup, 카드 dedup, Bootstrap profile 루트. 파일 손실/rollback 및 경로 시험 |
| 05 | a–d 4/4 | receipt 소유권, 원래 publisher call, 원래 메시지 part, history-before-relay. DB/writer 및 bootstrap 기존 배선 시험 |
| 06 | a–e 5/5 | strict ID schema, 메인 창·최상위 frame 검사, preload 명시 API, 파일 stat 오류 분류, 요청 세대. 허위 sender는 모든 endpoint에서 서비스 전에 거절 |
| 07 | a–h 8/8 | 공유 part/event, DTO, RECV_EVENT/LOAD_SESSION, parts/turn memo, AssistantTurn. 실제 DB 재열기→partFromRow와 renderer 귀속 시험 |
| 08 | a–g 7/8, h 부분 | catalog/menu/registry, viewport/reveal, 고정 ID·stale 폐기, 세션 삭제, 공통 카드. 마우스 실기는 수행; 실제 키보드 인수 남음 |
| 10 | a–g 7/7 | 각 화면 저장 집합, Main 상한/dialog 포트, 실제 바이트·충돌, 결과 UI, ID reveal. 실제 설치 창의 native 대화상자/탐색기 연계 남음 |
| 11 | a–d 4/4 | 같은 copyMessagesTx의 자식 refs, sessionDelete의 참조 수명, DB 초기화 보존, 종료/cleanup. 실제 DB+FS 마지막 참조와 close 이후 지각 trash 시험 |
| 12 | a/c 2/4 | 사전 기대 집합과 분류 oracle. b 전체 반복, d 사용자 수용 판단 미완료 |
| 13 | a–e 5/5 | plan·INDEX·docs INDEX·선행 study·평가 상태를 실제 부분 완료 상태로 동기화 |
| 14 | a–h 8/8 | 확인창/중복 억제, ID trash, 직전 실체 검사, OS trash, DB 기록 실패 분리, 동일 file 투영, 외부 복원. native 호출과 UI는 분리 관측 |

파일 전수 검색은 publisher 호출(`.publish(`), runtimeTools 문맥 생산/소비, artifact part/type의 history/DTO/reducer/selector/view, `CHANNELS.artifact*` 등록과 preload 노출을 대상으로 수행했다. 새 profile 경로는 Bootstrap에서 기존 `orcaConfigDir()`를 직접 조합하며 별도 경로 플랫폼을 추가하지 않았다.

## AC / V 자기보고

**AC 9/15 SELF_PASS, 6개 부분 검증**이다. 이는 독립 검증 판정이 아니다. 코드 구현 여부와 종단 증거 부족을 구분한다.

| 판정 | AC / Pair | 이유 |
|---|---|---|
| SELF_PASS | AC2·3·4·8·9·10·11·14·15 | 호출 없으면 게시 없음, 검증·저장·DB 재열기·버전·fork 수명·stale·상태·휴지통 계층 증거 확보 |
| SELF_BLOCKED | AC1 / VP-01 | 실제 SDK/모델의 publisher 호출 완료 증거 없음 |
| SELF_BLOCKED_BY:VP-01 | AC5 / VP-05, VP-30 | 원래 메시지 연결의 DB/mapper/renderer 시험은 통과. 실제 CLI 모델 호출을 관통한 연결 미관측 |
| SELF_BLOCKED | AC6 / VP-06 | UI 마우스/테마/viewport와 파일 포트 시험 통과. 설치 앱의 파일 액션·키보드 인수 남음 |
| SELF_BLOCKED | AC12 / VP-12 | 전체 기존 회귀와 목록의 본문 미읽기 확인. 긴 transcript의 실제 UI 비교/성능 측정 남음 |
| SELF_BLOCKED | AC13 / VP-13 | 평가 분류는 검증했으나 전체 과업 반복·누락/오게시 수용 판단은 미완료 |
| SELF_BLOCKED | AC16 / VP-16 | 현재 바이트·reveal 대상·뷰어 부재 검증. 설치 창에서 native 저장/reveal 종단 남음 |
| SELF_PASS | VP-02·03·04·08·09·10·11·14·15·20·21·23·31·32·40·41·42·43·44·90 | 해당 계층·실제 FS/DB·기존 회귀 직접 증거. 위 미완료 종단을 이 행으로 대신하지 않음 |

유효 pair 27개 중 자기보고 20 PASS, 7 부분/차단이다. EP-08-h와 EP-12-b/d는 닫히지 않았으며 native/모델 종단 gate도 남아 있다. 핸드오프는 `impl/IN_PROGRESS`로 보존하고 커밋은 `Status: partial`로 기록한다. 남은 검증을 완료한 뒤 `IMPL_DONE`으로 넘긴다.

## 선택 변이·구현 중 발견과 대응

| 지점 | 관측과 조치 |
|---|---|
| VP-01 등록 제거 | 실제 Bootstrap registry 등록을 없애면 배선 시험 red. 원복 |
| VP-02 숨은 자동 게시 | Bootstrap에 별도 publish 호출을 넣으면 자동 producer 검사 red. 원복 |
| VP-05 마지막 메시지 귀속 | 원래 소유 메시지를 최신 메시지로 바꾸면 renderer 귀속 시험 2개 red. 원복 후 green |
| VP-10 마지막 참조 GC | 실제 deleteSession 경로에 GC를 넣으면 마지막 자식 삭제 직후 파일 읽기 ENOENT. 부모 삭제 구간은 유지. queries.ts byte-identical 원복 뒤 DB+FS 시험 green |
| 단일 저장 하드링크 | 원래 writeFile 방식에서 보관 원본이 덮이는 실패를 재현. 요청 temp+rename으로 교체, 실제 하드링크 원본 보존 시험 green |
| sender 신뢰 누락 | 공통 handle은 schema만 검사했다. 새 IPC마다 현재 창/최상위 frame/URL 검사를 주입. 미신뢰 호출 red→모든 endpoint green |
| 시간 초과 관측 오류 | 초기 live fixture가 catch 이후 FS/DB 조회를 건너뛰었다. 이전 false/0은 미확인으로 정정하고 nullable 관측/실패 이유를 추가. 수정 후 모델 재실행은 하지 않음 |
| UI fixture 초기화 | HMR의 초기 타일 재열기를 제품 이벤트 효과로 오인할 수 있었다. fixture 계수·상태 보존 후 연속 재검증, 제품 선택 로직 추가 없음 |

## Product/UX 파생 검토와 제한

미연결 게시도 목록에서 찾을 수 있지만 임의 최신 메시지로 복구하지 않는다. 외부 파일 수정은 현재 바이트로 저장하며 예전 hash를 불변 백업으로 사용하지 않는다. 대화가 모두 삭제되어도 파일이 남는다는 비용을 삭제 안내와 보관 폴더 액션으로 드러냈다. 휴지통 이동 성공/DB 기록 실패를 분리하고 과거 이동 시각을 현재 소실 원인으로 단정하지 않는다.

OpenCode·Cowork는 구현하지 않았다. 런타임 도구 문맥은 작은 포트이며 SDK 자료형이 저장·UI에 전파되지 않는다. 실제 OpenCode 호환 완료를 주장하지 않는다. HTML과 연결된 외부 asset 수집·bundle·미리보기도 범위 밖이다. 모델 선택률을 근거 없이 단정하거나 watcher를 자동 도입하지 않는다.

## 최종 게이트

`npm run build` exit 0. prebuild에서 SQLite를 Electron 39.8.10 ABI로 복구했고 node/web/test 타입 검사와 main/preload/renderer 번들 생성이 완료됐다. 최종 상태는 Electron ABI다. 설치 프로그램 생성·설치본 smoke는 미실행이며 native 파일 대화상자·탐색기 및 모델 인수 검증 대기를 유지한다.

최종 문서 inventory/상대 링크와 diff 검사도 다시 통과했다. 임시 UI fixture와 Vite 서버는 제거/종료했다.

## Review Signals

새 production dependency·설정 키·파일 감지 서비스 없음. migration은 append-only이며 기존 DB 연결을 공유한다. 별도 에이전트의 읽기 검토에서 발견한 hardlink/sender 문제를 고쳤고 최종 제한 검토에서 추가 data-loss/오귀속 blocker는 보고되지 않았다. 이는 독립 handoff verify가 아니다. native trash fixture와 평가 oracle/live fixture는 재실행 자료로 남겼다.
