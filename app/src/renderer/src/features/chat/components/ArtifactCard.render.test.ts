import { Children, createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ArtifactCard } from './ArtifactCard'
import { artifactFailureKey } from '../lib/artifactFeedback'
import type { ArtifactFileView } from '../store/artifactStore'
import { MenuItem, type MenuItemProps } from '../../../shared/ui/MenuItem'
import type { ArtifactRef } from '../../../../../shared/artifacts'

// 메뉴스코프의 실제 JSX/콜백을 관측한다. 포털 열기·키보드 수명은 이 SSR 시험의 범위가 아니다.
const menu = vi.hoisted(() => ({ children: null as ReactNode }))
vi.mock('../../../shared/ui/Popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => {
    menu.children = children
    return null
  }
}))
const artifact = {
  publicationId: 'p',
  artifactFileId: 'f',
  title: '<script>Report</script>',
  filename: 'report.html',
  kind: 'html' as const,
  sizeBytes: 123,
  publishedAt: 1
}
function render(
  file?: ArtifactFileView,
  variant?: 'transcript' | 'list',
  ref: ArtifactRef = artifact
): string {
  return renderToStaticMarkup(
    createElement(ArtifactCard, {
      artifact: ref,
      file,
      variant,
      onAction: vi.fn(),
      onPreview: vi.fn(),
      onRefresh: vi.fn()
    })
  )
}
describe('artifact metadata card', () => {
  it('labels ordinary output files by extension and falls back to File for extensionless names', () => {
    const file: ArtifactFileView = {
      checking: false,
      busy: false,
      version: 1,
      availability: { state: 'present', sizeBytes: 123, modifiedAt: 1 }
    }
    const pdf = render(file, 'list', {
      ...artifact,
      category: 'file',
      kind: 'file',
      filename: 'report.pdf'
    })
    expect(pdf).toContain('PDF')
    expect(pdf).not.toContain('아티팩트')
    const plain = render(file, 'list', {
      ...artifact,
      category: 'file',
      kind: 'text',
      filename: 'README'
    })
    expect(plain).toContain('>파일</span>')
    expect(plain).not.toContain('아티팩트')
  })
  it('escapes HTML metadata and separates the preview trigger from auxiliary file actions', () => {
    const html = render({
      checking: false,
      busy: false,
      version: 1,
      availability: { state: 'present', sizeBytes: 123, modifiedAt: 1 }
    })
    expect(html).toContain('&lt;script&gt;Report&lt;/script&gt;')
    expect(html).toContain('report.html')
    expect(html).toContain('aria-label="다운로드"')
    expect(html).toContain('>다운로드</span>')
    expect(html).toContain('>아티팩트</div>')
    expect(html).not.toContain('아티팩트 · HTML')
    expect(html).not.toContain('role="status"')
    expect(html).not.toContain('>파일 있음<')
    expect(html).not.toContain('>탐색기에서 보기<')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<iframe')
    expect(html).toMatch(/^<article /)
    expect(html).toContain('미리보기')
    expect(html).toContain('data-artifact-preview="p"')
  })
  it('renders a compact list row with an artifact label instead of the transcript download control', () => {
    const html = render(
      {
        checking: false,
        busy: false,
        version: 1,
        availability: { state: 'present', sizeBytes: 123, modifiedAt: 1 }
      },
      'list'
    )
    expect(html).toContain('아티팩트')
    expect(html).toContain('aria-label="파일 작업"')
    expect(html).not.toContain('aria-label="다운로드"')
    expect(html).not.toContain('문서 · HTML')
    expect(html).not.toContain('role="button"')
  })
  it('keeps checking and disables busy actions while omitting the transient busy label from output lists', () => {
    for (const variant of ['transcript', 'list'] as const) {
      expect(render(undefined, variant)).toContain('확인 중')
      const busy = render(
        {
          checking: false,
          busy: true,
          version: 1,
          availability: { state: 'present', sizeBytes: 123, modifiedAt: 1 }
        },
        variant
      )
      if (variant === 'transcript') {
        expect(busy).toContain('처리 중')
        expect(busy).toMatch(/<button[^>]*disabled=""[^>]*aria-label="다운로드"/)
      } else {
        expect(busy).not.toContain('처리 중')
        expect(busy).toMatch(/<button[^>]*data-artifact-preview="p"[^>]*disabled=""/)
      }
    }
  })
  it.each(['transcript', 'list'] as const)(
    'keeps missing and inaccessible states without storage metadata in %s',
    (variant) => {
      const missing = render(
        {
          checking: false,
          busy: false,
          version: 1,
          availability: { state: 'missing' },
          lastTrashedAt: 10
        },
        variant
      )
      expect(missing).toContain('파일 없음')
      expect(missing).not.toContain('휴지통으로 이동한 시각')
      expect(missing).toContain('다시 확인')
      expect(missing).not.toContain('보관 폴더 열기')
      if (variant === 'transcript')
        expect(missing).toMatch(/<button[^>]*disabled=""[^>]*aria-label="다운로드"/)
      const denied = render(
        {
          checking: false,
          busy: false,
          version: 1,
          availability: { state: 'unavailable', reason: 'access-denied' }
        },
        variant
      )
      expect(denied).toContain('파일에 접근할 수 없음')
      expect(denied).not.toContain('파일 없음')
    }
  )
  it('keeps the same publication identity and all auxiliary actions in both variant menus', () => {
    for (const variant of ['transcript', 'list'] as const) {
      const onAction = vi.fn()
      const onRefresh = vi.fn()
      renderToStaticMarkup(
        createElement(ArtifactCard, {
          artifact,
          variant,
          file: {
            checking: false,
            busy: false,
            version: 1,
            availability: { state: 'present', sizeBytes: 123, modifiedAt: 1 }
          },
          onAction,
          onPreview: vi.fn(),
          onRefresh
        })
      )
      const items = Children.toArray(menu.children).filter(
        (node) => isValidElement<MenuItemProps>(node) && node.type === MenuItem
      )
      expect(
        items.map((node) => isValidElement<MenuItemProps>(node) && node.props.children)
      ).toEqual(['다른 이름으로 저장', '탐색기에서 보기', '다시 확인', '휴지통으로 이동'])
      for (const node of items) {
        if (isValidElement<MenuItemProps>(node)) {
          expect(node.props.disabled).not.toBe(true)
          node.props.onClick?.({} as Parameters<NonNullable<MenuItemProps['onClick']>>[0])
        }
      }
      expect(onAction.mock.calls).toEqual([
        [artifact, 'save'],
        [artifact, 'reveal'],
        [artifact, 'trash']
      ])
      expect(onRefresh).toHaveBeenCalledOnce()
      expect(Children.toArray(menu.children)).toHaveLength(4)
    }
  })
  it('maps known failure reasons and never displays a raw host error', () => {
    expect(artifactFailureKey('missing')).toBe('chat.artifacts.missing')
    expect(artifactFailureKey('access-denied')).toBe('chat.artifacts.unavailable')
    expect(artifactFailureKey('too-many-items')).toBe('chat.artifacts.tooMany')
    expect(artifactFailureKey('SECRET_PATH')).toBe('chat.artifacts.failed')
  })
})
