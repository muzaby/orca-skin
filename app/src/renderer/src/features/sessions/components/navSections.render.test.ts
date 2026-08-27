import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Project, SessionListItem } from '../../../../../shared/ipc'
import type { PinnedSessions, ProjectChildSessions, RecentSessions } from '../lib/navSections'
import { PinnedSectionView } from './PinnedSection'
import { PinnedProjectChildren, PinnedProjectsSectionView } from './PinnedProjectsSection'
import { SessionListView } from './SessionList'

// 0203 ΔV1 EP-9 / ΔV2 AT-13a·AT-15 — 구획 컴포넌트는 **받은 목록만** 그리고,
// 어댑터가 파티션의 **다른 칸**을 넘기면 컴파일되지 않는다.
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다.
// jsdom·testing-library 없이 react-dom/server 로 돈다(신규 의존성 0, D-013).
//
// **모든 음성 단언에 양성 짝을 둔다**(ΔV2 AT-13a). 음성만 있으면 아무것도 그리지 않는 출력에서
// 자동으로 참이 된다 — r2 의 프로젝트 구획 단언이 정확히 그랬다(접힘 뒤라 0건 렌더).

function session(id: string, title: string, over: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id,
    backend: 'claude',
    title,
    updatedAt: 1,
    preview: null,
    projectId: null,
    cwd: null,
    pinnedAt: null,
    ...over
  }
}

// 브랜드는 `splitNavSections` 만 부여한다(EP-12). 테스트 fixture 는 그 산출이 아니므로 여기서
// 캐스트한다 — 프로덕션 어댑터가 받는 값에는 이 경로가 없다.
const asPinned = (items: SessionListItem[]): PinnedSessions => items as PinnedSessions
const asRecent = (items: SessionListItem[]): RecentSessions => items as RecentSessions
const asChildren = (items: SessionListItem[]): ProjectChildSessions => items as ProjectChildSessions

const noop = (): void => {}
const rowHandlers = {
  currentSessionId: null,
  onSelectSession: noop,
  onTogglePinSession: noop,
  onDeleteSession: noop,
  onRenameSession: noop
}

// 세 구획에 "준 것"과 "주지 않은 것"을 각각 하나씩 둔다. 재파생하는 구현은 주지 않은 쪽을
// 어디선가 끌어와 출력에 넣게 되므로 음성 단언이 그것을 본다.
const GIVEN = session('given', '준-대화')
const WITHHELD = session('withheld', '안준-대화', { pinnedAt: 55 })

const PROJECT: Project = {
  id: 'p1',
  name: '프로젝트하나',
  instructions: '',
  createdAt: 0,
  updatedAt: 0,
  pinnedAt: 1
}

function renderPinned(items: SessionListItem[]): string {
  return renderToStaticMarkup(
    createElement(PinnedSectionView, { sessions: asPinned(items), ...rowHandlers })
  )
}

function renderRecent(items: SessionListItem[]): string {
  return renderToStaticMarkup(
    createElement(SessionListView, {
      sessions: asRecent(items),
      currentSessionId: null,
      projectNameById: new Map<string, string>(),
      onSelect: noop,
      onDelete: noop,
      onRename: noop,
      onTogglePin: noop
    })
  )
}

// 프로젝트 **하위 목록**은 행의 `expanded` 상태 뒤에 있어 구획 단위 렌더로는 0건이 나온다.
// 그래서 하위 목록 단언은 이 컴포넌트를 직접 렌더해서 잰다(0203 D7).
function renderProjectChildren(items: SessionListItem[] | undefined): string {
  return renderToStaticMarkup(
    createElement(PinnedProjectChildren, {
      sessions: items === undefined ? undefined : asChildren(items),
      ...rowHandlers
    })
  )
}

function renderProjectsSection(pinnedProjects: Project[] = [PROJECT]): string {
  return renderToStaticMarkup(
    createElement(PinnedProjectsSectionView, {
      pinnedProjects,
      projectChildren: {},
      onExpandProject: noop,
      onOpenProject: noop,
      onTogglePinProject: noop,
      ...rowHandlers
    })
  )
}

describe('구획 컴포넌트는 props 목록만 렌더한다 (EP-9 · AT-13a)', () => {
  it('"고정됨"은 준 목록을 그리고 안 준 것은 그리지 않는다', () => {
    const html = renderPinned([GIVEN])
    expect(html).toContain('준-대화') // 양성
    expect(html).not.toContain('안준-대화') // 음성
  })

  it('"최근 대화"는 준 목록을 그리고 안 준 것은 그리지 않는다', () => {
    const html = renderRecent([GIVEN])
    expect(html).toContain('준-대화')
    expect(html).not.toContain('안준-대화')
  })

  it('프로젝트 하위 목록은 준 목록을 그리고 안 준 것은 그리지 않는다', () => {
    const html = renderProjectChildren([GIVEN])
    expect(html).toContain('준-대화') // ← r2 에 없던 양성 짝. 0건 렌더면 여기서 깨진다
    expect(html).not.toContain('안준-대화')
  })

  // AT-05a 의 렌더 절반 — 같은 대화를 한 구획에만 주면 다른 구획 출력에는 없다.
  it('고정된 대화는 고정됨 출력에만 나타나고 최근 출력에는 없다', () => {
    const pinnedHtml = renderPinned([WITHHELD])
    const recentHtml = renderRecent([GIVEN])
    expect(pinnedHtml).toContain('안준-대화')
    expect(recentHtml).toContain('준-대화') // ← 양성 짝: 최근 출력이 비어 있지 않다
    expect(recentHtml).not.toContain('안준-대화')
  })

  it('빈 목록이면 대화 행은 없고 구획 자체는 남는다', () => {
    const pinnedHtml = renderPinned([])
    const recentHtml = renderRecent([])
    // 양성 짝 — 출력이 통째로 비어서 음성이 자동 참이 되는 경우를 배제한다.
    expect(pinnedHtml).toContain('aria-expanded') // 구획 헤더는 렌더됐다
    expect(recentHtml).toContain('아직 저장된 대화가 없습니다') // 빈 문구는 렌더됐다
    expect(pinnedHtml).not.toContain('준-대화')
    expect(recentHtml).not.toContain('준-대화')
  })

  it('하위 목록이 미조회면 로딩, 빈 배열이면 빈 문구를 그린다', () => {
    expect(renderProjectChildren(undefined)).not.toBe('')
    expect(renderProjectChildren([])).not.toBe('')
    expect(renderProjectChildren(undefined)).not.toBe(renderProjectChildren([]))
  })
})

describe('구획 헤더 (D-003 · D-008)', () => {
  it('고정 항목이 0개여도 두 구획 헤더가 남는다', () => {
    expect(renderPinned([])).toContain('aria-expanded')
    expect(renderProjectsSection([])).toContain('aria-expanded')
  })

  // 헤더만 남기려고 고정 프로젝트를 비운다 — 프로젝트 **행**의 chevron·kebab 까지 세면
  // 이 단언은 헤더가 아니라 본문을 재게 된다(r2 초안이 그래서 3을 돌려줬다).
  it('구획 헤더의 컨트롤은 접기 토글 하나다 — 추가(+) 액션이 없다', () => {
    const html = renderProjectsSection([])
    expect(html.match(/<button/g) ?? []).toHaveLength(1) // 양성: 토글 1개는 있다
    expect(html).toContain('aria-expanded')
    expect(html).not.toMatch(/aria-label="[^"]*(추가|add)/i)
  })
})

// ── AT-15 · 이음매의 음성 타입 테스트 (ΔV2 EP-11) ──────────────────────────
//
// 렌더 단언은 컴포넌트가 **무엇을 그리는지**만 보고 어댑터가 **무엇을 넘겼는지**는 못 본다 —
// r2 에서 `pinned` 대신 `recent` 를 넘겨도 497 케이스가 전부 초록이었다. `@ts-expect-error` 는
// **뒤집힌 단언**이라 그 줄의 오류가 사라지면 `typecheck` 가 깨진다 — 한 번 심었다 지우는
// 변이와 달리 다음 라운드에도 남는 눈이다(같은 수단의 선례: `src/shared/obj.test.ts` · 0190).
describe('어댑터가 파티션의 다른 칸을 넘기면 컴파일되지 않는다 (AT-15)', () => {
  it('세 구획의 슬롯 브랜드가 서로 대입되지 않는다', () => {
    const pinned = asPinned([GIVEN])
    const recent = asRecent([GIVEN])
    const children = asChildren([GIVEN])

    // @ts-expect-error "고정됨" 구획에 최근 대화 칸을 넘길 수 없다.
    createElement(PinnedSectionView, { sessions: recent, ...rowHandlers })
    // @ts-expect-error 프로젝트 하위 목록에 고정됨 칸을 넘길 수 없다.
    createElement(PinnedProjectChildren, { sessions: pinned, ...rowHandlers })
    // `@ts-expect-error` 는 **바로 다음 줄**만 덮는다 — 여러 줄 호출이면 오류가 그 줄에 안 찍혀
    // 지시자가 `TS2578`(불필요)로 뒤집힌다. 그래서 나머지 props 를 먼저 묶어 한 줄로 좁힌다.
    const recentProps = {
      currentSessionId: null,
      projectNameById: new Map<string, string>(),
      onSelect: noop,
      onDelete: noop,
      onRename: noop,
      onTogglePin: noop
    }
    // @ts-expect-error "최근 대화" 구획에 프로젝트 하위 칸을 넘길 수 없다.
    createElement(SessionListView, { sessions: children, ...recentProps })

    // 올바른 칸은 통과한다 — 브랜드가 모든 대입을 막는 것이 아니라 **혼동만** 막는다.
    expect(renderPinned([GIVEN])).toContain('준-대화')
  })
})
