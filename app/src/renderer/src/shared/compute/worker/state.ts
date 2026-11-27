import { diffLines, parsePatch } from 'diff'
import { hunksToDiffLines } from '../diffModel'
import { patchFileLines } from '../unifiedDiffLines'
import { DIFF_MODEL_CACHE_ENTRIES } from '../limits'
import {
  buildDiffView,
  diffViewRows,
  diffViewLocate,
  diffViewContext,
  type DiffModel
} from '../diffView'
import {
  diffSourceDocs,
  diffSourceKey,
  unpackLines,
  type DiffSourceRef,
  type LineNumbers
} from '../diffSource'
import {
  docKey,
  sourceDoc,
  requestDocs,
  type DocRef,
  type WireControl,
  type WireRequest,
  type WireResponse,
  resultSize
} from '../protocol'
import { stripLineNumberGutter } from '../gutter'
import { buildCodeIndex, codeWindow, type CodeIndex } from '../codeView'
import { tokensRange, type TokenDocument } from './tokens'
import { getHighlighter } from './highlighter'
import { handleMessage } from './handler'

export function createWorkerState(
  now: () => number = () => performance.now()
): (message: WireRequest | WireControl) => Promise<WireResponse | undefined> {
  interface Document extends TokenDocument {
    lines?: LineNumbers
    view?: Document
    index?: CodeIndex
  }
  const documents = new Map<string, Document>()
  const suspended = new Map<number, { refs: string[]; range: ReturnType<typeof tokensRange> }>()
  type CachedModel = {
    refs: string[]
    model: DiffModel
    axes: Partial<Record<'old' | 'new', Document>>
  }
  const models = new Map<string, CachedModel>()
  function read(ref: DocRef): Document {
    const document = documents.get(docKey(ref))
    if (!document) throw Error('unknown-doc')
    return document
  }
  function modelFor(source: DiffSourceRef, ignoreWhitespace: boolean): CachedModel {
    const key = diffSourceKey(source) + (ignoreWhitespace ? '|w' : '|k')
    const hit = models.get(key)
    if (hit) {
      models.delete(key)
      models.set(key, hit)
      return hit
    }
    const lines =
      source.kind === 'pair'
        ? hunksToDiffLines(diffLines(read(source.old).text, read(source.new).text))
        : source.kind === 'patch'
          ? patchFileLines(parsePatch(read(source.doc).text))
          : unpackLines(read(source.doc).text, read(source.doc).lines!)
    const entry: CachedModel = {
      refs: diffSourceDocs(source).map(docKey),
      model: buildDiffView(lines, ignoreWhitespace),
      axes: {}
    }
    models.set(key, entry)
    if (models.size > DIFF_MODEL_CACHE_ENTRIES) models.delete(models.keys().next().value!)
    return entry
  }
  return async (message) => {
    if ('type' in message) {
      const key = docKey(message.ref)
      const old = documents.get(key)
      if (old) {
        for (const [id, job] of suspended) {
          if (job.refs.includes(key)) suspended.delete(id)
        }
      }
      for (const [id, model] of models) if (model.refs.includes(key)) models.delete(id)
      if (message.type === 'doc.close') documents.delete(key)
      else if (message.type === 'doc.open')
        documents.set(key, { text: message.text, lines: message.lines, chains: new Map() })
      else throw Error('Wrong lane for a Markdown source extension')
      return
    }
    for (const id of message.discard ?? []) suspended.delete(id)
    try {
      if (
        message.kind === 'diffView' ||
        message.kind === 'diffLocate' ||
        message.kind === 'diffContext'
      ) {
        const { model } = modelFor(
          message.source,
          message.kind === 'diffContext'
            ? message.ignoreWhitespace
            : message.options.ignoreWhitespace
        )
        const result =
          message.kind === 'diffView'
            ? diffViewRows(model, message.options, message.start, message.end)
            : message.kind === 'diffLocate'
              ? diffViewLocate(model, message.options, message.anchors)
              : diffViewContext(model, message.lineIndex)
        return { id: message.id, ok: true, result, size: resultSize(result) }
      }
      if (message.kind !== 'tokens' && message.kind !== 'codeView') return handleMessage(message)
      const source = message.kind === 'codeView' ? message.source : message
      let doc: Document
      if ('axis' in source) {
        const { axis } = source
        const entry = modelFor(axis.source, axis.ignoreWhitespace)
        doc = entry.axes[axis.axis] ??= {
          text: entry.model.lines
            .filter((l) => l.type !== (axis.axis === 'old' ? 'added' : 'removed'))
            .map((l) => l.text)
            .join('\n'),
          chains: new Map()
        }
      } else {
        const raw = read(sourceDoc(source))
        doc =
          'view' in source
            ? (raw.view ??= { text: stripLineNumberGutter(raw.text), chains: new Map() })
            : raw
      }
      if (message.kind === 'codeView') {
        const result = codeWindow(
          (doc.index ??= buildCodeIndex(doc.text)),
          message.start,
          message.end
        )
        return { id: message.id, ok: true, result, size: resultSize(result) }
      }
      const range =
        message.resumeFrom === undefined ? undefined : suspended.get(message.resumeFrom)?.range
      if (message.resumeFrom !== undefined) suspended.delete(message.resumeFrom)
      const cursor = range ?? tokensRange(doc, message, await getHighlighter(), now)
      const step = cursor.next()
      if (!step.done) {
        suspended.set(message.id, { refs: requestDocs(message).map(docKey), range: cursor })
        return { id: message.id, ok: 'continue' }
      }
      return { id: message.id, ok: true, result: step.value, size: resultSize(step.value) }
    } catch (error) {
      return {
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
