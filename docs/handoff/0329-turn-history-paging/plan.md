# 0329 · 단계 E — 세션 이력을 턴 단위로 읽기

**DRAFT.** Claude Work의 **작업 → 진행 상황**은 해당 세션이 처리한 모든 정규 작업의 상태를 반영한다. 본문에 최신 한 턴만 떠 있어도 이전 턴에서 만든 작업과 완료 상태가 보인다. 상단 검색에서 일치 메시지로 직접 이동하는 방안은 타당성 검토 단계다.

## 메타

| 항목 | 값 |
|---|---|
| slug / 작성 | `0329-turn-history-paging` · Codex(설계 역할) · 2026-11-20 |
| 입력 | [0325 §6-C·D](../0325-ui-responsiveness-followup/plan.md) · [T01 요청 원문](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md) · [0326 V1 rev 7 §6-E](../0326-transcript-incremental-model/plan.md) |
| 상태 / V | plan/DRAFT · Baseline V · 기준 V 없음 · 이번/유효 V1 rev 3 초안 |
| 조사 기준 | `ccr-d0337fe8-4bexw8`의 `62125eaa` · 0326 verify r2 FAIL · 0327 plan READY |
| 착수 | 계획은 0327 구현 전에 작성한다. 구현 직전 0326 최종 소비 계약·검증 좌표를 §10과 대조한다. 0327 워커 구현은 E의 조회 선행 조건이 아니다. |

# Part I — 제품과 사용자 동작

## 1. 목표

긴 대화를 열었을 때 첫 화면 비용은 표시할 턴의 첫 묶음에 비례해야 한다. 같은 최신 턴 앞에 이력만 더 쌓아도 data 호스트의 본문 읽기, 포트 전송, 창의 검증·변환량이 증가하지 않아야 한다.

## 2. 사용자 의도와 근거

| 출처 | 받아들인 요구 |
|---|---|
| 이번 대화 | “327 구현전에 328 329 330 플랜” → “작성하라”. E 단독 설계 승인. |
| 0325 T01·D-022·D-023 | 최신 페이지·이전 커서·거대 본문 별도 인출·첫 페이지 준비 후 원자 교체. 미로딩 소비자의 동작은 결정 대상으로 인계. |
| 0326 D-044·048·057·058·065·069·083·093, §6-E | “최신 한 턴 → 하단 배치 → 이전 한 턴 앞삽입”. 짧은 턴도 위 방향 입력으로 조회. B가 메시지 ID·안정 블록·보류 이벤트·앵커를 소유한다. |
| 이번 후속 결정 | Work **진행 상황**은 처리한 모든 작업을 세션별로 등록한다. 상단 **검색**은 찾은 메시지까지 이동할 수 있는지와 그 비용을 조사한다. |
| 설계 제안 | 논리 턴과 물리 전송 한도를 구분한다. 구버전 이력의 색인 구축 비용은 §14에서 별도로 계수한다. |

## 3. Decision Ledger

| ID | 상태 | 결정·판정자 | 검증 |
|---|---|---|---|
| D-001 | ACTIVE | 0325 T01 장기와 0326 §6-E를 단계 E 하나로 계획한다. D의 목록 검색·정렬과 W의 장비 허용치는 각 핸드오프가 맡는다. 사용자 이번 턴. | AC1~AC10 |
| D-002 | ACTIVE | 같은 `isTurnStart`가 정의하는 한 턴을 조회 단위로 쓴다. 동일 시각·연속 user·선두 assistant·늦은 결과에서도 B의 메시지 키와 순서를 보존한다. 0326 D-058·083·093. | AC1·2·4·5 |
| D-003 | ACTIVE | 정상 열기는 최신 턴 하단, 과거 조회는 위 방향 한 조작에 한 번, 머리 스피너·앵커·재시도·세션 세대 격리는 E가 소유한다. 0326 §6-E. | AC1·3~5 |
| D-004 | ACTIVE | 실행 호스트 복구에는 온전한 보관 이력을 전달한다. 최초 본문 표시와 복구 요청의 소유자를 분리한다. 0325 §6-C와 현재 복구 호출. | AC7·8 |
| D-005 | SUPERSEDED | rev 1~2의 미결정 묶음. Work 진행 상황은 D-010, 검색 검토는 D-011, 나머지 패널은 D-012로 분리했다. | AC6·7·10 |
| D-006 | ACTIVE | 데이터 호스트가 세션·세대에 결합한 keyset 커서를 발급한다. 창 요청 번호와 출처 세대를 별개로 대조한다. 0326 §6-E의 구현 설계. | AC2~5·9 |
| D-007 | ACTIVE | 저장형·페이지 wire 형상은 §10 설계안이다. 거대 본문과 메시지가 많은 단일 턴은 서로 다른 경계로 계수한다. T01·D-022의 상한을 검증한다. | AC1·2·9 |
| D-008 | ACTIVE | 분기 초안·핸드오프 가용성은 부분 목록 때문에 바뀌지 않는다. 검색을 통해 세션만 여는 현재 경로에도 0326 D-057·074의 일반 진입 규칙을 적용한다. | AC6~8 |
| D-009 | OPEN | 한 논리 턴이 물리 한도를 넘을 때 현재 턴의 나머지를 버튼으로 읽는 안(추천)과 첫 표시 후 같은 턴 안에서만 유휴 시간에 채우는 안 중 사용자 선택. 보통 한 턴을 읽는 동작과 이전 턴 자동 연쇄 금지는 두 안 공통. | AC2·3 |
| D-010 | ACTIVE | 사용자가 Claude Work **진행 상황**에 해당 세션이 처리한 작업 전부를 등록하도록 확정했다. 메시지 페이지 범위와 독립된 세션별 작업 목록이 필요하다. 현재 작업 도구 계약의 완료·제거 규칙은 §5에 명시한다. | AC7·10 |
| D-011 | ACTIVE | 상단 검색에서 일치 메시지로 이동하는 방법·비용을 검토한다는 사용자 요청. 구현 범위는 현행 검색의 세션 열기 보존까지다. 신규 이동 방식 채택은 별도 선택으로 남는다. | AC6 · §5·8·17 타당성 검토 |
| D-012 | OPEN | 0325 D-023 중 Work 진행 상황 이외 우측 패널(계획·자식 작업·OpenCode 개요 등)이 미로딩 항목을 전체 요약할지, 읽은 범위를 표시할지 사용자 결정이 필요하다. | AC7 · Q7 |

갱신 메모 — V1 초안. D-001~004·006~008은 각 행의 AC와 대조했다. 부모 0325 D-023의 상단 제스처·스피너·재시도는 0326에서 구체화됐고, 소비자 범위 결정은 남아 있다.

rev 2에서는 현재 구현된 왼쪽 **최근 대화**와 Claude Work의 **작업 → 진행 상황**을 §5에 표시했다. 메시지 위치로 바로 이동하는 검색은 사용자 선택으로 남는다.

rev 3에서 D-005를 대체했다. Work 전체 세션의 작업(D-010 ↔ AC7)과 기존 검색 진입 보존(D-011 ↔ AC6)을 분리했다. 새 검색 위치 이동을 전제로 한 rev 2의 EP6·Q6·S-E5는 현행 경로 회귀로 좁혔다.

## 4. 현재 요구 검토

0325의 조각 상한은 한 번 전송하는 비용을 제한한다. 현재 `loadPartsStmt`는 그 앞에서 모든 part를 읽으며 §8의 동일한 최신 턴 실험에서 반환 행이 2 → 20,000이 됐다. 창이 이미 받은 큰 배열을 잘라 표시하는 방법으로는 AC1을 충족할 수 없다.

## 5. 사용자 흐름과 상태

**현재 앱에서 여는 경로.** 왼쪽 내비게이션을 펼치면 한국어 UI에 **최근 대화** 목록이 있고, 그 안의 저장된 대화 제목을 누르면 해당 대화로 이동한다. 고정한 대화는 **고정됨**, 프로젝트 대화는 프로젝트 상세 목록에서도 선택할 수 있다. 이미 보고 있는 동일한 대화 제목을 다시 누르면 평상시에는 재조회하지 않고 읽던 위치를 유지한다.

| 실제 조작 | 현재 코드에서 확인한 동작 | 단계 E의 변경 대상 |
|---|---|---|
| **최근 대화**의 제목 선택 | 접은 내비게이션에는 세션 목록이 숨겨진다. 펼친 목록의 행은 `onSelect(session.id)`를 호출하고, 앱은 `/chat/<id>`로 이동한 뒤 다른 세션이면 로드한다. | 기존 목록·대화 선택 경로를 사용한다. 선택 뒤 호스트가 읽는 이력과 대화 상단에서 위로 당길 때의 동작을 바꾼다. |
| 상단 **검색** → **대화 내용 검색…** → 결과 선택 | 발췌문을 찾은 대화로 이동한다. 결과의 메시지 위치는 현재 라우트에 전달하지 않는다. | E는 현재 세션 열기를 보존한다. 해당 메시지로 직접 이동할 때의 방법과 비용은 D-011에서 검토한다. |
| Claude Work 우측 **작업** → **진행 상황** | Work 작업 목록을 표시한다. Claude Code는 작업을 **계획** 타일에서 다루며 OpenCode는 자체 개요를 쓴다. | Work의 목록은 해당 세션 전체가 기준이다. 나머지 패널의 미로딩 이력 정책은 D-012에서 결정한다. |

경로 근거(아래 링크는 조사 기준 코드). [왼쪽 최근 대화](../../../app/src/renderer/src/app/Sidebar.tsx#L155) · [대화 행 클릭](../../../app/src/renderer/src/features/sessions/components/SessionRow.tsx#L244) · [대화 선택](../../../app/src/renderer/src/app/hooks/useSessionHandlers.ts#L98) · [동일 대화 재선택](../../../app/src/renderer/src/app/hooks/useChatRouteSync.ts#L62) · [프로젝트 상세](../../../app/src/renderer/src/pages/ProjectLandingPage.tsx#L122) · [검색 결과 선택](../../../app/src/renderer/src/features/sessions/components/SearchModal.tsx#L71) · [Work와 Code의 타일 정책](../../../app/src/renderer/src/features/chat/harnesses/claude/rightPanel.ts#L7) · [Work 진행 상황](../../../app/src/renderer/src/features/chat/harnesses/claude/rightpanel/TaskTileContent.tsx#L21).

**다음 표는 계획한 동작이다.**

| 시작 상태·입력 | 다음 상태·화면 | 실패·끝 |
|---|---|---|
| 명시적 세션 열기·부팅 진입(open) | 새 활성 세션은 최신 턴 끝 묶음·머리·커서를 한 번에 적용하고 하단에 둔다. 캐시 open도 진입 의도를 한 번만 소비. 동일 활성 항목 재선택은 위치 유지. | 삭제는 기존 미존재 처리. 첫 로드 오류는 기존 오류 경로. |
| 열린 창의 refresh/재접속(sync)·동일 세션 화면 재마운트(resume) | sync는 pin이면 하단, unpin이면 읽던 part의 앵커 유지. resume은 Claude Code·Work 하단, OpenCode는 저장 앵커(pin일 때 하단). | 재검증 중에는 기존 본문·컴포저·패널 유지. 실패는 기존 내용 유지. |
| 위로 읽기, 상단에서 휠·트랙패드 위 입력 또는 명시적인 이전 턴 조작 | 10 → 9 → 8 요청, 화면은 8·9·10 순. 진행 중 같은 커서는 한 요청. 머리에서 상태를 읽을 수 있고 당기기 시작한 part의 같은 글줄을 유지. | 짧아서 스크롤바가 없어도 위 입력으로 시작. 높이 변동·스피너 제거·상단 관찰만으로 다음 요청을 시작하지 않는다. 실패 시 같은 커서 재시도, 끝이면 제어 종료. |
| 한 턴에 메시지·part가 물리 한도를 초과 | D-009 추천안은 현재 턴의 표시 가능한 끝 묶음과 “이 턴의 앞부분 더 보기”를 내고, 같은 턴을 먼저 이어 읽는다. 대안은 동일 턴 잔여를 첫 본문 paint 후 유휴 구간마다 1묶음씩 채우고 취소·세션 전환·사용자 스크롤에서 중단한다. 본문이 큰 메시지는 원 ID의 ‘본문 열기’에서 조각 인출. | 중간 조각을 전체 턴·완료 본문으로 표시하지 않는다. 같은 턴 나머지와 이전 턴 커서를 별도로 보유한다. |
| 조회 중 live 이벤트·세션 전환·삭제·재접속 | 같은 세션의 새 live tail과 미로딩 원 소유 패치는 B 규칙으로 합쳐진다. 전환 후에는 이전 응답을 적용하지 않는다. | A→B→A도 옛 세대 거부. 화면을 읽는 동안 refresh로 이미 본 과거 턴과 선택을 버리지 않는다. |
| 이력 끝 | 마지막 응답의 끝 표식을 소비해 스피너를 닫는다. 빈 세션·한 턴뿐인 세션도 즉시 끝이다. | 이력 끝과 본문 조각의 끝을 따로 표시한다. |

### Work 진행 상황에 등록되는 작업

Work 세션 S에서 정규 작업을 만들거나 갱신하면 S의 작업 ID로 등록한다. S에서 100번째(최신) 턴 하나만 화면에 있어도 17턴에서 생성하고 41턴에 완료한 ‘테스트 수정’은 완료 상태로 보인다. 세션 T에도 같은 ID 7이 있으면 두 세션의 제목·상태·상세를 따로 유지한다.

| 들어온 기록 | 진행 상황의 결과 |
|---|---|
| 최상위 TaskCreate 성공 또는 TaskGet/TaskUpdate의 유효한 상태 | 세션·작업 ID로 등록/갱신한다. 완료는 완료 상태로 목록에 남고 해당 항목의 상세를 열 수 있다. 중복 전송·재열기는 행을 늘리지 않는다. |
| TaskUpdate 삭제 성공, TaskGet이 명시적으로 없음, 권위 있는 TaskList 스냅샷에서 빠짐 | 기존 작업 도구 계약에 따라 현재 목록에서 제거한다. 같은 도구 호출과 결과는 과거 턴에서 계속 조회할 수 있다. |
| 대화에서 이름만 언급, 실패/미확정 도구 결과, 다른 소유자의 하위 호출 | 현행 Work 작업 모델에서 정규 작업 등록 근거가 되는 입력만 받아들인다. 진행 중 백그라운드 실행의 중지·권한은 기존 실행 호스트가 소유한다. |

다른 패널의 정책은 개별 소비자가 필요로 하는 범위에 따라 정한다(D-012). 세션 전체 요약을 보여 주는 안과 현재 읽은 범위임을 표시하는 안이 남아 있다.

### 상단 검색에서 같은 결과를 눌렀을 때 — 타당성 비교

검색 예시에서 63턴에 “센서 A”가 있고 최신 턴은 100턴이다. 사용자가 원하는 차이는 결과를 누른 직후 63턴의 그 메시지가 눈앞에 보이는가이다.

| 방식 | 결과를 누른 직후 | 판단 |
|---|---|---|
| 현재 동작 | 결과의 발췌문을 보고 해당 세션을 연다. 세션 변경 시 기본 진입 규칙에 따라 열리며, 이미 열려 있던 세션이면 읽던 위치를 유지한다. | 기존 동작. E의 검색 회귀 기준. |
| 작은 변경안 · 현재 전량 로드 활용 | 전체 이력이 창에 이미 준비된 뒤, 결과 ID를 표시 메시지 키로 해소해 그 메시지를 찾아 가상 목록에 띄우고 행에 초점을 준다. | 긴 대화의 첫 열기 비용은 그대로다. E 이전에 검증할 수 있지만 E의 첫 paint 상한을 위한 최종 조회 경로로 쓰기 어렵다. |
| 턴 색인을 이용하는 변경안 | 결과를 눌렀을 때 data가 안정 키로 63턴의 해당 메시지 주변만 조회한다. 창은 실제 가시 블록을 마운트한 후 메시지를 표시한다. | 긴 대화·구 DB·원본 교체에서도 찾을 수 있는 색인·응답·복귀 경로가 필요하다. §8에 구현 가능성과 §17에 비용을 적었다. |

두 변경안은 검토 후보이며 AC6에 새 위치 이동을 요구하지 않는다. 메시지 전체를 잠시 강조하는 것과 본문에서 일치 문자열의 정확한 범위까지 강조하는 것은 별도 선택이다.

### 같은 대화에서 사용자가 보게 될 변화

예시는 Claude Work이며, 저장된 대화가 ‘최근 대화’에 보이고 현재 다른 대화가 열린 상태를 가정한다. 예시 대화에는 100턴이 있다. 63턴에는 검색어 “센서 A”가 있고, 100턴은 두 줄짜리 마지막 답변이다.

17턴에서 Claude가 실제 작업 도구 `TaskCreate`로 **테스트 수정**을 등록해 작업 ID 7을 받았다. 41턴에는 `TaskUpdate`가 같은 작업의 완료를 성공으로 돌려줬다. 현재 작업 목록은 이런 도구 호출과 짝이 맞는 구조화된 결과를 읽어 상태를 만들며, 대화에 ‘테스트 수정’이라는 문장만 쓴 경우에는 항목을 만들지 않는다. [작업 목록 계산](../../../app/src/renderer/src/features/chat/lib/transcriptIndex.ts#L665)

| 사용자가 하는 일 | 현재(AS-IS) | 계획(TO-BE) |
|---|---|---|
| 왼쪽 **최근 대화**에서 이 대화의 제목을 누른다 | 캐시가 없으면 data가 저장 이력 전체를 조립하고 창이 모든 조각을 받은 뒤 본문을 표시한다. 캐시가 있으면 기존 본문을 먼저 보여 주고 재검증한다. | 100턴 두 줄이 준비되면 메타·본문을 한꺼번에 표시하고 하단에 둔다. 위로 한 번 당기면 머리에 스피너가 나오고 99턴만 앞에 붙는다. 휠을 놓으면 98턴 요청도 멈춘다. |
| 대화를 연 뒤 Work 우측 **작업 → 진행 상황**에서 어제 끝낸 일을 확인한다 | 전체 이력에 작업 생성·완료 기록이 있으면 “테스트 수정”이 완료 상태로 보인다. | 새 로딩 방식에서는 최신 턴만 가져온 상태에서도 같은 완료 항목을 볼 수 있다. 17턴을 손으로 찾아 열 필요가 없다. 작업이 많은 세션에서는 목록을 나눠 보내더라도 모든 현재 항목에 접근할 수 있어야 한다. |
| 상단 **검색**에서 “센서 A”를 입력하고 결과를 누른다 | 검색 결과에는 발췌문이 보인다. 클릭은 세션 ID를 전달하고 보통의 세션 열기로 이어진다. | 이번 E 구현은 그 동작을 보존한다. 별도 검토안에서는 누른 결과가 가리키는 63턴 메시지를 곧바로 보게 된다. |
| 99턴을 읽다가 네트워크/호스트가 끊기거나 다른 대화로 간다 | 진행 중 세션의 live 상태와 전환 보호가 있다. 전체 로드 방식에는 “같은 이전 턴만 다시 요청”하는 화면이 없다. | 오류가 난 머리에서 같은 99턴을 재시도한다. 다른 대화로 간 뒤 도착한 응답은 그 대화에 섞이지 않는다. 원본 보관 기한 만료 후 다시 전송하면 실행 호스트는 1~100턴의 복구 자료를 쓰므로 창에 100턴만 열어 둬도 시작·중간 문맥을 보존한다. |

## 6. 범위

| 단위 | 담당과 산출 |
|---|---|
| WU-1 · data | 기존·신규 세션용 조회 가능 투영, 동일 메시지 키·순서, 턴·본문 keyset 조회, 원자 출판·재시작, Work 세션의 작업 요약 |
| WU-2 · 포트·스토어 | 타입·스키마·채널 소유·취소·상한, 열기·refresh·재접속, 세션별 이전 페이지 상태 및 보류 live 합류 |
| WU-3 · 공통 뷰포트 | 세 하네스의 상단 입력·스피너·재시도·끝·본문·앵커 |
| WU-4 · 소비자 | Work 세션별 전체 작업·기존 검색 세션 열기·복구·분기·핸드오프·현재 턴 TODO. 나머지 패널은 D-012에 따른다. 검색 결과 위치 직접 이동은 비교 설계에 한정. |
| WU-5 · 검증 | 구 DB와 새 DB 동등성, 첫 paint 비용·실기, 공개 문서 동기화 |
| 경계 | 0327 Markdown·Git 워커, 0328 내비 목록 쿼리, 0330 목표 장비의 합격선. 0326의 미통과 pair는 B에서 판정. |

## 7. Requirements / Acceptance — R ↔ AT

| R / AT | ID | 사용자 동작과 판정 | 진입점과 직접 검증 |
|---|---|---|---|
| R-01 / AT-01 | AC1 | 같은 최신 턴에 과거 1·100·10,000턴을 붙여도 첫 실제 본문의 조회·전송·검증량은 §14 예산 안. 준비된 첫 응답 1회 적용. | 일반 열기 → data → 창 커밋, Q1·Q2. 실제 읽은 payload·UI dispatch 계수. |
| R-01 / AT-01 | AC2 | 빈 세션·빈 parts 20만 메시지·한 턴 다수 메시지·다중바이트 거대 본문에서 첫 묶음 상한을 지키고 끝까지 복원한 ID·role·parts가 기준과 같다. | 페이지/본문 버튼 → 실 DB → 뷰포트, Q1·Q3. |
| R-02 / AT-02 | AC3 | 위 동작 한 번당 이전 턴 1회. 반복·동시 입력 1회, spinner 높이 변화·앞삽입에서 표시 part ±1px. 실패·끝·재시도·짧은 세션 모두 §5대로. | 세 하네스 일반 열기 → 실 제스처 → 머리·DOM, Q4. |
| R-02 / AT-02 | AC4 | 조회 중 live, refresh, 전환·삭제·재연결을 교차해도 현재 세션 본문·선택·활동·초안이 보존되고 늦은 응답 0회 반영. | store → 포트 → reducer/화면, Q2·Q5. |
| R-02 / AT-02 | AC5 | 이전 턴의 늦은 결과·publication이 본문과 어느 순서로 와도 소유·값·순서·개수가 동일. 오류·중복 페이지로 커서와 끝 표식이 진행하지 않는다. | 실제 writer+store → LOAD/PREPEND → 도구·산출물 행, Q5. |
| R-03 / AT-03 | AC6 | 전체 세션을 대상으로 한 검색 결과·발췌문을 유지한다. 다른 세션 hit를 누르면 그 세션의 일반 열기, 같은 활성 세션의 hit는 현행 위치 유지. | 실제 FTS → 검색 모달 → 세션 ID → 라우트/viewport, Q6. |
| R-03 / AT-03 | AC7 | Work 진행 상황이 전체 세션의 작업과 최신 상태를 표시한다. 완료·삭제·스냅샷·실패·중복·다른 세션의 동명/동일 ID를 §5대로 구분한다. 현재 작업 취소·OpenCode 현재 TODO·인계 조건도 확인한다. | 실제 저장/이벤트 → 세션별 요약 → Work 목록·상세와 별도 실시간 제어, Q7. 타 패널의 부분 이력 UX는 D-012에서 정한다. |
| R-03 / AT-03 | AC8 | 복구 프롬프트·저장 archive·분기 후 영속 이력에 최초·중간·마지막 고유 표지가 있다. 부분 분기 초안도 이전 문맥에 접근한다. | 원본 소실 후 전송 / 분기·물질화 → 피어·DB 재조회, Q8. |
| R-01 / AT-01 | AC9 | 구버전 DB·재시작·동일 시각·native 교체에서 공개된 한 세대 안의 순서·메시지·부가 part가 기존 투영과 일치한다. 다른 세션/출처 세대의 커서·본문 참조는 행동을 일으키지 않는다. | upgrade → 재기동 → page/body/refresh, Q1·Q3·Q9. |
| R-03 / AT-03 | AC10 | 실제 Windows 세 하네스에서 일반/검색 진입, 긴·짧은 대화와 늦은 응답을 §19 입력으로 재현하고 첫 페인트·앵커·판정 근거를 남긴다. | 설치본·진단 빌드 S-E1~S-E5, 각 AC의 기계 결과와 함께 기록. |

## 7-A. Baseline V

왼쪽 노드와 증거는 아래 표에서 같은 줄로 등록한다. R-01/02/03과 SD-01/02·AR-01~04·MD-01/02는 NEW. SD-03은 0326 V1 rev 7 §6-E 및 0324 D-011의 보존 동작(INHERITED)이다. 이 문서는 B V를 복제하지 않는다.

| Pair | 노드 ↔ 검증 | 등급 | production path / §10 자리 | 직접 관측 |
|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 열기/버튼 → 투영 저장소 → bounded reply → 화면 · EP1·2·3 | Q1·2·3·9 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 일반 진입 → 머리 입력 → 포트 → reducer → DOM · EP2·4·5 | Q2·4·5 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 패널/검색/복구/분기 → 읽기 권위 → 결과 · EP6·7·8 | Q6·7·8, S-E1~5 |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED | 최신 → 이전 → 이력 끝, 같은 턴 나머지·거대 본문 · EP2·3·4 | Q1~4 |
| VP-05 | SD-02 ↔ ST-02 | REQUIRED | 부분 이력 → 소비자 행동 → 전체/부분 표시 또는 복구 · EP6~8 | Q6~8 |
| VP-06 | SD-03 ↔ ST-03 | REGRESSION | 0326 고정 ID·보류/순서·pin → 실제 생산자 페이지 / 0324 원자 교체 · EP2·4·5 | Q2·4·5 |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | 기존 DB·writer·native 갱신 → 투영 → 조회 포트 · EP1·2 | Q1·2·9 |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | session/page/body → data handler → 창 transport → store/본문 열기 · EP2·3·5 | Q2·3·5 |
| VP-09 | AR-03 ↔ IT-03 | REQUIRED | FTS → 해당 세션 라우트 ‖ Work 전체 작업 → 요약·상세 → 진행 상황 · EP6·7 | Q6·7 |
| VP-10 | AR-04 ↔ IT-04 | REQUIRED | 분기 초안·실행 복구 → data 전체 archive → 저장/agent · EP8 | Q8 |
| VP-11 | MD-01 ↔ UT-01 | REQUIRED | 정렬된 경계·body 길이 → 선택 범위/커서 · EP1·3 | Q1·3 |
| VP-12 | MD-02 ↔ UT-02 | REQUIRED | 요청 세대·입력 방향·끝/오류·진단 → 단일 상태 전이 · EP4·5 | Q4·5 |

Q1·Q2의 과거 데이터 접근 0, Q9의 출판 원자성은 §10의 선택 변이로 증거 감도를 확인한다. 다른 pair는 실제 출력·선택·저장 재조회로 비교한다. 구현자는 `app/AGENTS.md`의 CI 대응 명령과 §19의 소스·메시지 버스 검사를 기록한다.

# Part II — 기술 설계

## 8. 현재 코드와 조사

경로는 별도 표시가 없으면 `app/src/` 기준이다. 조사 기준의 코드를 열어 아래 분기를 대조했다.

| 위치 | 관측 |
|---|---|
| `main/infra/db/queries.ts:141,480` | `loadPartsStmt.all({sessionId})`가 inner join 후 전체 세션을 정렬한다. part 0개인 DB 행은 이 join만으로 복원되지 않는다. 새 투영은 메시지 메타를 독립적으로 읽는다. |
| `main/features/history/reader.ts:17`, `native-projection.ts`, `native-recovery.ts` | full reader가 recovery archive prefix, native snapshot+binding 및 보정 part, orphan suffix, frontier 이후 local을 합친다. local raw 행 LIMIT만으로 native 화면과 동일한 페이지를 만들 수 없다. |
| `main/infra/db/native-history-queries.ts`, `main/app/data-host/session-load.ts:106` | `get`은 전체 payload, `recovery`는 archive까지, `compactLegacyRaw`는 구 JSON을 뜯는다. 검색용 native 테이블은 텍스트만 가진다. 이 세 경로를 첫 페이지 조회에서 제거한다. |
| `shared/data-host.ts:13`, `renderer/src/shared/api/transport/session-load.ts` | 현행 500개 메시지·500개 part·1,000,000자/조각. `settle`은 조각을 모아 전체 `LoadedSession`으로 돌려준다. UTF-8 바이트 단위 페이지 한도는 없다. |
| `renderer/src/features/chat/store/chatStore.ts:1864,2268` · `reducer/chatReducer.ts:1659` | load/refresh 모두 `LOAD_SESSION`으로 반영한다. 현재 prepend 거부는 진단 콜백에만 나타나며 호출자는 void 반환을 받는다. 커서 진행에는 명시적인 적용 결과가 필요하다. |
| `renderer/src/features/chat/lib/transcript/turnStart.ts` · `components/transcript/TranscriptViewport.tsx` | 턴 시작은 첫 메시지 또는 assistant 바로 뒤 user. 뷰포트의 header slot과 ResizeObserver·단일 스크롤 쓰기를 재사용한다. |
| `renderer/src/features/sessions/components/SearchModal.tsx`, `main/app/handlers/files.ts`, `main/infra/db/native-history-queries.ts` | hit는 숫자다. local은 +rowid, native FTS는 −rowid이며 모달은 현재 sessionId만 넘긴다. 표시 키는 B의 문자열 ID다. |
| `renderer/src/features/chat/store/chatStore.ts:startHandoff/startForkDraft/useTranscriptView`, `main/app/chat-turn/native-session.ts` | 보드·패널 파생, user 메시지 개수 조건, 분기 초안 복사와 서버 원본 복구의 입력이 서로 다르다(EP6~8). |
| 기존 테스트 | 이 턴에 `vitest run src/main/features/history/native-projection.test.ts src/renderer/src/features/chat/components/transcript/TranscriptViewport.prepend.test.ts src/renderer/src/shared/api/transport/session-load.test.ts`를 실행해 3파일·17건 통과. 신규 페이지 경로는 §10 Q1~Q9가 잠근다. |

**rev 3 현행 회귀 확인.** Work의 작업 관측, 전체 이력 기반 읽기 모델 및 상단 검색 모달의 기존 스위트(`taskBoard.test.ts`·`transcriptIndex.test.ts`·`SearchModal.test.ts`)를 재실행해 3파일·43건 통과했다. E의 새 작업 요약은 Q7이 검증한다.

**기준 측정.** Python sqlite3 임시 DB에 현재 `queries.ts`에서 추출한 `this.loadPartsStmt = db.prepare(...)` SQL을 그대로 실행했다. 각 턴은 user·assistant 2행, 같은 시각, 메시지마다 UTF-8 19바이트 `{"text":"abcdefgh"}` part 한 개다. 1/100/10,000턴의 반환은 각각 **2/200/20,000행, payload 합 38/3,800/380,000바이트**였다. 이는 쿼리 결과 계수이며 벽시계·제품 첫 paint 시간 측정은 §19에서 수행한다.

### 상단 검색의 위치 이동이 가능한 이유와 추가 배선

**메시지 단위 위치 이동은 구현 가능하다.** 현재도 검색 결과에 세션과 hit ID가 있고 B의 가상 뷰포트는 안정 블록 키로 위치를 찾는다. 두 값 사이의 대응, 해당 턴의 제한 조회, DOM 마운트 뒤 표시 단계는 아직 연결되어 있지 않다.

| 단계 | 현재 동작 | 직접 이동을 채택할 때 필요한 동작 |
|---|---|---|
| 1. 결과 찾기 | 로컬·native SQLite FTS5, 검색 입력 debounce 150ms·최대 결과 30. `SearchHit`은 `sessionId, messageId, role, createdAt, snippet` 등을 담는다. 24토큰 발췌에는 `<mark>`가 있고 본문 좌표는 없다. | 결과 생성 시 세션과 안정 메시지 키 또는 출처 식별자·투영 세대를 함께 보관한다. 클릭한 결과 하나에만 위치 해소·주변 조회를 요청한다. |
| 2. 메시지 식별 | local hit는 +SQLite row ID, native hit는 −SQLite row ID다. 표시용 키는 local 저장 번호/`m:`, 원본·binding·orphan 또는 복구 archive의 안정 키다. | data가 세션·출처를 확인한다. local의 행→저장 메시지 키, native의 원본·별칭→실제 투영 키, 복구의 `orcinus-orca-recovery:<순번>`→보관 키를 해소한다. 클릭 시 원래 세션·세대·안정 식별자를 재검사한다. native/복구 행 재생성으로 숫자 ID가 재사용되면 원래 안정 키로 한 번 재해소하고, 소실 시 찾을 수 없음을 알린다. |
| 3. 이력 읽기 | 현재 창은 세션 전체의 투영을 받는다. E 기본 조회는 최신 턴과 사용자가 당긴 이전 턴이다. | 작은 안은 현재의 전체 로딩이 끝난 뒤 표시 목록에서 키를 찾는다. E 연계안은 `{session, generation, messageKey}`로 대상 턴의 해당 메시지 앞뒤를 예산 안에서 읽고, 같은 턴 잔여와 앞·뒤 턴의 커서를 준다. 64~99턴을 전부 읽지 않아도 예시의 63턴을 볼 수 있다. |
| 4. 라우트·스크롤 | `SearchModal.goto`가 sessionId만 넘긴다. 같은 세션 URL이 이미 활성인 경우 라우트 동기화는 즉시 반환한다. 가상 목록은 마운트된 블록만 DOM에 있다. | 클릭마다 고유한 탐색 번호를 보내 동일 세션의 다른 hit와 같은 hit 재선택도 구별한다. 세션 전환 또는 재클릭 시 마지막 탐색 번호만 적용한다. block/part key를 해소하고 가상 목록을 이동 → 실제 블록의 레이아웃 완료 → 포커스/행 강조. 새 검색·전환·삭제 시 옛 요청·늦은 강조는 취소한다. |
| 5. 복귀·앞뒤 이동 | 현행 검색 클릭은 일반 세션 진입이다. | 검색 위치는 최신 연속 이력과 창의 별도 읽기 상태로 유지한다. 앞·뒤 이동은 명시 요청에 한 묶음씩, “최신 대화로”는 기존 현재 턴/live 상태로 돌아간다. 뒤로/앞으로 탐색에 저장하는 것은 세션·메시지·앵커이며 재진입 때 세대를 확인한다. |

검색에 잡히는 텍스트와 화면에 배치되는 텍스트가 정확히 같다는 보장은 없다. native 검색 인덱스는 부모 없는 text를 싣고 복구 검색은 text를 연결한다. FTS 접두어·중복 단어·Markdown·숨긴 도구 본문에서 **일치 문자열 자체**를 칠하려면 원문 part와 문자 위치를 화면 렌더링에 대응시키는 추가 설계가 필요하다. 메시지 단위안의 완료 기준은 선택한 메시지를 보이게 하고 그 행을 식별하는 것이다.

**외부 설계 사례.** Matrix의 메시지 검색은 한 결과와 함께 돌려줄 전후 이벤트 수를 `event_context.before_limit`·`after_limit`로 선택한다. Orca에도 결과 식별 후 제한된 문맥만 가져오는 구조를 적용할 수 있다. [Matrix Client-Server API v1.14 · Search](https://github.com/matrix-org/matrix-spec/blob/v1.14/data/api/client-server/search.yaml#L97-L118)

### 상단 검색 결과 선택 비용 · 로컬 SQLite 실험

한 대화의 중간 메시지에만 있는 단어를 찾아, 검색 결과를 클릭한 **뒤**의 두 데이터 경로를 비교했다. 전량 경로는 앱의 `loadSession`으로 대화 전체를 조립해 이미 아는 표시 키를 찾는다. 색인 경로는 실험용 `(세션, 세대, 검색 행) → (표시 키, 턴)` 표로 같은 턴의 메시지를 읽고 앱의 `localMessages`로 조립한다. 두 경로가 반환한 대상 키와 대상 턴의 내용이 같은지 단언한다.

| 세션 메시지 수 | 전체 조립 후 찾기 · 중앙 / p95 (ms) | 색인에서 선택한 턴 조립 · 중앙 / p95 (ms) | 메시지 JSON 크기 · 전체 → 해당 턴 (UTF-8 바이트) | 실험용 위치표·색인 최초 구축 · 시간 / DB 사용량 증가 |
|---:|---:|---:|---:|---:|
| 1,000 | 4.657 / 7.283 | 0.015 / 0.043 | 178,505 → 358 | 4.5 ms / 73,728 B |
| 10,000 | 48.945 / 100.275 | 0.016 / 0.051 | 1,815,006 → 364 | 55.9 ms / 671,744 B |
| 100,000 | 555.350 / 1,153.493 | 0.014 / 0.022 | 18,450,007 → 370 | 613.3 ms / 7,176,192 B |

- **조건.** Linux x64 Xeon Platinum 8573C, Electron 내 Node 22.22.1, SQLite 3.53.2. 실제 앱 마이그레이션을 적용한 임시 DB에 짧은 text part가 하나인 user·assistant 메시지 두 개씩 한 턴으로 넣었다. 같은 대상·준비된 DB에서 각 쿼리를 한 번 예열한 뒤 전량 11회·색인 501회 측정했다. 바이트는 메시지 배열을 JSON으로 표현한 크기다.
- **독립 재실행.** 같은 명령을 새 임시 DB에서 다시 실행해 3개 크기의 행 수·응답 바이트·증가한 DB 바이트와 식별자 5건이 모두 같음을 확인했다. 10만 건의 두 번째 중앙값은 전체 435.704 ms, 해당 턴 0.015 ms였고 최초 구축은 330.5 ms였다.
- **검색 목록 생성 비용.** 기존 FTS5로 10만 메시지 중 하나에만 맞는 단어는 중앙 0.195 ms(101회), 거의 모든 행에 맞는 단어는 80.064 ms(9회)였다. 위치표는 검색 결과를 선택한 뒤 쓰며, 기존 검색의 순위 계산 시간은 별도로 남는다.
- **적용 범위.** 시간·공간 수치는 로컬 이력의 DB 읽기·JS 조립까지다. Windows의 클릭→페인트 시간, IPC 비용, 복잡한 native/복구 이력의 색인 구축 시간은 별도 측정 대상이다. E의 공통 색인이 같은 키와 턴 위치를 제공하면 표의 구축량을 검색만의 비용으로 다시 더하지 않는다.
- **식별자 확인.** 로컬·원본·복구의 서로 다른 다섯 표본에서 실제 검색 행과 현재 앱에서 열리는 메시지 키를 대조했다. 예컨대 로컬 행 `+2`의 키는 `m:2`, 원본 행 `−1`의 키는 로컬 소유 키 `u:request-a`, 복구 행 `−4`의 키는 `x:1`이었다. 이 대조는 원본·복구에 대한 직접 이동의 전 구간 성능 측정과 구분한다.
- **재현.** 앱 의존성이 설치된 저장소 루트에서 `node docs/handoff/0329-turn-history-paging/evidence/search-jump-cost.cjs`를 실행한다. 합성 자료만 담은 임시 DB를 만들고 종료할 때 제거한다. [측정 코드](evidence/search-jump-cost.cjs)

**겹치는 후보.** 0327 완료 text 파싱과 0326 B28 승인 요청은 페이지의 상태 입력으로만 쓴다. 검색·복구 원본·뷰포트에서 이 후보의 파서/승인 교정 동작을 변경하지 않는다.

## 9. Architecture / Data & Control Flow

| 경로 | AS-IS | TO-BE |
|---|---|---|
| 저장·배포 | local tables·native JSON·archive가 서로 다른 형식. 열 때 full reader가 합성. | data 소유의 읽기용 투영에 정렬순서·소유 ID·턴 시작·본문 길이와 내용 조각을 기록한다. 원본은 기존 저장소가 소유. 갱신은 §11의 출판 경계. |
| 화면 조회 | 전체 reader → 전송 조각 → 전체 조립 → LOAD → 두 프레임 뒤 native refresh가 전체 교체 가능 | 일반 열기 → 현재 투영의 최신 한 턴 → bounded reply → 원자 LOAD. 이후 직접적인 위 입력 → 같은/이전 턴 → PREPEND. 갱신으로 투영 세대가 바뀌면 새 커서로 일관된 범위를 재검증. |
| 실행 복구 | agent → data.query.loadSessionArchive → full reader → archivePrompt | 같은 경로. UI 페이지용 핸들러와 타입을 분리해 agent가 부분 이력을 인자로 받을 수 없게 한다. |
| 창 내 도메인 | 전체 메시지 파생을 소비자에게 제공 | Work 진행 상황은 data의 세션별 전체 작업과 live 변경을 읽는다. 나머지 패널 범위는 D-012에서 정한다. live 실행 상태·취소 권위는 실행 호스트. |

## 10. 계약·타입·강제 지점

**D-009 추천안 기준 wire 형상.** `shared/ipc.ts`에 `HistoryQuery`를 최신, 이전 턴, 같은 턴의 나머지, 본문 범위 조회 판별합으로 둔다. 신규 data 채널은 기존 전체 복구 호출과 구분한다. `shared/protocol.ts` 입력 검사·`shared/channel-owner.ts` 소유·창 oo/IPC 타입·수신 검사·`docs/IPC_CONTRACT.md`를 함께 갱신한다. 일반 창 열기·재접속·refresh는 페이지 경로를 사용한다. 검색 위치 조회는 §8의 별도 제안이다.

| 계약 | 규칙 |
|---|---|
| 요청 / 응답 | 세션 키·창별 요청 id·창 열기 세대는 모든 응답에서 echo. 논리 커서는 `{v,session,projectionGeneration,kind,absoluteOrder/tieBreak}`를 data가 발급한 불투명 값이다. `ok`·`missing`·`stale`·`invalid`·`indexing`·`unavailable`·`cancelled`로 나눈다. 세션/세대/종류 혼용·과대 입력은 data에서 거부하고 창도 일치 여부를 검사한다. |
| 결정적 경계 | 정렬 키는 투영 내 절대 순번+안정 식별자. 시각·상대 배열 인덱스·SQL OFFSET을 커서로 쓰지 않는다. 마지막 turn의 직전 role/lookahead는 본문 없이 읽는다. `earlierTurn`은 이전 턴 하나에 한정. `withinTurn`은 같은 논리 턴의 앞부분만 반환. 형제 세션·다른 턴·다른 세대의 참조는 무효. |
| 한 턴과 조각 | 처음에는 제일 최근에 보일 끝부분을 반환한다. `moreInTurn`이 있으면 같은 턴 버튼을 우선 제공한다. 그 부분이 이어진 뒤 사용자의 새 입력으로 `earlierTurn`을 쓴다. 한 응답을 완전히 검사한 뒤 한 번만 적용. `withinTurn`의 non-T 앞삽입은 B의 `reset{complete:false}`·안정 선택/앵커를 지킨다. |
| 본문 | 큰 메시지의 ID·role·createdAt 및 최소 소유 메타와 `BodyRef`를 보낸다. ref는 세션·세대·메시지/part 키·kind·원문 바이트 길이에 결합. 지연 표시는 창의 명시적 상태로 보존한다. 저장된 빈 parts나 빈 문자열과 구분. 주문한 조각만 읽고 UTF-8 경계에서 복원하며 종료·오류·취소 시 부분 자료를 완성본으로 승격하지 않는다. |
| B의 끝 표식·응답 합류 | latest는 0326 합의대로 `complete:false`로 LOAD. 앞쪽 누락이 실제로 없으면 같은 store 공개 묶음 안에서 `prependHistory([], {reachedStart:true})`로 끝 처리. 이전 턴·같은 턴의 나머지 양쪽이 없는 최종 응답에서만 `reachedStart:true`. BodyRef가 가린 도구 소유는 data에서 안정 소유 키로 복원 가능해야 하며 유효한 보류를 고아로 버릴 수 없다. |
| 빈 결과·겹침·오류 | 0326의 순서 검사 뒤 적용/정당한 중복/거부를 액션 결과로 구분한다. 거부는 커서·끝 갱신 0, 재조회는 사용자 재시도 1회/동작. 순서가 맞는 전부 중복이나 빈 마지막 페이지는 끝 표식을 적용한다. |
| 검색 세션 열기 | 현행 검색 모달은 전체 세션의 FTS에서 받은 발췌문과 세션 ID를 사용한다. 세션 ID를 같은 기존 라우트로 전달하고 ordinary open/reselect 규칙을 따른다(AC6). |

**자리와 직접 oracle.** 다음 검색은 저장소 루트에서 `rg -n -g '!*.test.*' -g '!*.testfixture.*' '<술어>' app/src`로 실행한다. 아래 번호는 문자열 출현 수가 아니라 계약 값을 운반하는 생산·소비 자리다. 새 경로와 이전 경로의 어휘 모두 검색한다. Q는 구현 시 만들 테스트의 좌표이며 테스트명만 맞아서는 닫히지 않는다.

| EP / 검색 술어 | 강제 지점(왼쪽부터) | 대응 oracle · 실패 의미 |
|---|---|---|
| EP1 · `loadParts\|payload_json\|archive_json\|local_frontier\|message_key\|turnStart\|isTurnStart` | ① local 쓰기·교체·빈 메시지 ② native replace/binding/sidecar·고아 ③ archive prepare·이전 버전 변환 ④ publish·롤백·삭제 ⑤ stable key와 턴 시작에 의한 seek | ①②③⑤ Q1, ②③④⑤ Q9. 전량 읽고 slice하는 변이를 ⑤에 넣어 Q1의 read 계수가 red인지 본다. 출판 포인터를 먼저 바꾸는 변이를 ④에 넣어 중간 세대 노출을 검출한다. |
| EP2 · `sessionLoad\|sessionRefresh\|loadSession\|loadParts\|requestId\|reachedStart` | ① 일반/재접속/refresh 창 호출 ② 채널 route·스키마·세션 검사 ③ 예산 내 data reader·sender ④ 응답 검사/조립 ⑤ LOAD·끝 표식의 단일 공개 | 전 자리 Q2, data 결과는 Q1과 대조. ① 갱신과 ③ 최신 조회에 full reader를 각각 넣어 분기별로 과거 읽기 검출. 중복·조각 유실·재정렬·횟수 부조화 입력은 부분 적용 0. |
| EP3 · `parts\|payload_json\|message_id\|projectionGeneration\|moreInTurn\|bodyRef` | ① 본문 길이·분할 저장 ② 한도 초과 시 ref 또는 같은 턴 커서 발급 ③ sender의 범위·소유 확인 ④ 창 제어·수신→원 ID 내용 결합 | ①② Q1·Q3, ③④ Q3. 정상 경계·1 초과·빈 part·비 ASCII·중간 취소·offset 초과·세대 교차·재시도 입력. 승인 전이나 다른 세션의 본문·로컬 파일 경로 노출 금지. |
| EP4 · `entryIntent\|scrollTop\|header\|wheel\|scrollHeight\|reachedStart` | ① 세 화면 진입 intent→하단 ② 공통 상단 입력·짧은 턴 ③ 요청 상태→머리 표시/닫기/재시도 ④ 앵커 캡처→크기 변경→단일 위치 복원 | ①~④ Q4. 클릭 없이 상단이 보이기만 함·위/아래·중복 wheel·짧은 턴·끝/오류를 구별. 브라우저 레이아웃·픽셀은 S-E2. |
| EP5 · `sessionLoads\|dropSession\|cancelLoad\|PREPEND_HISTORY\|LOAD_SESSION\|heldPatches\|heldOutputs\|prependRejected` | ① store 요청 세대/중복 억제 ② 세션 닫기·delete·재접속 취소 ③ 응답의 세대/커서 재검사 ④ reducer 검증 및 보류 병합 ⑤ 성공일 때만 커서/끝 commit | ①~⑤ Q5, ②③ Q2. A→B→A, old-first/new-first, 삭제, out-of-order, owner result·출력 양 순서, stale/error/empty/중복/전체중복뒤틀림을 교차. |
| EP6 · `searchMessages\|messageId\|SearchModal\|onChoose\|entryIntent` | ① local/native·복구 FTS hit와 발췌 ② 모달 선택에서 세션 ID 전달 ③ 라우트의 일반 세션 열기/동일 활성일 때 위치 보존 | ①~③ Q6. 같은 문구가 있는 두 세션, 이미 읽는 세션의 과거 hit·다른 세션 hit·빈 결과·삭제 후 선택. |
| EP7 · `useTranscriptView\|useTaskBoard\|readTaskToolObservation\|startHandoff\|openCodeTodoTurnStartIndex\|historyComplete` | ① 작업 관측→세션별 전체 상태 ② Work 진행 상황→목록·상세 ③ 실시간 작업 권위 ④ 인계 버튼과 action 양쪽 ⑤ 현재 턴 TODO 위치 | ①② Q7은 미로딩 17·41턴, 세션별 ID 충돌, 완료·제거·중복 재생을 단언한다. ③~⑤ Q7은 active 호스트·stale 상세·현재 TODO를 본다. |
| EP8 · `loadSessionArchive\|archivePrompt\|prepareRecovery\|copyMessagesToSession\|startForkDraft\|forkPoint` | ① agent 원본 소실 판정→data archive 조회 ② 전체 프롬프트·컨텍스트 체크→복구 저장/전송 ③ fork 초안과 부모 범위 ④ fork materialize·전체 DB 사본 | ①~④ Q8. 프롬프트 예산 이내/초과, 부모 삭제·부분 조회·무관 세션 입력. |

**Q1~Q9의 실제 진입점과 입력.** `main`·`renderer`는 `app/src` 아래 경로다. 아래 파일은 표시한 디렉터리의 신규 검증 좌표다. 외부 포트·실기만 대체하고 시험 대상 writer/reader/handler/상태 전이는 production 조립을 지난다.

| 좌표 | 재현 입력 → 직접 관측 |
|---|---|
| Q1 · `main/features/history/turn-page.db.test.ts` ‘local/native/archive/empty latest’ | 실제 SQLite migration·writer·native replace·복구 저장 후 reader 호출. 1/100/10,000턴·중복 시각·선두 assistant·연속 user·빈 parts·같은 호출 결과·bound/orphan 각 예상 키/role/parts와 비교. 전체 열거 기준은 기존 full reader와 독립 고정 리터럴(빈 parts 포함). SQLite 반환·payload 페이지 접근·전송 바이트 수 계수. |
| Q2 · `main/app/data-host/history-port.integration.test.ts` ‘open/refresh/reconnect commit’ 및 `renderer/src/features/chat/store/history-open.integration.test.ts` 동명 | data handler와 창 전송 클라이언트를 실제 request/reply 모양으로 연결. 다른 세션/세대, 누락·중복·뒤집힌 분할, busy/unchanged/updated/missing/unavailable, cache+live 첫 응답 후 두 프레임 refresh 주입. 첫 유효 본문 공개 횟수·순서·cache·요청 수와 실제 frame/envelope 크기 기록. |
| Q3 · `main/app/data-host/history-body.integration.test.ts` ‘bounded range’ 및 `renderer/src/features/chat/components/transcript/TranscriptViewport.body.test.ts` ‘same id open’ | 한도 정확히/1초과·emoji가 경계에 걸린 4MiB 본문·2천 part 한 메시지·빈 parts 20만 메시지 단일 턴. 실제 bodyRef를 열어 첫·중간·끝·stale·타세션·취소 후 재시도. 합친 bytes/hash·원본 ID·내용, bounded 표지 수·읽은 DB bytes, 같은 턴 나머지 후 첫 turn 경계까지 비교. |
| Q4 · `renderer/src/features/chat/components/transcript/TranscriptViewport.history-pull.test.ts` ‘three harnesses’ | Code/Work/OpenCode 진입, 1/100턴에 같은 이전 턴 추가. 실제 viewport header·scroll writer를 통해 짧음/길음·위·아래·키보드 버튼·실패/재시도/끝·중복 제스처를 재생. request tuple, 표지·선택·pin·머리 높이, DOM 위치 측정. |
| Q5 · `renderer/src/features/chat/store/history-races.test.ts` ‘generation/overlap/held’ | S1 옛/새 세대, S2, 다른 cursor, live A·B·toolRunId·서로 다른 publication 두 건. 실제 store/reducer에서 응답·이벤트 두 순서와 invalid/empty/reachedStart·reconnect/삭제를 재생. 화면과 백그라운드 항목별 순서·끝·진단/미적용·spinner를 함께 관측. |
| Q6 · `renderer/src/app/history-search.integration.test.ts` ‘FTS result opens session’ + `main/features/history/turn-page.db.test.ts` ‘session search survives paging’ | 같은 문구의 local 양수 ID, native 음수 ID·복구 검색행·미로딩 63턴을 검색해 결과·발췌·세션을 비교한다. 다른 세션 선택은 그 세션 열기, 동일 활성 세션 선택은 현재 앵커, 삭제는 존재하지 않는 대화 처리. |
| Q7 · `renderer/src/features/chat/components/rightpanel/partial-history.integration.test.ts` ‘all session tasks’ 및 `main/features/history/work-task-summary.db.test.ts` ‘summary replay’ | 17턴 생성·41턴 완료·100턴 열린 S, 같은 ID 7을 쓰는 T. 정규 도구 성공/실패, 동일 결과 재전송, TaskGet 없음·TaskList 누락·명시 삭제, 재시작·native 새 세대·live 후 늦은 스냅샷을 실제 저장→요약→Work 화면에 넣고 독립 전량 투영과 비교. 인계·현재 TODO·실시간 취소도 구별. |
| Q8 · `main/app/chat-turn/paged-recovery.integration.test.ts` ‘full archive and fork’ + `renderer/src/features/chat/store/paged-fork.test.ts` ‘parent cursor’ | 5턴 중 창에는 5턴만 보이게 한 뒤 adapter missing→피어 archive→복구, 분기 초안→부모 이력 요청→물질화. 최초/중간/끝 고유표지와 ID를 프롬프트·DB 재열기에서 관측하고 예산 초과는 기존 복구 거부. |
| Q9 · `main/features/history/turn-index.upgrade.db.test.ts` ‘old database and publication’ | 저장 번호 없는 로컬·단일 JSON native/raw·archive x:·보정 sidecar·구조 불량 fixture, 새 쓰기·중단/재기동·삭제·commit 직전 경쟁. 이전/새 세대별 전량 결과를 old full reader와 비교하고 이전 load 중인 창과 신규 창이 각자 한 세대만 보는지 확인. |

## 11. 구현 설계

1. 기존 `isTurnStart(previous,current)`를 shared의 순수 함수로 옮겨 SQL용 턴 시작 색인을 만드는 writer와 B의 reducer가 같은 정의를 부른다. 시작 없음·선두 assistant·assistant→user·user→user·assistant→assistant 입력을 같은 표로 시험한다.
2. 원본 테이블은 보존하고 append-only migration으로 `(session, generation, order)` 투영, `(session,generation,turn,order)`와 메시지 키·source alias·소유 조회 색인, 길이와 바이트 오프셋을 가진 제한 크기 본문 조각, 활성 세대 포인터를 둔다. 고정 정렬은 복구 보관 → native 투영 → orphan → frontier 이후 local 순. 빈 parts 메시지도 헤더에 한 행을 가진다. archive ID는 저장 번호 또는 archive의 절대 위치에서 유도한 B의 `x:` 번호를 사용한다.
3. 신규 local append/같은 번호 갱신/part upsert·native binding·복구/분기 복제의 source 변경과 영향받은 읽기 키를 같은 DB 트랜잭션에 쓴다. 단순 tail append는 앞 커서 순서를 보존한다. 기존 본문 재배치·native replace·source 교체는 새 투영 세대에 기록하고 검증 완료 때 포인터만 한 번 바꾼다. 재구성 중인 세대에 발생한 쓰기는 변경 로그로 재적용하고 원본 revision이 여전히 맞을 때만 출판한다.
4. 구 DB 변환은 전용 색인 작업으로 처리한다. 오래된 JSON/raw·복구 보관 자료의 전량 디코드 비용과 디스크 사용을 별도로 계측한다. 시작/중단/재기동 위치를 저장하고 세션 삭제 시 취소한다. 구버전 전체 reader를 화면 첫 페이지의 fallback으로 호출하지 않는다. §14에 따라 색인이 없어 실제 본문이 늦으면 별도 결과로 보고한다.
5. 호스트 handler는 현재 출판된 세대에서 한 read transaction으로 세션 가시성, 턴 경계, 메시지·part 헤더와 실제 읽을 본문 범위만 읽는다. 최대 한도+1개 메타로 계속 여부를 판정하며 이전 이력 payload를 미리 열지 않는다. 전체 합계가 필요한 사용자 메타(비용·인계용 user 수)는 갱신 시 계산한 집계나 인덱스 질의를 써서 클릭당 전체 원장을 훑지 않는다.
6. 최신·이전·같은 턴 나머지·본문을 창의 상태별 요청으로 등록해 성공 때만 커서·메시지를 한꺼번에 반영한다. 거대 본문을 원 ID의 명시적인 지연 표시 모델로 연결한다. 메타에 다 담기 어려운 결과·산출물 소유는 세션·세대를 확인하고 B의 병합 키로 해소한 뒤 끝을 처리한다.
7. 0326의 `prependHistory`가 이미 쓰는 diagnostic에 적용 결과를 전달할 수 있는 얇은 반환을 더한다. 기존 호출자·fixture는 종전 행동을 유지하고 `prependRejected`에서는 커서를 진행하지 않는다. `isCurrent`의 첫 LOAD 보호와 이전 턴 조회의 live 교차 허용은 다른 상태로 둔다.
8. 세션 전체에서 Work 작업 호출과 결과를 toolRunId로 짝지어 같은 `shared/task-tool.ts:readTaskToolObservation`의 created/upserted/removed/snapshot 규칙으로 접는다. 세션·작업 ID, 현재 상태·정렬 키·상세 참조를 원본 저장 revision과 함께 출판한다. 부분 본문으로 재조회했을 때 요약을 거꾸로 덮지 않도록 세대와 처리 순서를 비교한다.
9. 기존 저장본은 읽기 투영 준비 시 작업 요약을 재생한다. source 세대 변경 때 작업 목록의 추가·삭제/스냅샷을 포함해 한 번에 교체한다. 응답은 작업 목록 keyset 페이지·전체 개수·끝 표식을 분리하고, 창은 요청한 항목의 상세만 받는다. 준비·실패·재시도·끝을 구분해 부분 값을 ‘작업 없음’으로 표시하지 않는다.

## 12. 생산자·소비자와 기존 호출자

| 쪽 | 배선 / 보존 |
|---|---|
| 화면 | `useChatRouteSync → chatStore.loadSession → sessionApi → transport/oo → data`. 현재 검색은 `SearchModal → OverlayLayer → /chat/<sessionId>`로 일반 세션을 선택한다. 후보인 대상 위치 조회는 §8에서 별도로 검토한다. |
| 패널과 보드 | Work의 `taskBoard`는 세션 전체 자료를 사용한다. 같은 계산을 공유하는 Claude Code의 계획 타일과 기타 `taskContextSources, subagentTasks, subagentTaskDescription, childMessage, transcriptResults, persistedBackgroundModels, sessionPanelModel`은 별도 소비 경로다. D-012가 남아 있어 Work의 선택을 일괄 전파하지 않는다. |
| 실행 파생 | `ClaudeConversationStatus`와 `chatStore.startHandoff`의 user 메시지 ≥2 조건은 전체 user 개수의 capped(0/1/2이상) 메타로 양쪽을 일치시킨다. 이는 턴 개수와 다르다. `openCodeTodoTurnStartIndex`는 앞삽입 후에도 현재 턴을 가리키도록 안정 메시지 키/절대 위치로 연결한다. |
| 분기·복구 | `startForkDraft`는 부모 메시지 목록·완전성·읽기 기준점까지 이어받는다. 부모의 특정 세대·분기점 이후 live는 초안에 섞지 않는다. 실제 물질화·원본 만료 복구는 서버의 전량 경로를 유지한다. |
| 부팅·등록 | `shared/host-channels`·owner table → data bootstrap → `registerSessionLoadHandlers` → renderer transport. 기존 접속·삭제/무효화·창 종료·캐시 재열기·새 대화 entry를 모두 검증한다. 창에 DB/native SDK 도입 없음. |

## 13. 수명주기·오류·정리

| 전이 | 처리 |
|---|---|
| `idle → loading(key,generation,cursor) → applied/end` | 같은 (세션,세대,종류,커서)는 단일 flight. A에 오래된 응답을 수신한 시점에 A가 다시 활성이어도 세대가 다르면 무시. 항목별 busy·자료·오류를 일치시키고 finally에서도 같은 요청만 정리. |
| `loading → retryable / stale / cancelled` | retryable은 같은 커서를 보존한다. stale은 동일 stable anchor 기준으로 새 세대에 재위치해 최신 범위와 동등성 확인 후 한 번 교체한다. 앵커가 삭제되었으면 인접 존속 위치와 갱신 사실을 표시. 재위치 실패는 기존 일관된 화면 유지. |
| `open / resume / sync` | §5의 세 진입 원인을 유지한다. 늦은 refresh라면 unpin 독자의 거리·선택을 보존하며, 읽던 메시지의 stable anchor로 새 세대를 조회한 뒤 원자 교체한다. busy 캐시·더 새로운 live가 이긴다. |
| 이력 삭제·호스트 끊김·취소 | generation 폐기, 포트 pending·body 청크·중복 억제 키·스피너 해제. 다른 세션의 flight는 유지한다. 삭제 후 같은 세션 ID가 나타나도 오래된 bodyRef/커서 거부. |
| 데이터 손상 | legacy native 해석 실패는 기존 유효한 local/archive 투영과 `nativeSync` 안내로 귀결. 잘린 본문을 빈 완성본으로 쓰거나 이미 출판된 최신 세대를 반쪽으로 교체하지 않는다. |

## 14. 성능 예산과 한계

| 측정 | 제안한 계약 |
|---|---|
| 1회 응답 한도 | 새 페이지는 메타 포함 UTF-8 JSON 표현 **256 KiB**, 메시지 헤더 **128**, part 설명 **256** 이내. 마지막 한도에 닿기 전 자르고 1개 lookahead는 본문 없는 키/길이로 한다. 기존 0325 문자/조각 한도는 전량 경로에서 유지한다. |
| 거대 본문 | 요청당 원문 최대 **64 KiB**. 본문 길이와 조각 경계를 쓰기 시 기록하고 건너뛸 payload에 JSON.parse/전체 stringify를 수행하지 않는다. wire escaping 포함 총 응답 한도도 별도 적용하며 같은 논리 offset에서 진척하는 양수 바이트를 반환한다. 원문은 명시 요청으로 전체 내용을 복원·내보낼 수 있다. |
| 첫 paint 전 | 일반 열기에서 page 응답 1개·실제 본문 commit 1회. 세션 제어 메타(제목 등)도 envelope의 UTF-8 예산에 포함한다. 과대 가변 메타는 참조·유효한 축약 표시 후 별도 조회. DB 본문 인출/직렬화/검증·reducer 방문·wire bytes를 독립 계수하고 동일 최신 턴에 과거 payload 읽기 0을 확인한다. |
| 입력 증가 | §8 분모에 동일한 최신 턴을 붙여 1/100/10,000턴 변화를 본다. 1턴에 20만 빈 메시지면 첫 요청은 ≤128개. 4MiB 한 part면 본문 열기 전 payload 읽기 0, 이후 실제 조각 수·원문과 일치 여부를 비교. B 앞삽입 비용은 1턴·100턴에 각각 1턴을 추가해 기존 방문·할당과 프레임을 기록한다. |
| 구 DB의 첫 실행 | 단일 `payload_json/archive_json`에는 과거 전체를 한번도 해석하지 않고 정확한 안정 키·소유·전후 턴을 제공할 색인이 없다. 업그레이드 작업에 사용한 시간·디스크·전량 처리량, 색인 미완성 상태에서 클릭→첫 실제 본문, 준비 후 같은 세션 클릭→본문을 따로 남긴다. `indexing`·스피너·빈 틀은 성공 paint가 아니다. 미준비 세션에서 과거 전체 작업이 첫 클릭을 막으면 AC1을 그 세션에 PASS로 적을 수 없다. |
| 저장 비용 | 새 투영은 디스크를 더 쓴다. 변경 세대 출판까지 직전 정상 투영만 제공하고 커서는 stale로 재시작 가능하므로 오래된 세대는 사용하는 트랜잭션을 마친 뒤 회수한다. 실기 p95/최대 허용치는 W에서 결정한다. |

## 15. 외부/공개 계약

새 data 페이지 요청과 판별합·예산·소유자·취소·오류·전량 복구의 차이를 `docs/IPC_CONTRACT.md`에 동기화한다. 현재 검색의 세션 이동 계약을 유지한다. §8의 조회용 위치 식별자를 공개 계약에 추가하는 일은 별도 채택 결정에 따른다.

## 16. 기존 결정과 관계

0324 D-011의 원자 교체, 0325 D-022의 조회 분리, 0326 D-057·074의 진입 의도와 D-083·093의 보류/병합 계약이 기준이다. nearest 커서의 시간값이나 표시용 합성 ID로 이 계약을 바꾸지 않는다. 0327 구현과 겹친 공통 뷰포트·renderer 소비처는 착수 시 실제 diff를 대조한다.

## 17. 위험과 선택 비용

### 상단 검색 변경안별 비용

아래 수치는 저장소를 아는 엔지니어 한 사람이 설계·코딩·자동 테스트에 쓰는 **예상 인일**이다(1인일=8시간). E 공통 색인·페이지 기반 자체를 이미 제공하는 경우와 검색이 그 기반을 먼저 만들어야 하는 경우를 나눴다. PR 대기와 Windows 장비 실기 시간은 별도다.

| 선택지 | 예상 공수 | 사용자가 체감하는 비용과 구현 범위 |
|---|---:|---|
| 현재대로 결과가 속한 세션 열기 | 신규 위치 이동 0인일 | 사용자가 긴 대화에서 해당 메시지를 다시 찾아야 한다. E의 기존 경로 회귀 시험은 포함한다. |
| E 이전의 작은 안 · 기존 전량 로드 이후 메시지 이동 | 4~8인일 | ID 대응·기존 로딩 완료·세 하네스의 가상화 위치·회귀를 연결한다. 과거 전부를 읽는 비용은 유지되고, E 적용 후 데이터 경로를 다시 연결할 수 있다. |
| E의 턴 색인이 준비된 뒤 · 클릭한 메시지 주변만 조회 | **추가 3~6인일** | 안정 ID·주변 조회 0.75~1.5, 라우트·store·뷰포트 1~2, 세 하네스·stale·복귀 자동검증 1.25~2.5인일. 검색 위치에서 앞뒤를 점진적으로 읽게 한다. |
| E 전에 상한 있는 위치 이동까지 독립 제공 | 8~15인일 | 색인·기존 DB 3~5, 제한 조회·커서 2~4, UI와 테스트 3~6인일. E와 공통으로 쓸 부분을 합의해야 중복 구축을 피할 수 있다. |
| 선택 사항 · 표시 본문의 정확한 문자열 강조 | 위 메시지 이동에 +2~5인일 | plain text·유니코드 범위에 한정한 추정이다. Markdown 변환·접힌 블록·초대형 본문에서 정확한 일치 위치까지 요구하면 별도 실측과 산정이 필요하다. |

목표 장비의 위치 이동 시간은 DB의 전체 검색 응답 시간과 별도로 측정한다. 클릭 후 키 해소·payload 범위 조회·전송·블록 마운트·실제 화면에서 대상이 보일 때까지를 분리해 p50/p95와 읽은 행·바이트를 기록한다. 같은 문구가 여러 메시지에 있거나 native 갱신 직후인 경우도 측정한다.

### 이력 처리 위험

| 상황 | 검출 / 판정 |
|---|---|
| 색인이 준비되지 않은 오래된 대화 | 업그레이드 직후 첫 클릭까지 따로 재생. 색인 구축을 사용자가 기다린 실제 시간도 보고한다. 지원 DB에서 첫 본문 예산을 만족하는 업그레이드 전략이 입증되지 않으면 구현 READY 전 재설계한다. |
| Work 진행 상황의 일관성 | 늦은 결과·source 교체·삭제·스냅샷 재생이 세션별 전체 목록을 정확히 갱신해야 한다. 같은 숫자 작업 ID를 다른 세션에 주어 오염을 검출한다(Q7). |
| 단일 거대 턴 | “언제나 완전한 한 턴을 첫 화면에 보냄”과 엄격한 전송·방문 총량은 동시에 보장할 수 없다. D-009 두 안 모두 한 턴의 나머지를 별도 범위로 명시한다. 수동안은 요청량을 통제하고 자동안은 추가 조작을 줄이지만 첫 표시 후 읽기 비용이 커진다. |

## 18. 영향 범위

| 영역 | 파일·정본 |
|---|---|
| data·저장 | `main/infra/db/{queries,native-history-queries}.ts`, 신규 append-only migration·투영 조회, `main/features/history/{reader,writer,native-projection,native-recovery,native-sync}.ts`, `main/app/data-host/{session-load,data-ops,persistence-receiver}.ts` |
| 계약·전송 | `shared/{ipc,protocol,data-host,channel-owner,host-channels}.ts`, renderer `shared/api/{ipc,transport/oo,transport/session-load}.ts`, `main/app/handlers/files.ts` |
| 창과 연속 작업 | `features/chat/{store/chatStore,reducer/chatReducer,lib/transcript/turnStart}`, `components/transcript/TranscriptViewport.tsx`, 패널·작업 보드·OpenCode TODO·인계 제어, `features/sessions/components/SearchModal.tsx`·앱 라우트·OverlayLayer |
| 문서·게이트 | IPC 정본, `docs/arch/{execution-model,backend/persistence,frontend/state}.md`, 필요 시 생성 inventory. `check-ui-thread.mjs`의 full-reader import 제약과 route owner 검사 유지. |

## 19. 검증 절차

1. 구현 직전 0326 기계 PASS 기준에서 §6-E 입력, `prependHistory` 결과, 헤더/앵커·entry intent 경로, 보류 이벤트 merge key를 다시 읽는다. 기준점과 변경된 계약·테스트명을 확인해 이 plan과 차이가 있으면 구현 전에 정정한다.
2. Q1~Q9는 SQLite를 실제로 여는 DB pool과 순수/renderer pool로 분리한다. `app/AGENTS.md`의 ABI 지침에 맞는 Node SQLite로 DB 검증을 실행·기록한다. 데이터 호스트·창 양 끝을 같은 mock으로 대체한 결과를 포트 통합 증거로 세지 않는다.
3. 마지막 변경 후 `app/`에서 `node scripts/check-migrations-appendonly.mjs`, `node scripts/check-doc-inventory.mjs --check`, `node scripts/check-product-naming.mjs`, `node scripts/check-test-budgets.mjs`, `node scripts/check-ui-thread.mjs`, `npm run lint`, `npm run typecheck`, `./node_modules/.bin/vitest run`, `node --test scripts/*.test.mjs`, `npx electron-vite build`, `node scripts/smoke-hosts.mjs`, `node scripts/smoke-preload.mjs out/preload`를 저장소 CI와 대조한다. 추가·수정 테스트 파일의 subtree 규칙, baseline 차집합, 실행하지 못한 단계는 구현 보고에 남긴다.
4. 설계 변경은 링크·상태·다음 주체와 INDEX/부모 후보 행을 대조하고 `git diff --check` 및 commit trailer 파싱을 확인한다. verify는 구축한 투영을 모르는 독립 fixture(예: archive 끝과 첫 native 메시지 사이가 같은 턴)로 한 번 더 재생한다.

**Windows 실기 (AC10, §14와 Q1~Q9 통과 뒤)**. 같은 장비·빌드·fixture의 Claude Code·Work·OpenCode에서 수행한다. 설치본은 동작 영상을, 진단본은 data 조회·wire·검증·reducer·실제 첫 본문 paint·프레임·앵커를 기록한다. 0326 store에만 넣는 fixture 대신 data 포트에서 실제 읽을 DB를 준비한다.

| ID | 입력 / 관측 |
|---|---|
| S-E1 | 같은 최신 한 턴 + 과거 1/100/10,000턴. 재기동·일반 open에서 실제 첫 본문까지 data 읽은 행/바이트·IPC 바이트·validation·commit·프레임. 구 DB는 변환 전/중/후 분리. |
| S-E2 | 최신 턴이 한 화면보다 짧은 경우와 긴 경우. 휠/트랙패드·키보드 이전 턴 버튼, 중복 입력·실패·재시도·끝, 읽던 part 거리 ±1px·선택·spinner·다음 자동 요청 0. |
| S-E3 | 99턴 조회 중 현재 턴 delta 및 17턴 소유 결과·publication, refresh·A→B→A. 같은 세대 응답만 반영, 각 소유 위치/개수·현재 활동·unpin 앵커 확인. |
| S-E4 | 4MiB 본문 및 20만 빈 메시지 단일 턴. 본문과 같은 턴 앞부분의 각 요청량, 원문 복원, 중간 취소/재시도, 일반 이전 턴 순서 확인. D-009 자동안을 택하면 첫 본문 paint 뒤에만 이어 읽고 세션 전환에서 중단. |
| S-E5 | 17/41턴에서 작업 생성·완료, 100턴만 창에 둔 Work에서 완료 항목 확인. 63턴 발췌문 검색 후 해당 세션이 기존 규칙대로 열리는지 본다. native 원본 소실 후 전송 시 앞·중간·끝 문맥은 고정 fixture에서 확인한다. |

S-E1~S-E5 원시 기록과 각 AC 결과를 0330 W에 연결한다. E의 확정된 행동·크기 경계를 위반했으면 해당 E AC를 다시 연다. 목표 장비의 프로파일별 절대 성능 허용치 결정은 [0330 보드 행](../INDEX.md)에서 추적한다.

## READY self-review

| 점검 | 결과 |
|---|---|
| 요구·작업 분리 | 0325 §6-C, 0326 §6-E의 data/renderer 양쪽 인계를 §2~7에 연결. 계획 근거·선행 관계와 사용자 합의 여부 분리. |
| 근거·동등성 | §8의 SQL 결과 계수·세 기존 테스트 스위트 재실행. native·local·archive·빈 parts·구 DB·late live는 Q1/Q5/Q9로 확인할 예정. |
| V·강제 지점 | R/SD/AR/MD의 VP-01~12, EP1~8, Q1~Q9 및 S-E1~5 등록. 테스트 좌표는 구현자가 만들 예정이며 구현 검증 결과는 미기입. |
| 설계 결론 | **DRAFT**. Work 진행 상황은 D-010으로 확정. D-009는 한 턴이 물리 상한을 초과할 때 이어 읽는 방식, D-012는 나머지 패널의 미로딩 범위다. D-011의 신규 검색 이동은 별도 검토안이며 기본 E의 READY 조건에서 제외한다. |
| 기존 DB | READY 전 기존 설치의 단일 JSON을 투영으로 전환하는 비용 및 실제 최초 클릭 예외를 작은 DB와 긴 DB에서 확인한다. 전체 읽기 후 slice하거나 색인 진행 표시를 첫 본문으로 보고한 결과는 AC1을 닫지 못한다. |

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §9).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: … (Part I/II의 정확한 절 인용)
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

> `§10`의 `언제 강제` 칸은 **하나의 불변식이 성립해야 하는 지점 목록**이다. 한 지점만 닫아도
> 대표 경로 AC는 통과하므로 게이트 green은 전수를 뜻하지 않는다.
> **각 행의 `재현 명령 / 관측`은 이번 턴에 실제로 실행한 것만 적는다** — 산출물에서 표식을 다시
> 찾지 못하면 그 행은 닫힌 것이 아니다.
> **그 관측이 구조적 proxy·0건/전수 스윕·배선 존재 oracle이고 이번 턴에 장치를 만들거나 고쳤다면,
> 등록된 결함을 심어 실패하는지 먼저 확인한다** — 눈이 없는 장치의 `0건`은 전수의 증거가 아니다.
> 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개는 oracle 종류와 무관하게 돌린다(impl §3 sweep). 그 밖의 직접 oracle에는 mutation을 더 발명하지 않는다.
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §9).
> **`닫은 지점`은 §10 항목이 아니라 §10이 고정한 자리로 세고, 기록된 자리 검색 명령을 다시 돌린 출력과 목록의 차집합을 적는다** — 목록이 없거나 출력과 갈리거나 술어가 불변식의 주어가 아니거나 범위가 지적이 인용한 파일로 좁으면 `PLAN_GAP`이다(impl §2).
> **닫은 자리마다 직접 oracle 좌표(`파일:테스트명` / 실패 의미 red를 관측한 `gate:<명령>`)를 적는다** — typecheck·코드 읽기·일회성 실측만 있는 자리는 `남긴 곳`에 적고 세지 않는다(impl §2).
> **좌표는 그 테스트의 실행 구간(들어간 곳 → 관측한 곳, mock한 path 구성요소 제외) 안의 자리만 닫는다** — 안쪽 export로 들어가거나 한쪽 끝을 mock하거나 내부 상태만 단언하거나 production 조립이 주입하는 의존성을 빼 다른 분기를 탄 테스트가 건너뛴 자리는 `남긴 곳`이다. 운반 값을 기본값·빈 값·형제와 같은 값으로만 준 좌표, 자리 규칙이 적은 분기 중 입력이 없는 분기가 있는 좌표도 그 자리를 닫지 않는다(impl §2).
> **`§10이 적은 지점`은 그 pair의 §10 자리 전부다** — 재구현 턴에도 지목된 자리만 적지 않고, 닫지 않은 자리는 `남긴 곳`에 남긴다(impl §9).
> **`운반 항 · 구별 값 · 관측`은 닫힘으로 센 행마다 그 자리가 넘기는 항, 테스트의 구별 입력, 좌표가 관측하는 곳을 적는다** — 셋 중 하나가 빠진 항은 `남긴 곳`이고, 호출·분기를 바꾼 변이의 red로 인자 항을 채우지 않는다(`docs/handoff/AGENTS.md §공통 V`).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 · commit → `a.test.ts:'…'` · revoke → … | commit: `key`(형제와 다른 값 → 저장 결과 단언) · … / 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음 / … → 분류(impl §7): 목록 미고정 → PLAN_GAP · 현재 결함 → 선조치 또는 PLAN_GAP · 확장 후보 → 확장 창이 열려 있으면 PLAN_GAP 가능, 닫혔으면 보고 · 비귀속 → 별도 finding
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 / ID → 잡은 테스트 `파일:테스트명`(재실행 결과) 또는 `동치` 근거·확인 실행 — 분류가 이행·현재 결함이거나 설계자가 채택한 확장 행은 이번 턴에 닫는다. 후보 표로 간 행과 `경계` 행은 제외

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다. 이전 라운드 상태를 유지로 옮기는 행도 좌표를 인용하고, 좌표 없이 났던 `SELF_PASS`는 이번 턴에 재판정한다(impl §2).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | `파일:테스트명` … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> **열거 sweep**: 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개(제거 — 계약이 다른 형제 슬롯이 있으면 맞바꿈을 더함)를
> 심어 red인지 본다(impl §3, 하네스 `.agents/skills/handoff-verify/scripts/mutate.py`). 그 위에 pair가 선택한 적대 증거·
> 파생 이슈의 인용 변이·이번 턴에 만든 구조적 proxy·0건/전수·배선 oracle의 민감도를 심는다. 규칙 칸 분기와 여러 항을 적은
> §10 자리 문장의 항은 그것을 구현한 diff 자리(조건·조기 반환·후보를 합치는 항)마다 제거 변이를 심어 찾는다. 그 밖의 hunk에는 mutation을
> 새로 발명하지 않는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `sweep — §10 자리 / path edge / 규칙 칸 분기(diff 자리)` / `재앵커 — 원 ID` / `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 테스트 추가** / 동치 — 근거·확인 실행 |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K · sweep S = 표 행 T` — sweep S는 열거 항목 수와 같아야 한다. 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §9).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 분모는 직전 verify 고장 이력의 `잡음` 행 중 하한 ④와 같은 범위이고, 원문이 옮겨 갔으면 재앵커한 행이다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 / … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … / **표에 없음** | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

> 범위 밖이라 이번에 고치지 않더라도 **적는다** — 적지 않으면 그 선택지가 존재한 적도 없게 된다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 선조치(구현 세부) / 📝 **plan 수정 제안**(설계가 틀렸다는 증거) / ⚠️ 보고만(제품·AC·Decision·의존성) | … |

> 가운데 갈래가 구현 턴의 핵심 산출이다 — plan을 고치는 것은 설계자 책임이지만, **고쳐야
> 한다는 증거를 만드는 것은 구현자만 할 수 있다.** 무엇이 틀렸는지·코드에서 무엇을 봤는지·
> 어느 절을 어떻게 바꿔야 하는지를 함께 적는다.

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음 / …

> 차이가 있으면 **대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다 한 줄씩** 적고, 그 축에서 다시 확인한
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §7).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … / 해당 없음 + 근거 | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … / 해당 없음 + 근거 | … |
| 재진입 | … / 해당 없음 + 근거 | … |
| 다른 무효화 축 | … / 해당 없음 + 근거 | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | `ci.yml` 단계 전부의 로컬 대응(파일 필터 없는 테스트) — 테스트 N파일 / M케이스 · error·warning 수 · 돌리지 못한 단계와 이유 · 기준선 분리 근거(변경 전 실패 집합과 차집합 ∅ + 환경 원인, `docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only`로 뽑은 테스트 파일 N · 규칙별 위반 0(app: 시간 예산·호스트 격리·풀 분류) · 그 파일들의 규칙 가드 실패 0 — 테스트를 건드리지 않았으면 `해당 없음` |
| V-pair 자기확인 | `SELF_PASS N / SELF_BLOCKED M`; pair별 상세는 위 표 |
| 강제 지점 전수 | N/M |
| **AC 자기보고**(`Criteria-Met`) | N/M — 각 AC 옆에 **이번 턴에 재현한 관측값**을 적는다. 표식을 다시 찾지 못한 AC는 ✅로 세지 않는다 |
| **합계 검산** | `✅ N · ⚠️ M · ❌ K = 총 T` — 분모를 다시 세고 **이 줄을 쓴 뒤** 커밋 trailer를 적는다. 분모가 바뀌었으면(AC 분할·추가) 그 사실을 적고 이전 라운드 합계와 직접 비교하지 않는다 |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r<N> 구현 — 좌표는 INDEX)` — 자기 환경의 해시를 적지 않는다. 좌표 정본은 `INDEX.md` 한 곳이고 검증자가 채운다 |

## [구현자 기입] Review Signals — 사실만

> 원인 분류(A~F)와 지침 변경은 `handoff-review`가 한다.

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 / …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: 없음 / …
- 현재 라운드·impl 턴: `rN` / `rN.k` (verify 3·6회째 FAIL/RETURN_TO_PLAN 또는 verify 없는 impl 턴 3 초과면 — 사용자 요구 변경 턴 제외 — 다음 재구현 전에 `handoff-review`. verify 9회째가 PASS가 아니면 `verify/CLOSED` 종료)

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| D1 | … | verify r<N> · VP-… · AC<N> / §10 <N>행 / gate | … | 이행 / 현재 / 확장 / 경계 / 비귀속 | BLOCKING / PLAN_GAP / NON_BLOCKING / NEXT_HANDOFF | open / 구현중 / 해결 / 후보 표 |
