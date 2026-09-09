import { describe, expect, it } from 'vitest'
import { artifactInput } from './validation'
import { artifactPreview, MAX_ARTIFACT_BYTES } from './formats'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
  'base64'
)

describe('artifact format boundaries', () => {
  it.each([
    ['report.markdown', 'markdown', 'markdown'],
    ['page.htm', 'html', 'html'],
    ['example.ts', 'text', 'typescript'],
    ['data.json', 'text', 'json'],
    ['readme.txt', 'text', 'text'],
    ['drawing.SVG', 'image', undefined],
    ['photo.JPEG', 'image', undefined]
  ])('classifies the explicit publication format %s', (filename, kind, language) => {
    expect(artifactInput({ path: filename }).kind).toBe(kind)
    if (kind !== 'image')
      expect(artifactPreview(filename, Buffer.from('hello'))).toMatchObject({
        format: kind,
        language,
        content: 'hello'
      })
  })
  it('preserves UTF-8 source and emits a validated image data URL', () => {
    expect(artifactPreview('image.png', png)).toEqual({
      state: 'ready',
      format: 'image',
      content: `data:image/png;base64,${png.toString('base64')}`,
      mimeType: 'image/png'
    })
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>한글</text></svg>'
    expect(artifactPreview('image.svg', Buffer.from(svg))).toMatchObject({
      format: 'image',
      content: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    })
    expect(artifactPreview('report.md', Buffer.from('# 한글\r\n'))).toMatchObject({
      content: '# 한글\r\n',
      mimeType: 'text/markdown'
    })
  })
  it.each([
    ['photo.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9])],
    [
      'animation.gif',
      'image/gif',
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
    ],
    [
      'image.webp',
      'image/webp',
      Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64')
    ]
  ])('recognizes the %s signature and preserves the image bytes', (filename, mimeType, bytes) => {
    expect(artifactPreview(filename, bytes)).toEqual({
      state: 'ready',
      format: 'image',
      mimeType,
      content: `data:${mimeType};base64,${bytes.toString('base64')}`
    })
  })
  it.each(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])(
    'rejects bytes with the wrong %s signature',
    (extension) => {
      expect(() =>
        artifactPreview(`fake.${extension}`, Buffer.from('<html>not an image</html>'))
      ).toThrow('invalid-image')
    }
  )
  it('rejects invalid text, XML declarations with external entities, and unsupported formats', () => {
    expect(() => artifactPreview('bad.ts', Buffer.from([0xc3, 0x28]))).toThrow('invalid-utf8')
    expect(() =>
      artifactPreview('bad.svg', Buffer.from('<!DOCTYPE svg SYSTEM "file:///private"><svg/>'))
    ).toThrow('invalid-image')
    expect(() => artifactPreview('bad.pdf', Buffer.from('hello'))).toThrow('unsupported-format')
  })
  it('enforces the inclusive byte bound during preview conversion', () => {
    expect(artifactPreview('large.txt', Buffer.alloc(MAX_ARTIFACT_BYTES, 65))).toMatchObject({
      format: 'text'
    })
    expect(() => artifactPreview('large.txt', Buffer.alloc(MAX_ARTIFACT_BYTES + 1, 65))).toThrow(
      'too-large'
    )
    expect(() => artifactPreview('large.png', Buffer.alloc(MAX_ARTIFACT_BYTES + 1))).toThrow(
      'too-large'
    )
  })
})
