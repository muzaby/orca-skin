# Plan — Work·Code 제품 에이전트 계층

## 메타

| 항목 | 값 |
|---|---|
| slug | `0224-work-agent-layer` |
| 작성자 | **Codex** |
| 일자 | 2026-09-08 |
| 상태 | **verify/PASS (r8) — 판정 원문은 [`verify.md`](verify.md)** |
| 코드 조사 기준 | `04953cf781b8c967d4aaef3255752bb721bafeb0` |
| V mode / revision | Delta V / ΔV8 — r8 구조 계획(§27) |
| 기준 V / 유효 V | V1 `51268488` / V1 + ΔV2(§21) + ΔV3(§22) + ΔV4(§23) + ΔV5(§24) + ΔV6(§25) + ΔV7(§26) + ΔV8(§27) |
| 관련 작업 | 0205 Cowork 연구, 0223 게시 도구·작업 패널, 0214 OpenCode 연구 |

현재 변경은 r8 구조 계획(§27)이 우선한다. D-050~054가 종류 이름과 명시적 정책 구성을 갱신한다. 아래 §1~§20은 V1 기준선이며 r2 패널 계획(§21)과 r3 패널 계획(§22)의 대체되지 않은 결정·AC·V·강제 지점을 유지한다. r1~r8 구현 보고는 과거 라운드 증거이며 독립 검증 판정은 [verify.md](verify.md)가 갖는다. 0223의 일반 생성물 기준과 미완료 상태는 이 핸드오프로 닫지 않는다.

# Part I — Product & UX Contract

## 1. 목표

사용자가 새 대화에서 **코딩** 또는 **작업(Work)**을 선택하고, 두 종류가 같은 앱의 세션·도구·승인·확장 기능을 이용하게 한다. Work는 문서 작성·자료 정리·분석처럼 결과물 중심의 작업 지침과 표현을 제공한다.

선택 진입점은 **새 대화 랜딩 중앙의 큰 아이콘 토글**이다. 왼쪽 Todo는 Work, 오른쪽 Terminal은 Coding이며, 선택값이 해당 모드의 UI/UX와 실행 프로필을 함께 결정한다.

새 계층은 **제품 에이전트의 역할**을 소유한다. Claude/OpenCode 실행 백엔드, 모델 공급자, 권한 모드, SDK 서브에이전트는 각각 기존 책임을 유지한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “새로운 핸드오프로 진행”, “Cowork(work) 도입”, “cowork 에이전트와 coding 에이전트를 놓는 레이어가 신설” | 현재 사용자 요청 |
| 명시 UX | “화면 새 대화 랜딩 페이지 중앙에 커다란 토글 버튼”, “좌: todo icon, 우: terminal icon” | 후속 사용자 결정 (2026-09-08) |
| 명시 전략 | “토글에 따라 uiux 또한 트리거”, “코딩, 코워크 종속적인 uiux” | 후속 사용자 결정 (2026-09-08) |
| 명시 조건 | “구조적이며 체계적인 모듈화, 경량화”, “단 해결을 위해 플랫폼화(비대화) 하는 것은 안되며 회귀 또한 안된다.” | 앞선 구조 개선 요청 |
| 유지 결정 | OpenCode는 후속 구현. SRT는 Windows 지원 성숙까지 보류 | 앞선 사용자 결정·[SRT 보고](../../etc/study/srt/execution-report.md) |
| 유지 결정 | 게시 도구는 모델이 맥락에 따라 직접 호출. 누락·오게시가 빈번할 때 hook/watcher 보완 검토 | 앞선 사용자 결정·[0223 계획](../0223-artifact-publisher/plan.md) |
| 유지 결정 | 진행 상황·출력·컨텍스트를 유지. 컨텍스트는 실제 참조한 리소스이며 수집은 다음 단계. 파일 뷰어는 후속 | 앞선 사용자 결정·[0223 UI 계획](../0223-artifact-publisher/plan.md) §20 |
| 작성자 조건 | “Plan/impl, 커밋 작성시 codex가 작성했다고 기입할 것” | 앞선 사용자 요청 |
| 추론 의도 | Work를 새 SDK로 대체하는 것이 아니라, Orca의 기존 실행 능력을 작업 중심으로 제공 | 현재 코드와 사용자 요구를 함께 해석한 **설계 제안** |
| 참고 증거 | 도입부→작업 타임라인→마무리→산출물, 우측 패널은 현재 상태 | [Cowork 연구](../../etc/study/cowork/README.md) |

연구는 한 완료 턴의 DOM 관찰이다. Anthropic 내부 실행 엔진·격리 방식·스트리밍 시점을 증명하지 않으며, 연구의 제안 문장을 사용자 승인으로 취급하지 않는다.

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 |
|---|---|---|---|---|
| D-001 | 새 핸드오프로 Work·Coding 계층 도입을 계획 | 기존 게시 작업과 목적 분리 | 현재 사용자 | ACTIVE |
| D-002 | 기존 도구·플러그인·세션 실행 경로를 공유하는 경량 구조 | 비대화·기능 중복·회귀 방지 | 앞선 사용자 | ACTIVE |
| D-003 | SRT·OpenCode의 실제 도입은 이번 범위 밖 | 보류·후속 결정 승계 | 앞선 사용자 | ACTIVE |
| D-004 | 게시 원본·직접 호출·삭제 UX와 세 섹션 패널을 유지 | 게시 계약은 승계, 공통 패널/닫기만 D-012·013으로 대체 | 앞선 사용자·0223 | SUPERSEDED (패널 부분), 나머지 ACTIVE |
| D-005 | 컨텍스트 수집·뷰어·일반 생성물 감지는 기존 미정/후속 상태 유지 | 실제 참조 수집은 후속. 명시 폴더 추가는 D-015·016으로 보완 | 앞선 사용자 | ACTIVE (폴더 추가 보완) |
| D-006 | plan·구현 보고·커밋 작성자를 Codex로 명시 | 작성 주체를 정확히 남김 | 앞선 사용자 | ACTIVE |
| D-007 | 새 대화에서 선택하고 첫 전송부터 종류 고정. 재개·분기·핸드오프는 상속 | 실행 도중 지침/도구 변경과 과거 이력 재해석 방지 | 사용자 “구현하라” — 제시한 권고안으로 착수 | ACTIVE |
| D-008 | 이번 범위는 종류·지침 계층과 Work 타임라인·기존 패널 연결 | 타임라인 승계, 패널은 D-012·013으로 대체 | 사용자 “구현하라” — 제시한 범위로 착수 | SUPERSEDED (패널 부분), 나머지 ACTIVE |
| D-009 | 정밀 Work 타임라인은 Main 수신 구간의 작은 경계 part를 영속하여 구성 | 현재 데이터로 완료 경계를 복원할 수 없음. 새 실행 엔진 대신 기존 parts 활용 | 사용자 구현 지시·D-008 범위 | ACTIVE |
| D-010 | 새 대화 랜딩 중앙에 큰 아이콘 토글. **좌 Todo=Work / 우 Terminal=Coding** | 사용자가 지정한 진입 위치·크기·순서·아이콘 | 후속 사용자 결정 | ACTIVE |
| D-011 | 토글 선택을 모드 종속 UI/UX와 실행 프로필의 공통 입력으로 사용 | 화면과 실제 에이전트 종류의 불일치 방지 | 후속 사용자 결정 | ACTIVE |

- Q-01 확정: 새 대화에서 선택하고 첫 전송부터 고정한다. 구현 요청은 직전 권고안에 대한 착수 승인으로 반영했다.
- Q-02 확정: Work 계층·타임라인·기존 패널을 구현한다. 컨텍스트 추적·뷰어·일반 생성물 감지는 기존 후속/미정 결정을 유지한다.
- D-010·D-011의 중앙 토글과 §5 모드별 UI 매핑을 구현한다. 이번 구현 지시로 D-007·008·009도 확정했으며, 별도 재확인을 요구하지 않는다.
- 이번 수정은 READY 전 V1 초안의 구체화다. 이전 초안은 `16862e68`에 보존되며, 미확정 기본값·세션 고정 정책을 사용자 결정으로 승격하지 않는다.
- ACTIVE 결정 ↔ AC 대조: D-001→AC1·5·9, D-002→AC6·7·13·14, D-003→AC6·8, D-004→AC12·15, D-005→AC12, D-006→문서·커밋 gate, D-010→AC1, D-011→AC16. 충돌 없음.

## 4. 요구와 연구의 비판적 검토

| 쟁점 | 판단 | 근거 |
|---|---|---|
| Cowork 전용 실행 어댑터가 필요한가 | 현재 요구에는 불필요. 제품 역할과 실행 백엔드를 분리 | `SessionAdapter`는 실행 포트이고 registry는 현재 Claude를 등록 |
| 새 레이어 위치 | Main의 `features/agents`에 고정 프로필·순수 해석기. app에서 조립 | Main DAG는 새로운 최상위 `agents/`를 허용하지 않음 |
| 도구/권한도 다르게 해야 하는가 | 첫 버전은 같은 능력·승인 계약. Work는 작업 지침과 표현의 차이 | 도구 차단은 별도 제품 결정이며 shell을 금지하면 문서/분석 작업도 제한 |
| 연구의 작업 패널 미구현 평가 | 일부 낡음. 작업 상태·activeForm·게시 출력은 현재 존재 | `TaskTileContent`, `taskBoard`, `TaskOutputContent` |
| 연구의 타임라인 분류 | 유효한 UX 방향. 문체 기반 판단은 채택하지 않음 | 실제 `AppMessagePart.type`, `parentToolRunId`, tool ID로 분류 가능 |
| 최종 텍스트 판정 | 단순히 메시지별 마지막 text를 선택하면 틀림 | `groupTurns`는 여러 assistant 메시지를 묶고 자동 알림도 추가됨 |
| `/agent`를 Work/Coding 목록으로 변경 | 제안하지 않음 | 현재 `/agent`는 실행 환경·모델 공급자 설정 화면 |
| 랜딩 모드 선택 부품 | 중앙 큰 선택기는 chat feature에서 조립. 기존 작은 Toggle을 확대 재사용하지 않음 | `NewChatLandingPage` 중앙 블록, shared `Button/Icon/Toggle` 계약 확인 |
| 계정/프로젝트 지침 변경 즉시 적용 | 문서와 코드가 어긋남. Work 설계를 낡은 설명에 의존시키지 않음 | persistent 채널은 spawn 시 append 적용, 현재 respawn 축에 append 없음 |

## 5. 사용자 흐름과 상태

새 대화 랜딩은 중앙 콘텐츠 블록의 주된 선택 요소로 **큰 2분할 아이콘 토글**을 배치한다. 인사말과 Composer 사이에서 수평 중앙에 놓고, **좌 Todo=Work / 우 Terminal=Coding** 순서를 고정한다. 기존 진입의 Coding 기본값과 시작 후 종류 라벨은 기존 권고를 유지하며, 왼쪽 배치가 Work 기본 선택을 뜻하지는 않는다.

토글은 동일 폭의 큰 두 선택 영역과 선택된 영역의 배경/테두리로 표현한다. 시각 제안은 각 영역 높이 최소 56px·아이콘 24px이며 실제 창에서 비례를 검증한다. 버튼 본체는 아이콘으로 표현하고, 한국어 접근성 이름·hover/focus 툴팁과 인접 모드 안내로 뜻을 전달한다.

프로젝트 랜딩에 같은 토글을 재사용하는 것은 기존 제안 범위다. 프로젝트 정보·세션 목록의 레이아웃을 유지하며 새 대화 중앙 배치를 그대로 강요하지 않는다. 별도 `/work` 라우트·대화 저장소·설정 페이지는 만들지 않는다.

```text
새 대화 중앙 [Todo: Work | Terminal: Coding] → 선택 모드의 랜딩·입력 안내
  → 입력·폴더 선택 → 첫 전송(종류 잠금 권고)
  → 선택 모드의 트랜스크립트·패널 → 결과 답변·명시적 게시 카드
  → 세션 목록 / 재시작 / 분기에서도 종류 복원
```

| 상태/이벤트 | 동작 | 관측 결과 |
|---|---|---|
| 전송 전 선택 변경 | 같은 `agentKind`로 선택 표시·랜딩/입력 안내를 즉시 갱신. 입력·첨부·cwd 보존 | 모드 변화가 보이며 작성 중 자료는 유지 |
| 첫 전송 준비 중 | 종류 잠금. SDK ID 전에도 같은 초안의 후속 입력은 같은 종류 | 빠른 연속 입력이 다른 프로필에 합류하지 않음 |
| 기존 대화 로드 | 저장값 우선, 이전 버전 대화는 코딩 | 화면과 실제 실행 종류 일치 |
| 종류가 다른 변조/오래된 요청 | 예약·spawn·사용자 메시지 영속 전에 명시 오류 | 기존 세션/큐는 그대로, 새 대화에서 선택 안내 |
| 분기·핸드오프 | 출발 세션 종류 상속. 원본 불변 | 파생 세션과 초안 라벨 일치 |
| Work 첫 진입 | 기존 작업 타일을 한 번 열되 공간이 좁으면 기존 패널 배치 규칙 적용 | 진행 상황·출력·컨텍스트 접근 가능 |
| 사용자가 패널을 닫음 | 새 토큰·알림·재렌더로 다시 열지 않음 | 사용자 배치 선택 유지 |
| 중단·오류·질문/승인 대기 | 기존 제어 UI와 원문 유지 | 접힌 활동 때문에 필요한 행동/실패가 가려지지 않음 |
| SDK init 전 실패 | Renderer 초안은 종류 잠금을 유지. 해제된 lease와 미물질 세션은 Main에 별도 보존하지 않음 | 같은 초안의 UI 재시도는 종류 유지, 새 대화에서 변경 가능 |
| 오프라인/백엔드 불가 | 기존 가용성·오류 UI 적용 | 다른 백엔드나 종류로 조용히 대체하지 않음 |

### 모드별 UI/UX 매핑 — 구현 제안

| 표면 | Work (좌 Todo) | Coding (우 Terminal) | 공통으로 유지 |
|---|---|---|---|
| 새 대화 랜딩 | 작업 중심 인사말·모드 안내 | 코딩 중심 인사말·모드 안내 | 중앙 선택기·기존 랜딩 셸 |
| Composer | 문서/분석/정리 요청에 맞춘 placeholder·안내 | 개발 요청에 맞춘 placeholder·안내 | 입력 엔진·첨부·cwd·모델/권한 선택 |
| 전송 이후 본문 | §9-B Work 활동·산출물 표현 | 기존 Coding 트랜스크립트 | 원문·Markdown·도구/승인·파일 액션 |
| 우측 영역 기본 동선 | 기존 작업 타일의 진행/출력/컨텍스트로 진입 | 기존 Coding 배치와 진입 동선 | 패널 셸·타일·사용자의 닫기/배치 선택 |
| 세션 이동/복원 | 저장된 Work 종류에서 같은 UI 선택 | 저장된 Coding 종류에서 같은 UI 선택 | 현재 세션의 `agentKind` |

모드 전용 화면 조립은 분리하되 해당 모드가 사용하는 공통 컴포넌트는 공유한다. 이번 토글 결정에 없는 Git/도구 기능의 숨김·삭제·권한 변경은 추가하지 않는다. 공유 입력기를 `key={agentKind}`로 재생성하거나, 선택 시 자동 전송·프로세스 시작을 일으키지 않는다.

### Work 지침

- 요청의 목적·완성 조건·대상 자료를 확인하고 필요한 경우만 사용자 질문을 한다.
- 여러 단계 작업이면 기존 Task 도구를 사용한다. 단순 답변마다 할 일을 만들지 않는다.
- 기존 파일/검색/쉘/확장 도구로 작업하고 실제 결과를 점검한다.
- 사용자가 받을 독립 산출물은 기존 게시 도구 설명에 따라 게시한다. 개발 중간 파일을 무조건 게시하지 않는다.
- 결과·파일 위치·완료하지 못한 부분을 설명한다. 프롬프트는 행동 지침이며 강제 실행 그래프나 보안 경계가 아니다.

### 테마·접근성

선택기·상태 라벨은 기존 시맨틱 토큰과 i18n을 쓴다. 기존 Button의 pressed 표현·가변 크기 Icon·Tooltip을 재사용하고 Todo/Terminal 글리프는 현재 Material 아이콘 체계에 추가한다. 기존 작은 on/off `Toggle` atom과 별도로 chat feature의 `AgentModeToggle`이 상호 배타 선택을 맡는다.

접근성은 이름 있는 버튼 그룹 안의 `aria-pressed` 버튼으로 구성하고, 클릭·Enter/Space 모두 같은 action으로 한 종류만 선택한다. Tab 포커스·선택 상태·툴팁·라이트/다크·좁은 창을 검증한다. 색상만으로 선택을 구별하지 않고 큰 토글이 Composer를 가리거나 가로 스크롤을 만들지 않게 한다.

## 6. 범위와 구현 순서

| 단계 | 결과 | 다음 단계 진입 조건 |
|---|---|---|
| A — 제품 계층 | 중앙 토글·모드별 랜딩/입력 안내·종류 저장/복원·프로필 조립 | 세션/큐/확장 회귀 통과 |
| B — Work 표현 | 작은 영속 표시 경계·순수 활동 투영·타임라인, 공통 작업 패널 연결 | 경계 기록과 라이브/재로드 동등성 검증 |
| C — 통합 인수 | 실제 Claude Work 작업·게시·재시작·동시 Coding 검증 | 문서·게이트·인수 결과 보고 |

A/B를 각각 검토 가능한 구현 커밋으로 분리한다. B가 해결되지 않았는데 A만으로 Cowork 도입 완료라고 보고하지 않는다.

| 미룬 항목 | 지금 필요한 경계 | 후속 처리 |
|---|---|---|
| OpenCode adapter | 제품 종류와 Backend를 직교시킴. 기존 `TurnExtensions`·정규 이벤트 포트 활용 | 실제 adapter와 능력 매핑·계약 시험은 별도 핸드오프 |
| SRT | 프로필 아래의 실행 경계. MCP/호스트 도구가 별도 프로세스일 수 있음을 유지 | Windows 재평가 후 격리 경로 전수 설계 |
| 컨텍스트 | 실제 참조와 허용 폴더를 구별 | 읽기/검색/외부 도구의 증거 계약부터 설계 |
| 뷰어 | 게시 참조 ID와 파일 액션 유지 | HTML 보안·MD 표시·파일 부재 UX를 별도 설계 |
| 일반 생성물 | 0223 Q-04 유지 | 발견/등록 기준 결정 전 watcher·자동 탐색 추가 없음 |
| 에이전트 편집·자동 역할 선택·상호 위임 | 고정 두 프로필만 필요 | 레지스트리·플랫폼·자체 스케줄러 선행 구축 없음 |

## 7. Requirements / Acceptance — 확정 V1

`P-*`는 §8의 실제 경로, `EP-*`는 §10의 강제 지점이다. 이 V1을 구현·검증 기준으로 잠근다.

| R | AT / AC | 관측 가능한 동작 | 직접 검증 수단 | 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 새 대화 중앙의 큰 토글은 좌 Todo=Work/우 Terminal=Coding이며 선택·아이콘·접근성 이름 일치. 전송 전 자료 보존 | 실제 랜딩 클릭/Enter/Space→store→첫 send·승격, DOM 순서와 white/dark·좁은 창 실기 | P-01 |
| R-02 | AT-02 / AC2 | 신규 Work와 기존 Coding이 DB 재열기·목록·검색 후 로드에서 같은 종류 | 이전 스키마 fixture migration→insert→close/open→IPC→store | P-02 |
| R-03 | AT-03 / AC3 | 존재 세션·준비 중 동일 초안의 명시적 종류 불일치가 큐/기록/실행을 바꾸지 않음 | 실제 send/lease 경로, 예약 sink와 DB diff 및 오류 단언 | P-03 |
| R-04 | AT-04 / AC4 | 분기·핸드오프·실패 재시도·백그라운드 연속 실행에서 종류 상속 | draft→send→init→reload, 원본 DB와 실행 입력 비교 | P-02·04 |
| R-05 | AT-05 / AC5 | Work 작업 지침은 한 번 조립되어 cold/resume에 전달, Coding의 기존 append는 동일 | 실제 빌더→SDK 옵션 캡처, Coding 기준 bytes 비교 | P-05 |
| R-06 | AT-06 / AC6 | 두 종류에서 활성 MCP·skills·plugins·게시 도구가 기존 범위로 작동 | 병렬 세션의 runtime tool 호출·SDK plugin 옵션, mock adapter 계약 | P-05·06 |
| R-07 | AT-07 / AC7 | 같은 프로필은 warm 재사용, 다른 프로필 키의 낡은 채널은 그대로 사용하지 않음 | spawn/push/close 기록, 최초·자동 연속 대칭 시험 | P-04·05 |
| R-08 | AT-08 / AC8 | Work 선택이 권한/cwd/extraDirs/worktree/네트워크 정책을 넓히지 않음 | 기존 승인·workspace·worktree 시험을 Work 경로로 재현 | P-03·06 |
| R-09 | AT-09 / AC9 | Work에서 도입부·실제 도구/중간 메모·마무리의 관계를 읽을 수 있고 실패 시도도 보존 | 순서 fixture를 production selector와 실제 컴포넌트에 투입, 텍스트·ID 순서 비교 | P-07 |
| R-10 | AT-10 / AC10 | 질문·승인·오류·구조화 결과·경계·서브에이전트 통지가 유실/중복되지 않음 | part union 사례·접힌 상태 UI, 질문 응답→기존 IPC까지 단언 | P-07·08 |
| R-11 | AT-11 / AC11 | 스트리밍·중단·늦은 알림·재로드가 과거 결과를 다시 분류하거나 성공으로 꾸미지 않음 | Main 경계→DB→reducer의 동일 이벤트열 비교, 무출력 listen·재시도·crash·copy/fork | P-04·07 |
| R-12 | AT-12 / AC12 | 기존 진행/출력/컨텍스트와 게시 카드·파일 부재/삭제 UX 유지. 사용자 닫기를 존중 | 실제 TaskOutputContent/ArtifactCard 수명주기 시험, 패널 닫음 후 late 응답 | P-08 |
| R-13 | AT-13 / AC13 | 기존 Coding 렌더·초안·경로 승격·copy/fork·모델/권한 선택 유지 | 기준 fixture와 기존 관련 suite를 production branch에서 재현 | P-01·07·08 |
| R-14 | AT-14 / AC14 | 종류 선택/표현만으로 모델 호출·프로세스·타이머가 늘지 않고 과거 턴을 재계산하지 않음 | query/spawn 등록 경로 조사+호출 spy, selector/render 횟수, §14 측정 | P-05·07·08 |
| R-15 | AT-15 / AC15 | 실제 Work 요청이 도구로 파일을 만들고 명시 게시하여 카드/출력·재시작에서 확인됨 | 실제 Windows 앱+설치된 Claude SDK, 게시파일 bytes·DB 참조·UI 동시 관측 | P-01→05→06→08 |
| R-16 | AT-16 / AC16 | 토글 즉시 해당 모드의 랜딩/입력 안내가 바뀌고, 첫 전송·세션 복원 후 본문/패널도 같은 종류를 사용 | 실제 토글→안내/placeholder→send→ChatTile→세션 이동/로드, 입력 보존·Composer/패널 단일 마운트 | P-01→07→08 |

AC15는 정해진 정답을 반환하는 mock으로 대체하지 않는다. 0223의 실제 모델 호출 미완료를 전제하며, 환경 실패와 모델 누락·오게시를 나누어 기록한다. 프롬프트만으로 임의 플러그인·미구현 OpenCode의 호환성을 보증하지 않는다.

## 7-A. V / Trace Matrix

새 제품 역할과 표현을 정의하므로 **Baseline V**다. 0223의 미완료 AC를 상속하여 통과로 계산하지 않고, 영향을 받는 동작만 회귀 기준으로 가져온다.

### Node registry

| Node | 레벨 | 계약 / 출처 | provenance |
|---|---|---|---|
| R-01…R-07, R-09…R-11, R-14…R-16 / AT-동일 번호 | R / AT | §7의 개별 행이 각각 독립 node | NEW |
| R-08 / AT-08 | R / AT | 승인/workspace/worktree 계약, 기준 커밋의 관련 시험 | INHERITED |
| R-12 / AT-12 | R / AT | 0223 V1+UI V1의 패널·게시 동작, 기준 커밋 | INHERITED |
| R-13 / AT-13 | R / AT | 기존 Coding 흐름·`turns.test.ts`와 현재 `useChatRouteSync` 코드, 기준 커밋 | INHERITED |
| SD-01 / ST-01 | SD / ST | 출생→준비/확정→재개/연속의 종류 고정 (§5·9·13) | NEW |
| SD-02 / ST-02 | SD / ST | 지침→기존 실행/확장→종류별 UI (§5·9) | NEW |
| SD-03 / ST-03 | SD / ST | Work 이력 표시와 live/reload 의미 동등성 (§9-B) | NEW |
| AR-01 / IT-01 | AR / IT | 프로필과 backend 직교·DB/IPC 왕복 (§9-A·10) | NEW |
| AR-02 / IT-02 | AR / IT | lease 및 spawn 경계·빌더·연속 턴 대칭 (§9-A·13) | NEW |
| AR-03 / IT-03 | AR / IT | 기존 transcript/panel 컴포넌트 공유 (§9-B·12) | NEW |
| MD-01 / UT-01 | MD / UT | 종류 해석과 고정 프로필·header 조립 (§10·11) | NEW |
| MD-02 / UT-02 | MD / UT | respawn 입력·listen/flush 전달 (§10·11) | NEW |
| MD-03 / UT-03 | MD / UT | 순서/part 분류·identity 보존 (§9-B·14) | NEW |
| MD-04 / UT-04 | MD / UT | 수신 구간 표시 경계의 시작/마감·중단/오류 분류 (§9-B) | NEW |
| MD-05 / UT-05 | MD / UT | `agentKind`에서 모드별 UI 표현을 파생하는 순수 매핑 (§9-C) | NEW |

### Pair registry

AT oracle은 §7의 직접 검증 수단을 포함한다. EP의 괄호 수는 §10에 열거한 강제 지점의 합이며 앱 전체 인벤토리 수치가 아니다.

| Pair | left ↔ right | requiredness | production path | 직접 oracle / 선택적 적대 증거 | 강제 지점 |
|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | P-01 | 중앙 토글·좌/우 배치→send·자료 보존 / Todo·Terminal 매핑 맞교환 변이 선택 | EP-01·02·14 (7) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | P-02 | 실제 DB 재열기+로드 종류 / 직접 행동 | EP-04·05 (6) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | P-03 | 오류+큐·DB 무변경 / preparing 비교 제거 변이 선택 | EP-01·03 (5) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | P-02·04 | 종류/원본/분기값 비교 / 직접 행동 | EP-02·03·04·08 (14) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | P-05 | SDK append bytes / 직접 행동 | EP-06 (4) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | P-05·06 | 실제 tool handler·plugin 옵션 / 직접 행동 | EP-06·09 (6) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | P-04·05 | spawn/push/close 대칭 / 자동 경로 key 누락 변이 선택 | EP-07·08 (7) |
| VP-08 | R-08 ↔ AT-08 | REGRESSION | P-03·06 | 승인 허용/거부·cwd 동일 / 직접 행동 | EP-09 (2) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | P-07 | 도입/도구/메모/마무리 순서 / 직접 행동 | EP-10·11 (5) |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | P-07·08 | union 사례·승인 전송 결과 / 직접 행동 | EP-11·12 (5) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | P-04·07 | 동일 이벤트 live/reload·중단 / 직접 행동 | EP-10·11·13 (10) |
| VP-12 | R-12 ↔ AT-12 | REGRESSION | P-08 | 카드·파일 상태·구독 정리 / 직접 행동 | EP-12 (2) |
| VP-13 | R-13 ↔ AT-13 | REGRESSION | P-01·07·08 | 기존 Coding 동작 / Work·Coding 렌더 분기 맞교환 변이 선택 | EP-02·10·12 (7) |
| VP-14 | R-14 ↔ AT-14 | REQUIRED | P-05·07·08 | 요청/spawn·렌더·시간 관측 / selector 과거 identity 파괴 변이 선택 | EP-06·10·11·12 (11) |
| VP-15 | R-15 ↔ AT-15 | REQUIRED | P-01→05→06→08 | 실제 모델의 파일/DB/UI / 변이 미선택, 실기 | EP-02·06·09·12 (11) |
| VP-16 | SD-01 ↔ ST-01 | REQUIRED | P-01→03→02→04 | 시작·빠른 후속·restart·fork 상태 표 일치 | EP-02·03·04·05·08 (17) |
| VP-17 | SD-02 ↔ ST-02 | REQUIRED | P-01→05→06→08 | 모드별 화면·실행 종류 일치, 동시실행·취소 session ID 일치 | EP-06·07·09·12·14 (14) |
| VP-18 | SD-03 ↔ ST-03 | REQUIRED | P-04→07→08 | stream·완료·중단·late 알림 순서·접힘·재로드 | EP-10·11·12·13 (12) |
| VP-19 | AR-01 ↔ IT-01 | REQUIRED | P-01→02→05 | production IPC→DB→profile→adapter 계약 | EP-01·04·05·06 (11) |
| VP-20 | AR-02 ↔ IT-02 | REQUIRED | P-03→04→05 | preparing/live 양쪽 종류 거부·채널 기록·연속 요청 | EP-03·06·07·08 (15) |
| VP-21 | AR-03 ↔ IT-03 | REQUIRED | P-01→07→08 | 모드별 조립에서 공유 Composer/ToolCard/ArtifactCard 동작 유지 | EP-10·11·12·14 (10) |
| VP-22 | MD-01 ↔ UT-01 | REQUIRED | P-03→05 | undefined/enum/mismatch 표와 bytes 대조 | EP-01·03·06 (9) |
| VP-23 | MD-02 ↔ UT-02 | REQUIRED | P-04→05 | 같은 key/변경 key·listen/flush 인자 비교 | EP-07·08 (7) |
| VP-24 | MD-03 ↔ UT-03 | REQUIRED | P-07 | 모든 part 사례, 안정 key/참조, 마지막 text 반례 | EP-11 (3) |
| VP-25 | MD-04 ↔ UT-04 | REQUIRED | P-04→07 | begin/end의 DB·live 동일성, 중단/오류를 ended로 바꾸는 변이 선택 | EP-13 (5) |
| VP-26 | R-16 ↔ AT-16 | REQUIRED | P-01→07→08 | 실제 토글로 화면/요청/복원 대조 / 소비처의 종류를 Coding 상수로 고정하는 변이 선택 | EP-02·10·12·14 (10) |
| VP-27 | MD-05 ↔ UT-05 | REQUIRED | P-01→07→08 | Work/Coding의 문구·본문·패널 기본값 매핑 직접 비교 | EP-14 (3) |

나머지 pair는 직접 행동 oracle이 있어 변이를 별도로 선택하지 않는다. 새 구조 스캔/배선 검사로 행동 증거를 대체하는 경우에는 그 장치가 결함을 검출하는지 추가 확인한다.

### 현재 설계 산출물 gate

| Gate | 적용 이유 | 명령/관측 | 실패 범위 |
|---|---|---|---|
| 문서 정합성 | 제품 결정·제안 AC·V·§10·보드 상태 | §20 대조 결과, 링크·분모 검사 | 이번 문서 내부 누락/모순 |
| 문서 인벤토리 | docs 수정 | `node scripts/check-doc-inventory.mjs --check` (cwd `app`) | 이번 변경으로 만든 문서 위반 |
| diff / 메시지 버스 | 설계만 별도 기록 | `git diff --check`, 커밋 trailer 파싱 | 변경 파일·작성자·상태 불일치 |

# Part II — Technical Design

## 8. 현재 코드 조사와 프로덕션 경로

| ID | 실제 entry → 경유 → consumer | 기준 코드 |
|---|---|---|
| P-01 | 중앙 AgentModeToggle → draft agentKind·UI 표현 → 기존 랜딩/Composer → chatStore send → chat:send → init 승격 → route sync | `pages/`, `features/chat/store/chatStore.ts`, `app/hooks/useChatRouteSync.ts`; 토글/매핑은 신규 제안 |
| P-02 | SDK session.updated → TurnCoordinator/HistoryWriter → insertSession → 목록/HistoryReader → session load → chatStore | `main/features/history/{writer,reader}.ts`, `infra/db/queries.ts`, `app/handlers/session.ts` |
| P-03 | chat:send → admission → attachments → lease acquire → busy reserve 또는 resolveTurn → TurnContext | `main/app/chat-turn/{send,admission,enqueue,resolve-turn,turn-context}.ts` |
| P-04 | 최초 request → runtime/retry → post-turn → automatic continuation → listen/flush → runtime | `main/features/chat/turn-coordinator.ts`, `app/chat-turn-continuation.ts`, `app/chat-turn/{post-turn,continuation}.ts` |
| P-05 | extensions build → system header → TurnRequest → runtime spawn/push → Claude options | `features/extensions/`, `features/sessions/session-runtime.ts`, `adapters/{turn,claude,claude-adapt}.ts` |
| P-06 | runtime tool snapshot/SDK tools/plugins → 기존 approval·workspace guard/host handler → 정규 이벤트 | `adapters/runtime-tools.ts`, `features/approvals/`, `features/artifacts/` |
| P-07 | normalized message parts → reducer → groupExchanges/groupTurns → AssistantTurn → 메시지/도구 카드 | `renderer/.../chat/{reducer,lib,components/transcript}/` |
| P-08 | Task events/artifact parts·list → taskBoard/TaskOutputContent → TaskTileContent/ArtifactCard | `renderer/.../chat/{lib/taskBoard,components/rightpanel,components/ArtifactCard}` |

위 경로의 `main/`·`renderer/`는 `app/src/` 기준이다. §18에는 실제 수정 후보 경로를 적는다.

### 전수 조사 — 기준 커밋에서 관측

| 대상 | 검색/방법 | N | 관측 |
|---|---|---:|---|
| `ctx.extensions.build` 호출 | `rg -n 'ctx.extensions.build' app/src/main -g '*.ts' -g '!*.test.ts'` | 2 | send 최초 조립·자동 연속 build callback |
| `respawnInputs` 호출(정의 제외) | 동일 범위에서 `respawnInputs\(` | 2 | runtime-entry·chat-turn-continuation |
| `insertSession` 호출(정의 제외) | 동일 범위에서 `insertSession\(` | 1 | HistoryWriter, fork도 이 출생 경로 |
| `SessionRuntime` 생성 | 동일 범위에서 `new SessionRuntime` | 1 | runtime-entry |
| Renderer 채팅 전송 producer | chatStore 일반 send·busy/steer 조사 | 2 | 두 payload 경로 모두 확인 필요 |
| 세션 아닌 `adapter.complete` | Main 사용처 조사 | 2 | 제목·worktree 이름. Work 지침 주입 대상 아님 |

기존 시험 근거: `continuation.test.ts`의 listen/flush spawn 입력 대칭, `respawn-policy.test.ts`의 unchanged warm 유지, `turns.test.ts`의 message identity/마지막 exchange 변경, `writer/reader/session.load` 시험 파일을 확인했다. 이번 설계 턴에 시험을 실행한 것으로 계산하지 않는다.

## 9. AS-IS → TO-BE

### 같은 축으로 비교

| 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 역할 | 사용자 작업 종류 없음, backend/provider/model 선택 | `AgentKind` 세션 속성 추가, backend와 독립 | AR-01·AC1~4 |
| Main 책임 | app이 extensions·runtime·history 조립 | app이 순수 프로필 해석 결과도 주입, 기존 실행 경로 유지 | AR-01·02·AC5~8 |
| 상태 | cwd/extraDirs 등 출생 속성 + 준비 lease | 같은 출생 수명에 종류 추가, DB 전에는 lease가 권위 | SD-01·AC3·4 |
| 지침 | 기존 Orca/Tools/User/Project append | Work만 Agent 지침 추가, Coding append bytes 유지 | MD-01·AC5 |
| 표시 | 공통 랜딩·assistant 메시지별 segments, 수신 완료 경계 미영속 | 중앙 토글→모드별 랜딩·본문·패널 조립, Work 경계/활동 투영 | AR-03·MD-04·05·AC1·9~13·16 |
| 오류/정리 | 기존 큐·승인·중단·채널 종료·패널 구독 | 해당 owner 유지, 종류 불일치는 예약 전 차단 | SD-01·02·AC3·7·12 |
| 성능/시험 | 기존 warm runtime·memo/virtualizer | 프로필 해석 O(1), 활동 투영은 영향받은 부분만 | MD-02·03·AC14 |

### 9-A. 제품 프로필 계층

```text
Renderer: 새 대화 중앙 [Todo: Work | Terminal: Coding]
    ├─ agentKind → 모드별 랜딩·본문·우측 패널 표현
    ↓ 기존 IPC · 세션 draft/DB (AgentKind)
Main app/chat-turn: 종류 해석·출생 잠금·실행 합성
    ├─ features/agents: 고정 프로필 + 순수 resolver
    ├─ features/extensions: 기존 지침·skills·plugins·도구 snapshot
    └─ 기존 SessionRuntime · 승인 · 이력
              ↓ TurnRequest / TurnExtensions
        SessionAdapter: Claude (현재) / OpenCode (후속)
              ↓ backend 실행 경계 (SRT 재검토는 후속)
```

| 책임 | 최소 형상 | 소유자 |
|---|---|---|
| 종류 식별자 | `AgentKind` 값은 `coding`, `work`. enum 값·검증 정본 | `shared/agent-kind.ts`, protocol은 이를 소비 |
| 고정 프로필 | `{ kind, instructions, key }`, 함수 `resolveAgentProfile(kind)` | `main/features/agents/` |
| 출생값 | `agentKind`, DB `agent_kind NOT NULL DEFAULT 'coding'` + 허용값 CHECK | lease/TurnContext → sessions row |
| 실행 조립 | builder에 `agentInstructions?`, extensions에 `agentProfileKey?` | app이 profiles→extensions를 연결. feature 교차 import 없음 |
| SDK 입력 | 기존 append·plugin·runtimeTools | adapter는 제품 UI 이름을 해석하지 않음 |
| 화면 | 현재 draft/세션 `agentKind`→순수 UI 매핑→선택 모드의 부품 조립 | 기존 chat feature. 별도 전역 WorkStore 없음 |

`key`는 호스트가 제공하는 불투명한 spawn 구성 식별자다. Coding은 추가 instructions/key를 생략해 기존 요청을 보존하고, Work는 정적 지침 변경에 맞춘 key를 제공한다. Renderer가 instructions나 key를 지정하는 IPC는 만들지 않는다.

도구 필터링·권한 override·프로필 편집은 이번 프로필 형상에 넣지 않는다. 두 종류는 같은 전역 RuntimeToolRegistry의 snapshot과 기존 pluginRoots/skills/hooks를 받는다. 향후 종류별 도구 제한이 필요해지면 세션 snapshot을 파생하고 승인 경로까지 별도 설계해야 한다.

### 9-B. Work 표현 계층

원본 `AppMessagePart`와 tool ID를 보존한 **표현 투영**으로 구현한다. 중간 텍스트를 DB에서 삭제하거나 모델/별도 분류기로 판단하지 않는다. 먼저 기존 `messageSegments`·result pairing·reconcile을 재사용하고, Work 규칙만 순수 `workActivity.ts`에 둔다.

| 입력/상태 | 제안 표시 계약 |
|---|---|
| 첫 실제 tool 이전 text | 도입부 본문. 첫 메시지의 첫 text만으로 제한하지 않음 |
| tool 시작 뒤 text | 활동의 진행 메모. 완료 후 마무리 후보의 위치만 분리 |
| reasoning | 기존 사고 접힘 행. 메모 수/최종 답변으로 승격하지 않음 |
| tool call/result | 실제 이름/ID로 짝지어 순서 유지, 실패 시도도 표시 |
| 도구 없는 답변 | 일반 Markdown 답변. 빈 활동 pill 생성 없음 |
| 최종 답변 | 마감된 표시 구간에서 마지막 도구 **뒤** 연속 text만 후보. 도구 이전 메모를 승격하지 않음 |
| streaming | 진행 메모를 펼쳐 읽을 수 있게 제공, 미완성 text를 매 토큰 본문↔pill로 왕복시키지 않음 |
| 완료·늦은 알림 | 마감된 구간의 본문은 고정. 후속 수신 구간은 별도 활동, 기존 알림은 독립 행 |
| 중단·오류 | 원문/부분 결과·기존 상태 유지. `pending=false`를 성공 증거로 쓰지 않음 |

**조사 결론:** 주요 응답 완료를 재구성할 공통 영속 필드는 없다. `turn.ended`는 Stop hook tick이며 terminal이 아니고, `subagent_notice`는 특정 자식 통지일 뿐이다. 따라서 D-009는 SDK의 내부 턴을 추측하지 않고 **기존 `TurnCoordinator.run`이 소비하는 수신 구간**을 표시 단위로 삼는다.

#### B의 최소 표시 경계 제안

```ts
type ResponseBoundary =
  | { phase: 'begin'; id: string }
  | { phase: 'end'; id: string; outcome: 'ended' | 'aborted' | 'failed' | 'unknown' }
// Main 합성 NormalizedEvent: { type: 'response.boundary', sessionId: string, boundary: ResponseBoundary }
// 영속 AppMessagePart: { type: 'response_boundary', boundary: ResponseBoundary }
```

- `id`는 Main이 만든 opaque UUID다. 제품 에이전트 ID·tool ID·SDK session ID와 구분한다. 내부 재시도는 같은 구간을 쓰고, 다음 listen/flush `run`과 소비 확정된 새 사용자 입력 뒤에는 새 ID를 쓴다.
- Work에만 기록한다. session ID와 사용자 입력 소비가 확정된 뒤, 첫 표시 가능한 part **바로 앞**에 begin을 기존 bus로 보낸다. `session.updated`, tick, usage만 있는 무출력 listen은 빈 구간을 만들지 않는다.
- emit 순서는 입력 커밋→begin→원래 표시 이벤트다. 종료는 마지막 표시 이벤트 뒤 end→다음 run begin 순서이며, 기존 usage→history→title→relay fanout 순서를 유지한다.
- 한 run 중 steer 입력이 소비되면 `commitConsumed`의 **user row 커밋 직전** 열린 구간을 unknown으로 닫는다. 새 입력 뒤 첫 표시 이벤트가 새 begin을 만든다. 초기 입력·연속 user 커밋 사이에는 빈 구간을 만들지 않으므로 기존 Exchange의 사용자 경계를 가로지르지 않는다.
- `ended`는 정상 수신 마감 관측이며 **작업 성공 판정이 아니다**. 같은 구간에 중단이 있으면 aborted, 오류가 있으면 failed가 우선하고, 정상 terminal 없이 수신 frame이 해제되면 unknown이다. `turn.ended` tick·UI pending·coordinator가 종료 정리에서 합성한 telemetry를 정상 terminal 증거로 쓰지 않는다.
- end는 시작한 구간에만 한 번 기록한다. run의 기존 성공·정착·예외 처리 결과를 순수 helper로 분류하고, 저장 실패는 기존 critical history 오류로 처리한다. 정리 중 중복 예외가 원래 실패를 덮지 않게 기존 settle 경로를 따른다.
- writer와 renderer는 같은 event→part helper를 소비한다. 새 DB 테이블은 필요 없으며 기존 parts JSON에 저장한다. begin만 남은 crash 이력은 열린/미확정 구간으로 표시하고 성공 결론을 합성하지 않는다.
- writer는 열린 표시 구간의 마지막 assistant message ID를 턴 문맥에 보관한다. telemetry가 `currentAssistantMessageId`를 reset해도 end는 그 ID에 append하며 `ensureAssistantMessage`로 경계만 있는 빈 메시지를 만들지 않는다. 경계는 content/FTS에 텍스트를 더하지 않고, 기존 complete 상태를 다시 incomplete로 바꾸지 않는다.
- begin/end 모두 확정 `sessionId`를 싣는다. 비활성 세션도 기존 이벤트 라우터로 전달하며, 삭제된 세션/폐기한 generation의 지각 이벤트는 버린다. 경계 수신이 inflight·사용량·실행 상태를 다시 변경하지 않게 한다.
- tool result·게시 part가 마감 후 늦게 추가되면 원래 tool/게시 ID로 갱신한다. 해당 갱신을 새 본문으로 간주하거나 이미 고정한 결론 위치를 바꾸지 않는다.
- 기존 Coding·경계 없는 이력은 기존 렌더를 유지한다. 경계 ID는 세션 내부에서만 해석하므로 fork 복사에서 재발급하지 않는다. copy 텍스트와 모델 context에 표시 경계 문자열을 넣지 않는다.

이 경계는 표시의 재현성을 위한 메타데이터다. 새 작업 실행 관리자·task 상태 머신·이벤트 저장소를 추가하지 않는다. 하나의 긴 논리 작업이 여러 수신/사용자 경계 구간으로 보일 수 있다는 절충을 허용하고, 그 구간들을 성공 여부나 사용자 의도로 재분류하지 않는다.

현재 part union에 대한 처리는 다음과 같다. `switch`에 exhaustive 확인을 두어 새 backend part가 추가되면 분류 검토가 필요함을 드러낸다.

| part | 처리 |
|---|---|
| `text`, `reasoning` | 위 규칙. `parentToolRunId`가 있는 자식은 기존 오른쪽 상세 소유 |
| `tool_call`, `tool_result` | 기존 짝짓기/도구 카드. AskUserQuestion은 대기 UI가 접힘에 갇히지 않게 유지 |
| `artifact` | 기존 턴 산출물 카드, 목록은 별도 최신 게시 투영. 중복 카드 생성 없음 |
| `structured_output`, `error` | 기존 독립 표시. 실패/사용자 행동을 일반 note로 숨기지 않음 |
| `compact_boundary`, `fork_boundary`, `subagent_notice` | 기존 독립 경계/통지, 앞뒤 순서를 유지 |
| `attachment`, `diff_requirements` | 사용자 메시지의 기존 처리 경로 유지 |
| `file`, `diff` | 현재 미렌더 seam 유지. 게시 산출물로 자동 변환하지 않음 |
| `response_boundary` (신규 제안) | Work 표시 구간 제어. Coding/복사/모델 컨텍스트에는 표시하지 않음 |

한 턴의 정상 활동 구간은 합치되 질문·오류·경계 등 기존 독립 표면을 넘어 강제 병합하지 않는다. 요약의 도구 종류는 distinct 이름, 메모 수는 text note 기준이며 reasoning을 더하지 않는다. 기존 Task 카드 라벨 개선은 실제 공유 `toolMeta`/task helper의 부족한 분기만 보완한다.

### 9-C. 모드 종속 UI/UX의 소유권

```text
AgentModeToggle → chat draft/session.agentKind
                      ├─ Main: 실행 프로필 해석
                      └─ Renderer: agentPresentation(kind)
                           ├─ 랜딩·Composer의 안내
                           ├─ Coding/Work 트랜스크립트 조립
                           └─ 기존 우측 패널의 첫 진입 동선
```

Renderer의 `features/chat/lib/agentPresentation.ts`는 정적 `Record<AgentKind, ...>`로 §5의 모드별 표시만 매핑한다. label/i18n key·표현 종류·패널 기본 진입값을 돌려주며, JSX factory·플러그인 등록·실행 권한을 소유하지 않는다. Main profile 모듈을 renderer가 import하거나 UI 구성을 위한 새 IPC를 만들지 않는다.

`AgentModeToggle`은 현재 draft의 `agentKind`를 읽고 동일 store action으로 변경한다. 랜딩과 ChatTile은 같은 종류를 소비하며 별도 `isWork` 전역 상태·토글 local state 사본을 두지 않는다. 과거/비활성 세션의 UI도 해당 세션 종류를 읽어 현재 새 대화 선택에 휩쓸리지 않게 한다.

page는 토글과 chat feature 부품의 배치만 맡는다. Composer는 같은 인스턴스에 안내 props를 전달하고, 모드 변경으로 작성 내용·첨부·cwd·프로젝트 소속을 reset하지 않는다. Work/Coding 분기는 랜딩 표현·AssistantTurn·패널 기본 진입의 조립 지점에 모으고, 공유 ToolCard/ArtifactCard에 불필요한 모드 조건을 퍼뜨리지 않는다.

우측 패널의 모드 기본값은 새 세션 첫 진입에만 적용한다. 사용자의 열기/닫기 상태를 토큰·안내 props 변경·재로드 effect가 덮어쓰지 않게 하며 기존 소유권과 §13 수명주기를 유지한다.

## 10. 계약 / 강제 지점

### 종류 해석 SSOT

| 입력 상태 | undefined 의미 | 명시 값 | 실패 |
|---|---|---|---|
| 새 초안, 기존 lease 없음 | `coding` | 그 종류로 출생 | enum 밖 값 거부 |
| 같은 준비 초안, lease 존재 | lease 값 상속 | lease와 같아야 함 | 큐 적재 전 mismatch |
| 확정 세션 재개 | DB 값 상속 | DB와 같아야 함 | 큐 적재 전 mismatch |
| fork/handoff | 출발 DB 값 상속 | 출발과 같아야 함 | 새 세션/원본 변경 전 mismatch |

Main의 출생 잠금 권위는 살아있는 lease와 DB다. init 전 실패로 lease가 해제된 경우 같은 clientKey의 다음 요청은 새 출생으로 해석하며, Renderer가 재시도 종류를 보존한다. 별도 실패 초안 registry는 만들지 않는다.

읽기/타입 기본값은 필요한 호환 경계에만 둔다. 잘못된 저장값을 무조건 Coding으로 숨기지 않고 분류 오류로 처리한다. DB lookup→lease CAS→비교 사이에 새로운 await를 추가하지 않으며, 이미 존재하는 attachments-before-busy 순서를 유지한다.

### 강제 지점 목록

| EP | SSOT / 계약 | 언제·어디서 강제 (열거 분모) | 실패 의미 |
|---|---|---|---|
| EP-01 | AgentKind enum | shared schema를 쓰는 `chat:send` admission (1) | invalid payload |
| EP-02 | Renderer 세션 종류 | 새 초안/선택 action; 일반 send; busy/steer send (3) | 잘못된 라벨·요청/중복 전송 방지 |
| EP-03 | host 출생값 | DB/출발 해석; lease 생성; preparing/resume busy 비교; resolveTurn 재확인 (4) | mismatch 예약·부작용 방지 |
| EP-04 | 저장 출생값 | 초기/연속 TurnContext; writer insert; migration/insert conflict 보존 (3) | 출생값 덮어쓰기 방지 |
| EP-05 | DB→UI 복원 | 목록/프로젝트 목록 projection; HistoryReader/session load; store load/승격 (3) | 오래된 라벨·실행 불일치 방지 |
| EP-06 | 단일 프로필 조립 | send 최초 build; 자동 continuation build; system header; Claude query option (4) | 지침 누락/중복·확장 손실 |
| EP-07 | spawned profile key | runtime 저장/해제; respawn helper·policy; runtime-entry 호출 (3) | 낡은 프로필 warm 사용 |
| EP-08 | 연속 입력 대칭 | chat-turn-continuation respawn; listen builder; flush builder; 재시도 request 유지 (4) | 자동 경로 프로필 유실 |
| EP-09 | 기존 권한/도구 | 승인·live mode/workspace 경로; 채널 runtime tool context/registry (2) | 종류 선택이 권한 확대/다른 세션 오염 |
| EP-10 | 종류별 렌더 | AssistantTurn 분기·memo 비교; 상위 Exchange/memo 전달 (2) | 잘못된 branch·갱신 누락 |
| EP-11 | Work 투영 | 영속 경계별 구간; part projection/reconcile; 카드·요약 producer/consumer (3) | 순서/내용 손실 |
| EP-12 | 공유 패널/카드 | Work 최초 활성화·사용자 닫기; TaskOutputContent/ArtifactCard 수명주기 (2) | 패널 재개방·구독 누수·액션 회귀 |
| EP-13 | 표시 경계 | coordinator begin; run·steer 사용자 경계 마감; writer 지정 메시지 영속; session 라우팅/reducer; reader/fork 복원 (5) | late 알림·재로드 시 과거 결론 재분류 |
| EP-14 | 종류별 UI 매핑 | 순수 presentation 매핑; 랜딩 토글/Composer 안내; ChatTile의 본문/패널 조립 (3) | 토글·화면·실행 종류 불일치 또는 중복 셸 |
| EP-D | 문서 상태 | plan 메타; handoff INDEX 행 (2) | 설계와 보드의 READY/DRAFT 불일치 |

EP는 파일 수가 아니라 같은 계약을 강제할 책임 지점 목록이다. 구현자는 각 그룹 내부 실제 소비처를 다시 열거하고, 특히 EP-04의 context 양 경로와 EP-09의 기존 승인 경로를 대표 하나로 갈음하지 않는다.

## 11. 최소 구현 모듈과 시험 seam

| 위치 | 변경 | 시험 |
|---|---|---|
| `shared/agent-kind.ts` (신규) | 값·타입·schema 정본 | enum/invalid |
| `main/features/agents/profiles.ts` (신규) | 고정 프로필·순수 역할 해석. 클래스/등록 API 없음 | 값·bytes·출생 해석 표 |
| `main/app/chat-turn/` | 기존 admission/resolve/context/requests에 값 전달, features 합성 | 실제 send+lease+큐 통합 |
| `main/features/extensions/{builder,system-header}.ts` | 선택적인 Agent 지침을 Orca 뒤에 삽입 | Coding bytes 불변, Work 단일 섹션 |
| `main/adapters/turn.ts` | `TurnExtensions.agentProfileKey?` | opaque key, adapter options 독립 |
| `main/features/sessions/` | lease 출생값·spawn key 및 기존 policy 비교 | warm/respawn·취소·동시 세션 |
| `main/infra/db/`, `features/history/`, shared IPC/protocol | agent_kind migration·insert·읽기·DTO | 실제 DB migration/reopen, legacy fixture |
| `main/features/chat/turn-coordinator.ts`, 순수 경계 helper·shared event→part | Work 수신 구간 begin/end, 기존 bus 전달 | 무출력 listen·retry·abort/error·crash, DB/live 비교 |
| `renderer/.../features/chat/` | 세션 속성, 공유 선택기, `lib/workActivity.ts`·`WorkActivity.tsx` | pure projection, 실제 store/component 통합 |
| `renderer/.../features/chat/components/AgentModeToggle.tsx`, `lib/agentPresentation.ts` (신규) | 큰 아이콘 토글, 종류별 UI 매핑과 기존 부품 조립 | 좌/우·선택·표현 일치, 입력기 단일 인스턴스 |
| `renderer/.../shared/ui/Icon.tsx`, shared i18n | 기존 Material 체계에 Todo/Terminal 추가, 접근성/안내 문자열 | 아이콘 매핑·접근성 이름·시각 검증 |
| `renderer/.../pages/`, `app/hooks/` | 기존 랜딩 선택기 조립·경로 승격 유지 | 신규/프로젝트/분기 라우팅 |

profile과 Work projection 순수 파일은 Electron·DB·Zustand를 import하지 않는다. 기존 모델 공급자 설정·title 생성·worktree 이름 생성에는 Work 지침을 넣지 않는다. preload는 기존 typed bridge를 사용하고 새 범용 invoke/file API를 만들지 않는다.

## 12. 등록과 소비처 / 호환성

| 소비처 | 변화 | 회귀 |
|---|---|---|
| 세션 목록·프로젝트·검색 후 로드 | DB 종류를 복원. backend 배지와 별도 label | AC2·13 |
| 새 대화·skill 프리필·fork/handoff | 중앙 토글의 초안 종류 또는 출발 세션 상속. 프리필 보존 | AC1·4·16 |
| provider/model selector·`/agent` 환경 설정 | 의미/정체성 유지 | AC6·13 |
| 승인·Task 도구·MCP·skills·plugins | 기존 실행 경로 공유, Work 지침만 추가 | AC6·8 |
| ArtifactCard·TaskOutputContent | Work/Coding 둘 다 기존 참조·액션 공유 | AC12·15 |
| title/worktree 보조 completion·debug/mock | 보조 지침 불변, debug는 동일 send/DB 경로 | AC5·6·14 |
| 랜딩·Composer·ChatTile | 같은 draft/세션 종류로 UI를 선택하고 공통 인스턴스 유지 | AC1·13·16 |

현재 지원 조합은 Coding×Claude와 Work×Claude로 계획한다. OpenCode를 등록하지 않으며, 미래에는 같은 프로필의 지침/확장 입력을 새 SessionAdapter가 해석한다. 호환성은 설치된 Claude SDK 옵션과 mock adapter 계약으로 검증하고 미래 SDK 동작을 미리 통과 처리하지 않는다.

## 13. 수명주기 / 실패 / 저장

- DB 전: lease가 출생 종류를 소유한다. SDK init 후 같은 종류를 sessions row에 저장하고 기존 promote 과정으로 UI에 연결한다.
- DB와 SDK 저장소는 원자적으로 같이 쓸 수 없다. SDK ID만 생기고 DB 쓰기가 실패하면 성공한 세션으로 UI 승격하지 않고 기존 persistence 오류/중단 경로를 사용한다.
- migration은 기존 migration runner의 백업/트랜잭션을 사용한다. 과거 행은 Coding으로 채우고, 충돌 insert가 기존 종류를 변경하지 않게 한다.
- 중단·owner gone·quit·timeout에서 기존 lease/runtime/tool context owner가 정리한다. profile은 정적 값이므로 별도 listener·파일·프로세스 해제가 없다.
- 표시 경계는 DB에만 영속하고 SDK transcript를 변경하지 않는다. DB 저장 후 renderer 전송이 끊기면 reload로 복원하고, DB 저장 전 crash면 미확정 상태를 유지한다.
- hot profile editing은 범위 밖이다. 다른 key가 감지될 때는 기존 channel teardown/resume 흐름을 이용하며, 전체 prompt/settings를 하나의 새 hash로 합쳐 기존 env/provider 실패 의미를 바꾸지 않는다.
- fork는 원본 메시지와 종류를 이어받고 handoff는 기존 lineage/요약 규칙을 사용한다. task/subagent의 식별자를 제품 종류로 대체하지 않는다.
- plan과 INDEX는 같은 설계 커밋에 담는다. 중간 실패 시 둘 다 DRAFT로 맞춘 뒤 커밋하며 완료/READY를 먼저 게시하지 않는다.

## 14. 성능과 상한

프로필 선택 때문에 추가하는 모델 분류 호출·감지 watcher·polling·백그라운드 프로세스는 없다. Work 지침은 정적 문자열 4 KiB 이내로 두고, spawn당 한 append에 한 번만 넣는다. 기존 턴마다 extensions 조회는 유지하며 공유 runtimeTools snapshot을 세션별 전역 registry로 복제하지 않는다.

표시 경계의 추가 part/event 상한은 **(표시 출력이 있는 coordinator run 수 + 출력이 이어지는 중간 사용자 커밋 경계 수) × 2**다. 무출력 수신 run·내부 재시도·연속 user 커밋만으로 경계가 늘지 않으며, 큰 tool payload를 경계에 복사하지 않는다. DB 추가 쓰기와 renderer 전달 횟수도 이 상한으로 관측한다.

Work projection은 전체 세션을 다시 평탄화하지 않고 기존 virtualized exchange와 message identity를 활용한다. 완료된 메시지 결과를 재사용하고 바뀐 메시지의 parts만 다시 읽으며, 각 part는 표현에 선형으로 대응한다. 원문 payload를 새 전역 store에 복제하지 않는다.

활동을 접으면 상세 Markdown·ToolCard subtree를 unmount하되 요약 계산에 필요한 작은 투영은 유지한다. 출력 fold는 현재처럼 목록 owner를 남겨 count를 유지하고 파일 상태 consumer는 해제한다. 확장 기능의 부수 효과를 잃지 않도록 캐시 대상은 표시 투영에 한정한다.

측정 fixture는 이전 교환 100개, 활성 교환의 완료 메시지 100개, 마지막 메시지의 연속 갱신 100회를 사용한다. 갱신 중 이전 교환과 완료 메시지의 projection 재실행은 없어야 하며, 카드 열기 상태와 스크롤 앵커를 보존해야 한다. 같은 기계·fixture의 기준 커밋/Coding 변경본을 비교해 median/p95를 보고하고, 지속적인 10% 초과 악화는 원인 확인 전 AC14를 닫지 않는다.

새 요청 총량은 종류 선택/표현만으로 늘지 않아야 한다. Work 모델 자체의 도구 선택 횟수는 작업 의존이므로 임의 전역 제한을 추가하지 않고 AC15에서 실제 usage·요청·시간을 기록한다.

## 15. 외부 계약과 문서

외부 플러그인이 새로 구현해야 할 포트는 만들지 않는다. 내부 IPC의 optional `agentKind`는 신규만 Coding 기본값이고 기존/준비/분기는 해당 소유자 상속이라는 의미를 문서화한다. 예제 payload의 typecheck와 잘못된 값·mismatch 응답 contract test를 함께 둔다.

구현 후 IPC_CONTRACT, persistence, frontend state/rendering, backend adapters/system-prompt 문서를 실제 코드에 맞춘다. 현재 system-prompt 문서의 per-turn query·settingSources 생략·warm 즉시 반영 설명은 코드와 다르므로 그 부분도 수정한다. 이를 계기로 지침 편집의 전체 live-refresh 정책을 임의 변경하지 않는다.

## 16. 기존 결정과의 관계

| 규칙/결정 | 설계의 실제 문장 | 판정 |
|---|---|---|
| Main DAG·feature 교차 import 금지 | §9-A app에서 프로필과 extensions 합성 | 유지 |
| Renderer 4-layer·토큰·memo | §5·9-B·14 공유 부품과 selector | 유지 |
| 중앙 큰 토글·좌 Todo/우 Terminal·모드 종속 UX | §5·9-C·AC1·16 | 새 사용자 결정 반영 |
| 직접 게시·파일 부재/삭제 | §6·7 AC12·15 | 유지, 0223 인수 미완료 별도 |
| SRT 보류·OpenCode 후속 | §6·12 | 유지 |
| 컨텍스트는 실제 참조 자료 | §6 허용 폴더를 참조로 가장하지 않음 | 유지 |
| 현재 prompt/settings 정책 | §9-A Coding bytes·§15 문서 정정 | 코드 정책 유지, 낡은 설명만 정정 예정 |
| 작성 주체 | 메타·커밋 `Agent: codex` | 사용자 지시 우선 |

## 17. 위험과 절충

| 위험 | 대응 |
|---|---|
| 작업 종류가 backend와 혼동 | 별도 필드/label, provider 환경 설정 불변 |
| 초안 준비 중 프로필 혼합 | DB 이전 lease에도 출생값 고정, busy 이전 비교 |
| 새 prompt가 warm 채널에 미적용 | spawn key 기록·최초/연속 동일 비교 |
| 완료 후 늦은 이벤트로 결과 재분류 | §9-B 수신 구간 경계를 영속, semantic 성공과 구별 |
| 지침만으로 파일/도구 격리했다고 오인 | 기존 권한 유지, SRT 미도입 사실 정확히 기록 |
| 모델이 게시하지 않음 | AC15 실측. 실패를 watcher 자동 도입으로 우회하지 않음 |
| 범위 비대화 | 고정 프로필·기존 stores/runtime만, 후속 기능의 빈 추상화 없음 |

신규 의존성은 제안하지 않는다. `agent_kind`는 확정된 Q-01·D-007의 저장 형식이다. Work 기본 패널 열림은 최초 진입만 적용하며 사용자 배치 선택을 덮어쓰지 않는다.

## 18. 영향 파일과 문서

- shared: `app/src/shared/{agent-kind.ts,ipc.ts,protocol.ts}`.
- Main: `app/src/main/features/agents/`(신규), `app/chat-turn/`, `app/chat-turn-continuation.ts`, `contracts/turn.ts`, `adapters/turn.ts`, `features/{sessions,extensions,history}/`, `features/chat/turn-coordinator.ts`, `infra/db/`, `app/handlers/session.ts` 및 관련 시험.
- Renderer: `app/src/renderer/src/features/chat/{store,reducer,lib,components}/`, `pages/{NewChatLandingPage,ProjectLandingPage}.tsx`, `app/hooks/useChatRouteSync.ts`, `shared/ui/Icon.tsx`, shared i18n 및 관련 시험.
- 문서: `docs/IPC_CONTRACT.md`, `docs/arch/backend/{persistence,adapters,system-prompt}.md`, `docs/arch/frontend/{state,rendering}.md`, `docs/generated/inventory.md`(필요 시 생성), `docs/handoff/INDEX.md`.
- 설계 문서는 이 plan과 인덱스에 한정한다. rev.2는 이 plan·handoff INDEX만 갱신하고 앱 코드는 변경하지 않는다.

## 19. 구현·검증 gate

기준은 `app/AGENTS.md`, Main/Renderer AGENTS와 handoff gate다. 미래 구현에서는 코드/테스트와 함께 현재 문서를 갱신한다.

1. 순수 UT: profiles/header, respawn/continuation, Work projection·union·identity, agentPresentation의 모드별 매핑.
2. 통합 IT: send/lease/예약·fork/handoff·실제 DB migration/reopen·SDK 옵션·중앙 토글→renderer store/Composer/panel.
3. ST: Windows 앱에서 새 선택→첫 입력→작업/게시→중단/재시도→세션 이동/재시작. 라이브·재로드 비교와 Coding 동시 실행.
4. AT: §7의 결과 단언. 실제 모델/native 파일 액션·키보드·테마·좁은 창은 실제 앱에서 수행한다.
5. 정적/빌드: cwd `app`에서 `npm run lint`, `npm run typecheck`, `npm run build`; 문서 inventory gate와 `git diff --check`.

기존 관련 suite: extensions `builder/system-header`, sessions `session-runtime/respawn-policy`, chat-turn `send.permission-mode/runtime-entry/respawn-inputs/continuation`, history `writer/reader`, handlers `session.load`, renderer `turns/parts`, `ArtifactCard.render`, `ArtifactCards.lifecycle`, `rightPanelTiles.render`, `RightPanel.viewport`. route sync·Work 경계·TaskOutput의 추가 통합 사례는 새로 작성하며 기존 전용 suite가 있다고 가정하지 않는다.

순수 시험은 직접 Vitest로 ABI 변경을 피한다. DB 시험은 실제 SQLite가 필요하므로 현재 ABI를 확인하고 기존 ABI 스크립트 절차에 따라 실행/복원한다. 환경 차단·모델 timeout·기존 baseline 실패는 이번 변경의 제품 실패와 분리하되 인수 성공으로 계산하지 않는다.

## 20. 설계 대조 결과 / 다음 단계

- 사용자 구현 지시로 D-007·D-008·D-009를 확정했다. 메타와 보드를 READY로 맞추고 설계만 먼저 커밋한 뒤 구현한다.
- §10 undefined의 의미와 §5 준비 중 잠금을 대조했다. 최초 출생의 기본값과 이미 준비 중인 초안의 상속값을 구분했다.
- §9-B는 현재 영속 경계 부재를 확인하여 D-009의 작은 수신 구간 part를 제안했다. AC11·VP-11/18/25·EP-13이 live/reload·중단·늦은 알림을 검증하며, D-008의 타임라인 범위와 함께 확정한다.
- rev.1에서는 요구/AT 15행과 하위 pair 10행을 대조해 분모·상대 링크 누락 0건을 확인했다. rev.2는 요구/AT 16행·하위 pair 11행을 대조했고, 전체 pair 27행의 EP 분모 불일치·상대 링크 누락은 각각 0건이다.
- 독립 읽기 검토에서 preparing lease·steer의 user 경계·telemetry 후 end 저장·session ID 라우팅을 대조하고 §9-B에 반영했다. 본문과 보드의 DRAFT 일치, 문서 inventory gate의 generated/prose/link 검사 통과를 확인했다.
- rev.2 코드 대조: 새 대화 중앙 블록은 `NewChatLandingPage`, 프로젝트 랜딩은 별도 구조다. `Button.pressed`·`Icon.size`를 재사용할 수 있고 정확한 Todo/Terminal 글리프는 추가가 필요하다. 기존 on/off `Toggle`의 17×30px 형상을 큰 모드 선택기로 취급하지 않았다.
- rev.2 독립 문서 검토에서 D-010·D-011↔AC1·AC16·§9-C·EP-14의 연결과 미확정 결정 보존을 확인했다. 문서 inventory gate의 generated/prose/link 검사가 통과했고 이번 변경은 문서뿐이므로 앱 실행 시험은 수행하지 않았다.
- 설계 이력의 DRAFT·문서 전용 표기는 당시 단계의 관측이다. 현재 Codex r1 구현과 자기확인은 r1 구현 보고, 현재 디스패치는 INDEX 행이 정본이다. 독립 검증은 아직 수행하지 않았다.

## [구현자 기입]

**Codex r1 구현·인수 보완**. 유효 V는 구현 전 확정한 V1이다. r1 구현 보고에 설계 리뷰·강제 지점/V-pair·수정 잠금·Product/UX 파생 검토·잠재 문제·게이트/AC·Review Signals를 기록했다. 최초 자동 승인 거부 후 사용자 명시 승인으로 실제 Claude 생성·게시·동시 Coding·앱 재시작 시험을 완료했다. AC 16/16·V-pair 27 SELF_PASS는 구현자 자기확인이며 독립 verify를 대신하지 않는다.

**Codex r2 구현**. 유효 계약은 V1 + 패널 ΔV2(§21)다. r2 구현 보고에 같은 일곱 필드와 ΔV2 AC 8/8 자기확인을 기록했다. r1 결과는 위에 보존하며 독립 verify는 pending이다.

## 21. Plan r2 — 모드별 우측 패널과 Work 폴더 추가

현재 표시 계약은 ΔV3(§22)가 일부 대체한다. D-012의 무조건 구역/정적 진행 표시는 D-018, D-013의 상시·메뉴 비활성은 D-019, D-014의 채워진 진행 그림은 D-020, D-015의 cwd 중복 no-op 해석은 D-021로 SUPERSEDED다. 나머지 결정은 유지하며 아래는 r2 기준선을 보존한다.

작성: **Codex**, 2026-09-08. 상태: **impl/IMPL_DONE — Codex r2 자기확인 완료, Claude 독립 검증 대기**. 같은 0224 핸드오프의 사용자 피드백을 구현한다. 독립 검증은 아직 수행하지 않았으며 사용자가 이번 피드백의 우선 반영을 지시했다.

| 항목 | 기준 |
|---|---|
| V mode / revision | Delta V / ΔV2 |
| 기준선 | 0224 V1 설계 `51268488`, r1 코드·인수 `ac4bebec` |
| 유효 계약 | V1 + 이 ΔV2. 아래 대체 관계 외 V1 결정 유지 |
| 참조 | Coding, Work, 빈 Work |

### Part I — Product & UX Contract

#### 1. 목표와 출처

Coding은 계획과 작업을 같은 패널에서 읽고, Work는 진행 상황·출력·컨텍스트를 가진 작업 패널 하나를 항상 볼 수 있게 한다. 기존 Markdown·작업 데이터·게시 액션을 재사용하며 새 패널 플랫폼을 만들지 않는다.

사용자는 “상단은 exitplanmode의 계획을 출력하고, 하단엔 … 작업을 표기”, “작업 패널 1개만 항상 노출”, “컨텍스트에 배치된 버튼은 add-dir 역할”을 명시했다. 후속 정정은 “cowork의 케밥버튼 제거는 취소다. 대신 요청한 타일을 제외한 다른 타일들은 노출을 하지않는다”이다.

기존 add-dir가 확정 세션에서 무시되는 사실을 설명한 뒤, 사용자는 **기존 대화에서도 추가 허용**을 선택했다. 유휴 상태에서 폴더를 저장하고 다음 요청에 적용하는 계약으로 확정했다.

#### 2. Decision Ledger

| ID | 결정 | 출처/조건 | 상태·대체 |
|---|---|---|---|
| D-012 | Coding task 타일 제거. plan 상단 계획·하단 작업, copy/expand/close 유지 | 이번 이미지1·명시 요청 | ACTIVE, V1 D-004/D-008의 공유 패널 부분 대체 |
| D-013 | Work는 task 하나를 항상 노출. 케밥 유지·타일 메뉴도 task만. 전체 타일 닫기는 제공하지 않고 펼치기/복귀 1개 | 이번 요청+후속 정정 | ACTIVE, V1의 1회 자동열기·사용자 닫기 규칙 대체 |
| D-014 | Work 세 섹션·구분선·출력 행·빈 상태 일러스트를 참조 비례에 맞춘다 | 이미지2·3, 기존 시맨틱 토큰 사용 | ACTIVE |
| D-015 | Work Context '+'는 폴더 선택. 유휴 기존 세션에도 추가·영속, 다음 요청부터 적용 | 사용자 질문 답변. 진행 중 변경 금지 | ACTIVE, V1 D-005의 폴더 편집 후속 부분 보완 |
| D-016 | 허용 폴더와 실제 참조 증거를 혼동하지 않는다. Context 폴더 칩은 사용자가 추가한 폴더임을 접근성/툴팁으로 명시 | 기존 참조 수집 후속 결정 유지 | ACTIVE |
| D-017 | 상태는 실제 데이터에서 파생. 빈 진행 그림은 설명용이며 완료 개수로 읽히지 않는다 | 이미지3의 완료 체크는 빈 상태 장식으로 해석 | ACTIVE |

V1 D-001/002/003/006/007/009/010/011은 유지한다. D-004의 게시 원본·삭제 UX, D-005의 실제 참조 수집·뷰어·일반 생성물 감지 후속, D-008의 실행 계층 범위도 유지한다. 최초 케밥 제거 요청은 후속 사용자 정정으로 폐기하며 구현하지 않는다.

#### 3. 흐름과 상태

| 상태/동작 | 사용자 관측 |
|---|---|
| 새 대화/프로젝트 랜딩에서 Work 선택 | 입력/첨부를 유지하고 우측 빈 작업 패널 표시. Coding 선택 시 Work 패널 제거 |
| Coding 계획 열기·작업 카드 진입 | plan 하나에 위 계획·아래 작업. 계획이 없어도 작업은 표시. 작업 상세는 하단에서 열고 목록으로 돌아감 |
| Coding 계획 검토 | 기존 선택 코멘트·복사·승인 흐름 유지. 작업 영역은 계획 선택 오프셋에 포함하지 않음 |
| Work 진입·이동·재로드·늦은 tile open | task 하나만 보임. 메뉴/복원/직접 열기가 다른 타일을 표시하지 않음 |
| Work task 메뉴 | 활성 작업 항목 유지. 비활성 토글처럼 오해하지 않게 고정 상태 표시. 세션 고정/이름/삭제 메뉴 유지 |
| 펼치기·복귀 | 같은 콘텐츠를 더 넓게 표시하고 원래 폭으로 복귀. 이중 마운트·추가 모델 호출 없음 |
| 섹션 접기 | 해당 본문만 접힘. 타일 전체는 유지. 세션 이동 시 다른 세션의 로컬 표시/선택 상태 유출 금지 |
| Work 출력 없음/로딩/실패 | 빈 일러스트+설명, 실제 로딩, 재시도 가능한 오류를 구별 |
| 폴더 선택 취소/실패/중복/루트 | 취소는 무변경, 실패·루트는 이유 표시, 중복은 늘지 않음 |
| 폴더 선택 중 세션 이동/전송 시작 | 늦은 결과로 다른 세션이나 실행 중 범위를 변경하지 않음 |
| 기존 Work 유휴에서 추가 | 성공 응답 후 칩 표시. DB가 정본이며 재시작 복원·다음 실행의 SDK/호스트 도구 범위에 반영 |
| 진행/준비/백그라운드 실행 중 추가 | 버튼 비활성+안내, Main도 재검사. 기존 실행/DB는 무변경 |

기존 Work의 계획 승인 카드는 트랜스크립트에서 유지한다. 비노출 타일로 보내는 별도 버튼은 숨기고 해당 도구 원문·승인·오류를 유지한다. 새 뷰어·자체 컨텍스트 수집·일반 파일 발견·다른 모드의 권한 변경은 범위 밖이다.

#### 4. Acceptance Criteria

이번 ΔV2 자기확인 분모는 아래 **8개**다. V1 전체 재인수로 합산하지 않으며 기존 V1 증거는 별도 보존한다.

| AC | 관측 기준 | 직접 oracle / production 경로 |
|---|---|---|
| AC-R2-1 | Coding 메뉴/영역에는 task가 없고 작업 진입은 plan으로 연결 | 실제 action→store→RightPanel/TitleBar. 정상 plan/diff/subagent와 task 차단을 함께 관측 |
| AC-R2-2 | plan 위 ExitPlanMode 본문·아래 작업, 진행 원/완료 체크+취소선/대기 점선 원. 계획 부재에도 작업·상세 접근 | plan_review·TaskCreate/Update fixture→실제 PlanTileContent, 영역별 DOM/좌표·선택 댓글·복사 |
| AC-R2-3 | Work task 상시 1개, 케밥 유지·task만, 펼치기/복귀. 랜딩·복원·직접열기에서 동일 | 실제 모드 전환·오염된 columns·OPEN_*→렌더, 구독/마운트 보존·폭 관측 |
| AC-R2-4 | Work 진행/출력/컨텍스트 순서와 populated/empty 상태가 참조와 대응 | 실제 task/게시 fixture, 흰색·어두운색·좁은 창 스크린샷. 상태 접근성·접기 확인 |
| AC-R2-5 | 폴더 추가 UI에서 취소·중복·루트·오류·세션 이동·busy 결과가 명확하고 안전 | picker→store→IPC를 실제 소비 컴포넌트로 호출, 다른 세션 DB/상태 무변경 |
| AC-R2-6 | 기존 Work idle 폴더 추가가 DB 저장·재로드·다음 SDK/호스트 scope로 전달, Coding/진행 중은 거부 | 실제 IPC handler·SQLite·turn/runtime 준비 시험, 기존 resume payload 임의 변경 거부 유지 |
| AC-R2-7 | 게시 다운로드·부재·휴지통 및 계획 승인·도구 원문을 보존 | 기존 ArtifactCard/TaskOutput 수명·plan review/Work transcript 회귀, 비노출 타일의 dead CTA 검사 |
| AC-R2-8 | 입력·첨부·종류 고정·세션 이동·Coding diff/subagent 회귀, 신규 의존성/모델 호출/이중 구독 없음 | 기존 agentKind/라우팅/패널/extraDirs suite 및 실제 renderer 인수 |

### Part II — Technical Design

#### 5. 조사 결과와 구조

| 대상 | 현재 코드 사실 | 변경 |
|---|---|---|
| 메뉴/패널 | `rightPanelTiles.ts` 전역 정의, `ChatTitleBar` 고정 메뉴, `RightPanel` columns 그대로 소비 | agentKind별 순수 표시 정책을 같은 모듈에서 소비. renderer 최종 필터도 적용 |
| 활성화 | reducer 일반 toggle/set/remove·BEGIN_TURN·LOAD_SESSION·plan_review·OPEN_TASK·OPEN_SUBAGENT_TASK·SELECT_DIFF_REQUIREMENT | 모드 정책 전수 적용. Coding task→plan, Work 고정 task |
| 계획 | `PlanTileContent`의 planContent와 댓글 containerRef | 기존 본문을 상단에, 공통 작업 목록/상세를 하단에. 빈 본문 early return 제거 |
| 작업 | `taskBoardForMessages` 캐시·`taskBoardOrdered`·TaskProgressList | 목록/상세 최소 추출·재사용. Work 진행 요약도 같은 items에서 파생 |
| 출력 | TaskOutputContent→artifactStore→ArtifactCards(list) | 같은 수명 유지. 기본 refresh 행은 오류 재시도로 정리·빈 그림 제공. 액션은 기존 메뉴 보존 |
| 폴더 | CwdPanel picker→addExtraDir는 확정 세션 무시. Main `selectTurnExtraDirs`는 DB 우선 | Work 전용 명시 폴더 추가 명령. 일반 chat.send override는 계속 무시 |

검색 기준: `rg -n 'rightPanelTiles|activateTile|OPEN_TASK|OPEN_SUBAGENT_TASK|SELECT_DIFF_REQUIREMENT|plan_review' app/src/renderer/src/features/chat`와 `rg -n 'extraDirs|extra_dirs|addExtraDir|pickDirectory' app/src/main/app app/src/main/features/sessions app/src/renderer/src/features/chat`.

레이어 방향은 기존 DAG를 유지한다. 페이지는 Work 랜딩 패널 조립만 담당하고 로직은 chat feature에 둔다. 새 실행 엔진·범용 패널 레지스트리·watcher·의존성은 추가하지 않는다.

#### 6. 폴더 저장·실행 경계

새 명시적 `session:addDirectory` IPC는 `sessionId + directory`를 받고 현재 DB의 Work 종류·실제 디렉터리·절대 경로·루트 금지·개수 상한·실행/준비 여부를 검증한다. 비동기 디렉터리 검증 뒤 busy/세션을 다시 확인하고 기존 extra_dirs에 추가만 한다. cwd 변경·삭제·임의 send payload로 범위 확대는 허용하지 않는다.

`registerSessionHandlers`에 composition root가 `supervisor.hasSession` 기반 busy 판정을 주입한다. 이는 준비 lease·실행·listening을 포함한다. 성공은 `{ok:true, extraDirs}`이며 실패는 busy/not-found/invalid-directory/not-work/limit 같은 명시 reason을 반환한다. 원본과 canonical 경로의 루트 검증을 모두 수행하고 최종 busy 재검사→행 재읽기→UPDATE 사이에는 await를 두지 않는다.

DB 성공 응답 후 renderer의 대상 sessionKey에 반영한다. picker 시작 시 key를 캡처하고 중간 전환/실행 시작에는 적용하지 않는다. 선택 취소/실패를 구분하고, 컴포저와 Context는 같은 picker 동작을 재사용한다.

다음 요청은 기존 DB 우선 해석을 유지한다. 기존 persistent 채널의 extraDirs와 달라졌다면 재사용하지 않고 재준비하여 SDK `additionalDirectories` 및 host tool context를 같은 범위로 맞춘다. 기존 listener/자동 연속/준비 lease가 살아 있는 동안 변경을 허용하지 않는다.

DB 쓰기는 단일 저장소·단일 추가 연산이다. 응답 도중 창이 닫혀도 DB가 정본이며 reload에서 복원한다. 별도 DB migration은 필요하지 않다.

#### 7. V nodes / pairs

V1 R-12/AT-12의 사용자 닫기·공유 패널 부분과 R-16/AT-16 패널 기본값, SD-02/AR-03/MD-05 관련 패널 부분은 아래 CHANGED 노드로 대체된다. V1 R-08/AT-08 중 Work 명시 추가 동작만 이번 사용자 승인으로 확장하며 나머지 권한 경계는 회귀다.

| Pair | node ↔ oracle | provenance / requiredness | 경로·강제 지점 |
|---|---|---|---|
| VP-R2-01 | R-R2-01 ↔ AT-R2-01 (AC1·2) | CHANGED / REQUIRED | Task/plan event→state→Coding panel, EP-R2-1·2·3 |
| VP-R2-02 | R-R2-02 ↔ AT-R2-02 (AC3·4) | CHANGED / REQUIRED | mode/load→Work sections, EP-R2-1·2·4 |
| VP-R2-03 | R-R2-03 ↔ AT-R2-03 (AC5·6) | NEW / REQUIRED | picker→IPC→DB→next turn, EP-R2-5·6·7 |
| VP-R2-04 | SD-R2-01 ↔ ST-R2-01 | CHANGED / REQUIRED | landing→first send→session switch/reload, AC3·5·8 |
| VP-R2-05 | AR-R2-01 ↔ IT-R2-01 | CHANGED / REQUIRED | menu/direct open→store→view, AC1·3·7 |
| VP-R2-06 | AR-R2-02 ↔ IT-R2-02 | NEW / REQUIRED | shared schema/preload→handler→DB→runtime, AC5·6 |
| VP-R2-07 | MD-R2-01 ↔ UT-R2-01 | CHANGED / REQUIRED | agent tile filter/activation+task status rendering, AC1·2·3 |
| VP-R2-08 | MD-R2-02 ↔ UT-R2-02 | NEW / REQUIRED | duplicate/root/busy/stale session directory handling, AC5·6 |
| VP-R2-09 | V1 R-12·AR-03 ↔ AT-12·IT-03의 게시/공유 입력 부분 | INHERITED / REGRESSION | ArtifactCard/TaskOutput/Composer/plan review, AC7·8 |
| VP-R2-10 | V1 R-08·R-13 ↔ AT-08·AT-13의 기존 권한·Coding 부분 | INHERITED / REGRESSION | 기존 workspace/extraDirs/종류·diff/subagent, AC6·8 |

각 AC는 위 표에서 독립 oracle이고 SD/AR/MD 행은 해당 AC의 구체 경로를 직접 검증한다. 선택 적대 증거는 **상단 계획/하단 작업 슬롯 맞교환 1건**(VP-R2-01/07): 존재만 확인하는 검사를 방지한다. 나머지는 실제 action/IPC/DOM 결과를 읽는 직접 행동 oracle이며 별도 변이는 선택하지 않는다.

V1의 프로필 문구·경계 part 기록·게시 모델 판단 자체는 바뀌지 않는다. 실제 Claude 요청을 다시 보내는 것은 이번 패널 변경의 필수 gate가 아니며 V1 실제 증거를 재실행 결과로 쓰지 않는다.

#### 10. 강제 지점과 운영 gate

| ID | 전수 지점 | 실패 의미 |
|---|---|---|
| EP-R2-1 | rightPanelTiles 정책·ChatTitleBar 메뉴/배지·RightPanel 최종 렌더 | 메뉴만 숨기고 이벤트로 다른 타일이 노출됨 |
| EP-R2-2 | reducer 종류/시작/로드·일반 toggle/set/remove·계획 review·task/subagent/diff open, store reveal·랜딩 2곳 | 캐시/우회 진입/새 대화에서 계약 유실 |
| EP-R2-3 | PlanTileContent 상하 조립·댓글 ref·TaskProgressList/Detail·상태 아이콘 | 계획 없을 때 작업 유실, 순서/상태 오해, 댓글 오프셋 회귀 |
| EP-R2-4 | Work TaskTileContent·TileSection·TaskOutputContent·Context·expanded chrome | 단일 패널이 상세로 통째 교체, 빈 상태/오류 유실 |
| EP-R2-5 | picker shared hook·CwdPanel·Context·대상 key store action | 취소/실패·늦은 결과가 다른 대화에 적용 |
| EP-R2-6 | shared IPC schema/channel·preload·renderer API·main registration/handler·DB write | 공개 계약 미배선·범위 검증/영속 누락 |
| EP-R2-7 | Main busy/preparing/listening 재검사·DB→turn·respawn key·host context | 실행 중 확대, SDK와 host 허용 경로 불일치 |
| EP-R2-8 | plan.md 메타/Decision 상태·이 문서·INDEX·impl-r2 보고·commit trailer | 상태/기준선/작성 주체 서로 불일치 |

구현자는 실제 파일/분기 전수 검색으로 각 행 지점을 재열거하고 차집합을 보고한다. 관련 subtree gate는 lint/typecheck, 영향 Vitest(설치 ABI 유지), production build, 문서 inventory/link, diff와 trailer 파싱이다. 새 IPC는 IPC_CONTRACT와 generated inventory를 함께 갱신한다.

시각 인수는 실제 production 컴포넌트+테마 CSS를 Chromium에서 렌더해 Coding populated/empty, Work populated/empty, dark/narrow, expand/return을 저장한다. 테스트 합성 값은 실제 실행·게시로 주장하지 않는다. 실제 DB/IPC 시험과 그림용 합성 입력은 별도 증거로 남긴다.

#### 11. READY 검토

사용자 정정과 add-dir 선택을 반영했으며 외부 제품 결정은 남지 않았다. ACTIVE 결정 대조: D-012→AC1/2, D-013→AC3, D-014/017→AC4, D-015→AC5/6, D-016→AC4/5, 기존 게시/권한/입력→AC7/8, 충돌 0. `supervisor.hasSession`의 준비 lease 포함, Runtime의 immutable host scope, 재개 DB 우선 해석을 코드에서 확인했다. 상단/하단 직접 oracle과 swap 변이를 선택했으며 READY 설계 커밋을 구현과 분리한다.

#### [구현자 기입] 조사 사실 정정

§5의 diff 직접 진입 action 이름은 `SELECT_DIFF_REQUIREMENT`다. 최초 조사 표의 존재하지 않는 이름을 정정했다. §10의 diff 직접 열기 책임과 제품 결정·AC·V-pair는 그대로다. 구현 중 파생 문제와 자기확인은 r2 구현 보고에 기록한다.

## 22. Plan r3 — 콘텐츠에 따른 패널 표시와 Work 작업 목록

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE**. 구현 보고의 ΔV3 AC 8/8은 Codex 자기확인이며 독립 검증 pending이다. 사용자 지시로 독립 검증에 앞서 이번 피드백을 같은 0224 핸드오프에 반영했다.

| 항목 | 기준 |
|---|---|
| V mode / revision | Delta V / ΔV3 |
| 기준 | V1 + ΔV2(§21), r2 구현 `473c4238` |
| 유효 계약 | V1 + ΔV2 + 이 ΔV3. 아래 대체 부분 이외 결정은 유지 |
| 참조 | 기존 Coding, 채워진 Work |

### Part I — Product & UX Contract

후속 사용자 피드백의 Work 권한/토글/Context 클릭/전체 상세는 ΔV4(§23)가 대체한다. 그 외 이 문서의 계약과 r3 증거는 유지한다.

#### 1. 목표와 출처

사용자는 “작업만 존재할때는 계획이 비었다는 표시 없이 작업만”, “계획이 존재하고 작업이 없을때는 계획만”, “둘 다 비었때는 2개 구역 구분 필요없음”과 Coding in-progress 애니메이션을 요청했다. Work는 “새 대화 랜딩페이지에서 작업 패널 표시는 없어야”, “케밥 버튼에서 활성/비활성화 가능”, “add-dir … 추가했을때 목록에 나와야” 하며 실제 콘텐츠는 새 참조처럼 표시해야 한다.

기존 빈 패널의 그림은 콘텐츠가 없는 상태로 유지하고, 작업 데이터가 생기면 작업명·상태를 가진 세로 목록으로 전환한다. 랜딩 제거는 앱의 새 대화/프로젝트 랜딩이며 빈 작업 섹션 자체의 삭제를 뜻하지 않는다.

#### 2. Decision Ledger

| ID | 결정·조건 | 출처 / 대체 |
|---|---|---|
| D-018 | Coding은 존재하는 계획/작업만 표시. 둘 다 없으면 단일 빈 영역. in-progress는 움직임 있는 상태 표시 | 이번 1-1. D-012의 무조건 상하 구역·r2 정적 진행 원 부분 대체 |
| D-019 | 새 대화·프로젝트 랜딩에 Work 패널 없음. 대화 최초 진입/첫 전송에서는 작업을 기본으로 열고, 이후 사용자가 케밥에서 닫거나 열 수 있음 | 이번 2-1/2-2. D-013의 상시·비활성 토글 부분 SUPERSEDED. 최초 대화 기본 열기는 기존 의도 유지 |
| D-020 | Work 데이터가 있으면 번호/작업명 세로 목록. 진행은 강조 윤곽 번호, 완료는 채운 체크+취소선, 대기는 옅은 번호. 각 상태를 실제 task 데이터에서 파생 | 이번 2-4 이미지. D-014의 populated 진행 원 연결 그림 부분 대체. D-017 빈 장식 구분 유지 |
| D-021 | Work에서 add-dir로 명시 선택한 cwd도 목록에 한 번 표시·저장. 자동 cwd 노출은 하지 않음. 이미 추가한 경로의 재선택은 중복 생성 안 함 | 이번 2-3. D-015의 cwd 중복 no-op 해석 정정. D-016 사용자 추가 폴더 의미 유지 |
| D-022 | 작업별 질문/변경 제안 버튼은 작업명을 인용해 기존 입력 뒤에 추가하고 입력창에 포커스. 사용자가 작성·전송 | 이미지의 버튼/툴팁에 따른 구현 해석. 기존 초안·첨부·세션별 입력 보존 |
| D-023 | 승인 요청은 있으나 계획 본문 해소에 실패한 오류는 빈 계획과 구분해 유지. 도구 미지원 안내는 둘 다 빈 단일 영역의 보조 정보로 보존 | 기존 0215·ΔV2 오류 계약. 단순 빈 상태 숨김으로 승인 실패를 은폐하지 않음 |

모두 ACTIVE다. D-012의 독립 Coding task 제거·계획 댓글/복사·확대, D-013의 Work에서 다른 타일 비노출·케밥 유지, D-014의 출력/Context, D-015의 유휴 추가·DB·다음 실행 scope, D-016/017과 V1의 나머지 결정은 유지한다. 일반 생성물 수집·실제 참조 추적·뷰어·SRT·OpenCode adapter는 계속 후속이다.

#### 3. 상태와 흐름

| 상태/행동 | 결과 |
|---|---|
| Coding 계획/작업 모두 있음 | 계획 위, 작업 아래. 댓글 오프셋에 작업은 포함하지 않음 |
| Coding 작업만 있음 | 빈 계획 안내 없이 작업만. 하단 상세·뒤로가기는 유지 |
| Coding 계획만 있음 | 작업 제목·빈 목록 없이 계획만 |
| Coding 둘 다 없음 | 구역 제목을 나누지 않은 단일 빈 상태. 미지원/판정 불가 보조 안내 보존 |
| Work 랜딩에서 종류 토글 | Composer/입력/첨부를 유지하고 작업 패널은 표시하지 않음 |
| Work 첫 전송 또는 처음 로드 | 작업 패널 기본 열림. 다른 타일은 필터링 |
| Work 케밥으로 닫음 | 이후 턴·계획 이벤트·화면 재렌더가 다시 열지 않음. 같은 캐시 세션 복귀도 닫힘 유지 |
| Work 케밥/명시 작업 열기 | 작업 한 개 표시. session별 선택/폭·확대 수명 유지. 앱 재시작 뒤 배치 영속은 새로 추가하지 않음 |
| Work 작업 데이터 발생/삭제 | 빈 장식↔세로 작업 목록. 출력·Context는 각 데이터의 기존 수명 유지 |
| 질문/변경 제안 | 해당 작업 인용을 입력에 추가·포커스. 기존 초안/첨부를 보존. 다른 세션에 늦게 적용하지 않음 |
| 폴더 추가 | 신규 폴더 또는 명시 cwd 모두 칩 표시. 중복/취소/루트/실패·busy/늦은 결과는 기존 경계 준수 |

#### 4. Acceptance Criteria

| AC | 관측 결과 | 직접 oracle |
|---|---|---|
| AC-R3-1 | Coding 네 조합에서 빈 형제 구역이 없고 모두 비면 한 영역. 승인 본문 실패는 구분 | 실제 PlanTileContent DOM, 선택·상세·capability 회귀 |
| AC-R3-2 | Coding 진행 아이콘 애니메이션, 완료 체크/취소선·대기 점선 유지. reduced-motion 존중 | 실제 진행/완료/대기 행 DOM·Chromium animation 관측 |
| AC-R3-3 | 새 대화/프로젝트 Work 랜딩에 패널 없음. 첫 전송·로드 후 기본 표시 | 실제 페이지/모드·BEGIN_TURN·LOAD_SESSION 경로 |
| AC-R3-4 | Work 메뉴 task만, 켜기/끄기 가능. 닫음 이후 턴·이벤트·캐시 복귀가 자동 복원하지 않음 | 메뉴 클릭→store→RightPanel, reducer 우회/복원/허용 Coding 대조 |
| AC-R3-5 | Work 작업 세로 목록·번호/상태·제목·완료 취소선이 이미지에 대응. 빈 그림은 데이터 없을 때만 | 실제 TaskCreate/Update 입력·작업 상세·empty/populated·white/dark/narrow |
| AC-R3-6 | Work 명시 폴더/cwd 선택→칩→저장/reload. 반복 선택 중복 없음, Coding/busy/루트 경계 유지 | picker/store/renderer + 실제 Main handler·SQLite, draft/resume 모두 |
| AC-R3-7 | 작업 질문 버튼이 초안 뒤에 작업 인용을 추가·포커스하고 기존 텍스트/첨부 보존 | 실제 입력 controller와 세션 전환/취소 draft 복원 회귀. send IPC 없음 |
| AC-R3-8 | 출력 저장/삭제/부재·계획 승인/댓글·작업 상세·Coding diff/subagent·DB scope 회귀, 새 의존성 없음 | 해당 기존 UT/IT·native 상호작용·type/lint/build |

### Part II — Technical Design

#### 5. 조사·AS-IS → TO-BE

| 현재 사실 / 조사 | 변경 |
|---|---|
| PlanTileContent가 PlanDocument와 작업 section을 무조건 렌더. r2 시험도 빈 계획과 정적 진행 원을 요구 | 상위에서 plan/task presence 판단, 캐시된 작업 배열을 하단에 전달. 양쪽 슬롯 순서와 댓글 ref는 유지 |
| rightPanelColumnsForAgent는 빈 Work columns를 task로 복구. reducer toggle/remove도 Work를 거부. 랜딩 두 곳이 RightPanel을 직접 mount | 표시 필터는 빈 목록을 보존. 기존 agentPanelInitialized로 최초 진입에서만 기본 task 추가. 메뉴 비활성 제거, 일반 close/open 경로 통일 |
| TaskTileContent→WorkTaskProgress가 실제 작업도 연결된 원으로 표시 | 같은 taskBoard items의 세로 행과 상세. 별도 작업 모델·스토어 없음 |
| Main addSessionDirectory가 cwd를 중복 집합에 포함하지만 Context는 extraDirs만 읽음. draft ADD_EXTRA_DIR도 cwd를 버림 | Work의 명시 cwd 선택은 extraDirs에 한 번 기록. 저장된 extraDirs만 중복 비교. Coding 초안 정책은 유지 |
| draftRestore 소비자가 입력을 교체. 사용자 초안이 컴포저 내부에 있음 | 기존 feature 신호에 append 의미를 구분해 전달, 기본 restore는 교체 유지. 새 전역 이벤트 버스/두 번째 Composer 없음 |

검색 술어는 `rightPanelTiles|activateTile|removeTile|agentPanelInitialized`, `extraDirs|extra_dirs|ADD_EXTRA_DIR|addSessionDirectory`, `draftRestore|restoredDraft|replaceDraft`, `TaskProgressContent|WorkTaskProgress|TaskStatusIcon`이다. 실제 위치는 §10에서 잠근다.

새 IPC·DB 형식·adapter 계약은 없다. 명시 cwd 기록은 이미 허용된 경로의 UI 추적이며 cwd 자체를 변경하지 않는다. 기존 DB 우선 해석과 다음 턴 SDK/host 범위 비교를 유지한다. 사용자 지정 폭·로컬 접힘은 기존 lifetime을 따른다.

#### 6. V nodes / pairs

ΔV2의 패널·폴더 표시 관련 R/SD/AR/MD 노드는 아래 CHANGED 노드로 대체하며, 저장/권한/게시 동작은 해당 REGRESSION으로 유지한다. 비영향 V1 모델 프로필·실제 Claude 게시 인수를 이번에 다시 실행한 것으로 세지 않는다.

| Pair | node ↔ oracle | provenance / requiredness | production path / EP |
|---|---|---|---|
| VP-R3-01 | R-R3-01 ↔ AT-R3-01 (AC1/2) | CHANGED / REQUIRED | task/plan state→Coding DOM, EP1 |
| VP-R3-02 | R-R3-02 ↔ AT-R3-02 (AC3/4/5) | CHANGED / REQUIRED | landing/turn/menu→Work view, EP2/3/4 |
| VP-R3-03 | R-R3-03 ↔ AT-R3-03 (AC6/7) | CHANGED / REQUIRED | picker/작업 질문→목록/입력, EP4/5/6 |
| VP-R3-04 | SD-R3-01 ↔ ST-R3-01 | CHANGED / REQUIRED | 최초/기존/캐시 대화·닫음→다음 턴, EP2/3/6 |
| VP-R3-05 | AR-R3-01 ↔ IT-R3-01 | CHANGED / REQUIRED | event/store/layout/메뉴/페이지, EP1/2/3/4 |
| VP-R3-06 | AR-R3-02 ↔ IT-R3-02 | CHANGED / REQUIRED | 명시 폴더 DB/로드·draft→controller, EP5/6 |
| VP-R3-07 | MD-R3-01 ↔ UT-R3-01 | CHANGED / REQUIRED | presence·status·tile 필터·draft 병합, EP1/2/4/6 |
| VP-R3-08 | MD-R3-02 ↔ UT-R3-02 | CHANGED / REQUIRED | cwd/중복·canonical·세션 경계, EP5 |
| VP-R3-09 | ΔV2 VP-R2-03/06/08/10 | INHERITED / REGRESSION | DB·runtime scope·기존 권한·Coding 동작, EP5 |
| VP-R3-10 | ΔV2 VP-R2-01/09·V1 공유 입력 | INHERITED / REGRESSION | 계획 댓글/승인·게시·입력/복원, EP1/4/6 |

선택 적대 증거는 기존 계획/작업 상하 슬롯 swap 1건을 유지한다. 새 조건부 표시의 네 조합은 실제 영역 결과를 직접 단언한다. 나머지는 직접 action/IPC/DOM oracle이며 새 mutation을 선택하지 않는다.

#### 10. 강제 지점과 gate

| EP | 전수 대상 | 실패 의미 |
|---|---|---|
| EP1 | PlanTileContent presence/본문 ref·TaskProgressContent/empty·TaskStatusIcon·기존 슬롯 시험 | 빈 형제 영역 잔존, 본문 실패 은폐, 진행 원 정지, 순서/선택 회귀 |
| EP2 | 표시 필터·reducer SET_AGENT_KIND/BEGIN_TURN/LOAD_SESSION·toggle/set/remove·plan_review/task/subagent/diff open·store reveal | 닫은 타일 자동 복원 또는 다른 Work 타일 우회 노출 |
| EP3 | NewChatLandingPage·ProjectLandingPage·ChatTitleBar·RightPanel/Tile chrome·배지 | 랜딩 패널 잔존, 메뉴 비활성, 닫힌 Work 완료 알림 유실 |
| EP4 | WorkTaskProgress·TaskTileContent·TaskOutput/Context·작업 상세/질문 액션 | 그림이 실제 목록을 대체, 섹션/원문/기존 액션 유실 |
| EP5 | Main canonical/duplicate·DB 저장/load·draft ADD_EXTRA_DIR·store·picker·Context 소비 | 성공인데 칩 없음, 자동 cwd 노출, 중복/권한 회귀 |
| EP6 | 질문 producer·draft 신호 target/seq·ChatTile·Composer props·InputController append/restore·focus | 초안 덮어쓰기·다른 대화 적용·자동 전송 |
| EP7 | plan 메타·r2 대체 표기·r3 문서·INDEX·impl-r3·trailer | 결정·상태·작성 주체 불일치 |

운영 gate는 영향 Vitest(설치 ABI 유지), lint/typecheck, production build, actual production 컴포넌트/CSS의 Chromium 인수, 문서 inventory/link, diff와 trailer 파싱이다. 합성 UI 데이터·mock IPC와 실제 SQLite 시험을 구분한다. 시각 결과와 클릭/상태 결과, 선택 swap red/복원 green을 증거로 보존한다.

#### 11. READY self-review

D-018/023→AC1/2, D-019→AC3/4, D-020→AC5, D-021→AC6, D-022→AC7, 유지 결정→AC8을 대조했다. 기존 정적 원/상시 노출/빈 형제 영역 oracle은 이 ΔV3으로 명시 대체한다. cwd 선택은 실제 handler를 로드한 재현에서 성공·writes=0·표시 목록=0, 다른 폴더는 writes=1·목록=1로 확인했다. 사용자 명시 수정 외 새 제품 권한이나 의존성 결정은 없다. 설계 커밋은 구현과 분리한다.

## 23. Plan r4 — Work Composer 정책과 패널 탐색

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE — Codex 자기확인 8/8, 독립 verify pending**. 기존 V1 + ΔV2(§21) + ΔV3(§22)에 적용하는 **ΔV4**다. 조사 기준은 원격에 게시된 r3 구현 `20d9489d`이며 사용자 피드백 보완으로 진행했다. 구현과 최종 시각 피드백 인수는 구현 보고 r4에 기록한다.

후속 사용자 피드백은 ΔV5(§24)가 부분 대체하며, 여기의 나머지 결정과 검사는 기준선으로 유지한다.

### Part I — Product & UX Contract

#### 1. 목표와 사용자 출처

사용자는 Work일 때 “composer에서 git 패널스택을 출력하지 않는다”, 권한을 “수동 승인, 자동 승인, 모든 승인 건너뛰기” 순으로 제공하고 “클로드 4.5 이하 및 커스텀 모델은 모두 자동 권한을 지원하지 않는다”고 요청했다. 랜딩은 `< <Task SVG> / <Terminal SVG> >` 형태와 Orca의 파란 활성색을 사용하고, 아래에 “어떤 작업을 시작할까요?”, “개발, 디버깅을 시작하세요.”를 각각 표시한다. 컨텍스트는 클릭 가능하며 Work 진행 항목 클릭은 패널 전체의 상세 단계로 전환한다.

권한 메뉴 범위는 질의 후 답변 전 기본 해석을 알렸다: Work는 세 항목, Coding은 기존 메뉴를 유지하고 자동 승인 모델 조건만 공통 적용한다. 컨텍스트는 현재 폴더만 있으므로 기존 작업 폴더와 같은 탐색기 열기로 해석한다. 사용자의 후속 지시에 따라 handoff-review는 사용하지 않고 사용자 결정 추적과 일반 plan/impl 절차만 수행한다.

#### 2. Decision Ledger

| ID | ACTIVE 결정 | 출처·대체 관계 |
|---|---|---|
| D-024 | Work Composer에서 Git 스택을 mount하지 않는다. 다른 입력/승인/폴더 UI와 보유 Git 상태는 유지한다. | 사용자 1. V1 공유 Composer 중 Git 표현만 대체 |
| D-025 | Work 메뉴는 수동 승인→자동 승인→모든 승인 건너뛰기, 칩은 수동/자동/모든 승인 건너뛰기. 수동 실제값은 default, 자동은 auto_classified, 건너뛰기는 bypass다. 기존 bypass 확인을 유지한다. | 사용자 1. Coding 기존 메뉴 유지는 명시한 기본 해석 |
| D-026 | 자동 승인은 구체적 Claude 버전 >4.5에만 허용한다. <=4.5·커스텀 이름·버전 불명·선택 전은 불가. Work는 수동, Coding은 기존 편집 수락으로 강등한다. | 사용자 1. 기존 0215 Haiku 제외 정책을 대체. provider와 모델 종류는 구분 |
| D-027 | Work의 기존 plan/accept_edits/dont_ask 선택 상태는 수동으로 정착한다. 계획 요청/본문/승인 흐름은 유지하고 승인 후 Work=default, Coding=accept_edits다. | 세 Work 권한의 실제 의미를 유지하기 위한 파생. SDK 정규화 enum 축소 없음 |
| D-028 | 랜딩 토글은 장식 좌/우 꺾쇠·Todo/슬래시/Terminal로 구성하고 활성은 기존 selected 계열 파랑을 쓴다. 토글 아래 정확한 Hero 문구를 한 번 표시한다. | 사용자 2. V1 토글 외형/인사말 배치·설명 문구 대체 |
| D-032 | 꺾쇠·슬래시·SVG를 확대하고 Hero의 크기·두께를 키우며 토글의 회색 배경과 외곽선을 제거한다. 선택된 모드의 파란 강조는 유지한다. 구체 적용값은 꺾쇠 28px, SVG 36px, 슬래시/Hero 32px·bold이며 실제 화면에서 대조한다. | 최종 사용자 피드백. D-028의 형태·색·순서는 유지하고 크기/배경만 대체 |
| D-029 | 컨텍스트 폴더 클릭은 해당 세션에 저장된 폴더를 탐색기로 연다. 실패는 칩을 남기고 오류 표시·재시도를 제공한다. | 사용자 3 + 기존 CwdButton 열기 UX 재사용 |
| D-030 | Work 작업 선택은 같은 타일 전체를 상세 단계로 바꾸며 뒤로가기로 목록에 돌아간다. 진행/출력/컨텍스트의 상태와 구독은 보존하고 화면/키보드에서는 숨긴다. | 사용자 4. ΔV3 inline 상세만 대체 |
| D-031 | 세션 캐시 선택·케밥 재열기 수명은 유지한다. 선택 작업 삭제 시 목록으로 돌아가며 DB reload는 선택을 초기화한다. 질문 버튼은 상세 전환과 분리한다. | ΔV3 유지. 사용자가 요청하지 않은 닫힘 정책 변경 없음 |

ΔV3 D-018/019/021/022/023 중 위에서 대체하지 않은 동작, Work 전용 타일·출력·명시 폴더 저장, 모드 잠금·기존 입력 보존은 ACTIVE다. 일반 생성물 감지·실제 참조 추적·뷰어·SRT·OpenCode 구현은 후속이다.

#### 3. 사용자 흐름

| 시작 | 표시/결과 |
|---|---|
| 새 대화/프로젝트에서 Work 선택 | 파란 Todo·Hero가 토글 아래 표시. 동일 Composer 유지, Git stack/조회는 없음 |
| Coding 선택 | 파란 Terminal·Coding Hero. 기존 Git 표시와 권한 메뉴 유지 |
| Work 권한 선택 | 수동/자동/건너뛰기 실제 모드 반영. 지원하지 않는 자동 항목은 제공하지 않음 |
| 모델 변경·구형 세션 복원 | 선택 모델과 종류에 맞게 권한 정착. 적용되지 않은 auto를 칩에 계속 표시하지 않음 |
| live 권한 변경 | 실제 live 모델을 Main에서 확인, 적용한 모드를 응답해 대상/요청 세대가 유효한 UI만 반영 |
| idle 권한 선택 | live SDK 적용 없이 선택 저장. 다음 send에서 실제 해소된 모델로 다시 강제 |
| 컨텍스트 클릭 | 저장 세션의 허용 폴더를 탐색기로 열기. 오류/없는 폴더는 메시지와 원래 항목 보존 |
| Work 작업 클릭 | 타일 전체 상세. 뒤로가기와 작업명·기존 상세 동작. 목록 섹션은 숨김 |
| 상세에서 복귀/작업 삭제 | 보존된 목록으로 복귀. 접힘·출력 더보기·폴더 상태 유지 |

#### 4. Acceptance Criteria

| AC | 관측 기준 | 직접 oracle |
|---|---|---|
| AC-R4-1 | Work에서 Git UI/조회가 mount되지 않고 Coding의 기존 Git·나머지 Composer는 유지 | 실제 Composer 조립·Git 호출 대조·입력/첨부 회귀 |
| AC-R4-2 | Work 메뉴 순서/라벨·수동 실제값·위험 모드 확인, Coding 메뉴 유지 | 실제 메뉴 DOM·클릭·store 결과 |
| AC-R4-3 | Claude 4.5 경계·4.6+·날짜/1m·custom/unknown에서 동일 auto 정책 | 순수 경계 행렬 + 메뉴/reducer/Main의 적용값 |
| AC-R4-4 | 종류/모델/권한/load/send/live/계획 승인에서 UI와 적용값 일치 | renderer/store·Main/SDK 옵션·응답 순서/세션 경계 |
| AC-R4-5 | 두 랜딩의 확대된 꺾쇠·슬래시·SVG·굵은 Hero, 회색 배경 제거·파랑·정확 Hero 위치, 같은 Composer와 잠금 유지 | 실제 DOM/Chromium·슬롯 순서 단언 |
| AC-R4-6 | 저장된 Context 폴더 클릭/키보드→허용 경로 열기, 실패/재시도·경계 유지 | 실제 handler/임시 DB/디렉터리 + OS open 포트 관측, UI 오류 |
| AC-R4-7 | Work 전체 상세 전환·뒤로가기·동일 overview 상태·삭제/캐시 수명 | 실제 패널 클릭/가시성·DOM 보존·선택 상태 |
| AC-R4-8 | r3 계획/출력/질문·입력·폴더/범위 회귀, 새 패키지/일반 플랫폼 없음 | 영향 UT/IT/native 및 타입/린트/빌드 |

### Part II — Technical Design

#### 5. 현재 구조와 최소 변경

| 조사 대상 | 관측과 변경 |
|---|---|
| Composer gitRow 슬롯 1곳 | GitRow가 useGitSnapshot의 유일 소비자다. agentKind 경계에서 GitRow 생성만 생략한다. sessionStarted에 대한 Coding 정책은 내부에 유지 |
| shared permission-mode/model-identity | 기존 판별은 Haiku 여부뿐이다. 구체적 Claude 버전 판별과 종류별 권한 정착·승인 목표를 순수 함수로 공유. 날짜를 minor로 해석하지 않고 [1m]은 분리 |
| 메뉴·reducer·store | 메뉴는 동일 정책으로 후보를 필터링하고 Work 전용 label/순서를 조립한다. 모델/권한/종류/load 전이 및 live 응답의 최신 대상/요청만 적용 |
| Main send/coordinator/adapter | payload 여부와 무관하게 실제 모델·종류에서 실행 권한을 정착. live는 기존 runtime의 spawnedModel 읽기만 노출하고 idle runtime 목록 API를 신설하지 않음 |
| 계획 승인 | renderer·Main은 공통 승인 목표, Main→TurnRequest는 계산된 승인 목표 값만 전달. adapter는 불투명 agentProfileKey를 파싱하지 않음 |
| AgentModeToggle + 랜딩 두 곳 | Toggle이 Hero를 함께 소유하여 두 페이지가 같은 순서를 사용. 별도 프로젝트 정보 Hero는 유지 |
| TaskContextContent→openPath | 현재 Main은 extra_dirs를 허용하지 않음. 기존 요청의 directory에 선택적 sessionId를 추가해 해당 Work 세션의 저장 extraDirs 정확 일치만 열기 허용 |
| TaskTileContent/WorkTaskProgress | selectedTaskKey가 이미 존재. overview를 숨긴 채 mount 유지하고 같은 타일에 detail 형제를 표시. 새 router/store/범용 panel stack 없음 |

##### 계약·수명

- `OpenPathRequest`의 선택적 sessionId는 directory 요청에서만 사용한다. scoped 요청은 Work 세션·저장 extraDirs·실제 디렉터리를 검증하며 요청자가 임의 경로 목록을 보내지 못한다. 기존 unscoped cwd/reveal 호출은 유지한다.
- 기존 permission:setMode 응답은 적용한 `NormalizedPermissionMode`로 정밀화한다. live 모델로 강등됐으면 renderer도 반영하며 늦은 응답이 새 선택/다른 세션을 덮지 못하게 한다. idle은 다음 send에서 최종 해소 모델을 검사한다.
- `TurnRequest`에는 Main이 계산한 계획 승인 목표만 전달한다. SDK의 정규화 모드·계획 내용·자동 연속 요청은 유지하고 전송/후속 경로에 같은 값을 승계한다.
- 실제 모델명이 불명확한 별칭을 최신 Claude라고 추정하지 않는다. 커스텀 provider라도 명시된 실제 Claude 식별자는 모델 기준으로 판단한다. 외부 제품의 계정/서버별 추가 제한을 앱이 우회하지 않는다.
- 상세 전환은 overview 내부 picker·출력 구독·접힘 상태를 유지한다. 상세 진입/복귀 시 키보드 초점과 스크롤을 해당 화면에 맞추며 확대/케밥 수명은 기존 타일을 사용한다.
- 추가 파일 열기는 기존 OS 포트를 사용한다. 사용자 파일 내용 읽기·뷰어·모델 권한 쓰기를 도입하지 않는다.

외부 사실은 [Claude Code permission modes](https://code.claude.com/docs/en/permission-modes)와 설치 SDK 타입을 대조한다. 문서의 지원 모델은 Sonnet/Opus 4.6 이상 사례이며, 이번 >4.5 경계는 사용자가 지정한 Composer 선택 정책이다.

#### 6. Delta V nodes / pairs

| Pair | 노드 ↔ oracle | provenance / requiredness | production path / EP |
|---|---|---|---|
| VP-R4-01 | R-R4-01 ↔ AT-R4-01 (AC1/2/3) | CHANGED / REQUIRED | kind/model→Composer Git/menu, EP1/2 |
| VP-R4-02 | R-R4-02 ↔ AT-R4-02 (AC5/6/7) | CHANGED / REQUIRED | toggle/context/task click→화면/OS, EP3/4/5 |
| VP-R4-03 | SD-R4-01 ↔ ST-R4-01 (AC4) | CHANGED / REQUIRED | model/mode/load→send/live/approval→UI/SDK, EP2 |
| VP-R4-04 | SD-R4-02 ↔ ST-R4-02 | CHANGED / REQUIRED | 상세→뒤로/삭제/cache·open 실패/다른 세션, EP4/5 |
| VP-R4-05 | AR-R4-01 ↔ IT-R4-01 | CHANGED / REQUIRED | shared policy→renderer/Main/adapter, EP1/2 |
| VP-R4-06 | AR-R4-02 ↔ IT-R4-02 | CHANGED / REQUIRED | 요청 타입/schema/preload/API→handler/DB/OS, EP4 |
| VP-R4-07 | MD-R4-01 ↔ UT-R4-01 | CHANGED / REQUIRED | version/model/kind 정착·옵션/라벨·승인 목표, EP2 |
| VP-R4-08 | MD-R4-02 ↔ UT-R4-02 | CHANGED / REQUIRED | toggle Hero 순서·선택 상세/Context UI, EP3/4/5 |
| VP-R4-09 | ΔV3 VP-R3-01/02/04/09 | INHERITED / REGRESSION | Coding 계획·Work 타일 선택·입력/범위, EP1/2/5 |
| VP-R4-10 | ΔV3 VP-R3-03/06/10 | INHERITED / REGRESSION | 질문/초안·게시/폴더 저장·계획 댓글/승인, EP2/4/5 |

선택 적대 증거는 **토글/Hero 상하 슬롯 swap 1건**이다. DOM에 두 내용이 남는 것만으로 순서를 증명하지 않고 실제 순서 단언이 역교환을 검출하는지 확인한다. 나머지는 실제 값·클릭·IPC 결과이며 새 mutation을 선택하지 않는다.

#### 10. 강제 지점과 gate

| EP | 전수 대상 | 실패 의미 |
|---|---|---|
| EP1 | Composer gitRow, GitRow/useGitSnapshot, 두 랜딩/ChatTile 공용 Composer | Work 숨긴 Git 조회 지속, Coding Git 또는 입력 유실 |
| EP2 | shared version/coerce/승인 목표, 메뉴/칩, reducer kind/model/mode/load, store model/mode/live 응답, Main send/coordinator, runtime 읽기포트, TurnRequest/후속, 승인 renderer/Main/adapter | unsupported auto 실행·칩 불일치·Work 수동이 편집수락·stale 응답/승인 불일치 |
| EP3 | AgentModeToggle, agentPresentation, NewChatLandingPage/ProjectLandingPage, i18n ko/en | 순서/문구/활성색·잠금·동일 입력 인스턴스 회귀 |
| EP4 | TaskContextContent, fileApi, OpenPathRequest/schema/IPC/preload, files handler/DB 경로/OS 호출, 에러 UI | extraDirs 열기 실패, 다른 세션/임의 경로 허용, 오류 은폐/칩 삭제 |
| EP5 | TaskTileContent, WorkTaskProgress, TaskDetail, TileSection/Output/Context lifetime, selectedTaskKey/delete/load/cache, RightPanel chrome | inline 상세 잔존, 숨긴 overview 가시/포커스, 복귀 시 상태/구독 유실 |
| EP6 | plan 메타·ΔV3 대체 표기·ΔV4·INDEX·impl-r4·trailer, 현재 IPC/권한/rendering 문서 | 상태·범위·작성 주체/공개 계약 불일치 |

구현자는 각 EP의 실제 호출/분기 지점을 다시 세고 명시한 목록과 대조한다. 운영 gate는 영향 Vitest(설치 Electron ABI 유지), typecheck node/web/test, lint, production build, 실제 컴포넌트/CSS의 native 인수, inventory/prose/link, diff와 trailer 파싱이다. DB/디렉터리는 임시 실제 자원, OS 열기는 주입 포트로 관측하고 모델 실행을 새로 수행한 것으로 세지 않는다.

#### 11. READY 대조

D-024→AC1, D-025→AC2/4, D-026/027→AC3/4, D-028/032→AC5, D-029→AC6, D-030/031→AC7/8을 대조했다. 기존 사용자 요청 중 대체되지 않은 r3 회귀는 VP-R4-09/10에 연결했다. Git 생성·실제 모델 권한·Context 허용 범위·상세 수명은 코드 조사로 닫았으며, 새 패키지·DB migration·별도 플랫폼 결정은 없다.

## 24. Plan r5 — 패널 밀도와 세션 완료 표시

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE — Codex 자기확인 8/8, 독립 verify pending**. 기준은 원격 r4 구현 `eb7e0db9`의 V1 + ΔV2 + ΔV3 + ΔV4(§23)이며, 이번 사용자 피드백을 **ΔV5**로 적용한다. 사용자의 지시에 따라 handoff-review를 사용하지 않고 plan/impl 추적만 수행했다. 구현과 Windows 인수는 구현 보고 r5에 기록한다.

### Part I — Product & UX Contract

#### 1. 목표와 범위

랜딩의 장식을 줄이고 Work에서 불필요한 Git 제어와 패널 버튼을 숨긴다. Work는 내용만큼 작은 패널로 표시하고 Coding 작업 목록은 같은 테마와 전체 상세 전환을 사용한다. 채팅 목록은 모드 아이콘으로 종류와 아직 확인하지 않은 완료를 구분한다.

사용자 조건은 “단 해당 세션이 안열려있을때를 전제함”, “각 영역에서 여백 운영하지 말것”, “아무것도 없으면 패널의 랜딩페이지에서도 여백을 없애 작업패널의 높이를 줄이라”, “코딩의 우측 패널은 현재 상태 유지”다. 마지막 조건은 Coding의 높이 정책이며, 별도로 명시한 작업 목록 테마·전체 상세 전환은 변경한다.

#### 2. Decision Ledger

| ID | ACTIVE 결정 | 출처·대체 관계 |
|---|---|---|
| D-033 | 모드 토글의 tooltip을 삭제하고 Hero는 normal 두께로 표시한다. 아이콘·문구 크기, 파란 선택색, Hero 아래 배치, 접근성 이름·잠금은 유지한다. | 사용자 1. D-032의 Hero bold만 대체 |
| D-034 | Work CwdPanel은 BranchChip/WorktreeToggle을 렌더링하지 않는다. Coding에서 다시 표시하며 폴더 추가는 기존 flex 순서에서 빈자리 없이 당겨진다. | 사용자 2. r4 랜딩 Git 표시 예외를 대체 |
| D-035 | Work 타일의 우상단 확대 버튼과 출력 목록의 모두 저장을 제거한다. 케밥 활성/비활성, 개별 파일 동작, 트랜스크립트 모두 저장, Coding 계획의 복사/확대/닫기는 유지한다. | 사용자 3. Work 확대 유지 결정만 대체 |
| D-036 | Coding/Work는 같은 작업 행·배지·상태·제목 CSS를 사용한다. 클릭은 해당 패널 전체 상세로 전환하며 뒤로가기·삭제 복귀·캐시·초점을 유지한다. Coding의 기존 blockedBy 정보와 Work 전용 질문 액션은 보존한다. | 사용자 4. Coding 하단 inline 상세 대체 |
| D-037 | 채팅 행의 우측 모드 텍스트를 제거하고 왼쪽은 Google Material Terminal 2 / Checklist SVG를 사용한다. 비열람 세션이 정상 완료되면 아이콘만 selected 파란색으로, 세션을 열면 원래 색으로 복원한다. | 사용자 5. 기존 말풍선/우측 라벨 대체 |
| D-038 | Work 작업·출력·Context 항목 제목은 가용 폭을 넘으면 한 줄 말줄임한다. 전체 제목의 접근성 이름·title 및 상세 내용은 유지한다. | 사용자 6 |
| D-039 | Work 외곽은 내용 높이에 맞춰 줄어든다. 세 영역 각각의 header/padding 포함 최대 높이는 부모가 허용하는 패널 최대 높이의 1/3이며, 남는 공간을 배분하지 않는다. 넘치는 본문은 영역 안에서 스크롤한다. | 사용자 7 |
| D-040 | Work 상세는 세 영역 제한을 적용하지 않고 전체 허용 높이까지 사용한다. Coding 외곽의 현재 높이 정책은 보존한다. | 사용자 4/7의 적용 범위 해석 |

이전 계획 중 위에서 대체하지 않은 권한·게시·폴더 저장/열기·계획 댓글·세션 종류 잠금은 유지한다. SRT·OpenCode·뷰어·참조 추적·새 패키지·DB migration은 범위가 아니다.

**추가 질의 Q-R5-01:** Coding에서 켠 워크트리의 Work 전송 적용도 끌지 사용자에게 물었다. D-034의 UI 변경은 확정이며, 실행 정책 변경은 답변 전 수행하지 않는다. 기존 draft 선택값을 삭제하지 않고 보존한다.

#### 3. 상태와 전이

| 시작/행동 | 관측 결과 |
|---|---|
| 새 대화 Work↔Coding | tooltip 없이 같은 입력/첨부 유지, normal Hero, Work Git 그룹 부재와 Coding 복귀 |
| Work 빈/일부/다수 내용 | 짧은 외곽→자연 증가→해당 영역만 최대치와 내부 스크롤. 다른 영역으로 잉여 높이 이전 없음 |
| 양 모드 작업 클릭/Back | overview가 화면·키보드에서 숨고 전체 상세가 표시됨. Back은 목록·문서·섹션 상태와 초점을 복원 |
| 상세 중 새 완료/선택 작업 삭제 | 보이지 않는 목록을 읽음 처리하지 않음. 선택 삭제 시 overview로 복귀 |
| 다른 세션 정상 완료 | 해당 행의 모드 아이콘만 파란색. 현재 열린 세션 완료·중간 메시지·오류/중단은 새 완료 표시를 만들지 않음 |
| 표시된 세션 열기/다른 곳 이동 | 열기에서 확인 처리. 다른 곳으로 이동해도 예전 완료가 다시 켜지지 않음 |
| 목록 재조회/삭제/앱 재시작 | 완료 표시는 재조회에 유지, 삭제 시 정리. 이번 앱 실행 동안의 transient 상태이며 DB 형식은 유지 |

#### 4. Acceptance Criteria

| AC | 관측 기준 | 실제 도달 경로·oracle |
|---|---|---|
| AC-R5-1 | 두 랜딩 tooltip 없음·Hero normal, 크기/순서/파랑·동일 입력 보존 | 두 페이지→AgentModeToggle, 실제 DOM·computed style·click |
| AC-R5-2 | Work Git 그룹/조회 부재와 add-dir 빈자리 제거, Coding 표시/선택 보존 | Composer→CwdPanel→BranchChip, 실제 mock IPC 호출·좌표 비교 |
| AC-R5-3 | Work 확대/출력 모두 저장 제거, 케밥/개별 저장·Coding chrome 유지 | RightPanelTile·ArtifactCards 실제 DOM/클릭 |
| AC-R5-4 | 양 모드 동일 작업 테마·진행 애니메이션·전체 depth/Back | 실제 목록 computed style·상태 행렬·두 패널 클릭/키보드 |
| AC-R5-5 | 모든 채팅 목록의 종류 아이콘·완료 파랑·열기 확인·비열람 조건 | 정상 종료 이벤트→완료 표시 상태→SessionRow, 라우트/목록 재조회·삭제 검사 |
| AC-R5-6 | Work 제목이 폭 내 한 줄 ellipsis, 전체 이름/동작 유지 | 작업/출력/폴더 실제 DOM·scrollWidth/clientWidth·title/aria |
| AC-R5-7 | Work 빈 외곽 축소·내용 자연 증가·각 영역 1/3 cap/내부 scroll, Coding 높이 유지 | 실제 RightPanel 부모/카드/section border-box와 창 크기 변경 |
| AC-R5-8 | 상세 전환의 문서·댓글·목록·출력·Context·질문·선택 캐시 수명 보존 | 실제 두 패널 DOM identity/scroll/focus + 기존 store/댓글/게시 회귀 |

### Part II — Technical Design

#### 5. 현재 구조와 최소 변경

| 조사 | 현재 관측 | 변경 |
|---|---|---|
| AgentModeToggle / CwdPanel | 두 페이지가 공유. tooltip wrapper와 font-bold가 있고 BranchChip은 종류와 무관하게 mount | tooltip/설명 연결 제거·font-normal. BranchChip 전체 Coding 조건부 생성; CwdButton·추가 폴더·plus 순서 유지 |
| RightPanelColumn / Tile | Work도 전체 flex 높이, absolute 확대 버튼 | 기존 row available height에 CSS size container. Work 카드만 자연 높이/max-height, 확대 chrome 삭제 |
| TaskTileSections / Output | 섹션 수명은 로컬, output 소유자는 구독·pagination 유지 | 세 section의 border-box max-height를 cqh/3, header 고정·body scroll. ArtifactCards list variant의 모두 저장만 제거 |
| WorkTaskProgress / TaskProgressList | 작업 행 CSS·inline/전체 detail 경로가 각각 존재 | 한 작업 행 컴포넌트·numbered badge CSS. in_progress 외곽 spin은 reduced-motion 준수. 질문 port는 Work에서만 제공 |
| TaskTileContent / PlanTileContent | r4 Work만 hidden/inert overview+형제 detail. Coding은 하단만 교체 | 작은 로컬 TaskPanelContent로 선택/Back/삭제/ack/focus 공유. overview를 mounted 유지, PlanDocument ref 범위 유지 |
| SessionRow / sessionsStore | 모드 텍스트·chat icon. 완료 미확인 상태 없음 | 공식 SVG registry 추가, 세션별 transient 표시. 정상 완료 신호와 실제 열람 라우트를 app 경계에서 연결 |

새 범용 router·패널 플랫폼·이벤트 저장소를 만들지 않는다. 작업 제목·번호·상태 파생은 기존 taskBoard가 소유하며 표현과 상세 화면 전환만 공유한다. Work의 section별 scroll owner와 Coding 문서 scroll은 상세 전환 후 복원한다.

##### 완료 표시 경계

정상 완료는 기존 `turn.ended`/`turnEndTick` 신호를 사용하고 중간 `message.completed` 또는 무조건적인 busy 종료로 추정하지 않는다. 열람 여부는 `useSessionHandlers`가 계산하는 실제 `/chat/:sessionId`와 draft 상태를 기준으로 하며, 다른 화면에 남아 있는 chatStore.activeKey만으로 판정하지 않는다. app 계층이 chat/sessions를 조립하고 feature 교차 import와 매 delta 전체 세션 스캔을 피한다.

표시 상태는 목록 메타데이터와 분리해 재조회가 지우지 않도록 하고, 삭제/구독 해제/늦은 이벤트를 검사한다. 모드 아이콘은 shared Icon의 새 이름으로 추가해 다른 terminal/todo 사용처의 모양을 바꾸지 않는다. Google 공식 material-design-icons의 terminal_2/checklist SVG 출처·라이선스를 구현 기록에 남긴다.

#### 6. ΔV5 nodes / pairs

| Pair | 같은 레벨 노드↔검사 | provenance / requiredness | production path / EP / 직접 oracle |
|---|---|---|---|
| VP-R5-01 | R-R5-01↔AT-R5-01 (AC1/2/3) | CHANGED / REQUIRED | kind→두 랜딩/Composer/chrome, EP1/2, DOM·실제 조회/좌표 |
| VP-R5-02 | R-R5-02↔AT-R5-02 (AC4/6/7) | CHANGED / REQUIRED | 작업/내용→row/전체 detail/section, EP2/3, computed style·border-box |
| VP-R5-03 | R-R5-03↔AT-R5-03 (AC5) | NEW / REQUIRED | 완료→비열람 아이콘→열기, EP4, actual event/route/color |
| VP-R5-04 | SD-R5-01↔ST-R5-01 | CHANGED / REQUIRED | overview→detail→Back/delete/cache, EP3, DOM/scroll/focus/ack |
| VP-R5-05 | SD-R5-02↔ST-R5-02 | NEW / REQUIRED | 완료/현재route/재조회/삭제→미확인 표시, EP4, 이벤트 순서·동일세션/타세션 |
| VP-R5-06 | AR-R5-01↔IT-R5-01 | CHANGED / REQUIRED | 공통row/shell→두 panel, EP2/3, 두 소비처 실제 렌더·수명 |
| VP-R5-07 | AR-R5-02↔IT-R5-02 | NEW / REQUIRED | chat 완료+app 열람→sessions→각 목록, EP4, feature 조립과 실제 행 |
| VP-R5-08 | MD-R5-01↔UT-R5-01 | CHANGED / REQUIRED | kind/작업상태/선택 파생→표현, EP1/3, 경계 행렬·삭제/키보드 |
| VP-R5-09 | MD-R5-02↔UT-R5-02 | NEW / REQUIRED | 완료/확인/삭제 상태 전이, EP4, 중간·오류·활성 대조 |
| VP-R5-10 | ΔV4 VP-R4-01/02/04/08/09/10 | INHERITED / REGRESSION | 영향받은 입력/권한선택/계획댓글/게시/Context/수명, EP1/2/3/4 |

검사는 실제 click·event·style·bounds를 직접 관측한다. 구조 문자열 존재만으로 완료/배치를 판정하지 않으므로 새 mutation은 선택하지 않는다. 과거 토글/Hero 슬롯 순서 단언은 유지하며 fixture의 바뀐 요구(굵기·확대·Git 표시)만 명시적으로 갱신한다.

#### 10. 강제 지점과 운영 gate

| EP | N / 전수 대상 | 실패 의미 |
|---|---|---|
| EP1 | 6 — AgentModeToggle, NewChatLandingPage, ProjectLandingPage, CwdPanel kind 경계, BranchChip mount/조회, add-dir flex 배치 | 숨은 tooltip/조회·입력 remount·빈자리 |
| EP2 | 4 — RightPanelColumn available 높이, RightPanelTile Work chrome/외곽, ArtifactCards list 저장, TaskOutputContent 소비 | Coding 높이 변경·Work 확대 잔존·개별/트랜스크립트 저장 유실 |
| EP3 | 10 — 공통 row/status, 제목/blockedBy, Work 질문 port, TileSection cap/scroll, 공유 전체 depth, Back/삭제, focus/각scroll/ack, Output/Context mounted, PlanDocument/댓글 범위, selected/store/cache/kebab/key | 목록 CSS 분기·장문 넘침·blank 공간·댓글/구독/선택 유실 |
| EP4 | 6 — 정상 종료 생산자, app 실제열람 조립, transient 완료/확인, 재조회/삭제 수명, SessionRow 종류/색, recent/pinned/project/draft 소비 | 잘못된 완료/활성 기준·unread 재생·일부 목록 누락 |
| EP5 | 6 — r5 계획, root plan 메타, r4 대체 연결, INDEX, impl-r5와 증거, 현재 rendering/state·commit trailer | 결정/구현 상태 사본 불일치 |

분모는 표에 명시한 논리 경계이며 구현자는 실제 검색으로 각 경계의 모든 소비처를 다시 대조한다. 영향 Vitest·node/web/test 타입·전체 lint·production build·실제 Windows Chromium 인수·inventory/prose/links·diff·trailer 파싱을 수행한다. 설치 Electron SQLite ABI를 유지하며 실제 모델 호출·사용자 DB·외부 Explorer 실행을 인수 증거로 주장하지 않는다.

#### 11. READY 대조

D-033→AC1, D-034→AC2, D-035→AC3, D-036→AC4/8, D-037→AC5, D-038→AC6, D-039/040→AC7/8을 대조했으며 충돌은 없다. 최신 조건과 반대인 r4 Hero bold·랜딩 Git 표시·Work 확대·Coding inline 상세·전체 높이만 대체한다. Q-R5-01은 확정한 표시 변경과 분리했으며, 답변 전 실행 정책을 바꾸는 근거로 사용하지 않는다.

후속 사용자 피드백은 ΔV6(§25)가 부분 대체한다. Git 조회/캐시의 최종 정정은 ΔV6가 정본이다.

## 25. Plan r6 — 랜딩 Git 캐시와 권한 메뉴 보완

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE**, Codex 자기확인 **4/4**. 구현 보고 r6, 독립 verify pending. 기준은 원격 `39a37c20`의 V1~ΔV5이며 이번 사용자 피드백을 **ΔV6**로 적용한다. 사용자 지시에 따라 handoff-review는 사용하지 않는다.

### Part I — Product & UX Contract

#### 1. 결정과 출처

| ID | ACTIVE 결정 | 대체/보존 |
|---|---|---|
| D-041 | 비열람 완료의 nav SVG는 기존 파란색과 함께 굵게 표시한다. 열람 후 원래 굵기·색으로 복원한다. | D-037 보완, 완료/확인 수명 유지 |
| D-042 | 랜딩의 `<`, `/`, `>`는 같은 폰트·크기·굵기로 표시한다. Hero normal과 아이콘 크기·배치는 유지한다. | D-033 보완, SVG 꺾쇠를 문자로 대체 |
| D-043 | Git 조회는 Coding에서 시작한다. Work로 전환해도 진행 중인 응답과 결과를 유지하고 같은 cwd의 Coding 복귀는 캐시를 즉시 표시한다. | 최종 사용자 정정. D-034의 unmount/조회 취소 대체 |
| D-044 | Coding의 cwd가 있으면 초기 브랜치 확인 중 `-`를 즉시 표시한다. 확인된 non-Git/실패는 그룹을 숨기고, Git이면 실제 브랜치 또는 detached 라벨을 표시한다. | 지연 mount 대체. Work는 그룹이 없어 add-dir가 빈자리 없이 당겨짐 |
| D-046 | 모델 계열은 haiku·sonnet·opus·fable을 인식하며 버전 구분자는 점과 하이픈을 모두 허용한다. 모델 discovery 분류와 자동 승인 판정에 같은 계열 목록을 사용한다. | 최신 사용자 보완. 4.6/4-6 동일 의미, 기본 alias/env 추가는 아님 |
| D-045 | 두 모드의 자동 승인 메뉴는 확인된 비커스텀 Claude 4.6 이상에만 표시한다. 4.5 이하·custom·모델 미확정은 메뉴에서 제외한다. | r4 정책을 실제 선택 카탈로그/메뉴 경로에서 보완 |

사용자는 “Git 조회는 코딩 트리거시 동작”, “그 순간 work 트리거시에도 결과는 갖고있어야 함”, “캐싱되어 coding으로 다시 트리거시 바로 출력”으로 최초 질의를 정정했다. 따라서 Work 최초 진입은 조회하지 않지만 Coding에서 시작한 조회를 Work 전환으로 취소하지 않는다. cwd 변경 시 다른 폴더의 브랜치를 표시하지 않으며 명시 checkout 이후에는 갱신한다.

Q-R5-01의 Work 전송 시 worktree 적용 정책은 이번에도 변경하지 않는다. 변경은 표시·조회 수명과 권한 메뉴 후보이며 Main의 기존 모델 discovery 분류와 공용 버전 판정은 최신 요청에 맞춰 확장한다. 새 provider·env key·IPC·DB·의존성은 추가하지 않는다.

#### 2. 인수 기준

| AC | 관측 결과 | 실제 경로/검사 |
|---|---|---|
| AC-R6-1 | 미확인 완료 SVG가 파랗고 굵으며 열면 둘 다 복원 | SessionRow→Icon, 실제 SVG computed style·기존 완료 store 회귀 |
| AC-R6-2 | 세 문자의 font family/size/weight 일치, 기존 토글·Hero 정상 | 공용 AgentModeToggle→두 랜딩, DOM/style/click |
| AC-R6-3 | 첫 Work 조회 0, Coding 초기 `-`, Work 전환 중 응답 보존, Coding 복귀 즉시 캐시/중복 조회 0 | CwdPanel→BranchChip→지연 gitApi.status, cwd 교체/실패/nonrepo/detached 대조 |
| AC-R6-4 | Haiku/Sonnet/Opus/Fable의 점·하이픈 버전 경계·custom·미확정의 메뉴 제외, 4.6 이상 양성, Work/Coding 동일 적용 | selectedModelShape→modeMenuOptions→실제 ModeMenu, 실제 Composer 경로/native |

### Part II — Technical Design

#### 3. 조사와 최소 구현

| 대상/검색 | 전수/원인 | 변경 |
|---|---|---|
| `BranchChip` production 소비처 | CwdPanel 한 곳. mode 조건부 mount가 snapshot과 진행 중 effect를 버림 | 항상 mount하고 hidden 입력으로 표시/조회 시작만 제어. 한 cwd snapshot과 요청 identity를 유지하고 stale 결과는 차단 |
| `AgentModeToggle` | 두 랜딩의 공용 구현. 꺾쇠는 SVG, 슬래시는 문자 | 세 문자를 같은 class로 렌더 |
| `SessionRow` | 공용 목록 행. 완료 상태에 색만 적용 | 완료 상태의 SVG에만 currentColor stroke를 더해 굵기 강화, 원래 Material path 보존 |
| `modeMenuOptions` | Composer 한 소비처. 버전 판별은 이미 shared에 있으나 selectedModelShape가 isCustom을 버림 | 카탈로그의 isCustom을 후보 판정에 전달. 선택 원천 미확인은 자동 후보에서 제외 |

숨긴 BranchChip은 UI와 overlay를 반환하지 않지만 조회 결과를 받는다. 새 캐시 서비스·범용 lifecycle 모듈을 만들지 않으며 같은 mounted 인스턴스 내 snapshot만 사용한다. 초기 placeholder는 disabled이고 확인 후 기존 브랜치 선택·워크트리 유예 동작을 재사용한다.

#### 4. ΔV6 pair

| Pair | 같은 레벨 노드↔검사 | 속성 | 직접 oracle / EP |
|---|---|---|---|
| VP-R6-01 | R-R6-01↔AT-R6-01 (AC1/2) | CHANGED/REQUIRED | native SVG/font style·확인 복원, EP1/2 |
| VP-R6-02 | R-R6-02↔AT-R6-02 (AC3/4) | CHANGED/REQUIRED | 지연 IPC와 실제 mode/cwd/menu 조작, EP3/4 |
| VP-R6-03 | SD-R6-01↔ST-R6-01 | CHANGED/REQUIRED | Coding→Work pending→Coding cache·cwd race, EP3 |
| VP-R6-04 | AR-R6-01↔IT-R6-01 | CHANGED/REQUIRED | 실제 선택 shape→후보→메뉴, 공용 컴포넌트 양 소비, EP2/4 |
| VP-R6-05 | MD-R6-01↔UT-R6-01 | CHANGED/REQUIRED | 버전/custom 경계·loading/nonrepo/detached, EP3/4 |
| VP-R6-06 | ΔV5 VP-R5-01/03/05/08/10 | INHERITED/REGRESSION | 입력/종류 잠금·완료 확인·권한/checkout·패널 회귀 |

검사는 실제 DOM·computed style·지연 응답을 사용한다. 별도 mutation은 선택하지 않으며 수정 전 RED와 수정 후 직접 행동 대조를 보존한다. 비영향 Work 높이/전체 상세 결정은 ΔV5를 유지한다.

#### 10. 강제 지점과 운영 gate

| EP | N / 실제 지점 | 실패 의미 |
|---|---|---|
| EP1 | 2 — SessionRow 완료 SVG·열람 복원 | 색만 변경/모든 아이콘 굵기 변경 |
| EP2 | 3 — 공용 Toggle·새 랜딩·프로젝트 랜딩 | 문자 폰트 불일치/한 페이지 누락 |
| EP3 | 5 — CwdPanel mount/hidden·조회 시작/캐시·pending 응답/수명·초기 placeholder/비Git·checkout/유예 | Work 선조회/응답 유실·중복/잘못된 cwd·기존 선택 회귀 |
| EP4 | 5 — Main discovery 계열 분류·선택 카탈로그 shape·custom/불명 후보·공유 버전 판별·두 모드 실제 메뉴 | canonical 이름 custom 허용·옛 버전 노출·지원 모델도 숨김 |
| EP5 | 4 — r6 계획/root·INDEX/r5 대체 링크·보고/증거·현재 rendering 문서/trailer | 상태/결정 불일치 |

영향 Vitest와 기존 renderer 회귀, node/web/test 타입, 전체 lint, production build, 실제 Windows Chromium의 대상 동작 인수, inventory/prose/links·diff·trailer 파싱을 수행한다. Electron SQLite ABI와 사용자 데이터는 유지한다.

#### 11. READY 대조

D-041→AC1, D-042→AC2, D-043/044→AC3, D-045/046→AC4를 대조해 충돌 0이다. 마지막 Git 정정이 조회 수명과 캐시 oracle에 반영됐고 r5의 Work 조회 0은 최초 진입에만 남는다. 원격 r5의 완료 표시는 색만, 꺾쇠는 SVG, BranchChip은 조건부 mount, 모델 shape는 isCustom 누락임을 코드에서 확인했다.

후속 모델명 변형·Work 표시 보완은 ΔV7(§26)이 우선하며 나머지 결정은 유지한다.

## 26. Plan r7 — 모델명 변형과 Work 표시 보완

작성: **Codex**, 2026-09-09. 상태: **impl/IMPL_DONE**, Codex 자기확인 **3/3**. 구현 보고 r7, 독립 verify pending. 기준은 원격 r6 `86d47e04`의 V1~ΔV6이며 이번 피드백은 ΔV7이다. 사용자 지시대로 handoff-review는 사용하지 않는다.

### Part I — Product & UX Contract

| 결정 | 사용자 결과 | 승계 |
|---|---|---|
| D-047 | 사용자 정정의 `claudecode-sonnet-5`, `claudecode-opus-4.8`, `claudecode-opus-4.8[1m]`을 지원한다. claude/claudecode 접두사, 네 계열과 버전, 점·하이픈 구분자를 인식한다. | D-045/046의 모델명 형식 확장. 4.6 이상·custom/미확정 제외 유지. 최종 정정으로 계열 생략/하이픈 누락 지원은 제외 |
| D-048 | Work의 현재 권한 버튼은 팝업과 동일한 수동 승인·자동 승인·모든 승인 건너뛰기 라벨을 사용한다. | Coding 라벨·승인 의미·bypass 확인 유지 |
| D-049 | Work 출력 목록 항목 간격을 줄인다. | 출력 행만 gap 8→4px, 세로 padding 8→4px. 트랜스크립트 카드·개별 동작·영역 상한 유지 |

사용자가 최종 세 번째 ID를 `claudecode-opus-4.8[1m]`으로 정정해 확정했다. 내부 개행을 임의로 지우거나 모델 ID를 SDK 전달 전에 바꾸지 않는다.

| AC | 행동 기준 | 실제 경로/검증 |
|---|---|---|
| AC-R7-1 | 명시한 모델명 변형과 1M이 두 모드에서 자동 승인 후보가 된다. 4.5 이하·잘못된 문자열·custom은 제외된다. | 공용 판정→Main settings/runtime 분류→선택 shape→메뉴, 공용 실행 permission coercion 테스트와 실제 Composer |
| AC-R7-2 | Work 선택 후 버튼과 메뉴의 라벨이 같고 Coding의 기존 라벨은 유지된다. | permissionModeLabelKey/WORK_MODE_OPTIONS→Composer, 실제 선택과 표시 |
| AC-R7-3 | 출력 행 사이 간격과 행 padding이 줄고 메뉴·말줄임·상태 표시는 유지된다. | TaskOutputContent→ArtifactCards list→ArtifactCard, 실제 native bounds/style |

### Part II — Technical Design

| 조사 대상 | 현재 관측 | 최소 변경 |
|---|---|---|
| supportsAutoPermission / classifyModel | 공용 regex는 claude-계열-버전만 허용한다. 최종 세 모델은 Main에서 이미 sonnet/opus로 분류된다. | 기존 공용 정규식의 접두사에 code를 선택적으로 허용한다. Main 분류와 ID 원문은 그대로 유지한다. |
| permissionModeLabelKey | Work bypass만 메뉴 라벨을 사용한다. Composer 소비 1곳. | Work 카탈로그에서 해당 mode의 labelKey 조회, 기존 카탈로그 fallback 유지. |
| ArtifactCards list | production 소비는 TaskOutputContent 1곳. gap-2와 py-2가 누적된다. | list 분기에 gap-1/py-1만 적용. 다른 variant는 그대로 둔다. |

네 계열 분류의 기존 부분문자열 호환은 유지하되 자동 승인은 전체 문자열이 공용 문법과 버전 기준을 통과해야 한다. 기본 alias/env·IPC·DB·의존성 추가는 없다. 목록의 비동기 수명·저장/삭제와 Git 캐시는 바꾸지 않는다.

### V pair와 §10 강제 지점

| Pair | 노드↔검사 | 속성 | 직접 oracle / EP |
|---|---|---|---|
| VP-R7-01 | R-R7-01↔AT-R7-01 | CHANGED/REQUIRED | 실제 Composer 모델별 메뉴와 Work 선택 라벨, 출력 bounds/style / EP1~3 |
| VP-R7-02 | AR-R7-01↔IT-R7-01 | CHANGED/REQUIRED | Main settings/runtime 모델→카탈로그→선택→메뉴, 문자열 identity 보존 / EP1 |
| VP-R7-03 | MD-R7-01↔UT-R7-01 | CHANGED/REQUIRED | 이름/버전 양·음성, permission coercion, 메뉴/버튼 라벨 / EP1~2 |
| VP-R7-04 | ΔV6 VP-R6-05/06 | INHERITED/REGRESSION | 기존 권한/모델 선택·출력 카드/상태/개별 동작 검사 |

| EP | 지점 수와 대상 | 실패 의미 |
|---|---|---|
| EP1 | 4 — 공용 이름/버전 판정, Main settings/runtime 공용 분류, 카탈로그/메뉴, 실제 실행 coercion | 메뉴만 열리거나 Main custom 판정 때문에 계속 숨김 |
| EP2 | 2 — Work 카탈로그/버튼 라벨, Coding 라벨 회귀 | 버튼과 메뉴가 불일치하거나 Coding 문구까지 변경 |
| EP3 | 2 — list 행 padding, 목록 gap/트랜스크립트 대조 | 바깥 여백만 줄이거나 트랜스크립트까지 축소 |
| EP4 | 4 — r7/root, r6 대체 링크/INDEX, 보고/증거, 현재 문서/trailer | 상태 사본 불일치 |

검사는 실제 반환값·메뉴 선택·DOM/style을 사용한다. 별도 mutation은 선택하지 않는다. 영향 Vitest, node/web/test 타입, 전체 lint, production build, Windows Chromium 인수, inventory/prose/links·diff·trailer를 확인한다. 새 외부 모델 실행과 사용자 DB는 필요하지 않다.

READY 대조: D-047→AC1, D-048→AC2, D-049→AC3. 기존 custom 제외는 명시 custom 메타를 유지하며 인정 모델 형식만 확장한다. Q-R5-01은 계속 미결이며 이번 변경과 독립이다.

## 27. Plan r8 — Work / Code 명시적 정책과 조립

작성: **Codex**, 2026-09-09. 상태: **verify/PASS**. Codex 자기확인과 증거는 구현 보고 r8에, 독립 검증 판정은 [verify.md](verify.md)에 있다. 설계 기준은 `4e9e51fa`의 READY 문서다. 사용자가 구조 진단 이후 “Plan 문서를 업데이트하고 구현을 이행하라”고 지시했다. 기준은 `0c24aaa2`의 V1~ΔV7이며 이번 변경은 **ΔV8**이다. 기존 사용자 지시에 따라 handoff-review는 사용하지 않는다.

### Part I — Product & UX Contract

#### 결정과 승계

| 결정 | 사용자 요구 / 구현 계약 | 상태·연결 |
|---|---|---|
| D-050 | “에이전트 구분을 work, code … 내부 변수도 및 표현도 coding을 code로 변경” — 현재 내부 종류·IPC 출력·저장값·종류 라벨/키를 code로 이행한다. 외부 Claude Code/OpenCode 식별자와 과거 증거는 보존한다. | ACTIVE, AC1·2 |
| D-051 | “if else의 형태로 work를 그때그때 처리하지말고 구조적인 레이어” — 종류별 정책을 소유 모듈에 명시하고 실행/화면 조립에서 선택한다. | ACTIVE, AC3·4 |
| D-052 | “가능한한 Work가 아니면 code agent이다 라는 형태로 구조를 가져가지 말것” — 두 종류 모두 완전한 정의를 갖고 unknown은 거부한다. 구형 coding/필드 누락은 명명된 읽기 경계에서만 변환한다. | ACTIVE, AC1·3 |
| D-053 | 경량 리팩토링·회귀 방지 — 기존 실행기·카드·store·캐시·마운트 수명을 보존한다. 새 기반 클래스·동적 등록·모델 호출·watcher·의존성을 만들지 않는다. | ACTIVE, AC4~7; D-002 승계 |
| D-054 | 현재 계획을 갱신하고 구현한다. plan·impl·커밋의 작성자는 Codex다. | ACTIVE, 문서/커밋 gate; D-006 승계 |

D-050은 V1의 `coding` 종류 이름·기본값·DB/IPC 어휘를 대체한다. 새 대화 기본 선택은 code이며 Work의 반대 분기에서 추론하지 않는다. 첫 전송 이후 종류 고정·분기/핸드오프 상속과 ΔV2~7의 배치·권한·모델 판정·Git 캐시·추가 폴더 정책은 유지한다. Q-R5-01의 Work 전송 시 worktree 적용 여부는 변경하지 않는다.

#### 동작과 실패

| 시작 / 상태 | 결과 |
|---|---|
| 새 대화 선택 | 좌 Work / 우 Code. 종류 라벨은 작업/코드, 기존 히어로·아이콘·툴팁 없음·색상·폰트 유지. 입력·첨부·cwd 보존 |
| 기존 DB 업그레이드 | coding 세션은 code, work는 work. ID·메시지·검색·lineage·게시 참조 보존 |
| 현재 IPC·메모리에서 정상 종류 | 그 종류의 명시 정책을 선택. 현재 목록/로드 출력에는 필수 종류 포함 |
| 지원하는 구형 읽기 데이터 | 정확한 coding 또는 문서화한 필드 누락만 code로 변환. arbitrary 문자열·오염된 값은 오류 |
| Main 종류 불일치 / 비동기 사이 상태 변화 | 기존 admission 오류·busy·경로 검사 유지. 다른 종류로 대체하거나 권한 확대하지 않음 |
| Code→Work→Code | Git BranchChip 마운트 유지. Work에서 새 조회는 시작하지 않고 이미 시작한 결과와 같은 cwd 캐시는 보존 |
| 패널 닫기 / 세션 이동 / 스트리밍 | raw 패널 상태·상세·스크롤·투영 캐시의 기존 소유자 유지. 표시 정책만 파생 |

#### Acceptance Criteria

| AC | 관측 가능한 결과 | 실제 경로·oracle |
|---|---|---|
| AC-R8-1 | code/work 정상 입력은 그대로, 구형 coding은 정해진 읽기 경계에서 code, unknown은 오류. 현재 종류 라벨/키/IPC 출력은 code 사용 | shared parser→Main admission/DTO→renderer load·draft→nav/toggle; 종류·프로토콜·store 및 실제 렌더 |
| AC-R8-2 | 업그레이드/빈 DB에서 값·기본값·CHECK가 code/work이며 데이터·FK·검색·재열기 보존 | 실제 migration→queries→reader/DTO→close/open; SQLite fixture |
| AC-R8-3 | Work와 Code의 권한·세션 능력·UI/패널 정의가 각각 완전하며 소비자가 선택 결과를 사용 | 실제 정책→permission coercion/menu·reducer·패널 파생의 반환값; 타입 누락 검사 |
| AC-R8-4 | 정상/자동 연속 턴의 종류·지침·warm key·도구 경로 및 Work 표시 경계 기록이 유지 | send/resolve→profile→extensions/runtime, coordinator→writer; 기존 통합/경계/respawn 시험 |
| AC-R8-5 | 기존 Work/Code 메뉴·본문·패널·상세 진입·nav 표시가 같은 역할로 연결 | 실제 Composer/ApprovalCard/AssistantTurn/RightPanel/SessionRow 렌더와 클릭; native fixture |
| AC-R8-6 | 토글·조회 중 전환·패널 닫기·세션 이동 후 입력/폴더/Git 캐시와 종류 계승 유지 | BranchChip deferred 응답, store/reducer·fork/handoff·패널 수명 시험, native |
| AC-R8-7 | 정의 선택은 정적 참조를 재사용하고 기존 Work 투영/memo·가상화·실행 재사용을 보존 | policy 동일 참조·기존 identity/수명/respawn 동작 시험. 성능 향상 수치는 주장하지 않음 |

### Part II — Technical Design

#### 모듈 책임과 변경 경로

```text
입력 / DB 읽기 → 종류 검증 (work | code)
   ├ shared permission-mode / agent-session-policy: 공용 순수 정책
   ├ Main profiles → app 실행 조립 → 기존 extensions/runtime/history
   └ Renderer agentPresentation / panel policy → 기존 화면 조립 → 공통 부품
```

| 소유자 / 파일 | 구현 |
|---|---|
| shared `agent-kind.ts` | canonical enum/type, strict parser, 명시 legacy reader. 새 출생 기본값과 legacy 읽기를 분리한다. current wire는 code/work만 허용 |
| shared `permission-mode.ts` | `Record<AgentKind, ...>`의 모드 정착표·계획 승인 목표·자동 미지원 대체. kind 인자를 필수로 받고 기존 모델 지원 판정을 재사용 |
| shared `agent-session-policy.ts` | `allowDirectoryUpdates`, `directoryIdentity: windows/exact`, `allowContextFileOpen`을 양쪽에 명시. 실제 busy·path·소유권 검증은 Main 경계에 남김 |
| Main profiles / app | code/work 프로필을 명시하고 실행 준비에서 response-boundary 정책을 전달. 지침 bytes·Work key·Code의 지침/key 없음 유지. Main feature 교차 import 금지 |
| DB / history / IPC | 후속 0023 migration; row 읽기 검증; 현재 목록/로드의 필수 kind. optional send는 신규 기본/기존 상속 의미 유지. preload typed bridge 재사용 |
| Renderer `agentPresentation.ts` | icon/navIcon/label/greeting/placeholder와 composer/transcript 선택 값을 명시. 컴포넌트 import 없는 순수 값 정의 |
| `rightPanelTiles.ts` / layout / registry | 양쪽 visibleIds/taskTarget/taskBadgeTile/columnMode/chrome 명시. 기존 component registry 유지, raw column 상태는 변환하지 않음 |
| Composer / 카드 / 본문 | 상위에서 선택한 Git 표시·본문 투영·상세 진입 값을 사용. 공통 leaf에는 필요한 semantic prop만 전달. 새 전역 Provider 없음 |
| store / reducer / nav | 내부 kind 기본 인자·non-work fallback 제거. draft selector에는 strict parse. app→sessions 표시 props 전달로 chat↔sessions 교차 import 방지 |

정적 선언 예시는 아래와 같다. Code는 전체 목록에서 Work를 제외해 계산하지 않는다.

```ts
const policy = {
  work: { allowDirectoryUpdates: true, directoryIdentity: 'windows', allowContextFileOpen: true },
  code: { allowDirectoryUpdates: false, directoryIdentity: 'exact', allowContextFileOpen: false }
} as const satisfies Record<AgentKind, AgentSessionPolicy>
```

#### 저장 이행과 오류

0022는 변경하지 않는다. 0023은 sessions에 code/work CHECK를 가진 임시 이름의 컬럼을 추가하고 정확히 coding→code, work→work로 복사한 뒤 기존 컬럼 제거/새 컬럼 rename을 수행한다. sessions 테이블 자체와 PK를 유지해 참조 테이블 재생성을 피한다. bundled SQLite에서 이 DDL과 FK·인덱스·검색·재열기를 먼저 fixture로 검증한다.

기존 migrator의 백업·트랜잭션·`DB_SCHEMA_TOO_NEW`를 유지한다. 실패하면 기존 스키마/데이터가 남고 정상 새 스키마로 표시하지 않는다. 현재 migration 완료 후 DB 값과 IPC 출력에는 coding을 쓰지 않는다. 구형 DB/fixture 읽기 호환은 명시한 decoder로 한정하고 preload/UI마다 조용한 기본값을 추가하지 않는다.

#### 수명과 성능

BranchChip은 표시 여부와 관계없이 같은 인스턴스다. Work에서는 hidden으로 새 조회만 중지하며 pending 응답/cwd snapshot 처리 방식은 그대로 둔다. Composer GitRow의 기존 조건부 mount와 Work transcript의 session key remount는 별도 선택 값으로 유지한다.

정책 객체는 모듈 정적 값으로 두고 state에 복제하지 않는다. 모델 지원 능력, backend, product kind는 서로 별도 축이다. policy 선택 때문에 타이머·프로세스·쿼리를 추가하지 않으며 UI 코드 이동이 기존 cache/memo 참조를 깨뜨리지 않는지 직접 동작 시험으로 확인한다.

### V pair / §10 강제 지점

기준 V1~ΔV7의 영향 없는 기능은 승계한다. 아래 NEW/CHANGED 노드만 ΔV8 REQUIRED로, 영향받는 기존 계약은 REGRESSION으로 재확인한다. 변경 없는 실제 모델의 게시 선택(기존 VP-15), SRT/OpenCode 실제 실행은 NOT_REQUIRED이며 이전 인수/미완료 상태를 바꾸지 않는다.

| Pair | 노드↔검사 / provenance | 속성 | 경로·직접 oracle | EP |
|---|---|---|---|---|
| VP-R8-01 | R-R8-01↔AT-R8-01 CHANGED (AC1·2·5) | REQUIRED | 선택/저장/복원→UI의 code/work 결과, migration fixture와 native | 1·2·5 |
| VP-R8-02 | SD-R8-01↔ST-R8-01 CHANGED (AC4·6) | REQUIRED | 초안→send/lease→load/continuation 및 전환/닫기; 기존 상태 보존 | 1·3·6 |
| VP-R8-03 | AR-R8-01↔IT-R8-01 CHANGED (AC1·2·4) | REQUIRED | DB→DTO/reader→current IPC→store 및 profile→runtime 왕복 | 1·2·3 |
| VP-R8-04 | AR-R8-02↔IT-R8-02 CHANGED (AC3·5) | REQUIRED | 정책→Composer/본문/패널/nav 실제 소비와 클릭 결과 | 4·5 |
| VP-R8-05 | MD-R8-01↔UT-R8-01 CHANGED (AC1·3·7) | REQUIRED | strict/legacy 입력표, 양쪽 권한/세션/표시 반환값·참조 | 1·4·5 |
| VP-R8-06 | V1 VP-03/04/05/07/11/14, ΔV6 VP-R6-05/06, ΔV7 VP-R7-03/04 | REGRESSION | 종류 고정·계승·지침·warm·Work identity 및 모델/권한/출력 행동 시험 | 3·4·5·6 |

VP-R8-06은 각 원래 계약의 행동 oracle을 재실행한다. 리팩토링이 변경하지 않는 실행 총량 benchmark/실모델 결과를 이번 속도 개선 증거로 재해석하지 않는다. 구조 검색은 조사 보조이며 `조건문 0`을 완료 oracle로 사용하지 않는다. 모든 pair는 실제 결과 oracle을 사용하므로 별도 결함 변이는 선택하지 않는다.

| EP | 강제 지점 (구현 시 각 소비처 재열거) | 실패 의미 |
|---|---|---|
| 1 | shared enum/parser; send schema/admission; DTO/reader; renderer load/list/draft; 새 출생·선택·일반/busy 전송 | unknown이 code가 되거나 같은 세션에서 종류가 달라짐 |
| 2 | migration 등록/SQL; insert/queries; FK/검색·lineage/게시 참조; 재열기·구형 앱 거부 | 저장 거부·데이터 손실·과거 migration 수정 |
| 3 | send/resolve; lease/context; 최초/자동 extensions/runtime; coordinator/writer; directory/files의 await 전후 guard | 실행/지침/권한/경계 차이 또는 stale 허용 |
| 4 | 공용 permission 정착/plan 목표/auto fallback; Composer 목록/라벨; session capability와 reducer | 메뉴와 실행 불일치·모델 지원 범위 변화 |
| 5 | presentation/toggle/nav; Composer/Cwd/Git; transcript/ApprovalCard/task/subagent; panel visible/target/badge/layout/chrome | 다른 역할 표시 또는 암묵 Code fallback |
| 6 | 입력/초안·추가폴더; pending Git/cwd cache; raw panel state/close; projection/memo/session key | 표시 변경으로 상태·캐시 수명 소멸 |
| 7 | root plan·r8 plan·INDEX; current arch/IPC/i18n; impl 보고·커밋 trailer | 현재 계약/상태/작성자 사본 불일치 |

### 구현 순서 / 검증

1. 종류·DB·UI 행동 시험을 먼저 준비해 기존 coding/unknown 결과를 관측한다. 기존 통합 fixture는 유지하고 새로운 요구의 실패를 확인한다.
2. shared 종류·현재 IPC·DB migration·Main 소비처와 Renderer canonical rename을 이행한다. 영속/외부 제품 이름은 구별한다.
3. 공용 권한/세션 정책, Main 실행 구성, Renderer 표시/패널 구성을 각각 소유 모듈로 모은다. 기존 공통 컴포넌트를 재사용한다.
4. store·nav·leaf의 종류 재해석을 제거하고 strict 경계·semantic prop 연결을 확인한다.
5. 관련 Vitest(ABI 중립), 실제 SQLite(Electron ABI fixture), native Chromium 회귀, node/web/test typecheck, lint, production build를 수행한다. 사용자의 실제 DB는 사용하지 않는다.
6. 현재 IPC/architecture 문서, inventory 재생성/검사, migration append-only·diff·trailer를 확인하고 Codex 구현 보고를 작성한다.

계획과 구현은 별도 커밋이다. 기존 브랜치에서 이어가며 새 worktree·PR·push는 이번 작업에 추가하지 않는다. 독립 verify 결과는 선점하지 않는다.

READY 대조: D-050→AC1·2, D-051→AC3·4, D-052→AC1·3, D-053→AC4~7, D-054→EP7. 기존 Git hidden/cache, Work 권한 라벨, Code 패널 배치와 Q-R5-01 유지가 Part I/II에서 일치한다. 영향 파일·시험 경로는 코드 조사와 구조 진단에서 확인했다.

## [검증자 기입] 파생 이슈

**r8 검증 = PASS.** 판정·증거 원문은 [`verify.md`](verify.md)다. 아래는 현재 PASS를 막지 않는 7건이며 전부 `NON_BLOCKING`이다.

| # | finding | 귀속 | 후속 |
|---|---|---|---|
| D1 | `SessionInsert.agentKind`가 optional이고 `queries.ts:386`이 `?? DEFAULT_AGENT_KIND`를 적용한다 | D-052 인접 | 필수 필드로 좁히면 write 축까지 닫힌다 |
| D2 | `parseAgentKind` 8지점 중 `chatStore.ts:1817`·`bootstrap.ts:934`는 테스트가 잠그지 않는다 | EP-1 | 두 입력이 canonical이라 등가 변이다 |
| D3 | `docs/arch/backend/persistence.md:87`이 이행을 "후속 컬럼 migration"으로 적는다 | EP-7 | 0023이 수행했다고 바꾸면 단독으로 읽힌다 |
| D4 | `[구현자 기입]`이 r1·r2만 담고 r3~r8은 `impl-rN.md`에만 있다 | EP-7 | plan 메타 링크로 증거는 살아 있다 |
| D5 | native fixture `panel:code:retained-dom-scroll-focus`가 Linux/Xvfb에서 red다 | AC-R8-5 | 전이 중 10px 카드 높이를 읽은 샘플링 문제다(verify §13) |
| D6 | `rightPanelTiles.ts:50` `isRightPanelTileId` 참조 0 | 비귀속 | `d542bfc` 산출이며 r8 무관이다 |
| D7 | `check-migrations-appendonly.mjs`가 태그 부재로 git 이력 비교를 skip했다 | 환경 | `git log`로 0022 미변경을 대신 확인했다 |

남은 사람 실기 2건은 verify §8에 있다 — 기존 DB 첫 부팅과 Windows 실물 창 시각 확인이다.
