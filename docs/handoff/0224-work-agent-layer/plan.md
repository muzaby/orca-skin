# Plan — Work·Code 제품 에이전트 계층

## 메타

| 항목 | 값 |
|---|---|
| slug | `0224-work-agent-layer` |
| 작성자 | **Codex** |
| 일자 | 2026-09-08 |
| 상태 | **impl/IMPL_DONE — Codex r8 구조 리팩토링** |
| 코드 조사 기준 | `04953cf781b8c967d4aaef3255752bb721bafeb0` |
| V mode / revision | Delta V / ΔV8 — [r8 구조 계획](structural-plan-r8.md) |
| 기준 V / 유효 V | V1 `51268488` / V1 + [ΔV2](panel-plan.md) + [ΔV3](panel-plan-r3.md) + [ΔV4](panel-plan-r4.md) + [ΔV5](panel-plan-r5.md) + [ΔV6](panel-plan-r6.md) + [ΔV7](panel-plan-r7.md) + [ΔV8](structural-plan-r8.md) |
| 관련 작업 | 0205 Cowork 연구, 0223 게시 도구·작업 패널, 0214 OpenCode 연구 |

현재 변경은 [r8 구조 계획](structural-plan-r8.md)이 우선한다. D-050~054가 종류 이름과 명시적 정책 구성을 갱신한다. 아래 V1의 coding은 이행 전 기준 어휘이며 현재 정본은 code다. 이 문서 본문은 V1 기준선이며 [r2 패널 계획](panel-plan.md)과 [r3 패널 계획](panel-plan-r3.md)의 대체되지 않은 결정·AC·V·강제 지점을 유지한다. 현재 Codex 자기확인은 [구현 보고 r8](impl-r8.md)에 기록했다. [r7 보고](impl-r7.md)는 이전 라운드 증거다. [r6 보고](impl-r6.md)는 이전 라운드 증거다. [r5 보고](impl-r5.md)는 이전 라운드 증거다. [r1 보고](impl.md)·[r2 보고](impl-r2.md)·[r3 보고](impl-r3.md)·[r4 보고](impl-r4.md)는 과거 증거이며 독립 verify는 미수행이다. 0223의 일반 생성물 기준과 미완료 상태는 이 핸드오프로 닫지 않는다.

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
| 유지 결정 | 진행 상황·출력·컨텍스트를 유지. 컨텍스트는 실제 참조한 리소스이며 수집은 다음 단계. 파일 뷰어는 후속 | 앞선 사용자 결정·[0223 UI 계획](../0223-artifact-publisher/ui-plan.md) |
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
- 설계 이력의 DRAFT·문서 전용 표기는 당시 단계의 관측이다. 현재 Codex r1 구현과 자기확인은 [impl.md](impl.md), 현재 디스패치는 INDEX 행이 정본이다. 독립 검증은 아직 수행하지 않았다.

## [구현자 기입]

**Codex r1 구현·인수 보완**. 유효 V는 구현 전 확정한 V1이다. [구현 보고](impl.md)에 설계 리뷰·강제 지점/V-pair·수정 잠금·Product/UX 파생 검토·잠재 문제·게이트/AC·Review Signals를 기록했다. 최초 자동 승인 거부 후 사용자 명시 승인으로 실제 Claude 생성·게시·동시 Coding·앱 재시작 시험을 완료했다. AC 16/16·V-pair 27 SELF_PASS는 구현자 자기확인이며 독립 verify를 대신하지 않는다.

**Codex r2 구현**. 유효 계약은 V1 + [패널 ΔV2](panel-plan.md)다. [r2 구현 보고](impl-r2.md)에 같은 일곱 필드와 ΔV2 AC 8/8 자기확인을 기록했다. r1 결과는 위에 보존하며 독립 verify는 pending이다.

## [검증자 기입] 파생 이슈

아직 없음. Codex 자기확인은 독립 verify가 아니다.
