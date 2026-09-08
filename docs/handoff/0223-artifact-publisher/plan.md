# Plan — artifact-publisher

## 메타

| 항목 | 값 |
|---|---|
| slug | `0223-artifact-publisher` |
| 작성자 | Codex — 사용자 명시 요청에 따른 설계 작성 |
| 작성 주체 표기 | 사용자 지시: Codex가 작성한 plan·impl 기록에는 `작성자: Codex`, 해당 커밋에는 `Agent: codex`를 명시. 설계 커밋도 실제 작성 주체를 따름 |
| 일자 | 2026-09-08 |
| 상태 | **READY** — 사용자 구현 지시를 반영하고 Q-03·T-01을 확정 |
| 코드 기준 | `e475c62af8c553a7b1789d33aa99c99497d88726` |
| V mode / 기준 V | Baseline V / none — 산출물 게시의 기존 구현 V 없음 |
| 이번 revision / 유효 V | V1 rev.4 / Baseline 확정 — 게시 선행, 뷰어 후속 |
| 매핑 | [선행 검토](../../etc/study/cowork/artifact-publisher-review.md), 기존 리팩토링 PR과 별도 기능 |
| 실행 범위 | 사용자 구현 승인. 게시 코드 구현, 남은 인수 검증은 [impl.md](impl.md) 참조 |
| 구현 상태 | **IN_PROGRESS** — 코드와 자동 게이트 완료, 모델/native 인수 검증 일부 미완료 |

# Part I — Product & UX Contract

## 1. Context / 목표

**모델이 선택한 최종 산출물을 대화 안에 게시한다.** 해당 답변의 카드와 우측 산출물 목록에서 파일 상태를 확인하고 저장·탐색기·휴지통 액션을 사용할 수 있게 한다.

파일 변경 감지는 첫 구현의 선행 조건이 아니다. 모델에게 게시 도구와 사용 기준을 제공하고, 실제 평가에서 드러난 문제를 근거로 후속 보완을 결정한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “아티팩트 게시에 대한 커스텀 도구만 제공(모델에게 사용방법 노출)하고 모델이 맥락에 따라 직접 호출하는 형태로 구현하겠다.” | 이번 사용자 결정 |
| 명시 조건 | “테스트 후 누락 및 오게시가 빈번하다고 판단되면 hook에서 whatcher 를 통해 보완하도롣 하는 전략을 사용하겠다.” | 이번 사용자 결정 원문 |
| 기존 명시 요구 | “산출물(html, md 우선)”을 트랜스크립트에 표시하고 우측 신규 패널에 게시 | 최초 기능 요청 및 첨부 이미지 |
| 기존 명시 조건 | “허가하면 그때 구현시작” | 최초 기능 요청. 최신 “구현하라”로 구현 승인 |
| 추가 명시 요구 | 아티팩트 원본은 `~/.config/orca/artifacts`에 저장하고, 세션이 추적하며, 파일이 삭제되어도 게시 기록과 삭제 상태를 표시 | 최신 사용자 결정 |
| 추가 위임 | 더 나은 일반적인 UX를 선택하고 삭제 UX도 포함 | 최신 사용자 결정 |
| 추가 명시 결정 | 기존 뷰어는 없으며 도구 구현 후 다음 단계로 뷰어 구현 | 최신 사용자 확인 — Q-01 해소 |
| 유지할 방향 | 경량 모듈화·기존 UI/디자인 토큰 재사용, 향후 SRT·Cowork·OpenCode 연결 대비 | 앞선 사용자 요구와 이번 검토 맥락 |
| 해석 | 게시 대상은 이번 요청에서 사용자에게 전달할 결과물. 파일 확장자·폴더 이름으로 의미를 확정하지 않음 | 논의에서 설명한 모델 선택 방식 |
| 해석 | publish는 앱 내부 게시. 외부 웹 배포·공개 링크 생성은 범위 밖 | 트랜스크립트·우측 패널 요청 |

첨부 MD와 이미지의 제안은 사용자 지시와 구분한다. 첨부 MD의 watcher 최소안은 본 계획의 기본 구현으로 승계하지 않는다.

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 모델이 직접 호출하는 커스텀 publisher를 첫 구현의 유일한 게시 진입점으로 둠 | 사용방법을 모델에게 노출 | 이번 사용자 원문 | ACTIVE | — |
| D-002 | 감지용 hook·watcher·workspace scan·후보 자동 주입을 첫 구현에서 제외 | 테스트 후 필요성 판단 | 이번 사용자 원문 | ACTIVE | 선행 검토의 B/C 필수 단계 해석을 대체 |
| D-003 | 누락·오게시 평가 후 사용자가 필요하다고 판단하면 후속 hook/watcher 보완 설계 | 조건절을 무조건 도입 일정으로 바꾸지 않음 | 이번 사용자 원문 | ACTIVE | — |
| D-004 | HTML·Markdown 우선, 트랜스크립트 카드와 우측 산출물 타일 제공 | 첨부 이미지의 결과 제공 흐름 | 최초 사용자 요청 | ACTIVE | — |
| D-005 | 경량 모듈화, 기존 runtime tool·DB·IPC·타일·시맨틱 토큰 재사용 | 후속 계층 추가 대비, 플랫폼 비대화 방지 | 사용자 누적 요구 | ACTIVE | — |
| D-006 | 이번 턴은 plan만 작성. 구현 착수로 해석하지 않음 | “허가하면 그때 구현시작” | 이전 사용자 요청 범위 | SUPERSEDED | D-019 |
| D-007 | 본문 FS·메타데이터 DB의 기존 저장 방향 유지 | DB Blob 금지 결정 승계 | persistence §1·TRD Artifact FS | ACTIVE | — |
| D-008 | `publish_artifact`, server `orca_artifacts`, 입력 `path` 필수·`title` 선택을 명칭으로 사용 | 정확한 `artifact` 도구명과 혼동 방지 | 기존 제안에 대한 최신 구현 지시 | ACTIVE | — |
| D-009 | 정적 HTML 우선인지 JavaScript 상호작용까지 포함할지 | 뷰어 후속 단계에서 설계 | 이전 미확정 권고 | SUPERSEDED | D-018 |
| D-010 | 게시 시점 불변 사본, fork 참조 보존, 마지막 대화 참조 삭제 후 정리 권고 | 파일 추적·삭제 상태 유지 요구로 변경 | 이전 미확정 권고 | SUPERSEDED | D-015·016·017 |
| D-011 | 도구 승인 경로는 현재 정책 유지. 별도 자동 승인 예외를 만들지 않음 | 기본 도구 권한 OQ를 이번에 단독 결정하지 않음 | runtime-tool-policy·PRD OQ9 | ACTIVE | — |
| D-012 | 게시 시 패널 자동 열기 없음, 기존 타일과 제한 폭 스크롤로 공존하는 안 | 원래 보던 대화·타일을 유지. 뷰어 상세는 D-018에 따라 후속 | 사용자 UX 위임 및 최신 구현 지시에 따라 채택 | ACTIVE | — |
| D-013 | hook 없는 2단계 게시. 파일·세션 기록 commit이 성공이며, 실제 SDK 결과의 원래 tool_call에만 카드를 연결 | 결과 연결 유실 시에도 목록에 게시 보존. 최신 메시지 추정 금지 | 코드 조사에 따른 §9.3 설계 확정 | ACTIVE | — |
| D-014 | HTML/MD UTF-8·상한·로컬 파일·묶음 저장 정책은 §10을 적용 | 기존 제안의 경량 기본값을 구현 기준으로 채택 | 사용자 최신 구현 지시 + UX 위임 | ACTIVE | — |
| D-015 | 게시 원본 저장 루트는 `~/.config/orca/artifacts` | Windows도 `orcaConfigDir()`에서 파생 | 최신 사용자 명시 결정 | ACTIVE | 과거 `<userData>/artifacts` anchor의 경로 대체 |
| D-016 | 세션은 게시 원본의 경로를 참조. 파일 소실 뒤에도 제목·파일명·게시 시각과 게시 기록 유지 | 파일 존재와 게시 사실을 분리 | 최신 사용자 명시 결정 | ACTIVE | D-010의 불변 백업 의미 대체 |
| D-017 | 앱 파일 삭제는 휴지통 이동·기록 유지. 외부 소실은 ‘파일 없음’, 권한 오류는 별도 표시. 세션 삭제는 실제 파일을 삭제하지 않음 | 일반적인 UX 선택을 위임받아 채택한 설계. 자동 복원·마지막 참조 GC 없음 | 최신 사용자 위임 + §5 근거 | ACTIVE | D-010의 자동 정리 권고 대체 |
| D-018 | 이번에는 게시 도구와 카드·목록·파일 관리, 도구 구현 후 다음 단계에서 뷰어 구현 | 기존 뷰어가 없다는 사용자 확인. HTML/MD 본문 표시·본문 읽기 IPC·실행 정책은 후속 | 최신 사용자 명시 결정 | ACTIVE | D-009 대체, Q-01 해소 |

| D-019 | 확정 계획에 따라 게시 도구·카드·목록·파일 관리를 구현하고 검증 | 뷰어는 후속 단계 유지 | 최신 사용자 “구현하라” | ACTIVE | D-006 대체 |

### 갱신 메모

- 이번 사용자 결정으로 D-001~D-003을 고정했다. 선행 검토의 감지 단계는 조건부 후속 후보이며 현재 완료 기준에 포함하지 않는다.
- D-004·D-005·D-007·D-011은 유지하고 D-006은 D-019로 대체했다. 저장·파일 소실·삭제 UX는 D-015~017, 게시 선행·뷰어 후속 순서는 D-018로 확정했다.
- **ACTIVE 결정 ↔ AC 대조:** D-001/AC1, D-002/AC2, D-003/AC13, D-004/AC5·6·8, D-005/AC12, D-019/구현 및 문서 gate, D-007/AC4, D-011/AC3을 대응시켰다. hook/watcher를 현재 구현 AC로 요구하는 충돌은 없다.
- 추가 대응: D-015/AC4, D-016/AC14, D-017/AC10·AC14·AC15. 등록된 파일의 상태 조회는 새 산출물을 찾거나 게시하는 감지 기능이 아니다.
- D-018/AC16으로 현재 파일 액션을 검증한다. 이전 뷰어 AC7과 HTML 종단 검증은 현재 완료 분모에서 제외하며 PASS로 처리하지 않는다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 명시적 publisher만으로 시작할 수 있는가 | 가능. 모델 선택과 Main의 객관적 검증을 분리 | runtime tool 등록·instructions·handler가 이미 존재 |
| watcher가 의미 분류를 해결하는가 | 해결하지 않음. 변경 발견과 최종 전달물 선택은 다른 문제 | 사용자 저장·중간 파일도 이벤트에 포함 |
| 기능이 이미 존재하는가 | 게시 영속 모델·카드는 신규. 파일뷰어는 기존에 없으며 후속 단계 | shared `file` part는 타입상 seam이며 게시 도메인 미구현 |
| 더 작은 해법 | 기존 도구 선언 + 게시 서비스 + chat 내부 카드/타일 | 별도 분류 LLM·감시 서비스·범용 플러그인 호스트 불필요 |
| 선행 제안의 수정점 | 원래 호출 메시지 귀속이 아직 닫히지 않음 | SDK MCP extra에 Claude toolUseId 전달 근거 미확인 |
| 기존 결정과 충돌 | FS 본문·DB 메타는 유지. 경로는 사용자 결정으로 변경하고 마지막 참조 자동 정리는 폐기 | D-007·015~018 |

### READY 확정 근거

Q-03은 최신 구현 지시와 UX 위임에 따라 기존 명칭·파일 제한·묶음 저장안을 채택했다. 우측 영역은 기존 열 모델을 유지하고 부모 가용 폭의 50% 이내로 제한하며 내부 track에서 스크롤한다. 실제 좁은 창에서 기존 열 리사이즈·명시적 열기를 시험한다.

T-01은 §9.3의 2단계 경로로 해소했다. query별 host context, DB 세션 확정 gate, 원래 tool_call 검증, 중간 종료와 중복 의미를 V/EP에 반영했다. Q-01은 D-018, Q-02는 D-015~017로 이미 해소됐다.

## 5. 동작 / 사용자 흐름

```text
사용자 요청 → 모델의 기존 작업·파일 작성
  → 모델이 최종 전달물을 선택하여 publish_artifact(path, title?) 호출
  → Main의 파일·호출 문맥 검증 → 저장 확정
  → 게시 사실을 카드·산출물 타일로 표시
  → 카드·우측 목록 → 파일 상태 / 저장 / 탐색기 / 휴지통
```

모델이 도구를 호출하지 않으면 카드가 생기지 않는다. 일반 파일 링크·파일 변경·임의 도구의 JSON을 publisher 호출로 승격하지 않는다.

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/모델에게 보이는 결과 |
|---|---|---|
| 호출 전 | 기존 대화·작업 진행 | 새 산출물 카드 없음 |
| publisher 호출 | 기존 도구 이력 + 검증·저장 | 기존 ToolCard에서 진행 상태 |
| 검증/저장 실패 | 수정 가능한 오류 반환 | `isError:true`; 성공 산출물 카드 없음 |
| 저장 확정 | 게시 참조 전달 | 파일·세션 게시를 확정해 목록에 표시. 실제 SDK 결과를 받으면 원래 호출 메시지에 카드 연결 |
| 카드 파일 액션 선택 | 해당 sessionId/publicationId를 고정하고 원본 상태 확인 | 저장·탐색기·휴지통의 실제 액션 수행. 카드 본문은 메타데이터 표시 |
| 상태 조회 실패 | 요청 세대 확인 | 확인 중·파일 없음·접근 실패 구분 |
| 저장 대화상자 취소 | 게시 원본·기록 유지 | 실패로 경고하지 않고 취소 반환 |
| 새 버전 게시 | 새 게시 파일 참조 기록 | 과거 게시 기록·파일 참조 유지. 진행 중인 파일 액션의 대상 ID를 바꾸지 않으며 해당 경로의 현재 파일 사용 |
| 취소/종료 | 확정 전 작업 중단, 확정 후 기록 유지 | 확정 전 준비 중단, 확정 후 게시 유지. 결과 유실은 목록에서 확인 |
| 재조회/fork | 메타데이터·같은 게시 파일 참조 복원 | 파일이 없으면 카드와 ‘파일 없음’ 표시. 백업 사본으로 대신 열지 않음 |

### UI 계약 — D-012·D-014

| 영역 | 제안 |
|---|---|
| 트랜스크립트 | 해당 assistant 턴 본문 뒤, MessageMeta 앞에 카드 묶음. 도구 실행 이력은 기존 방식 유지 |
| 공통 카드 | 아이콘·제목·파일명·형식·크기와 명시적 저장/탐색기/휴지통 액션. 본문을 미리보기 버튼처럼 표시하지 않으며 중첩 button 금지 |
| 우측 패널 | 기존 타일 시스템에 `artifacts` 추가. 메뉴로 목록을 열고 파일 액션 제공. 본문 상세 화면 없음 |
| 목록 | 같은 입력 출처의 최신 게시 기본 표시. 과거 턴 카드의 액션은 그 기록의 ID로 직접 실행하며 최신 목록 선택에 의존하지 않음 |
| 자동 동작 | 게시 시 패널을 강제로 열거나 선택·스크롤을 바꾸지 않음 |
| 좁은 창 | RightPanel 내부 viewport를 제한 폭으로 두고 기존 separator까지 track 안에서 가로 스크롤. 새 docking 상태 모델은 없음 |
| 기존 타일 | 사용자의 명시적 열기 요청 때 해당 열을 노출. 열 삭제·창 축소 시 scroll 범위 보정 |
| 시각 기준 | 기존 white/dark·밀도·시맨틱 토큰·Button/Popover/MenuItem/Icon 재사용. 새 보라색 테마·CSS 파일 없음 |
| HTML·Markdown | 형식·파일명·상태만 표시. 파일 본문 렌더링·HTML 실행·가짜 미리보기 버튼 없음 |
| 저장 | 개별 ‘다른 이름으로 저장’, 묶음 ‘모두 저장’, 별도 ‘탐색기에서 보기’. 대상은 지정 루트의 게시 원본. 트랜스크립트는 해당 턴 버전 전체, 패널은 최신 목록 전체를 시작 시 고정. 파일 없음은 항목별 건너뜀 사유로 보고 |
| 파일 상태·삭제 | 아래 확정 UX 적용. 뷰어 없이 카드/목록에서 제공 |
| 입력 콘텐츠 | 첨부 이미지의 ‘콘텐츠’ 입력 영역은 이번 산출물 UI에 포함하지 않음 |

우측 viewport는 부모 가용 폭의 50% 이내이며 기존 열의 최소/최대 폭을 유지한다. CSS overflow 추가만으로 리사이즈·이미 열린 타일 노출이 해결됐다고 판정하지 않는다.

### 게시 원본과 삭제 UX — D-015~017 확정

게시 도구가 workspace의 완성 파일을 지정 루트로 복사해 **게시 원본**을 만든다. 이 파일이 이후 저장·위치 열기의 기준이다. workspace 입력은 삭제/이동하지 않으며 복구용 백업으로 쓰지 않는다. 별도 숨은 불변 사본도 만들지 않는다. 모델에 설정 디렉터리의 직접 쓰기 권한을 추가하지 않는다.

| 상황 | 표시·액션 |
|---|---|
| 파일 상태 확인 전/중 | 카드 메타는 즉시 표시, 상태는 ‘확인 중’. 확인 중 파일 액션의 중복 실행 방지 |
| 파일 존재 | 정상 카드. 저장·탐색기에서 보기·휴지통으로 이동 가능 |
| 앱의 휴지통 이동 성공 후 파일 없음 | 제목·파일명·게시 시각 유지, 현재 상태는 ‘파일 없음’. 완료 직후 ‘휴지통으로 이동했습니다’, 상세 이력은 ‘휴지통으로 이동한 시각’. 파일 액션 대신 ‘다시 확인’·‘보관 폴더 열기’ 제공 |
| 외부 삭제·이동 등으로 ENOENT/ENOTDIR | 카드 유지, ‘파일 없음 — 삭제되었거나 이동되었습니다’. 삭제 주체나 원인을 추정하지 않음 |
| 권한/일시 I/O 오류 | ‘파일에 접근할 수 없음’과 재시도. 삭제 상태로 기록하지 않음 |
| 같은 경로로 파일 복원 | 다음 확인에서 정상 상태로 복귀. 과거 휴지통 기록보다 현재 파일 존재를 우선 |
| 다시 게시 | 새 게시 파일/참조 생성. 이전 카드의 파일 없음 기록을 지우거나 새 파일로 자동 연결하지 않음 |
| 대화 삭제 | 해당 대화/참조만 삭제. 게시 파일은 남고 fork 등 다른 대화 참조는 유지 |

카드 메뉴의 **‘휴지통으로 이동’**은 기존 `openConfirmDialog`를 사용한다. 문구는 “파일을 휴지통으로 이동할까요? 게시 기록은 남습니다. 이 파일을 참조하는 다른 대화에서도 파일을 사용할 수 없게 됩니다.”, 버튼은 ‘취소’와 ‘휴지통으로 이동’이다. 확인창이 닫힌 뒤에도 카드 상태에서 진행·실패·재시도를 관리한다. 실패 시 영구 삭제로 대체하지 않는다. 별도 앱 휴지통·복원 관리자·전역 toast·일괄 삭제 UI는 추가하지 않는다. 복원은 OS 휴지통에서 하고 ‘다시 확인’으로 반영한다.

삭제는 사용자 UI 액션이며 모델용 삭제 도구를 추가하지 않는다. 동일 파일의 여러 카드·fork 참조에 같은 상태를 투영한다. 대화 삭제 안내에는 “저장된 산출물 파일은 유지됩니다”를 포함한다. 마지막 참조가 없어도 자동 파일 정리를 하지 않으며, 보관 폴더에서 사용자가 정리할 수 있다.

상태는 세션/패널 진입, 사용자 ‘다시 확인’, 저장·reveal·삭제 직전에 **DB가 이미 알고 있는 경로만** 조회한다. watcher·주기 polling·디렉터리 재귀 탐색을 추가하지 않는다. 상태 캐시는 관측 시점일 뿐 파일 작업 직전 검증을 대체하지 않는다. 과거 휴지통 이력은 현재 소실 원인의 증거가 아니다. `앱 삭제→복원→외부 삭제`에서도 현재는 ‘파일 없음’, 과거 행위는 별도 이력으로 표시한다.

근거: [Electron shell API](https://www.electronjs.org/docs/latest/api/shell#shelltrashitempath)는 Windows 휴지통 이동과 성공/실패를 제공한다. 확인 문구와 안전한 취소 선택은 [Windows 대화상자 지침](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/dialogs)을 참고하되 Orca의 기존 확인창을 재사용한다. 위 UX는 이 근거와 사용자 위임에 따른 설계 선택이다.

## 6. 범위 / 비범위

| 구분 | 내용 |
|---|---|
| 범위 | publisher 도구·모델 지침, 파일 검증·게시 보관, 대화 연결, 카드·목록 타일·파일 상태·저장·reveal·휴지통, 회귀 시험과 모델 선택 평가 |
| 후속 단계 | 도구 구현 후 HTML/Markdown 파일뷰어. 이번에는 본문 읽기 IPC·파서·iframe/WebContentsView·뷰어 상태/캐시를 만들지 않음 |
| 비범위 | 자동 파일 감지, 후보 수집/주입/UI, 주기 전체 scan, 감지용 hook/watcher, 별도 분류 LLM |
| 비범위 | 외부 웹 배포, 자동 공개 URL, 임의 파일 실행, HTML의 Orca IPC 접근, SRT 도입 |
| 비범위 | OpenCode adapter·Cowork 오케스트레이션 자체 구현, 새 플러그인 플랫폼, ZIP 의존성 |

| 미룬 항목 | 미루는 비용 | 처리 |
|---|---|---|
| hook/watcher | 게시 API가 유지되면 감지기를 나중에 붙일 수 있음 | 평가 결과와 사용자 판단 후 별도 Delta/후속 handoff |
| 추가 형식·상대 자산 묶음 | 자산 저장/권한 계약이 늘어남 | HTML/MD 단일 파일 범위부터 검증 |
| 파일뷰어·HTML 실행 정책 | 게시 ID·파일 참조를 재사용할 수 있으며 본문 읽기·실행 경계는 별도 필요 | 도구 구현 후 다음 단계에서 설계/구현. 정적/JavaScript 범위도 그때 확정 |
| 파일 보관·식별자 | 파일은 세션과 독립 보관. 전체 산출물 관리 화면은 후속 가능 | D-015~017 유지, T-01의 메시지 연결은 별도 확정 |

## 7. Requirements / Acceptance — R ↔ AT

아래는 **완료 판정 설계**이며 이번 턴의 시험 통과 보고가 아니다. D-008·012·013·014와 함께 아래 AC를 유효화했다.

| R | AT / AC | 동작 기준 | 검증 수단·직접 oracle | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 모델이 게시 기준·입력을 보고 실제 커스텀 도구를 호출할 수 있음 | SDK 등록 경계에서 name/description/instructions/schema 관찰 + 실제 모델 호출 기록 | registry → SDK MCP → handler |
| R-02 | AT-02 / AC2 | publisher 미호출 시 파일 생성/수정만으로 게시되지 않음 | HTML/MD를 작성하고 도구 미호출 시 DB/카드 변화 없음; 부팅~종료에 감시기·scan·후보 주입 배선 없음 | app boot → 작업 → 게시 저장소/화면 |
| R-03 | AT-03 / AC3 | 허용 파일은 게시하고 경로 이탈·미지원·취소·저장 실패는 오류로 반환 | 허용/거절 파일 및 실패 주입에 대한 실제 결과·FS/DB 상태 | handler → validation → commit |
| R-04 | AT-04 / AC4 | 게시 원본이 지정 루트에 저장되고 재시작 후 동일 경로로 추적됨 | root/상대경로·초기 바이트 대조, 입력 파일 변경·삭제로 추적 대상이 바뀌지 않음 | managed file → DB → status/save/reveal |
| R-05 | AT-05 / AC5 | 카드가 원래 호출 대화에만 나타나며 다른 세션/턴에 붙지 않음(T-01) | 동시 세션·동일 인자·steer·지연 결과에서 소유 메시지·카드 대조 | SDK → 원래 tool_call → part → AssistantTurn |
| R-06 | AT-06 / AC6 | 공통 카드와 우측 목록에서 각 게시 ID의 파일 액션이 정확함 | 클릭/키보드·개별 액션·과거 카드/최신 목록 대상 분리·기존 타일 공존·white/dark 실기 | ArtifactCard / artifacts tile → status/save/reveal/trash |
| R-08 | AT-08 / AC8 | 묶음 저장·취소·이름 충돌·일부 실패·파일 소실을 정확하게 보고함(Q-03) | 고정 집합과 저장/건너뜀/실패/취소 항목의 합집합 일치 | UI → IPC → dialog → 현재 게시 원본 copy |
| R-09 | AT-09 / AC9 | 같은 소유 메시지/경로/내용 재게시 중복과 새 버전을 구분함(T-01) | 같은 키/다른 메시지/바뀐 hash/제목 사례의 ID·part·내용 단언 | publisher → DB → cards/latest list |
| R-10 | AT-10 / AC10 | fork가 같은 게시 파일을 참조하고 세션 삭제는 실제 파일을 삭제하지 않음 | 부모/마지막 대화 삭제 뒤 파일 생존, 자식 참조 조회, handoff 이력 미복사 유지 | fork/session delete → DB refs → retained file |
| R-11 | AT-11 / AC11 | 닫기·세션 삭제·재조회 뒤 지연 파일 상태/작업 결과가 이전 화면을 되살리지 않음 | A→B→A·삭제→재생성·삭제 뒤 늦은 present 응답 순서 시험 | IPC status/action → request generation → session entry |
| R-12 | AT-12 / AC12 | 기존 대화·도구·타일 동작을 보존하고 목록에서 본문을 읽지 않음 | 기존 회귀 사례 + FS read/stat 관측·긴 transcript UI 비교 | 기존 runtime/store/tiles → 새 경로 |
| R-13 | AT-13 / AC13 | 누락·오게시를 저장/표시 실패와 분리해 평가하고 후속 여부를 사용자에게 보고함 | [평가표](evaluation.md)의 사전 oracle·전 실행 기록·집계·판단 보류/결정 | 실제 모델 작업 → 호출 → FS/DB → 화면 |
| R-14 | AT-14 / AC14 | 게시 파일 소실·접근 실패·복원을 구분하고 게시 기록은 유지 | ENOENT/권한 오류/복원에서 카드 메타·상태·액션 비교. 알려진 경로만 조회 | tracked path → status IPC → cards/tile |
| R-15 | AT-15 / AC15 | 사용자 파일 삭제가 휴지통 이동으로 실행되고 실패·취소·다른 참조 영향이 정확함 | 확인 취소/성공/실패·중복 클릭·FS 성공 후 DB 실패·fork 카드 상태, 영구 삭제 호출 없음 | card confirm → delete IPC → shell trash → status |
| R-16 | AT-16 / AC16 | 뷰어 없이 HTML/MD 원본 저장·탐색기 위치 확인·파일 관리가 사용 가능함 | 게시 UI가 본문을 표시/실행하지 않으며 저장 바이트와 reveal 대상 일치. 파일 액션 전용 IPC 경계 확인 | 카드/목록 → ID 기반 Main 파일 액션 → OS/FS |

### AC 검증 주의사항

- AC13의 보고서 완성은 모델 분류 정확도가 충족됐다는 뜻이 아니다. 평가 결과와 배포 수용·후속 감지 도입 판단을 분리한다.
- 모델에게 매 프롬프트마다 publisher 호출을 직접 지시하는 실험은 자율 선택 평가를 대신하지 못한다. 도구 설명은 고정하고 자연스러운 과업 프롬프트를 쓴다.
- AC2의 감시 배선 부재는 생성 이벤트만 넣는 양성 경로와 코드 경로 검사를 함께 사용한다. 함수명 `watcher` 문자열이 없다는 것만으로 판정하지 않는다.
- 실제 기존 case는 §8 표로 제한해 인용한다. 새로운 publisher 의미는 새 시험으로 검증한다.
- 이전 R-07/AT-07·SD-03/ST-03의 뷰어 계약은 D-018로 현재 범위에서 대체됐다. 현재 파일 액션은 R-16/AT-16과 SD-01/ST-01로 검증한다. VP-07·VP-22·EP-09는 현재 분모에서 제거하고 ID를 재사용하지 않는다. 후속 뷰어는 별도 설계에서 새로운 계약/검증을 정의한다.

## 7-A. V / Trace Matrix

Baseline V1이다. 선행 study는 구현 V가 아니므로 Delta V의 상속 기준으로 삼지 않는다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 출처 |
|---|---|---|---|---|
| R-01~R-06·R-08~R-16 및 대응 AT | R / AT | §7의 동일 번호 행을 개별 노드로 정의 | NEW | 이번 사용자 요구·§3 ACTIVE 결정 |
| R-07, AT-07 | R / AT | 이전 뷰어 표시 계약 → 현재 R-16/AT-16 파일 액션 계약 | SUPERSEDED | D-018, V1 초안 rev.2 |
| SD-01, ST-01 | SD / ST | 게시·메시지 연결·취소·재시작의 종단 상태, §9·§13 | NEW | §9.3 확정 계약 |
| SD-02, ST-02 | SD / ST | FS·DB·fork·세션 독립 보관 수명, §13 | NEW | D-015~017 |
| SD-04, ST-04 | SD / ST | 사용자 삭제·외부 소실·접근 오류·복원, §5·§13 | NEW | D-016·017 |
| SD-03, ST-03 | SD / ST | 이전 HTML 실행 경계 → 현재 SD-01/ST-01 게시/파일 흐름. HTML 실행 자체는 후속 | SUPERSEDED | D-018, V1 초안 rev.2 |
| AR-01, IT-01 | AR / IT | 정적 도구 등록·채널별 실행 문맥, §9.3 | NEW | runtime-tools·SDK MCP |
| AR-02, IT-02 | AR / IT | 게시 사실→DB part→wire→live/reload, §12 | NEW | 기존 history-before-relay |
| AR-03, IT-03 | AR / IT | 좁은 IPC·preload·상태/파일 액션 경계, §10 | NEW | 기존 handle/preload |
| MD-01, UT-01 | MD / UT | 경로·형식·크기·파일 안정성, §10 | NEW | 게시 validation |
| MD-02, UT-02 | MD / UT | 중복·버전·참조·파일 독립 보관, §10·§13 | NEW | DB/FS 분리 |
| MD-03, UT-03 | MD / UT | part→카드/목록·세션별 파일 상태·지연 응답, §11 | NEW | chat selector/reducer |
| MD-04, UT-04 | MD / UT | 평가 분모·실패 분류, evaluation.md | NEW | D-003 |
| MD-05, UT-05 | MD / UT | 파일 상태·삭제 진행/실패·복원 우선순위, §10 | NEW | D-016·017 |
| R-90, AT-90 | R / AT | 기존 세션·타일·분기 동작 유지, §8 기존 case | INHERITED | 코드 기준 커밋의 해당 테스트 의미 |

### Pair registry

§7의 현재 각 R/AT 행에 pair를 둔다. SUPERSEDED 노드는 현재 완료 분모에 포함하지 않는다. 아래 전수 지점은 §10의 EP 정의를 가리킨다.

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 지점 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 등록 → SDK → 도구 호출 | 모델-visible 설정·실제 호출 결과 | 등록 제거 시 호출 불가를 관찰 | EP-01 (6) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 작업 파일 작성 → 게시 저장소/화면 | 호출 없음이면 게시 없음, 감시 배선 없음 | 숨은 자동 게시 producer를 삽입하면 실패 | EP-01 (6) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | handler → 검사 → 확정 | 허용/거절·오류별 FS/DB/결과 | not selected — 직접 실패 주입 | EP-02·03·04 (18) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | 게시 원본 → 저장 → 재조회 | 지정 루트/경로·초기 바이트 일치 | not selected — 입력 원본 변경 대조 | EP-04·06 (11) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 호출 → 소유 메시지 → 카드 | 서로 다른 세션/턴의 정확한 귀속 | 현재 마지막 메시지로 강제 시 실패 | EP-02·05·07 (20) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | 카드/목록 → 파일 액션 | 입력별 실제 대상과 아래 viewport 직접 관측 항목 | not selected — UI 직접 관측 | EP-06·08 (13) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | save UI → dialog → 파일 | §5의 턴 버전 집합/패널 최신 집합과 실제 저장 집합 일치, 초과·취소·부분 실패 | not selected — 실패 주입 | EP-10 (7) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | 재호출 → DB → 카드 | ID·part 수·버전 바이트 | not selected — 동일/상이 입력 대조 | EP-04·05·07 (18) |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | fork/session delete → 참조 → 파일 | 부모/마지막 대화 삭제 뒤 파일 유지 | 마지막 참조 GC를 넣으면 실패 | EP-11 (4) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | 파일 상태/액션 요청 → 세션 전환 → 응답 | stale 응답 폐기·엔트리 재생성 없음 | not selected — 지연 순서 직접 제어 | EP-06·08 (13) |
| VP-12 | R-12 ↔ AT-12 | REQUIRED | 기존 흐름 → 새 게시 흐름 | 기존 case·목록 본문 read 없음·제한된 stat | not selected — 직접 회귀/자원 관측 | EP-06·07·08 (21) |
| VP-13 | R-13 ↔ AT-13 | REQUIRED | 모델 → publisher → 저장/표시 | 사전 기대 집합과 실제 차집합 | not selected — 평가 분류 직접 oracle | EP-12 (4) |
| VP-14 | R-14 ↔ AT-14 | REQUIRED | 알려진 경로 → 상태 조회 → 카드 | 소실/권한/복원 상태·메타 보존 | not selected — 실제 FS/오류 주입 | EP-06·08·14 (21) |
| VP-15 | R-15 ↔ AT-15 | REQUIRED | 확인 UI → trash → 상태 | 성공/실패/취소·다른 참조·영구 삭제 없음 | not selected — 삭제 경계 실패 주입 | EP-14 (8) |
| VP-16 | R-16 ↔ AT-16 | REQUIRED | 카드/목록 → 파일 IPC → OS/FS | HTML/MD 저장·reveal 성공, 게시 UI 본문 표시/실행 없음 | not selected — 파일 바이트·OS 대상·UI 직접 관측 | EP-06·08·10 (20) |
| VP-20 | SD-01 ↔ ST-01 | REQUIRED | 호출 시작 → 확정 → 종료/재시작 | 중간 종료별 DB/FS/카드 상태 | not selected — 상태 경계 실패 주입 | EP-02·04·05 (18) |
| VP-21 | SD-02 ↔ ST-02 | REQUIRED | publish → fork → session delete → restart | 대화/파일 수명 분리·다른 참조 유지 | not selected — 실제 다중 저장소 관측 | EP-04·11 (10) |
| VP-23 | SD-04 ↔ ST-04 | REQUIRED | 삭제/외부 소실 → 중단 → 재조회/복원 | 실제 파일 우선·기록 보존·오류 종류 유지, 앱 삭제→복원→외부 삭제의 과거 이력 분리 | not selected — 중간 실패 직접 관측 | EP-06·14 (13) |
| VP-30 | AR-01 ↔ IT-01 | REQUIRED | registry → adaptRuntimeTools → 채널 문맥 | 원래 caller·세션, revision·delegate 유지 | not selected — 실제 SDK/순서 oracle | EP-01·02 (14) |
| VP-31 | AR-02 ↔ IT-02 | REQUIRED | commit → history/relay → reload/reducer | DB와 live/reload 동일 part | not selected — producer/consumer roundtrip | EP-04·05·07 (18) |
| VP-32 | AR-03 ↔ IT-03 | REQUIRED | renderer → preload → handler → FS | 권한 범위·취소·반환 shape | not selected — IPC 경계 직접 호출 | EP-06·10 (12) |
| VP-40 | MD-01 ↔ UT-01 | REQUIRED | 경로/바이트 입력 → 판정 | 이탈·형식·상한·변경 중 판정 | not selected — 순수/FS 사례 직접 단언 | EP-03 (4) |
| VP-41 | MD-02 ↔ UT-02 | REQUIRED | refs/keys → 중복/참조 판정 | 같은 키/파일 소실/참조 조합별 결과 | not selected — 상태표 직접 단언 | EP-04·11 (10) |
| VP-42 | MD-03 ↔ UT-03 | REQUIRED | part/event/file state → view state | 정확한 메시지·파일 액션 ID·목록 투영 | not selected — 상태 입력별 직접 단언 | EP-07·08 (16) |
| VP-43 | MD-04 ↔ UT-04 | REQUIRED | 기대/실제 fixture 결과 → 분류 | 생성 실패·누락·오게시·저장 실패 분리 | not selected — 분류 예제 직접 단언 | EP-12 (4) |
| VP-44 | MD-05 ↔ UT-05 | REQUIRED | stat 오류/삭제 결과/지연 순서 → 상태 | present/missing/unavailable·중복 실행·복원·과거 trash 이력과 원인 분리 | not selected — 상태표 직접 단언 | EP-06·14 (13) |
| VP-90 | R-90 ↔ AT-90 | REGRESSION | 기존 session/runtime/store/tiles | §8 기존 case와 실제 UI 유지 | not selected — 기존 행동 oracle | EP-02·07·08·11 (28) |

### 현재 변경의 운영 gate

VP-06의 viewport 직접 관측은 `scrollLeft > 0`에서 첫 열 리사이즈, 이미 열린 화면 밖 plan/task/subagent/diff 재노출, 열 삭제·창 축소 후 스크롤 범위 보정, 배경 게시 시 스크롤·선택 불변을 포함한다. 기존 layout 단위시험만으로 대체하지 않는다.

| Gate | 적용 이유 | 증거/명령 | 실패 범위 |
|---|---|---|---|
| 현재 문서 | plan·평가표·라우팅·보드 변경 | 상대 링크, Decision↔AC↔pair↔EP 대조, `git diff --check` | 새 문서의 누락·모순·깨진 링크 |
| 향후 앱 구현 | main/preload/renderer/shared·DB 변경 | §19 | 이번 변경이 유발한 실패·명시 회귀 계약 |
| 상태 정합 | plan/INDEX·선행 검토의 제안 지위 | §13 문서 상태 사본 대조 | DRAFT를 READY/구현 완료로 표시 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견/제약 | 근거 |
|---|---|
| 런타임 도구는 정적 선언·구현의 전역 snapshot | `app/src/main/adapters/runtime-tools.ts:16,45`; `features/extensions/runtime-tool-registry.ts` |
| SDK 서버는 query 생성 때 조립 | `adapters/claude.ts:397` → `claude-runtime-tools.ts:75` |
| handler는 현재 입력만 받음 | `runtime-tools.ts:48`, `claude-runtime-tools.ts:41` |
| SDK MCP extra는 unknown, generic requestId와 Claude toolUseID는 다른 좌표 | 설치 SDK `sdk.d.ts:3985`; SDK `sdk.mjs`의 registerTool/control 경로 읽기 |
| canUseTool은 toolUseID/agentID를 가지지만 모든 호출에 실행되는 식별 채널이 아님 | 설치 SDK `sdk.d.ts:245`; 기존 permission 경로 |
| warm delegate 교체와 listen 조립이 존재 | `features/sessions/session-runtime.ts:289,574`; `app/chat-turn/continuation.ts:30` |
| steer가 같은 frame의 assistant 메시지를 마감할 수 있음 | `features/chat/turn-coordinator.ts:301`; `features/history/writer.ts:86` |
| 일반 구조화 출력은 artifact 영속 경로가 아님 | `adapters/claude-map.ts:488`의 Task 도구군 분기 |
| history-before-relay, DB가 메시지 정본 | `app/bootstrap.ts:785`; `features/history/writer.ts`; `infra/ipc/dto.ts` |
| fork는 message parts를 그대로 복사 | `infra/db/queries.ts:344`; `features/orchestration/fork.ts:19` |
| renderer에는 현재 DB messageId가 없음 | `features/chat/reducer/chatReducer.ts:202`; `shared/ipc.ts:1417` |
| 마지막 assistant append를 그대로 쓰면 지연 귀속을 보장하지 못함 | `features/chat/reducer/chatReducer.ts:666` |
| 일반 readRoots에는 게시에 불필요한 앱 설정/런타임 경로가 포함됨 | `adapters/workspace-guard.ts:80`. 게시 루트는 실행 cwd·세션 extraDirs로 별도 구성 |
| 기존 경로 문자열 비교는 Windows 실체 검사·전체 경로 정책을 대체하지 못함 | `infra/config/paths.ts:81`, `shared/absolute-path.ts:11`, `features/chat/attachments.ts:85` |
| 기존 files:reveal은 extraDirs 게시물을 포괄하지 않음 | `app/handlers/files.ts:35`; 게시 ID 기반 검증 경로 필요 |
| 홈 설정 경로는 모든 OS에서 동일하고 개발 DB는 별도 | `infra/config/paths.ts:28,36`; `main/index.ts:15`. 새 파일 루트는 `orcaConfigDir()` 아래, 개발 파일은 그 안의 `.dev`로 분리 |
| `.config/orca`는 모델 파일 도구의 읽기 전용 예외 | `adapters/workspace-guard.ts:33`. 모델 직접 Write 권한을 늘리지 않고 publisher가 복사 |
| 삭제 확인창은 기존 구현, 휴지통 IPC는 신규 | `renderer/src/shared/ui/confirmDialogStore.ts`, `ConfirmDialogHost.tsx`; `features/sessions/components/SessionRow.tsx`. 비동기 완료는 확인창이 아닌 호출 상태에서 처리 |

### 전수 조사 — 현재 등록·소비 표면

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| SDK MCP 실행 조립 production 호출부 | `rg -n 'adaptRuntimeTools\(' app/src/main -g '*.ts' -g '!*.test.ts'`에서 정의 제외 | 1 | `claude.ts` query 경계 |
| runtime snapshot production 참조 파일 | `rg -l 'runtimeTools|spawnedRuntimeToolsRevision' app/src/main -g '*.ts' -g '!*.test.ts'` | 10 | 아래 명시 목록. 선언·생산·소비 파일을 모두 포함하며 호출 횟수와 구분 |
| 게시 part 신규 강제 위치 | 타입→history→DTO→reducer→selector→view를 추적 | §10 | EP-05·07의 위치 등록표가 분모 정본 |
| 기존 타일 카탈로그 멤버 | `rightPanelTileDefinitions` literal 확인 | 4 | plan/subagent/task/diff. 새 값은 메뉴·상태·registry·layout 소비처에 반영 |
| 기준 handoff 번호 | `rg --files docs/handoff`에서 번호 경로 추출 | max=0222 | 새 번호 0223 선택 |

snapshot 참조 파일 전수: `main/app/bootstrap.ts`, `main/app/context.ts`, `main/app/chat-turn-continuation.ts`, `main/app/chat-turn/runtime-entry.ts`, `main/app/chat-turn/respawn-inputs.ts`, `main/adapters/turn.ts`, `main/adapters/claude.ts`, `main/features/extensions/builder.ts`, `main/features/sessions/session-runtime.ts`, `main/features/sessions/respawn-policy.ts`(모두 `app/src/` 기준). 실제 SDK 변환 정의는 별도 `main/adapters/claude-runtime-tools.ts`다. N은 이 기준 커밋에서 조사한 파일 또는 호출부의 수이며 저장소 전체 인벤토리 총계가 아니다. T-01 해결 후 새 경로가 바뀌면 §10 분모와 이 표를 다시 대조한다.

### 기존 테스트 case 존재 확인

| 파일 | 확인한 case/행동 |
|---|---|
| `adapters/claude-runtime-tools.test.ts` | `서버 식별자를 하나로 사용한다`; instructions·alwaysLoad·description 전달 |
| `adapters/claude-runtime-tools.boundary.test.ts` | 실제 in-memory MCP 성공·isError·throw·잘못된 반환 형상. CLI provenance 시험은 아님 |
| `features/sessions/session-runtime.test.ts` | spawn callback의 현재 턴 위임, pickFrameDelegates 전량 전달, 소속 불명/늦은 이벤트 격리 |
| `app/bootstrap.shutdown.test.ts` | `records usage before history clears message identity, then starts title work before relay` |
| `features/orchestration/fork.test.ts` | fork의 순서 보존 복사, handoff의 display 미복사, lineage 삭제 |
| `renderer/.../store/chatStore.test.ts` | 비활성 세션 누적과 활성 엔트리 불변, 미지 sessionId 지각 이벤트 폐기 |
| `renderer/.../reducer/chatReducer.parts.test.ts` | `LOAD_SESSION 은 parts 를 그대로 싣는다` |
| `renderer/.../lib/turns.test.ts` | 마지막 메시지 교체 시 해당 교환 비교가 달라짐 |
| `renderer/.../lib/rightPanelLayout.test.ts` | column-major 추가·중복 무시, 열 내부 제거와 다른 열 identity 유지 |
| `renderer/.../reducer/chatReducer.plan.test.ts` | 빈 열 제거 시 폭·행분할 splice |

renderer의 `...`는 `src/features/chat`을 뜻한다. 위 시험은 존재를 읽어 확인했으며 이번 문서 턴에서 실행하지 않았다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
ExtensionBuilder → RuntimeToolSnapshot → Claude query / SDK MCP
  → handler(args) → MCP result → SDK stream → NormalizedEvent
  → bus(usage → history → title → relay) → preload → chat store → transcript

ChatTile → RightPanel → tileRegistry → 기존 타일
```

runtime handler와 원래 호출의 toolRunId 사이 연결이 없다. 기존 `file` part도 불변 게시물·버전·저장 수명을 표현하지 않는다.

### TO-BE

```text
정적 publisher 선언·사용 지침 → 기존 SDK MCP 등록
  → 모델 직접 호출 → 채널에 묶인 호스트 문맥 + 파일 검증
  → artifacts 루트에 게시 원본 준비 → 게시 확정과 원래 호출 연결(T-01)
  → 기존 history / relay → artifact part → 공통 카드 / artifacts 타일

선택 publicationId → 좁은 IPC → 파일 상태 / 내보내기 / reveal / 휴지통
파일 없음 → 게시 기록 유지 + 상태 표시
```

감지 producer는 신설하지 않는다. 사용자 지침은 게시 도구 설명·server instructions에 한 번 정의하고 별도의 classifier prompt 체계를 만들지 않는다.

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | V·구현 연결 |
|---|---|---|---|
| 도구 등록 | 기존 runtime tools | 안정된 publisher 선언 추가 | AR-01·EP-01 |
| 실행 문맥 | handler(args) | 채널별 session/cwd/취소 문맥, 결과별 toolRunId로 원래 호출 연결 | AR-01·EP-02 |
| 저장 | 대화 DB, artifact FS 미구현 | 지정 FS 원본 + 세션별 게시 참조. 원본 소실은 기록과 분리 | SD-01/02/04·EP-04/05/11/14 |
| 표시 | text/tool 중심 parts | 신뢰된 게시 part·공통 카드·타일 | AR-02·MD-03·EP-07/08 |
| 파일 관리 | 범용 경로 중심 파일 API | 게시 ID의 상태·저장·reveal·휴지통 | AR-03·EP-06/10/14 |
| 평가 | artifact 선택 자료 없음 | 고정 과업과 결과 분류 | MD-04·EP-12 |

### 9.3 호출 귀속 — hook 없는 2단계 확정

1. `SessionRuntime`은 cold spawn마다 host context를 만든다. 확정 세션 대기 함수, 고정 cwd/extraDirs, 호출 시작 시 캡처하는 취소 신호를 query의 `adaptRuntimeTools` 래퍼로 전달한다. 전역 registry의 handler identity/revision은 세션 때문에 바뀌지 않는다. 기존 입력만 받는 도구는 호환한다.
2. 신규·resume 모두 `session.updated`의 동기 history 처리와 registry promotion 뒤 `confirmRuntimeToolSession` 포트로 소유 세션을 확정한다. `req.sessionId`·forkFrom·임시 clientKey는 DB 준비 증거가 아니다. 초기화 실패/종료 시 대기를 해제하고 오류를 반환한다. warm/listen은 같은 채널 문맥을 유지한다.
3. 도구는 세션 확정을 기다린 뒤 입력 파일을 검증·준비하고, commit 직전 세션 존재와 해당 준비의 취소를 확인한다. 파일과 세션 publication(messageId=null)을 저장하면 **게시 성공**이다. 응답 text JSON은 `{type:"orca.artifact.published",version:1,publicationId}`이며 본문/내부 절대 경로를 싣지 않는다.
4. mapper가 실제 각 `tool_result`의 `tool_use_id`와 `content`를 함께 보존한다. HistoryWriter는 고정 publisher tool 이름, `(sessionId, toolRunId)`의 원래 tool_call, 영수증 형식·게시 소유권을 확인하고 그 메시지에 artifact part를 연결한다. 현재 assistant ID·args·MCP requestId로 추측하지 않는다. 원래 호출이 없거나 모호하면 연결하지 않는다.
5. 파일·세션 DB 확정 뒤 연결 전에 죽어도 게시 기록은 우측 최신 목록에 남는다. SDK 결과가 재전달되고 원래 호출을 검증할 수 있을 때만 transcript를 연결한다. 새 메시지로의 자동 귀속 복구는 보장하지 않는다. `artifact.published` host 알림은 목록 갱신용이다. HistoryWriter가 기존 `tool.call.completed`에 보강한 `artifact`만 원래 `toolRunId`를 사용해 transcript part를 만든다.
6. 같은 영수증 재전달은 멱등 연결한다. 서로 다른 handler 호출은 각각 새 파일·게시 ID를 만든다. 같은 소유 메시지·입력 실체·hash·title 중복은 **연결 단계에서 카드만 하나로** 모으고 게시 기록은 보존한다. 다른 메시지/내용/제목은 별도 카드다. 최신 목록은 입력 실체별 최신 publication 한 건을 Main이 선택한다(게시 시각·ID 정렬). 미연결 게시도 포함한다.
7. 명시적 interrupt는 해당 채널에서 진행 중인 준비를 취소하고 다음 호출용 신호를 새로 만든다. close/respawn은 이전 채널 전체를 취소한다. 이미 DB 확정된 게시를 rollback하지 않는다. warm/steer/background의 메시지 소유권은 후속 원래 tool_call로만 정한다.

신규 세션 선행 호출, 두 채널 동일 인자, warm/listen, steer 뒤 지연 결과, 취소/종료, 영수증 위조·재전달을 직접 시험한다. 실제 SDK/CLI가 결과 블록과 ID를 보존하는 종단 시험은 별도로 실행·기록하며 모의 시험만으로 완료했다고 보고하지 않는다.

## 10. 계약 / 타입 / 강제 지점

### 공유 타입 계약

```ts
type PublishArtifactInput = { path: string; title?: string }
type ArtifactKind = 'html' | 'markdown'
type ArtifactRef = {
  publicationId: string
  artifactFileId: string
  title: string
  filename: string
  kind: ArtifactKind
  sizeBytes: number
  publishedAt: number
}
type ArtifactAvailability =
  | { state: 'present'; sizeBytes: number; modifiedAt: number }
  | { state: 'missing' }
  | { state: 'unavailable'; reason: 'access-denied' | 'io-error' | 'unsafe-path' }
type ArtifactStatusRequest = { sessionId: string; publicationIds: string[] }
type ArtifactStatusItem = {
  publicationId: string
  artifactFileId: string
  availability: ArtifactAvailability
  lastTrashedAt?: number // 과거 앱 동작 이력이며 현재 소실 원인은 아님
}
type ArtifactTrashRequest = { sessionId: string; publicationId: string }
type ArtifactTrashResult =
  | { outcome: 'trashed'; deletionRecorded: boolean }
  | { outcome: 'already-missing' }
  | { outcome: 'failed'; reason: 'forbidden' | 'unsafe-path' | 'trash-failed' }
```

모델 입력에 sessionId·내부 저장 위치·MIME·본문을 추가하지 않는다. IPC의 sessionId를 권한 증거로 신뢰하지 않고, Main이 게시 참조의 소유 관계와 sender의 기존 IPC 경계를 확인한다.

파일 상태·저장·reveal·휴지통은 본문을 renderer로 보내지 않는 좁은 API로 구현한다. 확인 중·삭제 중·표시 오류는 UI 요청 상태이며 파일의 `missing`과 섞지 않는다. 후속 뷰어용 읽기 타입/채널을 이번에 선언하지 않는다.

`artifact.published` 이벤트는 host가 `artifact: ArtifactRef`를 보내 목록만 갱신한다. 검증된 연결은 기존 `tool.call.completed.artifact?: ArtifactRef`로 relay하고 원래 toolRunId에 붙인다. `artifact` part는 `artifact: ArtifactRef`를 갖는다. ID 기반 list/status/save/reveal/trash/open-folder 계약의 정본은 구현의 `shared/artifacts.ts`다.

### 입력·저장·표시의 상한안 — D-014

| 항목 | 값/의미 |
|---|---|
| 지원 형식 | `.html/.htm/.md`, UTF-8. 지원 판정의 단일 함수를 Main에서 사용 |
| 경로/제목 | path는 1~4096 UTF-16 code units, title은 trim 후 1~160, 미지정이면 파일명 |
| 본문 | 단일 파일 5 MiB 이하. 읽는 도중에도 상한 강제 |
| 호출 | 단일 파일 입력. handler는 최대 2건의 파일 준비를 병행, 초과는 재시도 가능한 busy |
| 성공 결과 | ID와 제한된 메타데이터만 전체 8 KiB 이내. 본문·내부 절대 저장 경로 제외 |
| 묶음 저장 | 최대 50건/회 제안. §5의 대상 집합을 시작 시 고정하고 직렬 복사. 동명은 접미사로 구분하며 기존 파일을 덮어쓰지 않음 |
| 묶음 상한 초과 | 대상이 51건 이상이면 dialog/복사 시작 전 전체 요청을 거절하고 개별 저장을 안내하는 안. 앞 50건만 조용히 저장하지 않음. D-014 확정 |
| 파일 위치 | 첫 버전은 로컬 파일만 허용하는 안. UNC/네트워크·device namespace·ADS·드라이브 상대경로는 오류로 거절. D-014 확정 |
| 상태 조회 | 등록된 게시 ID 최대 100개/요청, Main stat 병렬 4개. 긴 목록은 필요한 페이지/표시 범위만 요청. 전체 파일 내용·디렉터리 탐색 없음 |

확정된 제품 SLA가 아니다. 수치를 채택하면 경계값 시험과 대표 파일 실측을 수행한다.

### 파일 검증과 원본 위치 열기

- **게시 입력** 허용 루트는 실제 실행 `cwd`와 해당 세션에 해석·계승된 `extraDirs`다. resume은 DB의 세션 값, continuity는 출발 세션 값을 따르는 기존 turn-context 경로를 사용한다. 일반 `readRoots`의 `.claude`·앱 설정·런타임 경로를 자동으로 포함하지 않는다.
- 상대 path는 호출 당시 실제 `cwd`로 해석한다. 허용 루트와 대상의 `realpath`를 확인하고 경로 요소 단위로 포함 관계를 비교한다. junction/symlink를 통해 루트 밖으로 나가는 대상, 디렉터리·장치·비정상 파일은 거절한다.
- 파일 handle로 크기 상한을 적용하며 읽고, 전후 파일 상태와 경로 실체를 다시 확인한다. 변경·교체가 관측되거나 확인할 수 없으면 저장을 확정하지 않는다. 이 검사는 일반 파일 변경 경쟁에 대한 방어이며 Windows의 악의적인 동시 경로 교체를 원자적으로 차단하는 OS 샌드박스로 표현하지 않는다.
- **게시 후** 모든 파일 액션은 publicationId→세션 참조→artifactFileId→보관 루트 상대경로로 해석한다. 처음 가져온 workspace 경로는 출처 정보이며, 파일 액션이나 자동 복원에 사용하지 않는다. worktree가 바뀌어도 추적 대상은 바뀌지 않는다.
- reveal은 현재 파일 실체를 검증한 후 `showItemInFolder`만 수행한다. `openPath(file)`로 HTML을 실행하지 않는다. ‘보관 폴더 열기’는 Main이 정한 해당 profile의 고정 폴더만 연다. 범용 files API의 경로 허용 범위를 넓히지 않는다.
- 삭제는 등록된 일반 파일 하나에 한정한다. 루트/디렉터리·실체 이탈·renderer 임의 path는 거절한다. 확인 후 동시 복원/교체도 실행 직전 다시 검사한다. 휴지통 이동 성공은 DB 기록 성공과 따로 반환한다.

### 보관 경로·수명

제품 루트는 `join(orcaConfigDir(), 'artifacts')`, Windows 표기는 `%USERPROFILE%\\.config\\orca\\artifacts`다. 제품 파일은 `<root>/<artifactFileId>/<safeFilename>`, 개발 실행 파일은 `<root>/.dev/<artifactFileId>/<safeFilename>`에 보관한다. UUID와 안전한 basename으로 충돌·상위경로 이탈을 막으며 title을 디렉터리 이름으로 쓰지 않는다. 개발·설치본은 자기 DB와 자기 profile 루트만 조회/삭제하고 실제 사용자 폴더를 시험 fixture로 쓰지 않는다.

DB에는 root 기준 상대경로·파일 ID·게시 당시 메타데이터와 세션 참조를 둔다. 절대 경로 문자열을 각 message part에 복제하지 않는다. UI는 원본 경로를 메타데이터로 표시할 수 있지만 모든 액션은 ID를 받는다. `artifact_files`는 세션과 독립된 행이고 `session_artifacts`만 세션 삭제에 따라 제거한다. fork는 같은 file ID를 참조하는 자식 행을 만들며 출발 세션 행에 수명을 종속시키지 않는다.

게시 후 사용자가 이 파일을 수정할 수 있으므로 해시 불일치를 자동으로 ‘손상’이나 ‘삭제’로 판정하지 않는다. 저장은 동작 시점의 정상 파일 바이트를 내보내며, 게시 당시 파일명/크기와 현재 파일 상태를 구분한다. 불변 과거 내용·자동 버전 백업을 보장하지 않는다. 새 publisher 호출로 재게시하면 새 파일을 만들고 이전 카드는 유지한다. 새 호출은 현재 입력을 다시 검증하고 새 게시를 만든다. 영수증 재전달은 기존 게시의 연결만 재사용하며 새 파일 성공으로 취급하지 않는다.

### 강제 지점

각 EP는 아래의 책임 경계를 뜻한다. 상세 강제 위치와 분모는 아래 위치 등록표에 정의하며, pair는 참조한 EP의 모든 위치를 닫아야 한다. T-01 결정으로 경로가 바뀌면 위치·분모·pair를 함께 갱신한다. 이전 뷰어 EP-09는 D-018에 따라 현재 범위에서 제거했으며 재사용하지 않는다.

| EP / V | 계약 | SSOT | 누가·언제·전체 대상 | 실패 의미 |
|---|---|---|---|---|
| EP-01 / AR-01 | 모델에게 노출하는 도구·고정 지침, 자동 감지 없음 | artifacts/tool 정의 | registry 등록, builder snapshot, SDK server 조립, 승인 도구명 생성 | 미노출·이름 충돌·의도하지 않은 자동 감지 |
| EP-02 / AR-01·SD-01 | 신뢰 세션·호출 문맥 | runtime 채널 문맥·§9.3 | query wrapper, 채널 생성, 세션 확정 gate, warm/listen 수명, 호출 시작/commit 직전 | 세션·메시지 오귀속 또는 종료된 준비의 commit |
| EP-03 / MD-01 | 경로·형식·크기·안정된 바이트 | artifacts/validation | publisher 입력, canonical 실체 검사, bounded read, commit 전 취소·세대 검사 | 범위 밖·불법 형식·미완료 파일 |
| EP-04 / SD-02·MD-02 | 지정 루트 FS 준비와 DB 확정·중복 키 | managed file store + artifact queries | temp 생성, rename, DB transaction, rollback, 같은 키 재호출 | 다른 루트 저장·없는 파일의 성공 참조 |
| EP-05 / AR-02 | 실제 게시를 원래 메시지 part에 연결 | history writer + artifact queries | 게시 ID 소유 검사, 원래 tool_call 검색, DB part, 성공/relay 경계 | 결과 위조·이중 persist·오귀속 |
| EP-06 / AR-03·MD-05 | ID별 파일 상태·소유권·실체 검사 | shared schema + artifacts status | IPC 등록, preload 명시 API, 알려진 경로 stat, 요청별 투영 | 임의 경로 조회·권한 오류를 삭제로 표시 |
| EP-07 / AR-02·MD-03 | live/reload 동일 part와 대상 메시지 갱신 | shared/ipc + chat parts selector | wire/part 타입, history, partFromRow, RECV_EVENT/LOAD_SESSION, parts/turn memo, AssistantTurn | 재시작 소실·잘못된 마지막 메시지 append |
| EP-08 / MD-03 | 공통 카드·타일·stale 방지 | chat 내부 상태/컴포넌트 | menu/catalog, tileRegistry, RightPanel, 파일 상태/액션 hook, 세션 삭제/invalidate, 명시적 열기 | 이전 응답 복원·타일 접근 불가·리사이즈 회귀 |
| EP-10 / AR-03 | 저장 대상 고정·취소·동명 처리·원본 위치 검증 | artifact save/reveal handler | 개별/묶음 저장 IPC, dialog, 각 copy, 항목별 결과, ID 기반 reveal | 원본 덮어쓰기·실패를 전체 성공으로 표시·다른 파일 열기 |
| EP-11 / SD-02·MD-02 | fork 참조·세션과 파일 수명 분리 | artifact DB refs + file store | copyMessagesTx, sessionDelete, boot 시 파일 보존, quit 취소 | 마지막 대화 삭제/다른 DB의 GC로 실제 파일 손실 |
| EP-12 / MD-04 | 모델 평가와 후속 판단 분리 | evaluation.md | fixture 기대값, 실행 기록, 생성/선택/저장/표시 분류, 사용자 판단 | 근거 없는 정확도·미평가 상태의 watcher 도입 |
| EP-13 / 문서 gate | 계획 상태 사본의 일치 | plan 메타 + handoff INDEX | 계획 상태, 보드 행, docs INDEX 진입점, 선행 study 안내, 평가표 상태 | DRAFT를 READY/구현 완료로 오인 |
| EP-14 / SD-04·MD-05 | 사용자 휴지통 삭제·기록 보존·소실/복원 | artifacts service + card state | 메뉴/확인, IPC, 경로 재검증, trash, 결과 기록, 참조 투영, 재조회 | 영구 삭제 대체·기록 소실·다른 파일 삭제·거짓 상태 |

### 상세 위치 등록표 / 전수 분모

아래 `a`~`n`은 EP 안의 개별 강제 위치 ID다(예: `EP-02-a`). 단일 파일 안에서도 시점/소비 경로가 다르면 별도 위치다. 이는 **설계상 구현해야 할 위치 목록**이며 현재 구현 완료 건수가 아니다. `main/`, `renderer/`, `shared/`, `preload/`는 `app/src/` 아래를 뜻한다.

| EP | N | 전체 위치 / 관측 대상 |
|---|---:|---|
| EP-01 | 6 | a `main/features/artifacts/tool.ts` 고정 선언·지침; b `main/app/bootstrap.ts` 단일 등록·자동 감지 배선 부재; c `features/extensions/runtime-tool-registry.ts` 충돌/revision; d `features/extensions/builder.ts` snapshot; e `adapters/claude-runtime-tools.ts` MCP 조립; f `adapters/claude.ts` 승인 도구명 |
| EP-02 | 8 | a `adapters/turn.ts` 문맥 포트; b `adapters/claude.ts` query별 wrapper; c `session-runtime.ts` cold spawn 문맥 생성; d `turn-coordinator.ts` history/promotion 뒤 세션 확정; e session-runtime warm/listen 문맥 유지; f interrupt/close/respawn 신호 취소; g publisher 진입 세션 대기; h commit 직전 세션/취소 재검사 |
| EP-03 | 4 | a `artifacts/validation.ts` 입력·지원 형식 판정; b `artifacts/service.ts` 허용 루트/실제 경로 검사; c `artifacts/files.ts` 상한 있는 읽기·변경 중 검사; d `artifacts/service.ts` commit 전 취소 판정 |
| EP-04 | 6 | a `artifacts/files.ts` temp 작성; b 같은 파일 rename; c `infra/db/artifact-queries.ts` transaction; d `artifacts/service.ts` 실패/rollback 정리; e `artifact-queries.ts` 동일 키 재호출; f `infra/config/paths.ts` 지정 root/profile와 Main 소비처의 동일 경로 사용 |
| EP-05 | 4 | a 게시 결과 ID의 host 소유 확인; b 원래 tool_call 메시지 조회; c `features/history/writer.ts`/DB part 확정; d `app/bootstrap.ts` history→relay 경계. a/b는 artifact DB queries, c는 원래 호출 메시지에만 part 저장 |
| EP-06 | 5 | a `shared/ipc.ts` status schema; b `app/handlers/artifacts.ts` sender/세션 참조 확인; c `preload/index.ts` 명시 API; d `artifacts/files.ts` profile/실체/stat 오류 분류; e chat 상태 요청의 세대/가시 범위별 투영 |
| EP-07 | 8 | a `shared/ipc.ts` 게시 part/wire; b `shared/protocol.ts` 이벤트; c `infra/ipc/dto.ts` partFromRow; d chat reducer RECV_EVENT; e 같은 reducer LOAD_SESSION; f chat `lib/parts.ts` 투영; g `lib/turns.ts` 비교/memo; h `AssistantTurn` 카드 표시. history 확정은 EP-05-c |
| EP-08 | 8 | a `lib/rightPanelTiles.ts` catalog; b `ChatTitleBar` 메뉴; c `rightpanel/tileRegistry.ts`; d `RightPanel` 폭/스크롤/리사이즈; e 타일의 명시적 열기 시 기존 열 재노출; f 파일 상태/액션 요청 세대와 대상 ID 고정; g `store/chatStore.ts` 세션 삭제·무효화; h `ArtifactCard` 명시 액션·메타데이터·키보드 |
| EP-10 | 7 | a 카드의 개별 저장 입력; b transcript 묶음 버전 집합; c 타일의 최신 목록 집합; d Main save IPC/dialog·상한 거절; e 원본 파일별 현재 바이트 복사/이름 충돌; f UI 항목별 성공/건너뜀/취소/실패 표시; g ID 기반 reveal의 세션 참조·현재 실체 재검증 |
| EP-11 | 4 | a `infra/db/queries.ts` copyMessagesTx의 자식 참조; b `app/handlers/session.ts` 런타임 종료 뒤 세션 참조만 삭제; c boot/DB 초기화에서 세션 없는 파일·다른 profile 파일 보존; d quit 취소/정착은 현재 호출의 미확정 temp만 처리. a~d는 DB 참조와 실제 파일 생존을 관측 |
| EP-12 | 4 | a evaluation fixture 기대 집합; b 반복별 실제 기록; c 실패 종류·분모 계산; d 사용자 후속 판단 기록 |
| EP-13 | 5 | a 본 plan 메타/자체 검토; b handoff INDEX 0223 행; c docs INDEX 진입점; d 선행 study의 전략 변경 안내; e evaluation 미실행/실행 상태 |
| EP-14 | 8 | a ArtifactCard 메뉴·기존 확인창; b 카드/파일별 진행 상태·중복 억제; c shared/preload의 ID 기반 trash 계약; d Main의 세션 참조·profile·실체 재검사; e shell.trashItem 성공/실패; f DB의 삭제 관측 기록·부분 실패; g 같은 file ID의 모든 살아 있는 카드/세션 투영; h 목록/다시 확인/액션의 외부 소실·권한 오류·복원 재조회 |

pair의 괄호 N은 그 행이 참조한 EP의 상세 위치 수 합계다. 여러 pair가 같은 위치를 검증할 수 있으므로 pair 합계를 전체 위치 총수로 더하지 않는다. EP-13은 이번 문서 운영 gate로 검증한다. 구현 중 위치가 달라지면 같은 불변식의 전체 지점을 다시 열거한다.

## 11. 구현 설계

### 구현 순서

| 순서 | 산출/완료 경계 |
|---|---|
| 선행 | rev.4 READY 설계 커밋을 별도로 남긴 뒤 사용자 승인에 따라 구현 |
| 1 | publisher 정의·기존 registry 연결, 채널 문맥, 파일 검증·FS/DB 저장. 실제 SDK 경계와 신규 세션·동시 호출·취소·저장 실패부터 검증 |
| 2 | 게시 ID의 원래 메시지 연결·history/live/reload/fork, 공통 카드·기존 우측 타일. 마지막 메시지에 잘못 붙는 회귀와 재시작 복원을 검증 |
| 3 | ID 기반 파일 상태·저장/reveal/휴지통·기존 확인창. 실제 Electron의 삭제 성공/실패, 좁은 창·기존 타일·stale 응답·파일 수명 검증 |
| 4 | 고정 평가표 실행·누락/오게시/프로그램 실패 보고. 결과를 근거로 사용자에게 수용 여부와 후속 보완 필요성을 제시 |

각 순서는 하나의 기능을 연결하는 구현 단위이며 별도 플랫폼·서비스를 뜻하지 않는다. 감지 hook/watcher를 자동으로 이어지는 5단계로 두지 않는다.

**다음 제품 단계는 파일뷰어 구현이다.** 현재 게시 기능 구현 후 별도 계획으로 시작하며, 이번 완료 기준이나 선행 의존성에 넣지 않는다.

### 모듈 배치

| 변경/신규 위치 | 책임 | 테스트 seam |
|---|---|---|
| 신규 `main/features/artifacts/tool.ts` | 도구 description/instructions/schema와 publisher 호출 | 순수 tool factory, 성공/실패 MCP 경계 |
| 신규 `main/features/artifacts/service.ts` | 검증·준비·commit·상태/삭제 조정, 파일별 동시성·취소 | FS·DB·호스트 context·휴지통 실행 포트 주입 |
| 신규 `main/features/artifacts/validation.ts` | 경로/형식/제목/상한의 순수 판정 | Electron·DB import 없는 별도 파일 |
| 신규 `main/features/artifacts/files.ts` | 지정 루트 FS temp/rename/stat/copy와 파일 실체 검사 | 실제 임시 디렉토리·실패 주입·profile 분리 |
| `main/infra/config/paths.ts` | artifacts 제품 루트와 개발 하위 루트 파생 | homedir 기준·다른 profile 이탈 거절 |
| 신규 `main/infra/db/artifact-queries.ts` + append-only migration | 메타데이터·게시 참조·중복·fork 원장 | 기존 SQLite 연결을 주입, 독립 DB/ORM 없음 |
| `main/adapters/runtime-tools.ts`, `claude-runtime-tools.ts`, `claude.ts` | 세션별 실행 래퍼·MCP 경계(T-01) | 기존 boundary 시험 확대 |
| `main/features/sessions/session-runtime.ts`, request/continuation 조립 | 현재 채널 수명·delegate 전달 | warm/listen/discard 회귀 |
| `main/features/history/writer.ts`, `infra/ipc/dto.ts`, `infra/db/queries.ts` | 게시 part·이력 재조회/fork 연결 | 실제 DB roundtrip·순서 |
| `main/app/bootstrap.ts`, 신규 `app/handlers/artifacts.ts`, 기존 session handler | feature 간 주입·IPC·수명 조립 | feature 교차 import 없이 실제 배선 시험 |
| `shared/ipc.ts`, `shared/protocol.ts`, `preload/index.ts` | 이벤트/part/좁은 상태·저장·reveal·trash API | schema·IPC contract·preload roundtrip |
| 신규 chat 내부 `ArtifactCard`, `ArtifactTileContent` | 카드·목록·파일 상태·파일 액션 | 순수 props/selector + 기존 confirmDialog 재사용·시각 검증 |
| chat parts/reducer/store/turns·rightpanel catalog/registry | 동일 게시물 투영·늦은 응답·타일 접근 | reducer·selector·session race·기존layout 시험 |

하나의 함수만 있는 전달 모듈을 추가로 나열하지 않는다. 각 신규 파일은 게시 정책·FS·DB·UI 중 서로 다른 실행/시험 경계를 갖는다.

### 모델에 제공할 지침 초안

```text
Publish a completed HTML or Markdown deliverable into the current Orca conversation.
Use this when the requested result is a document the user should open or save.
Do not publish application internals, configuration, tests, logs or intermediate files
merely because they were created or edited. A requested standalone HTML example can
itself be a deliverable; decide from the user's task, not the folder or extension alone.
Finish writing and checking the file, then call this tool before the final response.
If several files are final deliverables, publish each. Do not claim publication succeeded
unless the tool confirms success. This publishes locally in Orca, not to the web.
The tool stores the published file in Orca's artifacts folder and returns its reference.
Use the completed file in your working directory as input; do not change Orca settings
or write directly to its configuration folder to publish a file.
The current UI provides file cards and file actions; it does not preview document contents.
```

`alwaysLoad:true`로 설명·schema를 노출한다. 같은 지침을 system prompt·skill·hook에 반복 복제하지 않고 tool/server definition을 정본으로 둔다.

### 후속 뷰어에 넘길 최소 경계

`publicationId`·`artifactFileId`·세션/메시지 귀속·파일명/종류·게시 시각·Main 소유 상대경로·파일 상태를 재사용한다. 후속 단계에서 게시 ID 기반 본문 읽기와 HTML/Markdown 표시를 추가한다. 뷰어 URL·본문·HTML 실행 정책·미리보기 캐시를 현재 스키마에 선설치하지 않는다. 이 연결 가능성은 뷰어 구현이나 검증이 끝났다는 의미가 아니다.

### 저장 스키마 — 파일·게시 수명 분리와 2단계 연결

| 개념 | 저장 내용 | 관계 |
|---|---|---|
| artifact_files | 파일 ID·profile 내 상대 경로·게시 당시 hash/크기·kind·createdAt·lastTrashedAt | 본문은 지정 FS 원본. 세션 삭제로 cascade 제거하지 않음. hash는 불변성 보장이 아님 |
| publication/reference | 게시 ID·세션/메시지 소유권·file ID·제목·입력 출처·게시 시각 | fork에서 독립 자식 참조. 파일 소실 뒤에도 행 유지. 세션 삭제는 자기 참조만 제거 |
| message part | 카드 메타데이터·publication 참조·검증된 toolRunId | 원본 소스 문자열 파싱으로 생성하지 않음 |

전역 content-addressed 플랫폼·참조 수 캐시·자동 GC를 만들지 않는다. 파일 hash는 초기 기록과 동일 호출의 중복 판정에 사용한다. 파일의 현재 존재 여부는 실제 경로 조회로 판단하며, lastTrashedAt만으로 복원된 파일을 계속 삭제 상태로 두지 않는다.

## 12. End-to-end 영향

| 경계 | 생산자 → 소비자 | 회귀/추가 계약 |
|---|---|---|
| 등록 | Bootstrap → RuntimeToolRegistry → ExtensionBuilder → Claude query | 안정된 handler identity·서버 충돌 검출·기존 플러그인 유지 |
| 웜 채널 | TurnRequest → SessionRuntime delegates → adapter wrapper | 첫 request closure 고착 없음. listen·respawn 동일 전달 |
| 게시 기록 | publisher → 확정 계약(T-01) → HistoryWriter/DB → relay | 하나의 기록 정본, 이중 part 생성 없음 |
| live/reload | chat event → store/coalescer/reducer, DB→DTO→LOAD_SESSION | 같은 artifact part를 소유 메시지에 투영 |
| 카드 | parts → turns/exchanges → AssistantTurn → ArtifactCard | 해당 메시지만 immutable 갱신, memo·가상 높이 반영 |
| 타일 | rightPanelTiles → ChatTitleBar → tileRegistry → RightPanelTile | 기존 catalog 멤버와 새 타일의 open/close/resize 및 기존 순서 보존 |
| 파일 액션 | 카드·목록 → preload → Main → FS/OS | 소유권·크기·취소·요청 세대·고정 대상 ID 확인 |

공개 입력을 늘리는 데 필요한 최소 타입만 shared에 둔다. Claude SDK 타입은 adapter에 머물고 chat 도메인 상태는 renderer shared UI로 이동하지 않는다.

## 13. Lifecycle / 오류 / 정리

| 경계 | 처리 원칙 | 허용하지 않는 상태 |
|---|---|---|
| boot | 정적 도구 등록, DB 준비 뒤 서비스 연결. 지정 루트는 필요한 때 생성 | 세션별 registry 덮어쓰기, 파일 감시/전체 조사/무참조 파일 자동 삭제 시작 |
| 호출 | 호스트 채널 문맥 확보, 제한된 바이트 읽기 | 모델 sessionId를 소유권으로 채택 |
| 취소·세대 교체 | commit 직전 재확인. 확정 전 중단 | 종료된 호출이 새 세션/턴에 기록 |
| renderer gone | 확정된 데이터는 DB/FS에서 재조회 | relay 실패를 이유로 데이터가 없었다고 보고 |
| session delete | 기존 런타임 종료 뒤 해당 세션 refs 삭제, 실제 파일·다른 세션 참조 유지 | 마지막 참조 삭제를 이유로 실제 파일 정리 |
| 파일 삭제 | 사용자 확인한 file ID를 직전 재검사하고 휴지통 이동. 같은 파일 삭제 작업을 직렬화 | 모델 자동 삭제·중복 trash·영구 삭제 대체·다른 profile 파일 삭제 |
| cleanup | 현재 요청이 만든 미확정 temp/실패 파일만 소유권을 확인해 정리 | 공유 artifacts 루트 탐색·DB에 없다는 이유로 파일 삭제·입력/내보낸 파일 삭제 |
| quit | 신규 요청 차단·진행 I/O 취소/정착·준비 파일 정리 | 무제한 대기·닫힌 DB에 지각 쓰기 |

### 다중 저장소 실패 표

| 중단 지점 | 관측 상태 | 복구/처리 |
|---|---|---|
| 원본 검증/읽기 실패 | 게시 없음 | 모델 오류. 부분 파일은 게시하지 않음 |
| temp 쓰기 중 실패 | 앱 소유 temp만 존재 가능 | 실패 반환·해당 temp 정리 |
| rename 뒤 DB 확정 전 종료 | 등록되지 않은 파일이 루트에 남을 수 있음 | 성공 카드 없음. 무참조 파일을 전역 GC하지 않으며 사용자가 보관 폴더에서 정리 가능 |
| DB 확정 실패 | 새 유효 게시 참조 없음 | 이번 준비 파일만 정리, 성공 반환 금지 |
| DB 확정 뒤 relay 유실 | 유효 게시 데이터 존재 | 재조회 복원. 파일·DB 전체 원자성 보장으로 표현하지 않음 |
| 2단계 대안의 DB 확정 뒤 메시지 연결 전 종료 | 세션 게시가 있으나 transcript part 미연결 | 우측 목록에 보존. 검증 가능한 원래 tool_result가 재전달될 때만 transcript 연결 |
| 휴지통 이동 실패 | 기존 파일이 남을 수 있음 | 원인을 표시하고 다시 확인. 영구 삭제·성공 표기 금지 |
| 휴지통 이동 뒤 DB 기록 실패/종료 | 파일은 없고 게시 metadata는 존재 | 파일 없음 표시로 복원. 현 호출은 이동 성공/기록 실패를 분리 반환, 휴지통 이동을 재실행하지 않음 |
| 외부 삭제·이동 | 참조는 유효하지만 경로가 없음 | 게시 기록 유지·파일 없음. 입력 경로/다른 파일로 대체하지 않음 |
| 외부 복원 | 삭제 이력이 있어도 경로에 파일 존재 | 다음 상태 확인에서 정상으로 복귀 |

새 assistant 메시지 생성과 게시 commit을 묶는 설계라면 메모리의 `currentAssistantMessageId`는 commit 후 변경해야 한다. rollback된 row ID를 `TurnContext`에 남기지 않는다.

확인창은 원래 session/publication ID를 캡처한다. 확인 중 세션 전환·삭제가 발생하면 Main의 현재 참조 검사를 통과한 경우에만 실행한다. 삭제 후 늦게 도착한 이전 stat 결과가 `present`로 덮어쓰지 않도록 파일별 작업 세대와 UI 요청 세대를 함께 검사한다. 결과 수신이 삭제된 세션 엔트리를 다시 만들지 않으며, 같은 file ID를 보는 살아 있는 참조는 다시 확인한다.

### 문서 상태 사본

현재 상태의 사본은 본 plan 메타와 handoff INDEX 행이다. 선행 study에는 전략 변경과 본 plan 링크만 추가하고 현재 구현 사양으로 바꾸지 않는다.

문서 쓰기가 일부 실패하면 두 상태를 대조해 같은 DRAFT/READY로 복구한다. 문서 작성 완료와 기능 구현 완료를 같은 상태로 기록하지 않는다.

## 14. 성능 / 상한 / 최적화

| 비용 | 상한/보존할 의미 |
|---|---|
| 파일 준비 | 5 MiB × 병렬 2건 = 동시 원본 바이트 최대10 MiB. 복사 버퍼·문자열 overhead는 별도 측정 |
| 모델 반환 | 8 KiB × 각 도구 호출. 전체 턴 호출 수를 제한하지 않으므로 턴 전체 상한을 거짓으로 보장하지 않음 |
| 모델 컨텍스트 | 항상 노출되는 작은 도구 정의 한 벌. 전체 workspace 목록·본문을 매 턴 주입하지 않음 |
| 목록 | DB 카드 메타데이터를 먼저 표시하고 알려진 file ID의 상태만 제한된 batch stat. 파일 본문은 미리 읽지 않음 |
| 표시 | 게시 UI는 메타데이터와 파일 상태만 유지. 본문 IPC·파서·뷰어 캐시 비용 없음 |
| 묶음 저장 | 50개 × 단일 파일 상한, 직렬복사로 메모리·I/O 폭 제한. 대상 목록 시작 시 고정 |
| 대화 | 과거 모든 턴 재파싱 금지. 실제 part가 바뀐 메시지만 immutable 교체 |
| 감시 비용 | 제품에 watcher·periodic scan·후보 힌트가 없으므로 그 유휴 비용 없음 |
| 상태/삭제 | 상태 요청 최대100개·stat 병렬4개, 같은 파일 요청 병합. 삭제는 해당 파일 단위 직렬화. 유휴 polling·전역 참조 캐시 없음 |

기록된 원본 경로만 추적하므로 사용자의 이동·삭제·수정을 감추지 않는다. 등록 이후 원본의 과거 바이트를 자동 복원하지 않으며, 재게시만 새 게시 기록을 만든다. 세션 없는 파일은 남을 수 있다는 보관 비용을 삭제 안내·보관 폴더 진입점으로 드러낸다.

## 15. 외부 구현 포트 / 문서 계약

runtime handler 문맥은 adapter가 제공하는 최소 구조적 포트로 한정한다. 기존 플러그인이 추가 문맥을 사용하지 않아도 동작하도록 optional 전달/기존 handler 호환을 검증하되, publisher는 필수 문맥 미충족을 오류로 처리한다.

OpenCode용 포트 구현과 실제 도구 노출은 후속 범위다. 이 단계에서는 SDK별 context/type이 저장·UI로 전파되지 않는다는 구조만 검증하며 호환 완료라고 보고하지 않는다.

도구 입력·MCP 오류·IPC의 성공/취소/실패 예제는 실제 타입에 대입해 검사한다. 선언 shape 검사와 게시 성공 의미 검증을 구분한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문 연결 | 결과 |
|---|---|---|---|
| 사용자 승인 뒤 구현 | 최초 승인 조건·최신 구현 지시 | §메타·D-006 | 유지 — rev.4에서 구현 승인 확인 |
| Main 하향 의존·feature 교차 금지 | main AGENTS | §11 모듈·Bootstrap 포트 주입 | 유지 |
| Renderer 4-layer·시맨틱 토큰·named group | renderer AGENTS | §5·§11 | 유지 |
| FS 본문·DB 메타데이터 | persistence §1.4·TRD | D-007·015~017·§11·§13 | 본문/메타 분리 유지. 과거 경로·자동 정리 권고는 최신 사용자 결정으로 대체 |
| history-before-relay | main AGENTS·bootstrap 회귀 case | §9·§12 | 유지. 게시 시점 연결은 T-01 |
| fork 복사·handoff 미복사 | orchestration/fork | AC10·§13 | 유지 |
| PRD 도구 권한 미정 | PRD OQ9 | D-011 | 별도 기본 승인 예외 없음 |
| 생성물 인벤토리 단일 출처 | docs AGENTS | §19 | 구현 시 inventory 생성/검사 |
| 감지 단계를 후속에 도입 | 이번 사용자 | D-002·003·AC2·13 | 확정. 빈 모듈/설정도 선설치하지 않음 |

## 17. 리스크 / 트레이드오프

| 리스크 | 처리 |
|---|---|
| 모델이 호출을 잊거나 중간 파일을 선택 | 고정 평가로 관찰. Main의 경로 검사를 의미 분류 검증으로 과장하지 않음 |
| watcher가 오게시를 해결한다는 오해 | 발견 누락과 선택 오류를 분리 보고. 후자는 도구 지침 보완이 먼저 필요할 수 있음 |
| 호출 소유권의 미확정 | T-01로 공개, 임의 최신 메시지 연결 금지 |
| 게시 UI의 파일 실행 오인 | 카드 본문을 미리보기처럼 표시하지 않음. 파일 액션은 저장/reveal/휴지통이며 HTML을 자동 실행하지 않음 |
| 파일·DB·fork 수명 | D-015~017·중간 실패 시험. 대화 삭제로 파일 자동 삭제 금지, 전체 FS/DB 원자성 주장 금지 |
| 외부 파일 삭제/변경 | DB 기록을 현재 파일 존재나 불변 바이트의 증거로 쓰지 않음. 알려진 경로 재검사·기록 유지 |
| 새 타일의 폭·리사이즈 회귀 | 제한 viewport와 기존 separator 좌표를 같이 시험 |

신규 제품 의존성은 제안하지 않는다. 별도 browser 시험 도구가 필요하면 기존 설치/도구를 먼저 확인하고, 의존성 정책을 따른다.

## 18. 영향 받는 파일 / 문서

앱 변경 위치는 §11 표를 따른다. 실제 구현 후 IPC_CONTRACT, backend runtime/persistence/security, frontend rendering/UX 문서 및 generated inventory를 현재 코드와 동기화한다.

설계 산출물은 `plan.md`, `evaluation.md`, handoff INDEX, docs INDEX, 선행 study의 결정 변경 안내다. rev.4 승인 이후 앱 구현 산출물과 결과는 [impl.md](impl.md)에 기록한다. 기존 리팩토링 handoff 상태는 변경하지 않는다.

## 19. 게이트

| 단계 | 명령/검증 | 판정 |
|---|---|---|
| 이번 계획 | `cd app; node scripts/check-doc-inventory.mjs --check`, 신규 문서 상대 링크, `git diff --check` | 문서 정합만 판정 |
| 정적 구현 | `cd app; npm run typecheck`; `node_modules/.bin/eslint.cmd src scripts`(읽기 검증) 또는 작업 중 `npm run lint` | 타입·경계·규칙. 기존 warning은 분리 |
| 비-DB | `node_modules/.bin/vitest.cmd run <영향 suite>` | SDK boundary·pure·renderer/preload |
| DB | 필요 시 `npm test`의 Node ABI 준비 후 DB/fork 시험 | 실제 FK/transaction/마이그레이션·FS 실패 |
| 빌드 | Electron ABI 복구를 감안해 `npm run build`, Windows packaged smoke | ABI/egress 실패와 제품 실패 구분 |
| repository | docs inventory·migration append-only·test budgets·CI 필수 검사 | 현 subtree 가이드와 CI가 정본 |
| UI/파일 액션 | 실제 Electron에서 §7·§11 fixture와 기존 타일 동작 | 카드·저장·탐색기 대상·휴지통·파일 수명 직접 관측. HTML 렌더링 gate는 후속 |
| 모델 선택 | evaluation.md 전체 fixture의 제한된 반복 | 실패 종류별 근거 및 사용자 판단 보고 |

계획 작성 중 앱 테스트·빌드·모델 API는 실행하지 않는다. 구현 단계에서는 `app/AGENTS.md`의 ABI 지침을 따라 DB 시험과 Electron 실행 순서를 잡는다.

## READY self-review

| 항목 | 관측/판정 |
|---|---|
| 사용자 전략 승계 | D-001~003 ↔ AC1·2·13 일치, 감지기는 조건부 후속 |
| Product→Technical | §7 R/AT와 §10 EP, §11 모듈을 연결 |
| AS-IS/TO-BE | §9 같은 축 비교, 호출 문맥 공백을 숨기지 않음 |
| V | R/SD/AR/MD 각각 same-level pair, 기존 회귀 VP-90 명시 |
| 결정 상태 | Q-03·T-01은 rev.4에서 해소. 뷰어 구현·검증은 다음 단계 |
| 정합 검사 | rev.3 doc-inventory·git diff --check 통과. 상대 링크39건·유효 V pair27개·EP 상세 분모13그룹·D-018 ACTIVE·DRAFT 상태 사본 대조 통과. 뷰어 계약의 현재 분모 제거와 본문 읽기 IPC/뷰어 모듈 계획 제거 확인. 앱·모델 시험 미실행 |
| READY 판정 | **READY V1 rev.4**. 사용자 구현 승인, 2단계 연결·취소·복구·중복 계약과 EP 정합을 재검토 |

---

## [구현자 기입] 설계 리뷰

작성자: Codex. rev.4의 hook 없는 2단계 게시·연결, 세션과 파일 수명 분리, 뷰어 후속 계약을 구현했다. 제품 결정을 추가로 바꾸지 않았다. 단계별 실행 결과의 정본은 [impl.md](impl.md)다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

[impl.md 강제 지점 전수](impl.md#강제-지점-전수-대조)에 모든 EP 위치를 대조했다. EP-08-h의 키보드 실기, EP-12-b/d의 전체 모델 반복/사용자 수용 판단과 모델/native 종단 gate는 미완료다. 전건 완료로 보고하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금

선택 VP-01/02/05/10 변이 red와 원복 green을 확인했다. hardlink와 미신뢰 sender 실패도 재현 후 수정했다. 상세는 [impl.md](impl.md#선택-변이구현-중-발견과-대응)에 있다.

## [구현자 기입] Product/UX 파생 검토

파일 소실/접근 오류/복원/과거 휴지통 이력, 원래 ID 액션, 지각 응답, 미연결 게시의 목록 유지와 파일 단독 보관 비용을 검토했다. [impl.md](impl.md#productux-파생-검토와-제한)를 따른다.

## [구현자 기입] 놓친 잠재 문제 + 대응

공통 IPC helper의 sender 미검사, 단일 export의 hardlink 원본 덮기, live fixture의 취소 후 관측 누락을 선조치했다. 모델 무응답 원인은 미확정이며 SRT/감지 hook의 문제로 단정하지 않는다.

### 설계 대비 명시적 차이

경로 생성은 새 paths helper 없이 Bootstrap에서 기존 orcaConfigDir를 재사용한다. viewport 좌표 계산은 기존 RightPanel 안에 유지한다. 테스트가 사용하는 in-memory MCP·합성 UI·native shell·실제 모델 경로의 증거 범위를 구분했으며 해당 대체물만으로 전체 인수를 닫지 않는다.

## [구현자 기입] 구현 보고

[impl.md](impl.md), [evaluation.md](evaluation.md). AC 9/15 자기 통과, 6개 부분 검증. V 20/27 자기 통과, 나머지는 인수 증거가 부족하다. `Status: partial`로 커밋하고 INDEX의 IN_PROGRESS를 유지한다.

## [구현자 기입] Review Signals — 사실만

새 dependency·자동 감지·뷰어 없이 기존 registry/SQLite/preload/renderer 패턴을 확장했다. 공유 production 변경은 전체 자동 회귀 통과 후 동결했다. 독립 verify는 미착수다.

## [검증자 기입] 파생 이슈

독립 검증 미착수. rev.4 구현 뒤 독립 검증한다.
