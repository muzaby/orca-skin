# epitaxy — Claude Code 데스크톱 UI 분석

> 대상: Claude Code 데스크톱의 **컴포저 상단 스택**(저장소·PR·브랜치·diff·CI 행)과 **diff 패널** 타일.
> CSS 네임스페이스가 `epitaxy-*` / `data-cds=*` 라 그 이름을 디렉토리명으로 삼았다.
> 조사 방식: 렌더된 DOM 두 조각(컴포저 aux 행 1개, diff 타일 1개)을 속성 단위로 읽었다. 조사 일자 2026-08-28.

| 문서 | 내용 |
|---|---|
| [01-컴포저-상단-스택.md](01-컴포저-상단-스택.md) | 행 골격 · `display:contents` 그룹 · shrink 서열 · 2-span 트렁케이션 · 상태 3축 |
| [02-diff-패널.md](02-diff-패널.md) | 타일 슬롯 기하 · `tiles-shell` 1×1 그리드 · 포커스 변수 재기준 · 드래그 2종 · 트리/커밋/파일 3영역 |
| [03-orca-대조.md](03-orca-대조.md) | Orca 현재 구현과 축별 대조 · 적용 후보 · 이 캡처로 못 가른 것 |

## 캡처 범위의 한계

**한 시점의 DOM 두 조각이 전부다.** 메뉴·팝오버는 전부 닫힌 상태(`aria-expanded="false"`)로 잡혔고
diff 본문은 모든 파일이 접힌 상태(`aria-expanded="false"`)라 hunk·줄 마크업이 없다. 상호작용 이후의
DOM, 애니메이션, 상태 전이는 관측되지 않았다 — **여기 표에 없는 것은 이 조사가 모르는 것이다.**
추론으로 채운 자리는 문서 안에서 "추정" 으로 표시했다.

## 이 문서의 지위

`docs/etc/` 는 **evidence 지 현재 규칙이 아니다**([`../../../INDEX.md`](../../../INDEX.md) §Evidence).
여기 적힌 Claude Code 의 동작은 Orca 의 사양이 아니고, 채택 여부는 별도 handoff 의 결정이다.
Orca 가 지금 무엇을 하는지는 코드와 `docs/arch/` 가 갖는다.
