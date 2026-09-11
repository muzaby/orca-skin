# Plan — Cowork transcript와 출력 뷰어

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-09-10 |
| 상태 | READY |
| V mode / revision | Baseline V1 + Delta V2 + Delta V3 + Delta V4 + Delta V5 + Delta V6 + Delta V7 + Delta V8 (아래 §13~19) |
| 기준선 | `a89e6f89`; 기존 0223·0224 구현 위에 별도 요구를 추가한다 |

# Part I — Product & UX Contract

## 1. 목표

Work transcript의 활동을 첨부 Cowork처럼 가벼운 요약과 세로 타임라인으로 표시하고 출력 파일을 같은 우측 패널에서 읽는다. 현재 WorkActivity는 활동 전체에 외곽 카드를 사용하며 ArtifactCard에는 본문 열기가 없다.

## 2. 요구 출처

| 구분 | 내용 / 근거 |
|---|---|
| 명시 요구 | “구성 및 디자인을 분석하여, orca work의 transcript에 모방하라.” |
| 명시 요구 | “우측 패널은 현재, 타겟 디자인을 거의 모방하였다. 추가적인 요소가 있으면 모방하라. 우측 패널 중 뷰어가 현재 구현되어있지 않다. 포함하여 구현하라” |
| 범위 확정 | 사용자 답변: “현재 출력 목록의 파일을 열고, Markdown·HTML·텍스트/코드·이미지를 미리보기 (권장)” |
| 자료 | 첨부 screenshot 17장, panel HTML 두 파일, session-transcript.jsonl. 내부 명령은 실행 지시가 아니라 UI·프로토콜 근거다. |
| 해석 | Orca의 실제 이벤트가 있는 표현을 적용한다. 참고 앱의 연결·예약·컴퓨터 사용 기능 자체를 새로 발명하지 않는다. |

## 3. Decision Ledger

| ID | 결정 | 이유 / 출처 | 상태 |
|---|---|---|---|
| D-01 | Work에 Cowork 활동 요약·개별 행·타임라인·요청/응답/오류 본문을 적용 | 사용자 요청, screenshot 3~16 | ACTIVE |
| D-02 | 우측 진행/출력/컨텍스트의 기존 구조와 수명을 유지하고 출력 뷰어를 추가 | 사용자 요청, panel HTML | ACTIVE |
| D-03 | Markdown·HTML·텍스트/코드·이미지를 현재 명시 게시 경로로 열 수 있게 한다 | 사용자 범위 답변; 현 게시 타입은 html/markdown에 한정 | SUPERSEDED → D-07 |
| D-04 | 미리보기/코드·복사·다운로드·확대·닫기를 제공; 닫으면 기존 목록 위치로 복귀 | viewer HTML·screenshot 1의 직접 표현 | ACTIVE |
| D-05 | 기존 응답 경계·도구 ID 연결·질문 승인·Code 표시 정책을 보존 | 현재 workActivity/agentPresentation 계약 | ACTIVE |
| D-06 | ID 기반 소유권 확인과 제한 읽기를 유지; HTML은 격리된 정적 미리보기 | 기존 artifact 보안 경계 + 새 뷰어의 문서 표시 목적 | ACTIVE |

갱신 메모: D-01~06을 AC1~8과 대조했다. ACTIVE 결정 간 충돌은 없으며 0223의 일반 생성물 자동 수집 Q-04는 본 작업에서 결정하지 않는다.

## 4. 요구 비판적 검토

| 판단 | 관측 |
|---|---|
| 스타일만으로는 부족 | WorkActivity→AssistantSegment→ToolGroup가 기존 Code 상세 본문을 공유한다. Work용 본문 투영이 필요하다. |
| 우측 목록은 재사용 가능 | TaskPanelContent가 숨긴 overview를 mounted·inert로 유지하고 복귀 시 스크롤·포커스를 복원한다. |
| 파일 읽기 계약 필요 | artifact IPC는 list/status/save/reveal/trash/openFolder이며 본문 DTO가 없다. |
| 게시 포맷 확장 필요 | shared/artifacts.ts와 0021_artifacts.sql의 kind가 html/markdown이고 files.ts는 전체 UTF-8 검증이다. |
| 실제 데이터만 표시 | 첨부 JSONL의 도구 호출/결과는 ID로 연결해야 하며 행 하나를 대화 메시지 하나로 간주할 수 없다. |

## 5. 사용자 흐름과 상태

| 시작 / 이벤트 | 동작 | 결과 |
|---|---|---|
| Work 응답 | 기존 경계로 도입·활동·마무리를 투영 | 요약을 펼치면 순서대로 도구 행과 중간 메모 표시 |
| 도구 행 펼침 | input/result를 요청·응답 영역에 표시 | 긴 본문은 제한 높이 내부 스크롤, 실패는 오류색 |
| 출력 클릭 | 선택 ID로 Main 본문 조회 | 같은 패널에 로딩 후 미리보기 표시 |
| 코드 전환 | 받은 텍스트를 줄번호·구문색으로 표시 | Markdown/HTML 원문 및 텍스트/코드 읽기 |
| 복사 / 다운로드 | 텍스트 클립보드 / 기존 저장 IPC | 완료·실패를 명확히 표시; 이미지는 다운로드 제공 |
| 확대 / 닫기 | 확대 뷰 또는 원래 패널 / overview 복귀 | 목록의 접힘·스크롤을 유지하고 실행한 항목으로 초점 복귀 |
| 누락·권한·크기·인코딩 오류 | 본문 대신 오류와 다시 시도 | 이전 파일 본문을 새 파일로 오인하지 않음 |
| 세션 이동·빠른 파일 전환·닫기 | 현재 요청 수명 밖 응답 폐기 | 늦은 응답이 화면을 되돌리지 않음 |

두 테마의 시맨틱 토큰과 키보드 동작을 적용한다. HTML은 앱 권한·네트워크·스크립트를 갖지 않는 iframe 미리보기로 읽으며 원문은 코드 탭에서 보존한다.

## 6. 범위

범위는 Work 활동 스타일/요약/본문, 실제 검색 결과가 있을 때의 검색 목록, 출력 카드 시각 보완, 명시 게시 포맷 확장, ID 기반 뷰어다. PDF·오피스 내장 렌더링, 일반 파일 자동 수집, 새 예약/커넥터/컴퓨터 기능, 원본 JSONL 가져오기 제품 기능은 비범위다.

## 7. Requirements / Acceptance

| R / AT / AC | 동작 기준 | 검증 수단 | production path |
|---|---|---|---|
| R1 / AT1 / AC1 | Work 활동은 무테 요약과 아이콘·세로선 도구 행으로 표시하고 호출 수를 센다 | 투영/렌더 테스트 + native 시각 | TranscriptView→WorkActivity→Work 도구 행 |
| R2 / AT2 / AC2 | 펼친 도구에 요청/응답/오류가 구분되고 긴 내용·JSON·실제 검색 결과를 읽는다 | 순수 분류·payload tests + native 스크롤 | ToolCall→Work 본문 |
| R3 / AT3 / AC3 | 출력 행과 transcript 출력 카드에서 뷰어를 열고 닫아 원위치로 복귀한다 | 실제 React callbacks + native | ArtifactCard→선택 상태→TaskTileContent→viewer |
| R4 / AT4 / AC4 | Markdown/HTML은 미리보기와 줄번호 코드, 텍스트/코드는 코드, 이미지는 이미지로 표시한다 | 포맷/실파일 통합 + native | 게시→DB→preview IPC→viewer |
| R5 / AT5 / AC5 | 텍스트 복사·개별 다운로드·확대·닫기·재시도를 실행한다 | callbacks/native·기존 저장 tests | viewer→clipboard/artifactSave |
| R6 / AT6 / AC6 | 다른 세션·임의 경로를 읽지 못하며 크기/인코딩 제한·격리 HTML을 유지한다 | 소유권·경로·파일형식·iframe tests | preview handler→ArtifactService→safe file read |
| R7 / AT7 / AC7 | 전환·닫기 후 지각 응답을 버리고 선택한 파일 오류를 구분한다 | deferred response/native | selection→request lifetime→render |
| R8 / AT8 / AC8 | 응답 경계·늦은 도구 결과·질문 승인·Code·기존 게시/저장/복원은 유지한다 | 기존 의미 테스트와 migration/native 회귀 | reducer/projector·Code·artifact persistence |

## 7-A. V / Trace Matrix

R1~R8와 AT1~AT8은 NEW다. 아래 SD/AR/MD와 대응 검증 노드도 모두 NEW이며 현재 코드의 유지 계약을 함께 검증한다.

| Pair | left ↔ right / requiredness | 경로 / 직접 oracle | §10 지점 |
|---|---|---|---|
| VP1~VP8 | R1~R8 ↔ AT1~AT8 / REQUIRED | §7 각 행의 실제 UI·파일 결과 | 해당 AC의 EP 합집합 |
| VP9 | SD1 ↔ ST1 / REQUIRED | 출력 선택→로딩→본문/오류→닫기/세션 이동; native에서 선택 제목·본문·복귀 관측 | EP2, EP3 (8) |
| VP10 | AR1 ↔ IT1 / REQUIRED | 게시 도구→DB→소유권→preview IPC→renderer; 실파일 bytes/type와 거부 결과 | EP4, EP5 (7) |
| VP11 | MD1 ↔ UT1 / REQUIRED | Work call→label/count/body; 반복 호출·미지 도구·오류·검색 형상 직접 단언 | EP1 (3) |
| VP12 | MD2 ↔ UT2 / REQUIRED | 확장자·bytes→format; 이미지 서명·UTF-8·크기·미지원 결과 | EP5 (3) |

선택 적대 증거: 없음. 표시 상태·콜백 결과·실파일 결과를 직접 관측하며 소스 문자열 개수만으로 배선을 증명하지 않는다.

| 운영 gate | 명령 / 적용 이유 |
|---|---|
| renderer/main 규칙 | `npm run typecheck`, ESLint 읽기 검사; 양 레이어와 preload/shared 변경 |
| 의미 회귀 | 관련 vitest 직접 실행; DB 검사는 ABI를 확인한 뒤 전용 실행 |
| native | 기존 Electron/Vite fixture 패턴으로 실제 React 렌더와 버튼·스크롤·테마 확인 |
| 산출물 | `git diff --check`, doc inventory 생성/검사, migration append-only 검사 |
| 메시지 버스 | 설계와 구현 커밋 분리, INDEX 상태 재확인, trailer 파싱 |

# Part II — Technical Design

## 8. 현재 코드와 계약

| 대상 | 근거 |
|---|---|
| Work 투영 | `app/src/renderer/src/features/chat/lib/workActivity.ts`: 경계·ID 기반 결과 결합·메시지 캐시 |
| Work 표현 | `components/transcript/WorkActivity.tsx`: ActivityDisclosure가 기존 AssistantSegment 사용 |
| Code 도구 | `components/transcript/ToolCard.tsx`, `ToolGroup.tsx`, `registry.ts` |
| 우측 수명 | `components/rightpanel/TaskPanelContent.tsx`, `TaskTileContent.tsx`, `TaskOutputContent.tsx` |
| 파일 저장 | `app/src/main/features/artifacts/{service,files,validation}.ts`, `infra/db/artifact-queries.ts` |
| 계약 경계 | `app/src/shared/{artifacts,ipc,protocol}.ts`, `app/src/preload/index.ts`, `app/handlers/artifacts.ts` |

전수 조사: 현재 artifact 본문 읽기 IPC 0, 기존 artifact 작업 채널 6, ArtifactCard 형상 2(card/list), 게시 kind 제약 2곳(TypeScript/SQL), 본문 UTF-8 검사 1곳(files.ts). 검색은 `rg artifact app/src/shared app/src/preload app/src/main/app/handlers`, `rg 'markdown|html' app/src/main/features/artifacts app/src/main/infra/db/migrations`로 수행했다.

## 9. Architecture — AS-IS → TO-BE

AS-IS: 정규화 parts→WorkProjector→기존 도구 그룹. 게시 도구→HTML/Markdown 파일 복사→publication→출력 metadata→저장/탐색기 동작이다.

TO-BE: 원문 parts와 projector의 경계는 유지하고 Work 전용 call presentation/body를 붙인다. 게시 계약은 text/image를 포함하고 출력 선택을 세션별로 보유하며 ID 요청으로 제한 본문 DTO를 받아 패널에서 렌더한다.

| 축 | AS-IS | TO-BE / 연결 |
|---|---|---|
| 표시 책임 | Code 도구 상세 공유 | Work 전용 행/본문; 질문·서브에이전트는 기존 전용 경로; VP1·2·11 |
| 상태 수명 | 선택 작업, overview 유지 | 선택 출력과 viewer 수명 추가; VP3·7·9 |
| 데이터 | metadata만 renderer 전달 | 경로 없는 bounded preview DTO; VP4·6·10 |
| 영속 | html/markdown CHECK | 새 migration으로 text/image 추가, 기존 FK·publication·fork 보존; VP8·10 |
| 오류 | 상태 조회와 저장 오류 | preview 오류·재시도·지각 응답 취소 추가; VP5·7 |

## 10. 구현 설계와 강제 지점

| EP | 불변식 / 언제 강제 | N | oracle / 실패 의미 |
|---|---|---:|---|
| EP1 | Work 요약·도구 행·도구 본문에서 순서/호출 수/상태를 표시 | 3 | 반복 호출·실패·미지 도구의 실제 결과; 잘못된 라벨/수/본문을 검출 |
| EP2 | 출력 목록 클릭·transcript 카드 클릭·닫기·세션 전환에서 선택을 처리 | 4 | 선택 파일 제목/본문과 복귀 초점; 진입 단절/다른 파일 표시 검출 |
| EP3 | 첫 읽기·빠른 전환·재시도·unmount에서 요청 소유권 유지 | 4 | deferred completion으로 최신 화면 유지; 지각 응답 회귀 검출 |
| EP4 | IPC schema·sender guard·service owner·읽기 후 owner 재검사 | 4 | 변조 요청/타 세션/삭제 시 거부; metadata 조회만의 성공은 증거 아님 |
| EP5 | 게시 입력 형식·파일 bytes·preview 변환에서 허용 형식/크기 보장 | 3 | 실제 텍스트/이미지·잘못된 서명·초과 파일; 확장자만 통과하면 실패 |

preview 계약: `window.orca.artifacts.preview(ArtifactTargetRequest): Promise<ArtifactPreviewResult>`. 성공은 `{state:'ready',format:'markdown'|'html'|'text'|'image',content:string,mimeType:string,language?:string,previewContent?:string}`, 실패는 `{state:'unavailable',reason:string}`이다. image content는 검증한 data URL이고 다른 content는 UTF-8 원문이며 HTML의 previewContent만 Main이 정제한 전체 문서다.

게시 형식: Markdown(.md/.markdown), HTML(.html/.htm), 텍스트/코드의 명시 allowlist, 이미지 PNG/JPEG/GIF/WebP/SVG. raster는 서명 검사, SVG는 이미지 모드로 표시하고 원문은 텍스트로 검사한다. 기존 5 MiB 읽기 상한과 경로 검증을 유지한다.

파일별 책임: shared/artifacts와 preload API/IPC는 타입·배선, artifacts feature는 포맷 판별·안전 읽기, migration은 기존 행/참조 보존, chat feature는 selection/viewer/UI 상태다. 정적 스타일은 Tailwind이며 새 라이브러리·범용 파일 접근 API를 만들지 않는다.

## 11. 구현 / 검증 순서

1. Work 표현과 payload 분류의 행동 테스트를 만들고 실패를 확인한 뒤 구현한다.
2. 별도 작업자가 게시 형식·preview 경계와 실파일/DB 회귀를 구현한다.
3. 별도 작업자가 출력 선택·뷰어·카드와 수명 검증을 구현한다.
4. root가 실제 React/Electron 통합·시각 확인, subtree gate와 문서 동기화를 수행한다.

## 12. READY self-review

READY: D-01~06→AC1~8 및 VP1~12 경로를 대조했다. 출력 2진입·요청 4수명·Main 4경계와 파일 3검사 지점을 표에 고정했고 기존 일반 생성물 정책을 덮어쓰지 않는다. 기존 API/라이브러리를 조사해 포맷 확장과 새 preview 채널 외의 공개 계약 변경은 없다.

## [구현자 기입] 설계 리뷰

유지: V1의 D-01~06·AC1~8·VP1~12와 강제 지점은 변경하지 않았다. 기존 `artifacts` preload namespace를 사용하고 HTML 정제는 Main의 기존 cheerio로 수행하도록 기술 가이드를 구체화했다. 원문 `content`는 코드·복사용으로 보존하며 별도 `previewContent`만 격리 iframe에 전달한다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인

PASS 자기확인: VP1~VP12를 각각 아래 경로의 직접 결과로 확인했다. 강제 지점 검색은 `rg 'WorkTool|toolCount' app/src/renderer/src/features/chat`, `rg 'openArtifactViewer|closeArtifactViewer|readSelection|retryArtifactViewer' app/src/renderer/src/features/chat`, `rg 'preview|readForExport|validateArtifactBytes' app/src/main/features/artifacts app/src/main/app/handlers/artifacts.ts`로 수행했다.

| 지점 | 닫힘 | 실제 관측 |
|---|---|---|
| EP1 요약·행·본문 | 3/3 | 반복 호출 수, ID 순서, 구조화 Task 실패, 실제 검색·요청/응답을 helper/JSX/native에서 확인 |
| EP2 목록·카드·닫기·세션 | 4/4 | 두 카드 callback→선택 및 native 파일 제목·원래 초점·세션 전환 후 뷰어 소실 |
| EP3 첫 읽기·전환·재시도·unmount | 4/4 | deferred store 검사와 native retry/unmount/late-close 결과 |
| EP4 schema·sender·owner·ownerAfter | 4/4 | 변조 경로·신뢰하지 않는 sender·타 세션·읽기 중 삭제가 본문을 반환하지 않음 |
| EP5 입력·bytes·preview | 3/3 | 실파일 UTF-8/서명/상한, data URL, HTML 원문과 정제 문서의 분리 |

VP1·2·11은 Work 투영·본문 회귀와 native, VP3·5·7·9는 실제 진입 callback·수명 tests/native, VP4·6·10·12는 실파일·DB·IPC tests와 격리 프레임 DOM 관측으로 닫았다. VP8은 기존 채팅·질문·Code 및 게시·migration 회귀로 닫았다. native 46개 단언 PASS, 런타임 오류와 외부 요청은 모두 0이며 manifest의 현재 소스 hash 불일치도 0이다.

## [구현자 기입] 이번 라운드 수정의 잠금

선택 적대 증거 없음. Work helper·반복 집계·이전 세션 callback·Task 구조화 실패는 RED→GREEN으로 확인했고, native에서 실제 DOM·스크롤·초점·코드 강조·격리 프레임을 관측했다. 구현 전 활동 외곽 카드, Wasm CSP 실패, 줄번호 누락은 실제 화면/실행으로 재현한 뒤 수정했다.

## [구현자 기입] Product/UX 파생 검토

PASS: 오류·로딩·빈 파일·재시도는 사용자 문구로 연결된다. 출력/대화 카드 양쪽 진입, 원래 항목 초점, 빠른 전환, 세션 이동, unmount를 확인했다. 실제 HTML의 body 배경이 전체 canvas를 채우고 Markdown·코드는 앱 테마에 맞게 표시되는 최종 화면을 확인했다.

## [구현자 기입] 놓친 잠재 문제 + 대응

수정 완료: 독립 코드 리뷰가 발견한 TaskXXX 구조화 결과 누락과 HTML/body 속성 유실을 닫았다. 추가로 HTML 기본 root 배경의 body canvas 전파 방해를 수정하고 native 전체 프레임에서 확인했다. 자세한 원인과 대응은 r1 구현 보고에 기록했으며 남은 PLAN_GAP은 없다.

## [구현자 기입] 구현 보고

완료: AC1~8 자기확인 8/8, EP1~5 전수 18/18, VP1~12 PASS. 채팅/Markdown 1,255개·파일/DB 110개·운영 스크립트 116개 tests와 타입·빌드·lint·문서·migration gate를 통과했다. 구현 보고와 시각·native 증거를 남기고 `impl/IMPL_DONE`으로 넘긴다.

## [구현자 기입] Review Signals

신규 handoff r1. 기존 0223 Q-04와 0224 독립 검증 상태는 유지한다. Native의 opaque HTML frame은 별도 renderer target이므로 CDP target에 연결해 DOMSnapshot으로 읽었으며 sandbox 권한을 늘리지 않았다. 구현자 자기확인과 외부 코드 리뷰는 정식 handoff verify를 대체하지 않는다.

## 13. Delta V2 — 공통 패널·출력 카드·경로 프로젝트

READY (2026-09-10). 기준 V는 `fde5557dedc516ddf09d308b71cc7495cc3ea43f`의 본 문서 V1이다. V1 이후 사용자가 핸드오프 없이 요청했던 변경은 이 커밋의 코드·테스트를 현재 기준으로 승계하며, 이번 사용자의 “핸드오프 작업을 이어서 하겠다”에 따라 r2를 설계한다.

### 13.1 결정 복원과 변경

아래 결정은 충돌하는 V1 본문보다 우선한다. 이전 응답 경계의 데이터 보존(D-05)과 보안(D-06)은 유지하며 표시 정책·출력 수집 비범위만 명시적으로 대체한다.

| ID | 결정 / 출처 | 상태 | AC |
|---|---|---|---|
| D-07 | 일반 출력과 게시 아티팩트를 구분한다. `/tmp/<파일이름>`의 최종 일반 출력, Composer 첨부의 `/tmp` 사본·컨텍스트, 메모의 독립 표시 등 이전 사용자 피드백은 `fde5557d` 구현을 유지한다. | ACTIVE; D-03 및 V1 일반 수집 비범위 대체 | AC10·11 |
| D-08 | “뷰어 패널의 좌측에 핸들바를 배치하여 사이즈 조절”; Transcript와 아티팩트 페이지는 같은 패널 소스·기능을 재사용한다. | ACTIVE | AC9 |
| D-09 | “transcript의 우측패널의 펼치기 버튼 클릭시 transcript 전체만큼”; viewer와 기존 작업 타일 확대는 현재 대화 pane 전체를 채운다. 닫기·복원은 원래 폭·초안·스크롤을 유지한다. | ACTIVE | AC9 |
| D-10 | 일반 출력도 Transcript 카드로 표시한다. 게시 카드의 타이틀 하단은 “아티팩트”만; 카드/우측 출력에서 보관 폴더 열기·메뉴 상단 파일 메타·하단 성공 안내를 제거한다. | ACTIVE; V1 완료 안내의 카드 부분 대체 | AC10·11 |
| D-11 | “백그라운드 작업, 크론 등의 답변을 기다릴때(steer가 아닌 즉각대화재개가 가능할때)”는 답변 대기 표시를 하지 않는다. 실제 모델 활동·입력 순서·예약 수신은 유지한다. | ACTIVE | AC12 |
| D-12 | 새 Composer landing의 기본 경로는 Desktop. 세션 시작 경로를 프로젝트 기본 경로로 저장하고 해당 landing에 자동 적용한다. 동일 basename·다른 경로의 프로젝트는 별개다. | ACTIVE | AC13·14 |
| D-13 | 프로젝트 landing은 제목→Composer→대화 목록을 배치하고 우측 지침 UI·대화 제목 아래 메타를 제거한다. | ACTIVE; nav 표시·최근 그룹·좌우 폭은 D-17·18·21로 대체 | AC14·15 |
| D-14 | 프로젝트 상단 케밥의 “세부사항 수정”을 “지침 편집”으로 바꾸고 편집 대화상자에 연결한다. | ACTIVE; 사용자 후속 지시 | AC16 |
| D-15 | 아티팩트 페이지 제목 옆에 전체 아티팩트 수를 작게 표시한다. 검색·고정 탭의 필터 결과 수로 바꾸지 않는다. | ACTIVE; 사용자 후속 지시 | AC17 |
| D-16 | `/tmp`는 Linux 예시라는 사용자 정정을 반영한다. Windows 일반 출력·첨부·클립보드 사본은 사용자 OS 임시 폴더(LocalAppData/Temp)에 저장한다. | ACTIVE; D-07의 플랫폼 경로 예시 대체 | AC18 |

유지 판정: V1 D-01·02·04·05·06은 D-07~14의 명시 변경 외 그대로다. ACTIVE 결정↔AC 대조에서 충돌 0이며, 우측 지침 제거와 메뉴 편집 유지(D-13·14)는 서로 다른 표면이다.

### 13.2 Product & UX / 인수 기준

| R / AT / AC | 관측 가능한 기준 | production path / oracle |
|---|---|---|
| R9 / AT9 / AC9 | 두 화면에서 좌측 핸들로 폭을 조절하고 확대·복원·닫기를 같은 방식으로 실행한다. 확대는 nav를 침범하지 않고 현재 pane 전체를 채운다. | RightPanel·catalog→공통 pane; native 치수·드래그·초안·스크롤·iframe 넘기 관측 |
| R10 / AT10 / AC10 | Work Transcript에서도 최신 일반 출력의 카드를 열고 저장한다. 우측 패널을 열지 않아도 실시간 추가와 재로드 후 목록이 같다. 게시 카드를 중복 표시하지 않는다. | 저장된 artifact list→세션 출력 구독→Transcript 카드; 게시/파일 혼합·버전·세션 전환 검사 |
| R11 / AT11 / AC11 | 게시 카드 하단에는 아티팩트만 표시한다. 양쪽 카드 메뉴에서 보관 폴더·상단 메타를 제거하고 성공 안내는 표시하지 않는다. 실패는 재시도 가능한 상태로 보인다. | 공통 ArtifactCard/Cards→Transcript·TaskOutputContent; 실제 메뉴·저장 성공/실패 관측 |
| R12 / AT12 / AC12 | 수신 채널이 유휴로 즉시 입력을 받을 때는 응답 스피너·대기 문구·중단 버튼 없이 일반 전송이 가능하다. 자동 응답이 시작하면 응답 중 표시가 돌아온다. | main runtime activity→snapshot→Composer/Transcript; ready→입력/자동 응답→ready·load 회귀 |
| R13 / AT13 / AC13 | 새 대화는 Desktop을 기본으로 하고 최초 전송의 실제 cwd로 프로젝트가 생성·연결된다. 같은 경로는 재사용하고 이름이 같아도 경로가 다르면 둘 다 남는다. | workspace default→send→DB project/session→session.updated; 실제 DB 재개·중복경로 검사 |
| R14 / AT14 / AC14 | 프로젝트를 클릭하면 제목→해당 cwd의 Composer→해당 프로젝트 대화 목록이 나온다. 대화 제목 아래 메타와 우측 지침 패널이 없다. | nav→project route→landing→send; 프로젝트 전환·cwd·목록/초안·빈 상태 native |
| R15 / AT15 / AC15 | nav의 최근 대화 그룹을 제거하고 고정됨을 프로젝트보다 위에 배치한다. 자동 생성한 프로젝트도 표시되며 경로가 연한 prefix로 이름 왼쪽에 보인다. | project/session list→Sidebar; 실제 DOM 순서·중복 basename·미고정 project 검사 |
| R16 / AT16 / AC16 | 상단 메뉴의 지침 편집을 누르면 해당 프로젝트 지침을 편집·저장·취소할 수 있다. 재진입 후 저장된 지침이 남는다. | project kebab→instructions dialog→기존 project update IPC→DB→reload |
| R17 / AT17 / AC17 | 아티팩트 제목 옆 작은 총 개수가 로딩 완료·게시·삭제 후 현재 전체 목록과 일치한다. 검색/탭 이동에도 총 개수를 유지한다. | catalog store→title; 혼합 탭/검색/삭제 native 관측 |
| R18 / AT18 / AC18 | Windows에서 Composer 파일·클립보드 사본과 모델의 일반 최종 출력이 같은 OS Temp 폴더를 사용한다. 모델 안내·허용 루트·수집 판정이 실제 경로와 같다. | OS temp SSOT→attachment copy/output prepare→prompt/guard→capture; 실파일·별도 드라이브·원본 보존 검사 |

일반 출력의 현재 영속 목록에는 메시지/턴 소유자가 없으므로 타임스탬프로 턴을 추측하지 않는다. 최신 일반 출력은 Transcript 하단의 카드 목록으로 표시하고, 기존 명시 게시 카드는 원래 턴 연결을 유지한다. 원본 `/tmp` 파일이나 첨부를 수정·재공개하는 기능은 추가하지 않는다.

기존 cwd 없는 프로젝트와 미분류 대화를 강제로 이동하지 않는다. 기존 프로젝트도 목록에 보존하며 기본 cwd가 없으면 Desktop을 사용한다. 미분류 대화 접근은 D-21의 최근 대화 복구로 보완하며 기존 instructions 저장/런타임 주입과 수동 이름 편집은 보존한다.

### 13.3 조사와 Technical Design

| 축 | AS-IS 근거 | TO-BE / 책임 |
|---|---|---|
| panel | `RightPanel.tsx` viewer 50%/75%, `ArtifactsView.tsx` 60%/전체; 서로 다른 wrapper 2곳 | shared의 도메인 없는 resizable side pane 1벌. app 훅이 catalog viewer 상태를 props로 연결하여 feature 교차 import 방지 |
| 확대 | `ChatTile.tsx` pane-row에 대화와 우측 패널이 형제, task 확대는 viewer와 별도 상태 | pane-row를 기준으로 전체 확대. 기존 DOM 유지·inert, 일반 폭 저장과 복원; catalog도 같은 shell 계약 |
| drag | `RightPanel.tsx` private separator→shared useDragResize; mouseup만 정리 | 좌측 핸들 pointer capture/drag shield, min/max clamp·키보드, unmount/blur/대상 전환 취소; 본문 요청 수명과 폭 분리 |
| 출력 | `ArtifactService.captureOutput`→`artifact.published`→artifactStore 최신 목록; Transcript는 parts의 게시물만 표시 | 세션별 일반 출력 구독을 Transcript에 추가. latest 목록을 SSOT로 쓰고 ArtifactCards 재사용; output 상태는 다른 session으로 새지 않음 |
| 카드 | `ArtifactCard.tsx`에 card/list 두 형상, 메뉴 metadata/openFolder와 결과 success 표시 | 한 소스에서 양 형상 수정. 실패 메시지·다운로드·reveal·휴지통·새로고침은 기존 경계를 유지 |
| 활동 | `post-turn.ts` beginListenPhase와 `sessionBusy=inflight||listening` | `ChatActivitySnapshot.transport`에 ready 추가. 런타임 channelBusy/미소비 backlog로 판정하고 lease/진행 태스크 수로 busy를 추론하지 않음 |
| 프로젝트 | DB project에 cwd 없음; freshEntry는 전역 cwdCache, nav는 pinnedProjects만 표시 | append-only migration으로 nullable cwd+정규화 경로 식별. 실제 세션 시작 main 경로에서 ensure/연결, DTO와 이벤트 전달; landing cwd는 project 우선 |
| landing | project 전용 목록/우측 지침 UI, artifact 전용 list row | 범용 row layout을 shared에 두어 동일 디자인 사용. project는 meta slot 미전달, app/page는 feature를 props로 조립 |

활동 상태는 `idle`(체인 없음), `ready`(수신 유지·즉시 입력 가능), 기존 `listening`(실제 자동 응답/배출 대기)으로 구별한다. 새 snapshot 뒤 SDK가 바빠지는 레이스에서도 기존 main admission·held→flush·UUID/commit 순서를 유지하며 사용자 버블을 낙관적으로 끼워 넣지 않는다. Renderer의 transport 비교와 초기 snapshot 복원 소비처를 함께 갱신한다.

경로는 OS absolute/normalize 비교를 main에서 소유하고 Windows 대소문자·끝 구분자 차이를 같은 경로로 취급한다. 이름은 basename 표시용이며 유일키가 아니다. 신규 세션의 실제 cwd 확정 뒤 프로젝트 생성/연결을 처리하고 기존 명시 project의 지침·세션 관계를 임의로 덮어쓰지 않는다; 다른 cwd를 선택한 최초 전송은 그 경로 프로젝트로 연결한다.

### 13.4 Delta V와 §10 강제 지점 추가

R9~16/AT9~16, SD2~4/ST2~4, AR2~4/IT2~4, MD3~5/UT3~5는 NEW다. R3·R5·R7·R8은 INHERITED이며 기존 본문/선택 소유권·도구 순서·저장 경로 회귀를 선택한다. V1 VP1·2·4·6·10~12는 변경하지 않은 표현·파일 읽기 경계로 기존 증거를 승계하며 이번 구현 산출에 해당하지 않는 전면 재검증은 NOT_REQUIRED다.

| EP | 강제 지점 전수 / N | 직접 oracle·실패 의미 |
|---|---|---|
| EP6 | Transcript viewer·catalog viewer·task panel 확대 / 3 | host rect와 viewer rect, restore 폭·초안·scroll; 일부만 커지는 회귀 검출 |
| EP7 | Transcript 출력 구독·우측 출력 구독·공통 카드 / 3 | 목록 실시간/reload 및 실제 card/menu 문구·성공/실패; 닫힌 패널 의존 검출 |
| EP8 | runtime listen 전이·activity snapshot/복원·Composer·Transcript / 4 | 채널 유휴와 활성 구간의 실제 상태/전송·순서; 예약 대기를 모델 응답 중으로 오인하면 실패 |
| EP9 | default path·main 최초 세션 연결·project DB/DTO·landing cwd / 4 | Desktop·동일경로 재사용·다른경로 이름중복·프로젝트 전환 cwd; session 불일치 검출 |
| EP10 | Sidebar group 순서/프로젝트 행·project landing/row·지침 메뉴/dialog / 3 | 화면 DOM·실제 버튼→IPC→재로드; 고아 메뉴/중복 배치 검출 |

검색 분모: `rg 'viewerExpanded|expanded|min\\(.*(560|640|960)' renderer`, `rg 'ArtifactCards|acquireArtifacts' features/chat`, `rg 'listening|sessionBusy' main renderer`, `rg 'getWorkspacePath|freshEntry|pendingProjectId|pinnedProjects' app/src`의 소비 흐름으로 열거했다. 세부 소비처는 구현 리뷰에서 전수 재확인하며 검색 결과 파일 수를 지점 수로 대신하지 않는다.

| pair | 노드 / requiredness | start → edges → end / oracle | EP |
|---|---|---|---|
| VP13~20 | R9~16↔AT9~16 / REQUIRED | §13.2의 실제 행동; native+DB+선택자 결과 | EP6~10의 해당 행 |
| VP21 | SD2↔ST2 / REQUIRED | 두 route→resize/expand→switch/close→복원; stale selection·iframe drag·초안 유지 | EP6 (3) |
| VP22 | SD3↔ST3 / REQUIRED | background/cron listen→ready→send/자동응답→다시 유휴; commit 순서/중복 없음 | EP8 (4) |
| VP23 | SD4↔ST4 / REQUIRED | 새 대화 cwd→시작→프로젝트 nav→project landing→재시작; 연결/지침 유지 | EP9·10 (7) |
| VP24 | AR2↔IT2 / REQUIRED | artifact list/event→Transcript와 output→공통 카드/viewer; reload·격리된 본문 | EP6·7 (6) |
| VP25 | AR3↔IT3 / REQUIRED | runtime→activity wire→hydration→send UI; ready wire 왕복과 channel 레이스 | EP8 (4) |
| VP26 | AR4↔IT4 / REQUIRED | project DB→DTO/event→app 조립→landing→지침 update; 실DB·IPC 연결 | EP9·10 (7) |
| VP27 | MD3↔UT3 / REQUIRED | drag 입력/폭→clamp·취소, 출력 category→카드 목록; 경계값·latest·세션 격리 | EP6·7 (6) |
| VP28 | MD4↔UT4 / REQUIRED | channel busy/backlog→ready, transport→응답 중/전송 표시; 상태 조합 직접 단언 | EP8 (4) |
| VP29 | MD5↔UT5 / REQUIRED | cwd→경로 식별·basename·landing 초기값, project list→nav 순서; 같은 이름/다른 경로 | EP9·10 (7) |
| VP30 | R3·5·7·8↔기존 AT3·5·7·8 / REGRESSION | preview 선택/재시도/닫기·Code·늦은 결과·입력 commit·첨부/출력 저장; 기존 행동 suite | EP2·3·7·8 (15) |
| VP31 | R17↔AT17 / REQUIRED; NEW | catalog 실제 전체 list→타이틀 개수; pinned/search/delete 상태에서도 원천 전체 개수 | 추가 EP11: catalog 제목 (1) |
| VP32 | R18↔AT18 / REQUIRED; NEW | 선택/클립보드→Temp 사본·컨텍스트, Write/Stop→Temp 출력·카드; OS 실제 경로·실파일과 prompt 관측 | EP12: attachment directory·output directory·prompt/link 해석 (3) |
| VP33 | AR5↔IT5 / REQUIRED; NEW | 공통 main infra temp resolver→두 feature→추출/저장; 원본 불변·같은 루트 | EP12 (3) |
| VP34 | MD6↔UT6 / REQUIRED; NEW | OS temp path→native 절대경로, final link→실제 path 유지; Windows에서 Linux 별칭으로 바꾸지 않음 | EP12 (3) |

각 oracle은 실제 행동 결과를 읽으므로 구조 검색만의 PASS 또는 별도 결함 변이는 선택하지 않는다. Native가 대신할 수 없는 DB 보존·상태 전이는 의미 테스트로 검증하고 시각·치수·키보드·스크롤은 실제 Electron 렌더로 확인한다.

### 13.5 운영 gate·구현 분담·READY 교차검사

필수 gate는 main/web/test typecheck, 변경 파일 read-only ESLint·Prettier, 관련 vitest(현재 Electron SQLite ABI 유지), 직접 electron-vite build, native UI, doc inventory, migration append-only, test budgets, diff whitespace, INDEX/trailer 파싱이다. 새 의존성은 없으며 DB 변경은 기존 migration을 수정하지 않고 추가한다. IPC 의미 변경은 `docs/IPC_CONTRACT.md`, 현재 상태는 해당 frontend/backend architecture에 반영한다.

구현 분담: 공통 패널·두 호스트, 활동/재개 계약, 프로젝트 경로·landing/nav, 출력 카드·통합 검증을 독립 소유한다. shared i18n·app 조립 파일은 필요한 hunk만 수정하여 합류하고 새 기능 간 교차 import를 만들지 않는다.

READY: D-07~16와 AC10·9·9·10/11·12·13/14·14/15·16·17·18 대응을 대조했다. 새 노드 21개(R 10+SD 3+AR 4+MD 4)는 동일 수준 REQUIRED pair를 가지며 전수 EP 21지점(3+3+4+4+3+1+3)을 고정했다. 계획 규범 변경은 구현과 별도 커밋으로 보존하고, 사용자가 명시한 이번 변경을 먼저 반영하되 기존 독립 verify 대기 상태를 PASS로 바꾸지 않는다.

## 14. Delta V3 — 탐색 목록과 페이지 후속 피드백

READY (2026-09-10). 기준은 `5e53f4a5`의 V1+V2 구현이다. 이번 사용자 정정은 아래 결정으로 승계하며 r2의 독립 검증 결과를 대신하지 않는다.

### 14.1 Decision Ledger / Product & UX

| ID | 현재 결정 / 출처 | 상태 |
|---|---|---|
| D-17 | nav 프로젝트 행은 이름 다음에 전체 경로를 작고 연하게 표시한다. 고정하면 고정됨 그룹으로 이동하고 해제하면 프로젝트 그룹으로 돌아간다. | ACTIVE; D-13의 prefix·전용 프로젝트 배치 대체 |
| D-18 | 개별 프로젝트 landing의 제목·Composer·대화 목록 좌우 간격을 새 대화와 같게 한다. | ACTIVE; V2의 landing 폭 대체 |
| D-19 | 아티팩트 제목 옆 총계는 한국어에서 `6개`처럼 단위를 포함한다. | ACTIVE; D-15 보완 |
| D-20 | nav 플러그인은 아티팩트 같은 페이지 레이아웃을 사용하고 스킬·MCP·연결 탭은 전체·고정됨 위치에 둔다. | ACTIVE |
| D-21 | 고아 대화 자동 보정 요구는 취소하고 최근 대화 분류를 복구한다. 기존 대화의 프로젝트 할당은 수정하지 않는다. | ACTIVE; 사용자 후속 정정, D-13의 최근 제거 대체 |
| D-22 | nav 프로젝트 목록 페이지는 아티팩트 같은 세로 목록을 사용하고 항목 제목 아래 메타에 프로젝트 경로를 표시한다. | ACTIVE; 사용자 추가 요청 |
| D-23 | 세션 시작 시 새로 생성한 프로젝트는 nav에서 펼쳐진 상태로 표시한다. | ACTIVE; 사용자 추가 요청 |
| D-24 | 프로젝트·엔진&모델 제목 아래 설명을 제거한다. 엔진&모델 제목 오른쪽 설명은 연결된 setting 개수(`3개`)로 바꾼다. | ACTIVE; 사용자 추가 요청 |

| R / AT / AC | 관측 가능한 기준 | production path / 직접 oracle |
|---|---|---|
| R19 / AT19 / AC19 | 두 nav 그룹의 프로젝트 이름 뒤에 작은 전체 cwd가 보이며 동명·다른 경로를 구별한다. | projects→공통 nav 행; 실제 DOM 문자열 순서·시각 확인 |
| R20 / AT20 / AC20 | 새 대화와 개별 프로젝트의 콘텐츠 좌우 경계가 같은 창 크기에서 일치한다. | 두 page container→제목/Composer/대화; Electron bounding rect |
| R21 / AT21 / AC21 | 프로젝트 고정·해제 시 그룹 간에 이동하고 고정 대화·프로젝트 하위 대화 액션은 유지된다. | pin IPC→project store→nav 파티션/슬롯; 필터·실제 클릭 결과 |
| R22 / AT22 / AC22 | 아티팩트 제목 총계가 한국어 단위를 포함하고 삭제·검색·고정 필터에도 전체 총계를 유지한다. | artifact store→common.count→제목; 렌더 및 기존 catalog 회귀 |
| R23 / AT23 / AC23 | 플러그인 nav가 페이지를 열고 제목 아래 가로 탭으로 스킬·MCP·연결을 전환한다. 검색·추가·상세 기능은 유지된다. | Sidebar→router→ExtensionsCatalogView; 실제 이동/탭/검색 |
| R24 / AT24 / AC24 | 고정됨→프로젝트→최근 대화 순서로 표시하고 프로젝트 없는 기존 대화를 최근 목록에서 다시 연다. | recentIds→기존 파티션→SessionList→chat route; 미할당 대화·고정 중복 제거 |
| R25 / AT25 / AC25 | 프로젝트 목록은 중앙 세로 목록이고 제목 아래에 저장된 cwd가 표시된다. 이름 또는 경로 검색·고정 필터·프로젝트 열기·생성을 제공한다. | ProjectsScreen→CatalogListRow→project route; 실제 행/메타/필터/열기 |
| R26 / AT26 / AC26 | 세션 시작으로 새 프로젝트가 생성되면 해당 nav 행이 펼쳐지고 첫 대화가 나타난다. 기존 프로젝트 접힘과 수동 접기 선택은 유지한다. | main 신규 생성→session.updated→nav 펼침/하위 조회; 신규·재사용·초기 로딩 구별 |
| R27 / AT27 / AC27 | 두 페이지 제목 아래 설명이 없고 엔진&모델 제목 우측은 settings 원천의 설정 수와 한국어 단위를 표시한다. | useEngines→source 필터→제목; settings 2개+runtime 1개 입력에서 2개, 추가/삭제/빈 목록 |

최근 대화 파티션은 기존 고정 프로젝트와 고정 대화의 중복 제거를 재사용한다. 미고정 프로젝트 대화는 최근에도 표시되며 프로젝트 없는 대화를 임의로 배정하지 않는다. cwd 없는 프로젝트는 경로를 발명하지 않고 기존 Desktop 기본값 계약을 유지한다.

### 14.2 Architecture / V / 강제 지점

Main DB·migration·기존 대화 프로젝트 배정은 이번 범위 밖이다. 공통 `CatalogListRow`를 재사용하고 nav는 기존 project row 및 session partition을 조립한다. 프로젝트 landing은 새 대화의 외부 px-4·내부 max-w-[720px] 경계를 적용하고 플러그인은 `/plugins` route로 연결한다.

신규 프로젝트 자동 펼침은 Main의 실제 생성 결과를 `session.updated.patch.projectCreated` 선택 필드로 전달한다. renderer는 해당 project ID의 펼침 요청을 보관하여 catalog 조회의 지각 응답 뒤에도 적용한다. 최초 전체 목록이나 기존 project 재사용을 새 생성으로 추측하지 않는다.

엔진 제목의 setting 수는 `AgentEnvironment.source === 'settings'`의 표시 항목 수다. 모델 수나 읽기전용 `runtime` 원천 환경은 setting 파일 개수로 세지 않는다. `common.count`를 재사용하며 설정 편집·추가·삭제 동작은 유지한다.

| EP | 강제 지점 / N | 실패 의미 / oracle |
|---|---|---|
| EP13 | nav 파티션·두 그룹 공통 프로젝트 행·최근 슬롯 / 3 | 고정 중복/미할당 소실/경로 순서 오류; 파생·렌더·클릭 |
| EP14 | 프로젝트 landing·프로젝트 catalog·아티팩트 제목 / 3 | 콘텐츠 경계/경로 메타/단위 오류; 실제 치수·렌더 |
| EP15 | 플러그인 nav route·catalog tabs/content / 2 | 페이지 진입 단절/기존 검색·상세 소실; route와 상호작용 |
| EP16 | Main 생성 사실 발신·renderer nav 펼침 적용 / 2 | 기존 프로젝트를 신규로 오인/지각 목록에서 신호 소실; 생성·재사용·이벤트 순서 행동 |
| EP17 | 엔진 제목의 설명·설정 총계 / 1 | runtime·model 수 혼동/설명 잔존; 혼합 원천 및 실제 화면 |

| Pair | 노드 상태 / requiredness | 경로와 oracle | EP |
|---|---|---|---|
| VP35~41 | NEW R19~25↔AT19~25 / REQUIRED | §14.1 각 행동의 DOM·경로·필터 결과 | EP13~15 중 해당 지점 |
| VP42 | CHANGED SD4↔ST4 / REQUIRED | pin→nav 이동→project landing→recent→기존 대화; 프로젝트 상태 보존 | EP13·14 |
| VP43 | NEW AR6↔IT6 / REQUIRED | Sidebar→plugins route→feature 탭/검색/상세 | EP15 |
| VP44 | CHANGED MD5↔UT5 / REQUIRED | project pin·session membership→nav 각 목록, 기존 미할당 포함 | EP13 |
| VP45 | INHERITED R14·16·17↔AT14·16·17 / REGRESSION | landing cwd·지침 편집·catalog 전체 총계 | EP10·11 |
| VP46 | NEW R26↔AT26 / REQUIRED | 신규 세션→새 프로젝트→nav 펼침→첫 대화 | EP16 |
| VP47 | NEW AR7↔IT7 / REQUIRED | bindStartingProject→wire→project sync→목록 지각 응답 | EP16 |
| VP48 | NEW MD7↔UT7 / REQUIRED | 실제 created flag→expand 요청·소비; 기존 접힘·수동 접기 보존 | EP16 |
| VP49 | NEW R27↔AT27 / REQUIRED | projects/engine 화면→제목 설명 제거·settings 총계 | EP14·17 |
| VP50 | NEW MD8↔UT8 / REQUIRED | 환경 원천→settings 항목 수→제목; runtime·모델 수 독립 | EP17 |

기존 AC14의 순서·메타 제거·cwd는 유지하고 폭만 AC20으로 정정한다. AC15의 prefix·최근 제거는 AC19·21·24로 대체하며 AC17의 총계는 AC22로 보완한다. 나머지 V1/V2 pair는 비영향이므로 이전 증거 승계, 이번 전면 재검증은 NOT_REQUIRED다. 직접 행동을 검증하므로 별도 변이는 not selected다.

### 14.3 운영 gate / READY 대조

main/web/test typecheck, 변경 파일 읽기 ESLint·Prettier, nav/landing/catalog/plugin 관련 vitest, Electron fixture 시각·치수·액션, 직접 electron-vite build, doc inventory·test budget·diff whitespace와 INDEX/trailer를 확인한다. DB를 수정하지 않으므로 DB ABI 변경과 새 migration은 불필요하다.

READY: D-17~24의 각 결과를 AC19~27 및 EP13~17에 대조했다. 취소한 고아 보정은 구현 경로에서 제외했고 최근 분류 복구는 기존 membership 파티션으로 구체화했다. 기존 지침/세션 관계와 새 표시 계약 간 충돌은 없다.

### [구현자 기입] Delta V3 결과

AC19~27 자기확인 9/9, EP13~17 전수 11/11 완료. r3 구현 보고에 V-pair·게이트·실제 치수와 수정한 파생 문제를 기록했다. 독립 verify는 pending이며 사용자 정정으로 취소한 기존 대화 재배정은 구현하지 않았다.

## 15. Delta V4 — 플러그인 항목 목록과 우측 상세

READY. 기준은 `73ac30a0`의 V1~V3다. 같은 사용자 피드백 구현 턴의 추가 요청이며 새로운 독립 검증 라운드를 만들지 않는다.

| 결정 | 사용자 결과 | 상태 |
|---|---|---|
| D-25 | 플러그인 세 탭의 항목을 아티팩트와 같은 리스트로 표시하고 목록 헤더를 제거한다. | ACTIVE; 그룹별 표·열 헤더·접힘 헤더 대체 |
| D-26 | 항목 클릭 시 기존 depth 이동 대신 목록 옆 우측 상세 패널을 연다. | ACTIVE; V3의 상세 화면 교체 방식을 대체 |
| D-27 | Code 우측 변경사항 패널의 펼치기도 transcript 전체를 덮는다. | ACTIVE; 사용자 추가 요청 |

페이지 제목과 스킬·MCP·연결 탭은 유지한다. 목록 헤더는 그룹 헤더와 표 열 헤더를 뜻하며 항목의 이름·보조 정보는 공통 `CatalogListRow` 안으로 옮긴다. 기존 상세의 토글·편집·삭제·연결·인증과 스킬 본문 기능을 우측 패널에서 유지한다.

| R / AT / AC | 관측 기준 / 경로 | oracle |
|---|---|---|
| R28 / AT28 / AC28 | 각 탭은 무헤더 세로 항목 목록이며 아이콘·제목·보조 정보와 선택 상태를 보여준다. | 공통 row 실제 렌더·세 탭 클릭·키보드 |
| R29 / AT29 / AC29 | 목록 항목→같은 페이지 우측 상세, 목록·탭·추가 버튼 유지. 닫으면 실행한 행으로 초점 복귀, 탭 이동은 상세를 닫는다. | 실제 DOM 동시존재·좌표·close/tab/focus |
| R30 / AT30 / AC30 | 공통 우측 패널의 크기 조절·확대·복원을 사용하고 선택 전환 시 이전 항목의 폼·본문 표시 모드가 새 항목에 남지 않는다. | 드래그·키보드·치수·서로 다른 상세 전환 |
| R31 / AT31 / AC31 | Code 변경사항의 기존 펼치기 버튼을 누르면 nav를 제외한 transcript host 전체를 덮고 다시 누르면 원래 패널 폭으로 복원한다. | GitContextBar 버튼→RightPanel→공통 pane; 실제 host rect·원폭·선택 보존 |

Architecture: `ExtensionsCatalogView`가 selection과 폭·확대 상태를 보유하고 기존 상세 컴포넌트를 `ResizableSidePane`에 조립한다. skills feature끼리만 결합하며 chat feature를 import하지 않는다. 목록은 항상 mounted, 확대 시 inert이고 상세 수명은 탭+항목 ID로 구분한다. ID는 선택한 탭 안에서만 해석해 다른 탭의 동명 ID와 충돌하지 않는다.

| EP / 지점 | N | 실패 의미 / 직접 관측 |
|---|---:|---|
| EP18 스킬·MCP·연결 리스트 | 3 | 표/그룹 헤더 잔존·다른 형상·잘못된 선택; 실제 row DOM |
| EP19 선택·닫기·탭전환·항목전환·rename/delete | 5 | 목록 소실·초점 소실·다른 항목 폼 누출·stale 선택; 실제 이벤트 |
| EP20 상세 panel resize·expand/restore | 2 | 별도 조절 로직·좁은 창 overflow·목록 remount; 공통 panel 치수·키보드 |
| EP21 Code 변경사항 버튼·host 확대/복원 | 2 | 최대 폭만 바뀌고 transcript가 남음; 실제 버튼→전체 rect·복원 |

| pair | 노드 / requiredness | 경로 / oracle |
|---|---|---|
| VP51~53 | NEW R28~30↔AT28~30 / REQUIRED | 각 AC의 실제 renderer 행동; EP18~20 |
| VP54 | NEW SD5↔ST5 / REQUIRED | select→panel→switch/tab/close→목록/초점; EP19 |
| VP55 | CHANGED AR6↔IT6 / REQUIRED | plugin route→list+shared pane→기존 상세 액션; EP18~20 |
| VP56 | NEW MD9↔UT9 / REQUIRED | tab+ID→선택 상세/수명; 다른 탭 동일ID·삭제/rename; EP19 |
| VP57 | INHERITED R23↔AT23 / REGRESSION | 페이지 진입·가로 탭·추가/편집/인증 기능; EP15 |
| VP58 | NEW R31↔AT31 / REQUIRED | Code 변경사항 펼치기→공통 전체 덮기→원복; EP21 |
| VP59 | CHANGED AR2↔IT2 / REQUIRED | GitContextBar→registry header props→RightPanel 확대 상태→ResizableSidePane; EP21 |
| VP60 | INHERITED R9↔AT9 / REGRESSION | 다른 task/viewer의 전체 확대·복원·공통 크기 조절; EP6 |

직접 행동 oracle을 사용하므로 별도 mutation은 not selected다. 필수 gate는 renderer 타입·변경 소스 ESLint/Prettier·영향 Vitest·실제 Electron 목록/패널/좁은 화면·build·문서 inventory·diff whitespace다. DB·메시지 프로토콜은 비영향, D-25~27과 AC28~31·EP18~21의 충돌은 없다.

플랫폼 경로 정정의 기술 적용: `infra/config`의 OS 임시 경로 resolver를 첨부·출력 준비가 함께 사용한다. Node `os.tmpdir()`의 OS 사용자 임시 폴더를 사용하여 Windows 기본 LocalAppData/Temp와 시스템 재지정을 따른다. Work prompt에는 실제 native 경로를 명시하고 `/tmp`를 Windows 파일로 바꾸는 별칭 해석은 제거한다; 기존 관리 사본·기존 대화의 경로는 이동하지 않는다.

### [구현자 기입] Delta V4 결과

AC28~31 자기확인 4/4, EP18~21 전수 12/12 완료. r3 패널 구현 보고에 V-pair·게이트·native 증거 및 메뉴 Escape/지연 저장의 파생 문제 수정을 기록했다. 같은 r3 구현 턴이며 독립 verify는 pending이다.

## 16. 0226 리팩토링 및 공통 버튼 — Delta V5

READY · 작성 Codex · 2026-09-10 · 기준 `c02610ba`의 V1~V4. 기존 동작은 본 plan 본문의 ACTIVE 결정이 정본이다. 사용자 요청에 따라 같은 0226에서 r4를 진행한다.

### 16.1 결정과 범위

| 결정 | 출처 / 결과 |
|---|---|
| D-28 ACTIVE | “리팩토링…모듈화, 재사용, 간소화” — 반복되는 카탈로그 조작과 패널 조립을 공유하고 UI·비동기 액션·파일 작업의 책임을 분리한다. |
| D-29 ACTIVE | “비슷한, 같은 버튼은 아이콘을 통일…구글 메테리얼 svg” — 같은 역할은 공통 버튼과 Material Symbols Outlined SVG를 사용한다. 패널 펼치기/복원/닫기의 표시 라벨도 공통화한다. 대상 이름이 필요한 접근성 이름은 보존한다. |

동작 보존 리팩토링이 기본이며 D-29의 아이콘·버튼 문구만 표시 변경이다. 새 의존성·DB migration·IPC 스키마·출력 수집 정책·인증 및 HTML 격리 변경은 없다. 최근 대화 복구, 프로젝트 경로·고정·자동 펼침, 출력과 아티팩트 구분, 메모 독립 표시를 유지한다.

검토한 대안: 범용 store/패널 프레임워크는 서로 다른 요청·route 수명과 권한 정책을 억지로 합친다. 파일을 크기만으로 자르는 방식은 중복을 줄이지 못한다. 실제 중복 조작을 공유하고 한 파일에 섞인 책임만 분리하는 안을 선택한다.

### 16.2 AS-IS → TO-BE

| 현재 근거 | 변경 / 소유자 |
|---|---|
| ProjectsScreen·ArtifactsView·CustomizeTabs가 같은 tab ARIA/방향키/스타일 반복, 앞의 두 화면이 검색 초점/Escape 반복 | shared `CatalogTabs` 및 작은 카탈로그 검색 hook/UI. 필터·총계·생성·삭제·선택 데이터는 feature에 유지 |
| CustomizeList는 그룹을 만든 직후 rows를 flatMap. 그룹 제목·빈 그룹 모델은 표시되지 않음 | skills 내부 순수 `catalogOrder`로 최종 순서만 반환. 스킬 source의 동률/연속성, 활성 MCP 우선, provider kind 순서 유지 |
| ArtifactCard는 단일 카드·세션 구독 묶음·오류 메시지 매핑 혼재, viewer가 오류 하나 때문에 UI 파일 import | `ArtifactCard`/`ArtifactCards`, `lib/artifactFeedback`로 분리. import edge를 실제 책임에 연결하고 호환 배럴은 만들지 않음 |
| ArtifactViewer copy/download가 busy·피드백·현재 요청 확인을 반복 | `useArtifactViewerActions(selection)`에서 단일 실행 잠금과 요청 수명 처리. UI는 액션 상태·명령을 소비 |
| RightPanel이 separator·열/행 애니메이션·타일 조립·viewer host 수명 모두 포함 | 같은 feature의 `PanelResizeSeparators`, `RightPanelColumn`, 순수 `rightPanelViewport`로 분리. column/tile key와 평탄한 자식 배열 유지 |
| 패널 확장 버튼 4곳이 같은 icon과 다른 문구를 반복 | shared `PanelExpandButton`/`PanelCloseButton`, 공통 i18n 라벨. viewer·extension·task/plan·Code diff에 적용. compact/small 크기와 기존 data marker 유지 |
| 출력 카드의 탐색기 열기는 folder, diff 파일 열기는 arrowNE | 같은 파일 reveal 동작에 Material `file_open` 적용. 디렉터리를 여는 folder와 외부 링크를 여는 north_east는 역할에 맞게 유지 |
| TextExtractor.extract는 실제 첨부 경로에서 미사용, NUL/BOM 처리가 실제 경로에도 존재 | 클래스·옛 전체 파일 읽기 제거. 제한 읽기 후 현재 첨부 디코딩 한 경로만 유지 |
| artifact IPC 등록 파일에 내보내기 경로 검증·동명 파일 저장·안전 교체가 섞임 | 같은 artifact feature의 `export-files`로 이동. IPC는 sender·dialog·ID 재검사·DTO 조립만 담당 |

Material 원본은 [Google 저장소](https://github.com/google/material-design-icons)의 `symbols/web/<glyph>/materialsymbolsoutlined/<glyph>_24px.svg`를 확인한다. 펼치기=`open_in_full`, 복원=`close_fullscreen`, 닫기=`close`, 더보기=`more_vert`, 고정=`push_pin`, 파일 탐색=`file_open`, 복사=`content_copy`, 다운로드=`download`, 재조회=`refresh`, 미리보기=`visibility`, 코드=`code`를 기존 `Icon` SVG 진입점에서 재사용한다. 자체 그린 확대/복원 경로는 공식 원본으로 교체하고 실제 렌더로 확인한다.

### 16.3 인수 기준과 Delta V

| AC / R·AT | 사용자 관측 / 직접 oracle |
|---|---|
| AC32 / R32·AT32 NEW | 같은 역할의 패널 버튼이 같은 SVG·표시 라벨을 갖고 펼치기→host 전체→복원→닫기, 파일 열기 메뉴가 기존 동작을 실행한다. 실제 버튼 DOM/콜백·native 화면 |
| AC33 / R33·AT33 NEW | 카탈로그 두/세 탭, 방향키/Home/End, 검색 열기/Escape/초점, 필터·총계·생성/고정 후 초점이 동일하게 동작한다. 최종 행 순서와 native 사용자 흐름 |
| AC34 / R34·AT34 NEW | 출력 단일/묶음 카드와 뷰어 복사/저장·취소/오류·닫기/전환 후 지각 완료 무시가 유지된다. 기존 수명 테스트와 deferred 액션 |
| AC35 / R35·AT35 NEW | 첨부 BOM/NUL·Temp 사본·상한/원본 보존 및 artifact 내보내기 동명 충돌/하드링크/실패 정리가 실제 production 경로에서 유지된다. 실파일 테스트 |

| EP | 강제 지점 / N | 실패 의미 |
|---|---|---|
| EP22 | viewer·extension·task/plan tile·diff header 확장/닫기 / 4 | 같은 역할 문구/자원이 달라지거나 props 전달·복원 소실 |
| EP23 | project·artifact·plugin 탭 및 project/artifact 검색 / 5 | ARIA 연결·방향키·Escape/초점·총계 소실 |
| EP24 | skill·MCP·provider 순서 / 3 | 동률 source가 섞이거나 입력을 mutate |
| EP25 | 단일 카드·세션 묶음·viewer copy·viewer save / 4 | 다른 선택 결과가 남거나 저장 대상·상태 구분 소실 |
| EP26 | 첨부 실제 decode·export 목적지·동명 저장·안전 교체 / 4 | 우회 읽기·원본 변경·중간 실패 잔여 |
| EP27 | 출력 카드 reveal·diff 파일 reveal / 2 | 같은 파일 작업의 잘못된 아이콘 또는 경로 콜백 변경 |

| Pair | 노드 / requiredness | 경로 / oracle |
|---|---|---|
| VP61~64 | NEW R32~35↔AT32~35 / REQUIRED | 각 AC 직접 동작, EP22~27 해당 지점 |
| VP65 | NEW AR8↔IT8 / REQUIRED | 세 카탈로그→공통 controls→기존 필터/선택, 카드/viewer→feature hook/lib, IPC→export-files; 실제 소비 경로 테스트 |
| VP66 | NEW MD10↔UT10 / REQUIRED | 최종 catalog 순서·viewer 액션의 중복 잠금/요청 소유권·첨부 decode; 순서/지각 Promise/실파일 oracle |
| VP67 | INHERITED R9·R31↔AT9·AT31 / REGRESSION | 분리된 열/타일→공통 pane→resize/전체 확대/원폭/스크롤/초안 유지 |
| VP68 | INHERITED R3~8·R10~11↔해당 AT / REGRESSION | 출력 선택·소유권·preview 격리·save-all·기존 카드와 늦은 결과 |
| VP69 | INHERITED R19~30↔해당 AT / REGRESSION | nav/프로젝트/cwd/최근·카탈로그 순서·총계·플러그인 상세/모달·초점 |

선택 적대 증거: 없음. 행 순서·실행된 콜백·지각 Promise·실파일·실제 화면으로 직접 검증한다. 분리 파일 수/호출문 수로 동작을 대신 증명하지 않는다. 이번 비영향인 DB migration·스케줄 프로토콜·런타임 admission은 기준 V를 승계하고 전면 재검증은 NOT_REQUIRED다.

### 16.4 구현 작업 목록

- [x] 카탈로그: 기존 행동 테스트 baseline → 공유 tabs/search → 최종 순서 helper → 영향 테스트/native.
- [x] 출력/패널: 카드·피드백·액션 hook·열 조립 분리 → 기존 imports 직접 갱신 → 수명/폭 회귀.
- [x] Main: 실제 normalizeAttachments로 BOM/NUL 사례 이동 → 죽은 추출기 제거 → export-files 분리 → 실파일·IPC 회귀.
- [x] 버튼: 기존 렌더 테스트에 동일 역할 기대값 → 공식 SVG 및 공통 panel controls → 모든 EP22/27 소비처 대조.
- [x] 통합: 코드 리뷰 → main/web/test 타입, 변경 소스 ESLint/Prettier, 영향 Vitest, Electron native, build, doc inventory/test budget/whitespace → 문서·INDEX 보고. 검증된 변경을 기존 브랜치에 커밋·푸시한다.

### 16.5 운영 / READY 검토

기존 공유 브랜치에서 이어간다는 사용자 맥락에 따라 현재 checkout을 사용한다. 4-layer/feature DAG, OS Temp SSOT, 각 파일 읽기의 서로 다른 검증 정책을 유지한다. UI 리팩토링 baseline은 기존 r3 native fixture를 재사용하고 새 r4 결과를 별도로 기록한다. 테스트 파일명은 계약이 아니며 행동 단언을 이동한 뒤 다시 실행한다.

`handoff-review`는 r4 진입에 따른 DIAGNOSE_ONLY: 사용자 후속 레이아웃/경로 정정은 D(결정 변경), 이번 아이콘 일관성은 F(공유 구현 누락)로 본다. 현재 renderer 가이드의 공통 UI·기존 §15의 재사용 계약이 충분하므로 SKILL/AGENTS를 수정하거나 과거 corpus를 추가하지 않는다. 독립 verify pending을 자기확인 PASS로 바꾸지 않는다.

READY self-review: D-28/29→AC32~35→VP61~69→EP22~27의 경로를 대조했다. 외부 계약이나 제품 정책 선택 없이 현재 동작을 유지하는 구현 경계가 확정되었다.

### [구현자 기입] Delta V5 결과

AC32~35 자기확인 4/4. r4 구현 보고에 설계 리뷰·EP22~27 각 지점·VP61~69·직접 검사·UX 파생 수정·게이트·Review Signals를 기록했다. 독립 verify는 pending이다.

## 17. 0226 후속 동작 및 Windows CI — Delta V6

READY · Codex · 2026-09-10 · 기준 `769cd454`. 사용자 후속 요구와 CI red gate를 같은 0226 r5에서 처리한다. V1~V5의 비충돌 계약과 독립 verify pending을 승계한다.

### 17.1 결정과 사용자 결과

| 결정 | 출처와 계약 |
|---|---|
| D-30 ACTIVE | 최근 대화도 접을 수 있어야 한다. 모든 최근 대화(임시 대화 포함)는 같은 그룹 하위에 놓고 표시용 프로젝트 prefix를 제거한다. 제목 자체의 `/`는 유지한다. |
| D-31 SUPERSEDED → D-36 | 일반/아티팩트 카드는 해당 assistant 턴의 마지막에 모은다. 확정 본문과 live 본문 아래에 spark/status, 그 뒤 완료 메타와 카드가 온다. **배치 순서는 아래 §18 Delta V7로 대체한다.** 배경 대기 때 spinner를 숨기는 D-11은 유지한다. §13.2의 일반 출력 세션 최하단 배치를 대체한다. |
| D-32 ACTIVE | 일반 산출물은 Windows OS 사용자 Temp의 실제 파일을 읽고 열고 저장한다. 관리 아티팩트 디렉터리 사본을 일반 파일의 읽기 원본으로 사용하지 않는다. 외부 게시 아티팩트의 관리 사본은 유지한다. |
| D-33 SUPERSEDED → D-35 | 앱의 Claude 대화 기본 정책은 Bash·WebSearch 제외, PowerShell 허용이다. **PowerShell 자동 허용은 아래 §18 Delta V7의 노출/승인 분리로 대체한다.** 관리 provider 설정 템플릿과 실행 설정에 `env.CLAUDE_CODE_USE_POWERSHELL_TOOL="1"`, `skipWebFetchPreflight=true` 기본값을 제공한다. 기존의 명시 환경/설정 우선순위는 보존한다. completion의 도구 비활성은 유지한다. |
| D-34 ACTIVE | 사용자가 전달한 Vitest red gate를 수정한다. Windows 짧은 경로와 canonical 경로의 같은 파일을 허용하되 경로 탈출은 허용하지 않는다. 현재 계약에 뒤처진 테스트 대역을 보강하고 숨겨진 실행 오류도 검출한다. |

대안 검토: 카드 위치를 수신 시각이나 현재 마지막 메시지로 추정하면 늦은 도구 결과가 다음 턴에 붙는다. 기존 tool ID 및 응답 경계, 영속 artifact part를 재사용한다. 새 DB migration이나 타임스탬프 추정은 도입하지 않는다. 소유권 근거가 없는 과거 일반 출력은 우측 출력 목록에서 계속 제공하며 임의의 과거 턴에 끼워 넣지 않는다.

### 17.2 데이터 흐름과 상태

- Write/Edit 또는 Stop 명시 링크 → 제한된 Temp 파일 캡처 → SDK hook 결과 대기열 → SDK result의 telemetry 이전 `output.captured` → HistoryWriter의 소유권 확인/원래 메시지 artifact part → renderer의 같은 메시지 → 해당 턴 footer.
- Write/Edit는 `toolRunId`로 원래 호출 메시지를 찾는다. Stop 결과는 해당 응답 경계를 전달한다. Main에서 검증되지 않은 출력은 renderer에 연결하지 않는다. 오류/취소 시 경계 없는 Stop 출력을 다음 응답으로 넘기지 않는다.
- 일반 파일 capture는 메타데이터만 등록하고 관리 사본을 만들지 않는다. status/preview/save/reveal/trash의 단일 분기에서 category=file은 등록한 Temp 원본을 재검사한다. 파일 소실은 missing, 링크/정션·Temp 밖 경로는 거부한다. 기존 일반 출력도 등록한 원본으로 읽고 사본으로 fallback하지 않는다.
- 동일 파일 재수집은 기존 중복 억제를 유지하되, 현재 턴에서 명시적으로 생성/언급한 출력의 part 연결을 허용한다. 턴 안에서는 publicationId로 중복 제거한다.
- 최근 대화 접힘은 기존 CollapsibleSection의 화면 수명을 따른다. 새 항목 수신이나 route 변경이 사용자의 접힘을 강제로 풀지 않는다.
- provider 신규 설정/seed에는 기본값을 합성한다. 기존 설정 파일을 일괄 수정하지 않고 실행 시 누락된 기본값을 보완한다. 기존 custom > runtime > provider > app > process 우선순위를 보존한다.

### 17.3 AC와 유효 V

| AC / 노드 | 관측 가능한 결과 |
|---|---|
| AC36 / R36↔AT36 | 최근 대화 접기/펼치기·키보드, 모든 항목의 그룹 소속, 표시 prefix 제거와 실제 제목 보존 |
| AC37 / R37↔AT37 | 확정/live 본문→spark→카드 순서, 여러 턴·늦은 출력·reload에서 원래 턴 footer 유지, 일반/게시 동일 카드 액션 |
| AC38 / R38↔AT38 | 일반 파일 작업은 실제 Temp 원본에서 동작하고 관리 사본을 만들지 않음. 게시 아티팩트는 기존 관리 파일 유지. 삭제/교체/권한·범위 실패를 구분 |
| AC39 / R39↔AT39 | Work/Code SDK query의 deny/allow 및 신규·기존 실행 설정 기본값, 명시 설정 우선순위, completion 도구 없음 유지 |
| AC40 / R40↔AT40 | 전달된 CI 테스트가 Windows 실제 경로 및 현행 런타임/부팅 계약으로 통과하고 미등록 파일·정션 탈출은 계속 거부 |

| Pair | requiredness / 경로 / 직접 oracle |
|---|---|
| VP70~74 | REQUIRED · NEW R36~40↔AT36~40 · 위 AC의 native DOM/실파일/실제 query 옵션/실제 handler 실행 |
| VP75 | REQUIRED · NEW AR9↔IT9 · hook→SDK result→HistoryWriter→DB part→reducer의 일반 출력 연결, 도구 ID/응답 경계/중복/다른 세션 검증 |
| VP76 | REQUIRED · NEW MD11↔UT11 · Temp inspect 및 renderer footer 조립, 짧은 경로 canonicalization와 대역 오류 검출 |
| VP77 | REGRESSION · R6~8·R10~12↔해당 AT · 게시 소유권/격리 preview/save/trash, 배경 idle와 출력 액션 수명 |
| VP78 | REGRESSION · R19~30↔해당 AT · 고정됨→프로젝트→최근 순서 및 프로젝트/최근 탐색 |

선택 적대 증거: 없음. 실제 이벤트·DOM 순서·실파일과 실제 호출 인자로 검증한다. 비영향 패널 리사이즈·카탈로그 탭 전체 회귀는 V5 증거를 승계한다.

### 17.4 §10 강제 지점과 구현 경계

| EP | 언제 강제 / 지점 | 실패 의미 |
|---|---|---|
| EP28 | Sidebar 그룹·draft 행·저장 대화 행 / 3 | 그룹 밖 항목 또는 프로젝트 prefix 잔존 |
| EP29 | hook 수집·SDK drain·history 연결·live reducer·reload part·AssistantTurn footer / 6 | 다음 턴 오귀속, 중복, 카드 뒤 본문/spark |
| EP30 | ordinary capture·status·preview/export·reveal·trash / 5 | Temp 대신 관리 사본 읽기 또는 범위 우회 |
| EP31 | conversation query·completion query·설정 조립·신규 scaffold/seed·provider template·system header / 6 | Bash 지침 잔존, WebSearch 노출, env 우선순위 변경 |
| EP32 | session cwd·extraDirs·정확한 첨부·runtime fixture·bootstrap catalog / 5 | 8.3 경로 오거부, 미등록/정션 허용, 오류 은폐 |

Renderer는 기존 `ArtifactCards`와 `CollapsibleSection`을 사용한다. Main은 `TurnExtensions.outputFiles.capture` 반환값 및 hook 콜백으로 수집 결과를 정규화 스트림에 합친다. DB의 기존 message/tool 연결과 artifact part 포맷을 사용하며 일반 출력 전용 링크 검증은 게시 도구의 영수증 검증과 구분한다. 코드 경로의 category 분기와 제한 읽기는 한 서비스 내부에 모은다.

### 17.5 운영 gate와 READY 검토

영향 Vitest, main/web/test typecheck, 변경 TypeScript ESLint/Prettier, doc inventory/test budget/whitespace, Electron 빌드, 실제 SQLite 경로 검사와 native DOM 순서를 확인한다. 현재 Electron ABI를 유지하며 Node용 rebuild는 하지 않는다. 신규 의존성은 없다. 설계와 구현 커밋을 분리하고 현재 원격 브랜치에 푸시한다.

r5 handoff-review는 DIAGNOSE_ONLY. 새 사용자 배치/정책 결정과 CI 대역 drift를 기존 재구현 불변식에 반영한다. 스킬/AGENTS 수정은 필요 없다. D30~34→AC36~40→VP70~78→EP28~32를 대조했고 구현 가능한 경계와 실패 oracle을 확정했다.

### [구현자 기입] 결과

AC36~40 자기확인 5/5. r5 구현 보고에 EP28~32 전수, VP70~78 증거, 구현 중 발견한 경계 사례와 운영 gate를 기록했다. 독립 verify pending.

## 18. 0226 도구 노출과 spark 순서 정정 — Delta V7

READY · Codex · 2026-09-10 · 기준 `b727adbb`. 사용자가 같은 작업의 요구를 명시적으로 정정했으므로 r6에서 이어간다. V1~V6의 비충돌 계약과 독립 verify pending을 승계한다.

### 18.1 Decision Ledger와 동작

| 결정 | 출처 / 결과 |
|---|---|
| D-35 ACTIVE | “항상 허용이 아닌 도구 노출이 목적” — D-33의 PowerShell 자동 허용을 대체한다. Claude Work·Code는 Bash/WebSearch를 제외하고 SDK 기본 도구와 PowerShell을 노출한다. 앱이 PowerShell을 allowedTools로 자동 허용하지 않는다. 기존 permission mode와 승인 경로를 따른다. PS 활성화 환경값, WebFetch preflight 기본값, 명시 설정 우선순위는 승계한다. |
| D-36 ACTIVE | “사용자 메시지 버블, 어시스턴트 메시지 버블, 카드 ui, 스파크 순서” — D-31/AC37의 spark 앞 카드 배치를 대체한다. 확정/live 본문 → 일반/게시 카드 → spark/status가 같은 응답의 순서다. 완료 메타는 기존처럼 완료한 본문과 카드 사이에 둔다. idle/background ready에서 진행 spark를 숨기는 기존 정책은 유지한다. |

노출과 승인을 분리한다. 기본 도구 이름을 수동으로 전부 나열하면 SDK의 기본 도구가 누락될 수 있으므로 SDK 기본 집합을 유지하고 제외 목록만 적용한다. PowerShell은 env로 활성화한다. `allowedTools` 제거 후에도 Orca의 `canUseTool` 안전 도구 fallback이 자동 승인하지 않도록 PowerShell을 기존 shell 승인 분류에 넣는다. 승인/거절과 사용자가 선택한 permission mode는 그대로 전달한다.

화면은 PendingAssistant의 본문과 status 사이에 출력 카드를 조립할 수 있게 하여 live 리프 구독을 보존한다. 첫 응답의 assistant 메시지가 아직 없으면 기존 본문/status fallback을 사용하고 spark는 한 번만 표시한다. 파일 소유권·수집·영속·Temp 작업 경로는 바꾸지 않는다.

### 18.2 인수 기준과 V

| AC / 노드 | 사용자 관측 / oracle |
|---|---|
| AC41 / R41↔AT41 NEW | Work·Code에서 Bash/WebSearch를 제외한 SDK 기본 도구와 PowerShell을 노출하고 PowerShell을 자동 허용하지 않는다. 실제 query 옵션, canUseTool의 승인/거절 전달 및 기존 completion 도구 비활성 검사 |
| AC42 / R42↔AT42 NEW | 사용자→확정/live 본문→일반/게시 카드→spark 순서이며 spark는 하나다. 늦은 카드·첫 전송·reload·background ready 및 카드 액션 유지. 실제 React 조립과 Electron DOM/수직 순서 |

| Pair | requiredness / production path / oracle |
|---|---|
| VP79 | REQUIRED · NEW R41↔AT41 · Work/Code 요청→query 기본 도구+제외/활성화→SDK 권한 callback→기존 승인 응답, 실제 옵션과 spy 결과 |
| VP80 | REQUIRED · NEW R42↔AT42 · Exchange→AssistantTurn→PendingAssistant 본문/카드/status, SSR+native DOM/수직 순서 |
| VP81 | REQUIRED · NEW AR10↔IT10 · query와 canUseTool의 노출/권한 분리, PendingAssistant 일반 fallback/카드 삽입 경로. 해당 integration tests |
| VP82 | REGRESSION · R37~39↔AT37~39의 비충돌 부분 · 원래 턴 귀속·중복·메타·idle·Temp·설정 우선순위·completion 도구 없음, 기존 테스트 및 r5 증거 승계 |

선택 적대 증거 없음. 실제 반환 옵션·호출 결과·렌더 DOM을 직접 관측한다. DB·파일 수집·nav·다른 패널은 비영향이며 V6 증거를 승계한다.

### 18.3 §10 강제 지점

| EP | 언제 강제 / N | 실패 의미 |
|---|---|---|
| EP33 | conversation query·PowerShell 권한 분류/callback·completion query / 3 | 자동 허용 잔존, 기본 도구 누락, 제외 도구 재노출, completion 도구 활성화 |
| EP34 | pending assistant의 카드 삽입·assistant 없는 fallback·완료 메타/카드·늦은 카드 갱신 / 4 | 카드 뒤 본문, spark 앞 카드 누락, 중복 spark, 새 출력이 다른 턴으로 이동 |

### 18.4 작업과 gate

기존 테스트의 query/승인 및 spark 순서를 새 계약으로 먼저 바꾸어 red 확인 후 최소 구현한다. PendingAssistant의 공통 합성과 기존 ArtifactCards를 사용하며 새로운 store/IPC/의존성은 만들지 않는다. 영향 Vitest, node/web/test 타입, 변경 파일 ESLint/Prettier, Electron native 순서·스크린, build, inventory/test-budget/whitespace를 수행한다. 현재 ABI와 기존 브랜치를 유지하고 설계·구현 커밋을 분리한 뒤 원격에 푸시한다.

handoff-review DIAGNOSE_ONLY: 이번 정정은 D(User decision change)다. 기존 명시 결정의 supersede만 기록하며 스킬/지침을 바꾸지 않는다. READY self-review: D35/36→AC41/42→VP79~82→EP33/34의 생산·소비·실패 경로를 대조했다.

### [구현자 기입] Delta V7 결과

AC41·42 자기확인 2/2, VP79~82 SELF_PASS, EP33 3/3·EP34 4/4. r6 구현 보고에 승인 fallback 보강, 카드 부모 유지, 영향 Vitest 198건·native 46건 및 운영 gate 결과를 기록했다. 독립 verify는 pending이다.

## 19. 0226 CI·추가 버튼·Temp 게시 보정 — Delta V8

READY · Codex · 2026-09-10. V1~V7 및 r6 구현 `cdc8175b`를 승계한다. 같은 사용자 피드백의 구현을 이어가며 독립 verify pending은 유지한다.

### 19.1 Part I — 사용자 결과와 결정

| 결정 | 명시 요구 / 동작 |
|---|---|
| D-37 ACTIVE | “엔진 추가 버튼이 레퍼런스” — 프로젝트 상단 새 프로젝트와 플러그인 상단 스킬/MCP 추가를 같은 공통 Button 디자인으로 맞춘다. 기존 생성 모달·스킬 메뉴와 탭 전환을 유지한다. |
| D-38 ACTIVE | “publish artifact 도구가 … Temp 경로를 unsafe-path라고 한다. 해당 경로는 허용” — 게시 입력에 실제 OS 사용자 Temp와 그 하위 파일을 허용한다. Windows는 기존 resolver의 LocalAppData/Temp 및 OS 재지정을 따른다. cwd/add-dir 게시와 기존 파일 형식·크기·로컬 경로·실체 경계 검사는 유지한다. |
| D-39 ACTIVE | “vitest 실패: 첨부” — 첨부는 제목 한 줄뿐이다. 현재 HEAD의 CI run 34465282903에서 확인한 실패 10건을 보정하고 실행 결과로 확인한다. 테스트가 현재 동작과 어긋나면 기대값/fixture를 수정하며 정상 제품 동작을 과거 기대값으로 되돌리지 않는다. |

버튼은 light/dark에서 레퍼런스와 같은 색상·크기·간격·plus 아이콘을 사용한다. 스킬의 dropdown 표시와 메뉴 열림은 유지한다. 프로젝트 empty CTA는 지정한 상단 버튼과 별개이며 그대로 둔다.

Temp의 완성된 파일로 publish_artifact를 호출하면 관리 사본과 해당 세션의 게시 참조를 얻는다. 입력 원본은 보존하고 게시 성공 여부·취소·실패·재시도·세션 소유권은 기존 흐름을 따른다. OS Temp 허용은 게시 입력에 한정하며 임의 폴더나 다른 도구의 권한으로 확장하지 않는다. 일반 출력의 Temp 직속 원본 정책은 유지한다.

| AC / 노드 | 행동 기준 / 직접 oracle |
|---|---|
| AC43 / NEW R43↔AT43 | 프로젝트·스킬·MCP 상단 추가 버튼이 엔진 추가와 같은 primary/small/plus 토큰을 사용한다. 실제 computed style과 light/dark 화면, 기존 클릭·키보드·닫기 동작 |
| AC44 / NEW R44↔AT44 | cwd/add-dir 밖의 실제 OS Temp 파일을 게시할 수 있다. root·하위·Windows 짧은 표기, tool→service→실파일/DB/preview 경로. Temp 밖 형제 및 외부로 나가는 정션은 거부하고 게시 사본·원본·세션 격리를 유지한다. |
| AC45 / NEW R45↔AT45 | 현재 CI의 4 suite 10 실패를 재현 가능한 현재 계약으로 보정한다. 해당 suite 실행, 전체 Vitest 및 Windows CI 결과로 확인한다. |

### 19.2 Part II — 조사와 기술 적용

| 대상 | 관측 / 최소 적용 |
|---|---|
| 상단 추가 버튼 | AgentEnvironmentView는 primary/small/plus다. ProjectsScreen은 variant 생략, ExtensionsCatalogView는 contained이며 plus 누락이다. 기존 Button props만 맞추고 공통 토큰은 수정하지 않는다. |
| publisher 허용 root | tool→service→readArtifactInput의 허용 목록은 cwd/extraDirs뿐이다. SDK에는 별도로 Temp가 전달되지만 publisher context에는 없다. 파일 입력 검사에서 실제 Temp를 허용하고 query/사용자 extraDirs는 바꾸지 않는다. |
| Temp 검증 | getTemporaryFilesPath를 단일 출처로 사용한다. canonical root와 candidate containment 및 stable read 뒤 root/candidate 재검사를 유지한다. 기존 cwd 게시가 존재하지 않는 별도 Temp root 때문에 실패하지 않게 한다. |
| CI 현재 실패 | [run 34465282903](https://github.com/muzaby/orca-skin/actions/runs/34465282903): files.contextDirectory 1, attachments 2, composerRequirementWiring 6, workPanelSections 1. 경로 실체 기대값·현재 hook mock·컨텍스트 표시 기대값을 원인과 대조한다. |

publish 입력→바이트 검증→관리 파일 준비→DB publication→tool 영수증/알림의 기존 수명은 재사용한다. 새 저장소·migration·IPC·의존성은 없다. tool 설명과 현재 영속성 문서에 Temp 입력 허용을 반영한다. 실제 파일·DB 검증은 기존 service fixture의 독립 Temp resolver를 사용하여 허용 밖 형제 경로를 계속 검사한다.

| Pair | requiredness / 경로 / oracle |
|---|---|
| VP83 | REQUIRED · NEW R43↔AT43 · 세 화면 상단 Button→메뉴/모달, 실제 스타일·기존 액션 |
| VP84 | REQUIRED · NEW R44↔AT44 · Temp 완성 파일→publisher→관리 사본/세션 참조→preview, 실제 파일/DB 결과 |
| VP85 | REQUIRED · NEW AR11↔IT11 · runtime tool context→service→Temp 입력 검사·사본/DB·영수증, 실제 tool handler 합성 |
| VP86 | REQUIRED · NEW MD11↔UT11 · 허용 roots·canonical containment·stable read 및 후검사, 정상 Temp/short path와 외부 탈출·교체 직접 결과 |
| VP87 | REQUIRED · NEW R45↔AT45 · CI에 명시된 4 suite→생산 경로/현재 fixture→기대 결과, 로컬 및 CI Vitest |
| VP88 | REGRESSION · INHERITED R18·38↔AT18·38와 게시/카탈로그 동작 · 일반 Temp 직속·원본, 기존 cwd/add-dir·형식/크기·세션·취소/실패/cleanup, 기존 실제 suite |

별도 적대 변이는 not selected다. 실제 반환값·파일·DB·DOM을 직접 관측하며 r6의 PowerShell 승인 분리와 spark 순서 및 비영향 nav/패널은 기존 증거를 승계한다.

### 19.3 §10 강제 지점과 gate

| EP | 지점 / N | 실패 의미 |
|---|---|---|
| EP35 | 프로젝트 상단·스킬 상단·MCP 상단 / 3 | 다른 버튼 색상/아이콘, 메뉴·모달 동작 소실 |
| EP36 | Temp root 해석·candidate 경계·stable read와 후검사·서비스 사본/세션·tool 입력/영수증 / 5 | Temp 정상 파일 거부, 외부 탈출, 변경 중 혼합 바이트, 잘못된 세션/거짓 성공 |
| EP37 | files.contextDirectory·attachments·composerRequirementWiring·workPanelSections / 4 | Windows canonical 경로 불일치, 누락 mock export, 현재 컨텍스트 기대값 불일치 |

원인 재현 후 최소 수정한다. 영향 Vitest와 전체 Vitest, node/web/test 타입, 변경 파일 ESLint/Prettier, 두 테마의 실제 Button 스타일·메뉴/모달·좁은 화면, electron-vite build, inventory/test budget/whitespace를 수행한다. SQLite는 기존 Electron ABI를 유지하여 Electron-as-Node로 실행한다. 기존 브랜치에 설계와 구현을 분리하여 커밋·푸시하고 CI를 확인한다.

READY self-review: D37~39→AC43~45→VP83~88→EP35~37을 현재 호출부와 대조했다. 기존 ACTIVE 결정과 충돌 0; Temp 허용을 publisher에 추가하되 일반 출력의 직속 수집과 다른 도구의 권한은 유지한다. handoff-review DIAGNOSE_ONLY: 버튼은 사용자 구체화(D), Temp 입력 불일치는 구현 결함(F), CI는 현행 fixture와의 불일치를 실측 후 분류한다. 지침 자체는 수정하지 않는다.

### [구현자 기입] Delta V8 결과

AC43~45 자기확인 3/3, VP83~88 SELF_PASS, EP35 3/3·EP36 5/5·EP37 4/4. r7 구현 보고에 Windows 8.3 경로 재현, Temp 게시의 실제 tool/DB 동작, 최종 CSS native 228건 및 로컬·Windows CI의 전체 Vitest 결과를 기록했다. 독립 verify는 pending이다.

## [검증자 기입] 파생 이슈

> ΔV8 판정 원문은 [`verify.md`](verify.md). 여기엔 이관 대상 파생 이슈만 둔다. r1~r6은 독립 검증 없이 승계됐다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | Temp root 자체가 정션이면 그 대상 폴더 전체가 게시 입력이 된다. 일반 출력은 같은 root를 `unredirectedDirectory`로 거부한다 | 비귀속 — AC44는 "외부로 나가는" 정션만 거부한다 | 게시 root도 `unredirectedDirectory`로 맞추는 안 | NON_BLOCKING | open |
| D2 | 프로젝트 empty CTA 버튼만 `variant` 없이 남는다 | 비귀속 — ΔV8이 명시 제외 | 기록만 | NON_BLOCKING | open |
| D3 | 인용된 기준선 해시가 `codex-cowork-transcript-viewer`에만 있다. `main`은 내용만 같은 다른 SHA다 | 운영 — 다음 라운드 기준선 | 이후 문서는 `main` 좌표를 함께 적는다 | NON_BLOCKING | open |
| D4 | AC43의 기계 잠금은 native fixture뿐이다. 단위 되돌림 2종은 green이었다 | VP83의 선언된 oracle과 정합 | 버튼 계약 변경 라운드는 native 재실행 필수 | NON_BLOCKING | open |
| D5 | `composerRequirementWiring` 6실패는 r2(`b23d254`)의 `useChatResponding` mock 누락이며 r6까지 red였다 | 운영 — 라운드 gate 범위 | 후속 라운드는 전체 Vitest를 gate로 | NON_BLOCKING | open |
| D6 | node ID `MD11`이 ΔV6 VP76·ΔV8 VP86에 중복 배정됐다 | 추적 | 다음 Delta에서 번호 재부여 | NON_BLOCKING | open |
