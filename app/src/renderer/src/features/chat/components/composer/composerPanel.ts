// 컴포저 **패널 스택**(`Composer.tsx` 의 `flex flex-col gap-2` 컨테이너)에 쌓이는 패널들의
// 크롬을 **한 곳에서** 정한다 — 배경 · 반경 · 안쪽 여백 · 본문 크기.
//
// 스택에는 성격이 다른 패널이 섞여 선다(git 행 · 안내 메시지). 각자 클래스를 적어 두면
// 배경 한 톤, 반경 2px, 여백 1px 차이가 스택 전체를 흐트러뜨린다 — `chipSurface` 가 칩
// 행에서 막는 것과 같은 종류의 어긋남이다(0206 D-021).
//
// **적용 대상은 콤팩트 패널 둘뿐이다**(0206 §10 EP-09). 승인 카드 3종은
// `rounded-r7 border border-t5 bg-surface-primary-elevated shadow` 로 의도적으로 다른
// 티어이고, `CwdPanel` 은 랜딩 칩 레일이라 0201 D-011 이 외형을 소유한다.
//
// ── 값의 출처 = 참조 디자인 실측 ────────────────────────────────────────────
// 이미지 픽셀을 **글자 크기로 정규화**해 옮겼다. 참조 본문 42.5px ↔ Orca `text-footnote`
// 12px 이므로 k = 0.2824 CSS px / image px. DPR 을 몰라도 비율은 성립한다.
//
//   패널 채움  #f2f2f0 (페이지 #fbfbf9 대비 −10)  → `bg-bg2`  (#f4f4f3, `bg` 대비 −11)
//   테두리     없음 (가장자리에 어두운 링 0)       → 지정하지 않는다
//   반경       25px × k = 7.1px                   → `r4` (0.5rem = 6.5px)
//   좌우 여백  32px × k = 9.0px                   → `p6` (0.75rem = 9.75px)
//   상하 여백  29px × k = 8.2px                   → `p5` (0.625rem = 8.125px)
//   본문       42.5px × k = 12px                  → `text-footnote`
//   글리프     40px × k = 11.3px                  → 12
//
// 여백이 상하·좌우로 갈리는 것은 실측이 그렇기 때문이다 — 참조도 9.0 / 8.2 로 다르다.
// rem 기반 토큰이라 밀도 설정(11.5 / 13 / 14.5px)을 따라 함께 늘고 준다.

// 패널 선두 글리프 크기. 칩 행의 `OUTLINED_ICON_SIZE` 와 같은 12 이지만 **다른 행의
// 규칙**이라 별도 상수로 둔다 — 한쪽을 바꿀 때 다른 쪽이 조용히 따라가면 안 된다.
export const COMPOSER_PANEL_ICON_SIZE = 12

// 흐름(flex 방향·정렬)은 **호출부가 소유**한다. git 행은 한 줄이라 `items-center` 고
// 안내 패널은 제목+본문이 쌓여 `items-start` 다 — 크롬은 그 축을 강제하지 않는다.
export const composerPanelSurface = 'rounded-r4 bg-bg2 px-p6 py-p5 text-footnote'
