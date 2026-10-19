# 구현 r1 — 디자인 문서 검증 관측

2026-10-19. 구현자 자기확인이며 독립 verify 판정은 아니다.

## 재현

저장소 루트에서 실행한다.

```sh
python docs/handoff/0266-renderer-design-guidelines/evidence/check-design-docs.py
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
git diff --check
```

앱 디렉터리에서 실행한다.

```sh
node scripts/check-doc-inventory.mjs --check
npm run lint
npm run typecheck
```

## 관측

| 검사 | 관측 |
|---|---|
| 브랜치 / 추적 | `main` / `origin/main` |
| TSX 카탈로그 | source=286, rows=286, `source-minus-doc=[]`, `doc-minus-source=[]` |
| 진입점 | root/app/renderer AGENTS·docs INDEX 각각 디자인 시스템과 카탈로그 링크 확인 |
| 제작 절차 | 읽고 준수·재사용·상태 설계·완료 검토·문서 갱신 문구 확인 |
| 문서 게이트 | 생성물 일치·current-state 수치 산문 검사·상대 링크 검사 통과 |
| 타입 | node·web·test 설정 모두 진단 없이 완료 |
| lint | 0 error / 2 warning: OpenCode `Timeline.tsx`, `useTranscriptVirtualizer.ts`의 기존 `react-hooks/incompatible-library` |
| lint 부수 변경 | main의 `chat-turn.execution-config.test.ts`에 생긴 자동 줄바꿈만 원복. 해당 파일의 최종 diff 없음 |
| 변경 범위 | 제품 코드·토큰·의존성·IPC·저장 포맷 변경 없음 |

## Oracle 음성 대조

[검증 도구](check-design-docs.py)는 메모리의 문서 사본을 바꾸며 제품 파일은 수정하지 않는다.

| 심은 결함 | 기대 / 관측 |
|---|---|
| 카탈로그 TSX 행 제거 | 누락 오류 / red |
| 존재하지 않는 TSX 행 추가 | 오래된 경로 오류 / red |
| 진입점별 디자인 시스템 링크 제거 | 각 자리 red — root/app/renderer AGENTS·docs INDEX |
| 진입점별 카탈로그 링크 제거 | 각 자리 red — root/app/renderer AGENTS·docs INDEX |

선택 음성 대조는 카탈로그 2개와 링크 8개로, 전부 의도한 오류를 관측했다.
이 도구는 카탈로그 완전성과 진입점을 검사한다. 문장 의미·실제 UI의 디자인 준수는 아래 소스 대조와 후속 UI 검토가 담당한다.

## 의미 대조

| 가이드의 선택 기준 | 대조한 소스 / 관측 |
|---|---|
| primary 중립 반전·danger rust | `shared/ui/Button.tsx`의 TEXT·squishClass |
| white/dark·oc·stage 범위 | `styles/tokens.css`·OpenCode composer appearance·CameraView |
| rem·transcript 전용 배율 | `styles/app.css`·tokens의 inline type scale·ReadingColumn·theme.ts |
| 모달 backdrop·busy·X 없음 | `shared/ui/Modal.tsx`·MODAL_BACKDROP_CLASS·ModalActions |
| 메뉴·툴팁 표면 | Popover·MenuItem·CascadeMenu·tooltipStyle |
| 사용량 의미색 | usageTone·Meter·UsageCircle |
| 설정 레일 | Rail의 좌측 nav·중립 선택·nested·aria-current |
| 공통 assistant 본문 책임 | common/transcript/AssistantMessage의 segment 투영, 메타는 턴 소유 |
| 계획 승인 | components/ApprovalCard는 plan 전용이며 입력 대체, tool/ask는 별도 하네스 표면 |
| 캡처 화면 | CapturesView의 Future Scope 안내, 실제 목록/미리보기 아님 |

위 경로는 `app/src/renderer/src/` 기준이다. 실제 UI를 바꾸지 않아 앱 스크린샷·시각 인수는 수행하지 않았다.
새 UI 제작 시 확인할 시각·상태·폭·키보드 항목은 renderer AGENTS와 디자인 시스템에 명시했다.
