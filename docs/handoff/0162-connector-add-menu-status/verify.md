# Verify — 0162-connector-add-menu-status

## 메타

| 항목 | 값 |
|---|---|
| slug | `0162-connector-add-menu-status` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `666a1bd` |
| 라운드 | 1 |
| 상태 | **PASS (조건부)** — 인수 기준은 충족했으나 **AC3(주소 입력)이 이 커밋에서 실제로는 깨져 있었고** 0163 이 고쳤다. 아래 §비판적 검토 참조 |
| 자기 검증 여부 | **예** — 설계·구현·검증 모두 Claude |

## 구현 결과 비판적 검토

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경 실패 방식 | **한 곳이 실제로 깨졌다** | `onBaseUrlChange` 가 **매 키 입력마다** origin 으로 되써서 `https://wiki.corp/` 의 `/` 를 먹었다. 사용자가 실사용에서 즉시 발견했고 0163 이 고쳤다. **0162 의 인수 기준 15건 중 이 표면을 검사하는 것은 0건이었다** |
| **잘못된 성공** 가능 경로 | **하나 있었고 구현자가 잡았다** | `runReconnect` — broker 는 실패를 **던지지 않고** `{kind:'failed'}` 로 resolve 한다. plan 의 `Promise<unknown>` 시그니처였다면 `try/catch` 만 보고 실패를 성공으로 읽었을 것. 구현자가 `AuthLogoutOutcome` 으로 좁혀 union 3값 전수 테스트 |
| 되돌릴 수 있는가 | **예** — renderer 표시·게이트 전용 | — |
| 설계가 의도한 것을 구현했는가 | **예** | 판정을 순수 모듈 2개로 내려 AC 15건 중 9건을 기계 검증 |
| 구현자 선조치 경계 | **지켰다** | 8건 전부 구현 세부. `재연결` 라벨은 0163 에서 사용자 어휘로 재조정 |

## 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `pluginTone` — 테스트 5회, 프로덕션 **0** | **❌ 죽은 코드 (0164 시점)** | 0162 가 만들고 `CustomizeList` 가 썼으나, **0164 가 소비처를 `connectorActions(row.connector).tone` 으로 바꾸면서 함수와 테스트만 남았다.** `rg '\bpluginTone\b' --글롭 '!*.test.*'` = **정의 1줄뿐** → **D2** |
| `ConnectorActionInput` — 테스트만 | **오탐** | `connectorActions()` 시그니처 타입 |
| `resolveTemplateLabel` — 테스트만 | **오탐** | 같은 파일 `addMenuState()` 가 소비 |
| `connectorOriginDisplay`·`connectorTarget` — 테스트만 | **⚠️ 0160 산 유산** | `connectorOriginDisplay` 는 모달이 `connector.origin` 을 직접 읽어 우회. 경미 |
| `addMenuState` 의 `loading`/`empty` 분기 | **배선됨** | `ConnectorAddMenu.tsx` 가 세 분기 모두 그린다 |

## 구현자 코멘트 확인

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `runReconnect` 시그니처가 설계에서 틀렸다(`Promise<unknown>`) | **타당 — 가장 값진 정정** | broker 가 실패를 resolve 한다는 사실을 코드로 확인. 매트릭스 ✅ |
| 모달 초기화 effect 가 `react-hooks/set-state-in-effect` error | **타당** — 조건부 마운트로 effect 자체를 없앤 것이 옳다 | lint 0 error 확인 |
| `dropdown={tab !== 'mcp'}` 로 뒤집어 적었다 | **타당** | 탭이 늘 때 기본값이 안전한 쪽으로 접힌다 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1·2 | 추가 버튼 드롭다운 + 템플릿 1행 나열 | ⚠️ **사람 실기** | 0164 가 이 버튼을 **기본 숨김**으로 바꿨다 — 디버그 토글을 켜야 보인다 |
| 3 | 템플릿 0개면 사유 표시 | ✅ | `connectorAddMenu.test.ts` |
| 4 | 템플릿 고정 폼(`templateId` 필수 prop) | ✅ | `typecheck` + `connectorInstance.test.ts` |
| 5 | 저장 시 목록 등재 | ⚠️ **이 커밋에선 불완전** | `onCreated` 가 `find()` 성공 시에만 호출 → 갱신 누락 가능. 0163 이 무조건 갱신으로 수정 |
| 6 | 저장 직후 자격증명 화면 | ❌ **이 커밋에선 실패** | 인스턴스 행 provider 가 0개라 "쓸 수 있는 인증 방식이 없습니다" 가 떴다(0163 §자료조사 2). **AC6 이 "사람 실기" 였기에 통과로 기록됐다** |
| 7·8 | 상세·목록 초록 점 | ✅ | `connectorActions.test.ts` |
| 9·10·11 | 액션 집합(연결/재연결/해제/제거) | ✅ | `connectorActions.test.ts` 4케이스 |
| 12·13 | 재연결 순서 + 실패 시 미개방 | ✅ | 호출 순서 단언 + union 3값 |
| 14 | 새 자격증명 재연결 | ❌ 미검증 | 사내 DC 필요 |
| 15 | i18n ko·en | ✅ | `typecheck` |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 | ✅ | — | 통과 |
| 인수 기준 대조 | ✅ | — | 위 표 |
| **UI 시각·조작** | ✖ | ✅ | AC1·2·5·6 — **사용자 실사용이 실제로 AC5·6 의 결함을 잡았다** |
| 사내 DC 실기 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
lint 0 error(warning 1 = 베이스라인) · typecheck 0 error
vitest 1770 passed / 1 file failed(chat-turn.continuity, electron egress) → 베이스라인 제외 0건
scripts 28 pass
```

## 검증 자기 리뷰

- **설계 단계**: AC5·6 을 **"사람 실기"** 로 적은 것이 화근이었다. 둘 다 순수 로직으로 내릴 수 있었다 —
  AC5 는 "생성 응답 처리" 함수로(0163 이 실제로 그렇게 했다), AC6 은 "connector 의 수용 provider ∩ 등록
  provider 가 비지 않는다" 로. **"사람 실기" 가 측정 불가 항목의 하치장이 됐다** — SKILL.md 관문 2 가
  경고한 바로 그 형태다.
- **구현 단계**: `onBaseUrlChange` 를 0161 에서 그대로 물려받아 **재검토 없이 유지**했다. 설계가
  "제안만 하고 자동 확정하지 않는다" 는 0161 결정을 인용했으나, 그 결정이 *매 키 입력마다* 실행된다는
  사실은 아무도 확인하지 않았다.
- **검증 단계 — 못 본 것**: 이 verify 는 **0162 커밋 시점이 아니라 HEAD 기준**으로 판정했다. AC5·6 의
  실패는 0163 plan 의 조사 결과를 인용해 소급 기록한 것이지, 내가 `666a1bd` 를 체크아웃해 재현한 것이
  아니다. 그렇게 표기했다.

## [PASS 조건] 남은 항목

- [ ] **D2** — `pluginTone` 죽은 코드 제거(0164 가 소비처를 바꾸며 남겼다). 그 테스트 5케이스도 함께.
- [ ] AC1·2 는 0164 의 디버그 게이트를 켠 상태에서 사람이 확인
