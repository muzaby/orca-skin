import { describe, expect, it } from 'vitest'
import { en } from '../../../shared/i18n/resources/en'
import { ko } from '../../../shared/i18n/resources/ko'
import { back, CATALOG_TABS, openDetail, selectTab } from './catalogSelection'
describe('catalog selection', () => {
  it('탭은 플러그인·스킬·MCP 순서이고 라벨이 해석된다', () => {
    expect(CATALOG_TABS.map((item) => item.tab)).toEqual(['plugins', 'skills', 'mcp'])
    expect(ko.skills.rail.plugins).toBe('플러그인')
    expect(en.skills.rail.plugins).toBe('Plugins')
    expect(ko.skills.rail.skills).toBeTruthy()
    expect(en.skills.rail.skills).toBeTruthy()
    expect(ko.skills.rail.mcp).toBeTruthy()
    expect(en.skills.rail.mcp).toBeTruthy()
    expect(ko.skills.rail).not.toHaveProperty('providers')
    expect(en.skills.rail).not.toHaveProperty('providers')
  })
  it('탭을 바꾸면 선택이 해제된다', () =>
    expect(selectTab({ tab: 'skills', selectedId: 'x' }, 'mcp')).toEqual({
      tab: 'mcp',
      selectedId: null
    }))
  it('상세를 열었다 뒤로가면 같은 탭의 목록으로 돌아온다', () =>
    expect(back(openDetail({ tab: 'mcp', selectedId: null }, 'p'))).toEqual({
      tab: 'mcp',
      selectedId: null
    }))
})
