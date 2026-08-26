// 컴포저 칩의 외형 두 가지 — **한 곳에서 정한다**. 컴포저에는 칩 행이 둘 있고 둘은 서로 다른
// 것을 말한다:
//
// - `flat`  — 입력 **아래** 컨트롤 행(모드·모델·작업량·첨부). 배경에 가라앉아 본문을 방해하지 않는다.
// - `outlined` — 입력 **위** 작업 컨텍스트 행(작업 경로·브랜치·참조 경로). 테두리로 각 칩의 경계를
//   그어 "지금 어디서, 어느 브랜치로, 무엇을 더 보고 도는가" 가 낱개로 읽히게 한다.
//
// 세 컴포넌트(CwdButton·ComposerChip·ExtraDirChip)가 한 행에 섞여 서므로 클래스를 각자 적어
// 두면 반드시 어긋난다 — 높이 1px, 반경 2px 차이가 행 전체를 흐트러뜨린다.

export type ChipVariant = 'flat' | 'outlined'

// outlined 행에 선 칩들의 글리프 크기. 테두리가 각 칩의 경계를 그으면 글리프 2px 차이가
// 바로 눈에 띈다 — CwdButton 은 flat(타이틀바)에서는 원래 크기(14)를 유지한다.
export const OUTLINED_ICON_SIZE = 12

const BASE =
  'inline-flex h-7 max-w-full items-center gap-g3 rounded-r4 bg-transparent text-footnote transition-colors'

const TONE: Record<ChipVariant, string> = {
  flat: 'border border-transparent text-t6 hover:bg-fill-contained-hover hover:text-t7',
  outlined: 'border border-border text-t6 hover:bg-fill-uncontained-hover hover:text-t7'
}

// 라벨 없는 아이콘 전용 칩은 좌우 여백을 줄여 정사각에 가깝게 둔다 — 테두리가 붙으면
// 텍스트 칩과 같은 px 여백이 과하게 넓어 보인다.
export function chipSurface(variant: ChipVariant, iconOnly = false): string {
  return `${BASE} ${iconOnly ? 'px-p3' : 'px-p5'} ${TONE[variant]}`
}
