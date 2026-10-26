# 0287 구현 시각 확인 — r1

2026-10-26, Windows의 설치된 Electron 39.8.10 / Chromium 142에서 실제 React·Tailwind·Popover·메뉴 컴포넌트를 렌더했다. 전체 앱 프로필을 열지 않고 IPC만 fixture로 대체했다. 실제 네이티브 폴더 대화상자의 외형은 변경하지 않았으며, 반환값 처리는 page 통합 테스트로 확인했다.

재현: `app/`에서 `node scripts/composer-picker-visual.mjs`. 스크립트는 `.temp/0287-visual/`에 번들·스크린샷·`metrics.json`을 만들고 레이아웃·모션·키보드 결과를 단언한다. 숨긴 창의 캡처가 이전 프레임을 반환하는 문제를 피하려고 Electron offscreen 렌더를 사용한다.

| 항목 | 관측 |
|---|---|
| O-A4 / AC6 | 짧은 에이전트 메뉴 95.45 CSS px. 긴 이름은 좁은 viewport에서 말줄임되며 체크의 오른쪽 끝이 메뉴 안에 남는다. |
| O-A4 / AC7 | 제목 오른쪽 끝과 spinner 왼쪽 사이 7.25 CSS px. SVG는 화살표 없는 원호이며 `animationName=spin`; reduced motion에서 `none`. |
| O-P7 / AC9·15 | white/dark에서 검색·폴더 SVG·선택 체크·선택 강조·구분선·추가 버튼 표시. 프로젝트 메뉴 288.85 CSS px, 좁은 viewport에서도 좌우 경계 안에 위치. |
| O-P7 / 키보드 | 검색 초점 → Down으로 행 → Enter 선택 → trigger 복귀. Space 재열기 → 검색 초점. Tab은 다음 컨트롤로 이동. Escape는 닫고 trigger 복귀. |
| 비동기 재측정 | 열린 agent 메뉴를 짧은 이름에서 긴 이름으로 바꾸고 창을 축소해도 새 너비로 배치한다. `Popover.resize.test.ts`에서도 panel observe·좌표 변경·disconnect를 단언한다. |

실측 원본은 [visual-metrics.json](visual-metrics.json), 캡처는 [밝은 프로젝트](visual-white-project.png)·[어두운 프로젝트](visual-dark-project.png)·[에이전트 로딩](visual-white-agent.png)·[좁은 에이전트](visual-narrow-agent.png)·[좁은 프로젝트](visual-narrow-project.png)다.

이 결과는 구현자 자기확인이다. 전체 앱 배포본의 독립 인수 검증을 대체하지 않는다.
