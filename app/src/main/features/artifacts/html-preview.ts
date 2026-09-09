import { load } from 'cheerio'

// This document is consumed only by an opaque iframe with sandbox="". The CSP also
// blocks URLs inside preserved author CSS, which cannot safely be filtered by a regex.
const STATIC_HTML_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

const removedElements = new Set([
  'script',
  'meta',
  'base',
  'link',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',
  'fencedframe',
  'template',
  'noscript',
  'animate',
  'animatemotion',
  'animatetransform',
  'set',
  'audio',
  'video',
  'source',
  'track'
])
const removedAttributes = new Set([
  'href',
  'xlink:href',
  'action',
  'formaction',
  'target',
  'ping',
  'srcdoc',
  'srcset',
  'autofocus',
  'background',
  'poster',
  'manifest'
])
const localImage =
  /^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;charset=(?:utf-8|us-ascii))?(?:;base64)?,/iu

export function staticArtifactHtml(source: string): string {
  // Server-side parsing does not instantiate browser resources. Unlike template.innerHTML,
  // document parsing also preserves html/body attributes that determine a report's layout.
  const $ = load(source, { scriptingEnabled: false })
  for (const element of $('*').toArray()) {
    if (!('tagName' in element) || !('attribs' in element)) continue
    const tag = element.tagName.toLowerCase()
    if (removedElements.has(tag)) {
      $(element).remove()
      continue
    }
    for (const name of Object.keys(element.attribs)) {
      const attribute = name.toLowerCase()
      if (attribute.startsWith('on') || removedAttributes.has(attribute)) {
        $(element).removeAttr(name)
      } else if (attribute === 'src') {
        const source = element.attribs[name]!.trim()
        if (tag !== 'img' || !localImage.test(source)) $(element).removeAttr(name)
        else $(element).attr(name, source)
      }
    }
  }
  const policy = $('<meta>').attr({
    'http-equiv': 'Content-Security-Policy',
    content: STATIC_HTML_CSP
  })
  // The iframe supplies the light canvas. A transparent root preserves propagation
  // of an authored body background; authored rules and inline styles keep precedence.
  $('head').prepend($('<style>').text('html { color-scheme: light; color: black }'))
  $('head').prepend(policy)
  return $.html()
}
