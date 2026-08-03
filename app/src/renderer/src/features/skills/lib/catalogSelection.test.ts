import { describe, expect, it } from 'vitest'
import { en } from '../../../shared/i18n/resources/en'
import { ko } from '../../../shared/i18n/resources/ko'
import { back, CATALOG_TABS, openDetail, selectTab } from './catalogSelection'
describe('catalog selection', () => {
  it('탭은 스킬·MCP·플러그인 3개이고 라벨이 해석된다', () => {
    expect(CATALOG_TABS.map((item) => item.tab)).toEqual(['skills', 'mcp', 'plugins'])
    expect(ko.skills.rail.plugins).toBeTruthy()
    expect(en.skills.rail.plugins).toBeTruthy()
  })
  it('탭을 바꾸면 선택이 해제된다', () =>
    expect(selectTab({ tab: 'skills', selectedId: 'x' }, 'mcp')).toEqual({
      tab: 'mcp',
      selectedId: null
    }))
  it('상세를 열었다 뒤로가면 같은 탭의 목록으로 돌아온다', () =>
    expect(back(openDetail({ tab: 'plugins', selectedId: null }, 'p'))).toEqual({
      tab: 'plugins',
      selectedId: null
    }))
})
