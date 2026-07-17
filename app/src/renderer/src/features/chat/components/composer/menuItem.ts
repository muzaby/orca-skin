// composer 드롭다운 메뉴(EffortMenu · ModeMenu · ModelMenu)가 공유하는 항목 버튼 클래스.
// 세 메뉴는 같은 Popover 콘텐츠 패턴이라 항목 스타일도 한 곳에서 유지한다.
// 공용 shared/ui/MenuItem 으로 수렴하지 않는 문서화된 예외(handoff 0121) — 이 세 메뉴는
// 2줄(라벨+설명)·우측 체크 레이아웃이라 items-start 정렬이 필요하고, 이미 단일 상수다.
// 단순 아이콘+라벨 항목은 shared/ui/MenuItem 을 쓴다(AttachMenu 선례).
export const MENU_ITEM =
  'flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-sidebar'
