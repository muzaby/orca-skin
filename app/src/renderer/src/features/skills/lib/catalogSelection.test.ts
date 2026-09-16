import { describe, expect, it } from 'vitest'
import { en } from '../../../shared/i18n/resources/en'
import { ko } from '../../../shared/i18n/resources/ko'
import {
  back,
  CATALOG_TABS,
  INITIAL_CATALOG_SELECTION,
  openDetail,
  selectTab
} from './catalogSelection'
describe('catalog selection', () => {
  // 0181 — 구 plugins 탭 자리에 providers 가 들어왔다(0180 제거 → 0181 재작성).
  it('탭은 플러그인·스킬·MCP 순서이고 라벨이 해석된다', () => {
    expect(CATALOG_TABS.map((item) => item.tab)).toEqual(['providers', 'skills', 'mcp'])
    expect(ko.skills.rail.skills).toBeTruthy()
    expect(en.skills.rail.skills).toBeTruthy()
    expect(ko.skills.rail.mcp).toBeTruthy()
    expect(en.skills.rail.mcp).toBeTruthy()
    expect(ko.skills.rail.providers).toBe('플러그인')
    expect(en.skills.rail.providers).toBe('Plugins')
  })
  it('탭을 바꾸면 선택이 해제된다', () =>
    expect(selectTab({ tab: 'skills', selectedId: 'x' }, 'mcp')).toEqual({
      tab: 'mcp',
      selectedId: null
    }))
  it('첫 진입은 플러그인 탭이다', () => {
    expect(INITIAL_CATALOG_SELECTION).toEqual({ tab: 'providers', selectedId: null })
  })
  it('상세를 열었다 뒤로가면 같은 탭의 목록으로 돌아온다', () =>
    expect(back(openDetail({ tab: 'mcp', selectedId: null }, 'p'))).toEqual({
      tab: 'mcp',
      selectedId: null
    }))
})
