import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ArtifactCard, artifactFailureKey } from './ArtifactCard'
import type { ArtifactFileView } from '../store/artifactStore'
const artifact = {
  publicationId: 'p',
  artifactFileId: 'f',
  title: '<script>Report</script>',
  filename: 'report.html',
  kind: 'html' as const,
  sizeBytes: 123,
  publishedAt: 1
}
function render(file?: ArtifactFileView): string {
  return renderToStaticMarkup(
    createElement(ArtifactCard, {
      artifact,
      file,
      onAction: vi.fn(),
      onRefresh: vi.fn(),
      onOpenFolder: vi.fn()
    })
  )
}
describe('artifact metadata card', () => {
  it('escapes HTML metadata and exposes explicit file actions without a full-card button or document body', () => {
    const html = render({
      checking: false,
      busy: false,
      version: 1,
      availability: { state: 'present', sizeBytes: 123, modifiedAt: 1 }
    })
    expect(html).toContain('&lt;script&gt;Report&lt;/script&gt;')
    expect(html).toContain('report.html')
    expect(html).toContain('다른 이름으로 저장')
    expect(html).toContain('탐색기에서 보기')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<iframe')
    expect(html).toMatch(/^<article /)
    expect(html).not.toContain('미리보기')
  })
  it('keeps metadata for missing and inaccessible files and labels historical trash separately', () => {
    const missing = render({
      checking: false,
      busy: false,
      version: 1,
      availability: { state: 'missing' },
      lastTrashedAt: 10
    })
    expect(missing).toContain('파일 없음')
    expect(missing).toContain('휴지통으로 이동한 시각')
    expect(missing).toContain('다시 확인')
    expect(missing).toContain('보관 폴더 열기')
    expect(missing).not.toContain('다른 이름으로 저장')
    const denied = render({
      checking: false,
      busy: false,
      version: 1,
      availability: { state: 'unavailable', reason: 'access-denied' }
    })
    expect(denied).toContain('파일에 접근할 수 없음')
    expect(denied).not.toContain('파일 없음')
  })
  it('maps known failure reasons and never displays a raw host error', () => {
    expect(artifactFailureKey('missing')).toBe('chat.artifacts.missing')
    expect(artifactFailureKey('access-denied')).toBe('chat.artifacts.unavailable')
    expect(artifactFailureKey('too-many-items')).toBe('chat.artifacts.tooMany')
    expect(artifactFailureKey('SECRET_PATH')).toBe('chat.artifacts.failed')
  })
})
