// 컴포저 칩의 외형 두 가지 — **한 곳에서 정한다**. 컴포저에는 칩 행이 둘 있고 둘은 서로 다른
// 것을 말한다:
//
// - `flat`  — 입력 **아래** 컨트롤 행(모드·모델·작업량·첨부). 배경에 가라앉아 본문을 방해하지 않는다.
// - `outlined` — 입력 **위** 작업 컨텍스트 행(작업 경로·브랜치·참조 경로). 테두리로 각 칩의 경계를
//   그어 "지금 어디서, 어느 브랜치로, 무엇을 더 보고 도는가" 가 낱개로 읽히게 한다.
//
// 세 컴포넌트(CwdButton·ComposerChip·ExtraDirChip)가 한 행에 섞여 서므로 클래스를 각자 적어
// 두면 반드시 어긋난다 — 높이 1px, 반경 2px 차이가 행 전체를 흐트러뜨린다.

// - `segment` — outlined 행 안에서 **테두리 하나를 나눠 쓰는 묶음**의 원소(브랜치 + 워크트리).
//   두 값이 "다음 세션을 어디서 시작하는가" 라는 한 결정을 이루므로 참조 컴포저도 그 둘만
//   한 테두리로 묶는다. 버튼은 여전히 둘이고 사이의 실선이 경계를 긋는다.
export type ChipVariant = 'flat' | 'outlined' | 'segment'

// outlined 행에 선 칩들의 글리프 크기. 테두리가 각 칩의 경계를 그으면 글리프 2px 차이가
// 바로 눈에 띈다 — CwdButton 은 flat(타이틀바)에서는 원래 크기(14)를 유지한다.
export const OUTLINED_ICON_SIZE = 12

const BASE =
  'inline-flex max-w-full items-center gap-g3 bg-transparent text-footnote transition-colors'

// 높이 · 반경 · 테두리 두께 — **variant 마다 정확히 한 벌**이다. 같은 속성의 유틸리티를 두 벌
// 실으면 어느 쪽이 이기는지는 className 문자열 순서가 아니라 생성된 CSS 순서가 정한다.
const GEOMETRY: Record<ChipVariant, string> = {
  flat: 'h-7 rounded-r4 border',
  outlined: 'h-7 rounded-r4 border',
  // 묶음 안의 칩은 자기 테두리·반경을 갖지 않는다 — `chipGroupSurface` 가 하나로 갖는다.
  // 높이도 다시 적지 않는다: 여기서 `h-7` 을 쓰면 묶음 테두리 2px 만큼 형제 칩보다 커진다.
  segment: 'self-stretch'
}

const TONE: Record<ChipVariant, string> = {
  flat: 'border-transparent text-t6 hover:bg-fill-contained-hover hover:text-t7',
  outlined: 'border-border text-t6 hover:bg-fill-uncontained-hover hover:text-t7',
  segment: 'text-t6 hover:bg-fill-uncontained-hover hover:text-t7'
}

const PRESSED: Record<ChipVariant, string> = {
  flat: 'border-accent text-accent',
  outlined: 'border-accent text-accent',
  // 묶음 칩에는 자기 테두리가 없다 — 눌림을 채움과 글자색으로 말한다.
  segment: 'bg-fill-uncontained-hover text-accent'
}

// 라벨 없는 아이콘 전용 칩은 좌우 여백을 줄여 정사각에 가깝게 둔다 — 테두리가 붙으면
// 텍스트 칩과 같은 px 여백이 과하게 넓어 보인다.
export function chipSurface(variant: ChipVariant, iconOnly = false, pressed = false): string {
  const stateTone = pressed ? PRESSED[variant] : TONE[variant]
  return `${BASE} ${GEOMETRY[variant]} ${iconOnly ? 'px-p3' : 'px-p5'} ${stateTone}`
}

// 분리된 칩 둘을 **테두리 하나**가 감싸는 묶음. 높이는 형제 outlined 칩과 같은 `h-7` 이고
// `border-box` 라 테두리를 포함한다 — 안쪽 칩이 `self-stretch` 로 그 높이를 채우므로 두 칩의
// 클릭 영역이 묶음과 정확히 겹친다. `overflow-hidden` 은 칩의 hover 채움을 묶음 반경으로
// 자른다(칩이 자기 반경을 가지면 모서리에 채워지지 않는 자국이 남는다).
export const chipGroupSurface =
  'inline-flex h-7 max-w-full items-stretch overflow-hidden rounded-r4 border border-border'

// 묶음 안 칩 **사이**의 실선. 묶음이 아니라 **앞 칩이** 그린다 — git 저장소가 아니면 브랜치
// 칩이 스스로 사라지는데, 묶음이 줄을 그리면 그때 세로선 하나만 남는다.
export const chipGroupDivider = 'w-px shrink-0 self-stretch bg-border'
