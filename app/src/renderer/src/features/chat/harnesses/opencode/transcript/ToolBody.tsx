import { useMemo } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { CopyIconButton } from '../../../../../shared/ui/CopyIconButton'
import { DiffTable } from '../../../components/DiffTable'
import { buildDiffLines } from '../../../lib/diffLines'
import { unifiedDiffLines } from '../../../lib/unifiedDiffLines'
import { stringify } from '../../../format'
import type { OpenCodeFileView, OpenCodeToolView } from '../toolPresentation'

export function OutputPanel({ text, label }: { text: string; label: string }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="relative overflow-hidden rounded-md border border-oc-border">
      <div className="absolute right-2 top-2">
        <CopyIconButton text={text} title={tr('common.copy')} />
      </div>
      <pre
        tabIndex={0}
        aria-label={label}
        className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 pr-10 font-mono text-[calc(12px*var(--transcript-text-scale,1))] leading-[1.7] text-oc-ink outline-none ring-focus"
      >
        {text}
      </pre>
    </div>
  )
}
function FilePanel({ file, write }: { file: OpenCodeFileView; write: boolean }): React.JSX.Element {
  const { tr } = useI18n()
  const lines = useMemo(
    () =>
      file.before != null || file.after != null
        ? buildDiffLines(file.before ?? '', file.after ?? '')
        : unifiedDiffLines(file.patch ?? ''),
    [file.before, file.after, file.patch]
  )
  const added = lines.filter((line) => line.type === 'added').length
  const removed = lines.filter((line) => line.type === 'removed').length
  return (
    <details
      open
      className="overflow-hidden rounded-md border border-oc-border"
      data-component="opencode-file-diff"
    >
      <summary className="cursor-pointer px-3 py-2 text-caption text-oc-ink">
        <span className="break-all">{file.path}</span>
        {!write && lines.length > 0 && (
          <span className="ml-3 font-mono">
            <span className="text-good">+{added}</span> <span className="text-bad">−{removed}</span>
          </span>
        )}
      </summary>
      {write ? (
        <OutputPanel text={file.after ?? file.patch ?? ''} label={file.path} />
      ) : lines.length > 0 ? (
        <div
          className="max-h-96 overflow-auto border-t border-oc-border"
          tabIndex={0}
          aria-label={tr('chat.opencode.fileDiff')}
        >
          <DiffTable lines={lines} filePath={file.path} />
        </div>
      ) : (
        <OutputPanel text={file.patch ?? ''} label={file.path} />
      )}
    </details>
  )
}
export function ToolBody({ view }: { view: OpenCodeToolView }): React.JSX.Element {
  const { tr } = useI18n()
  const content =
    view.kind === 'shell'
      ? `$ ${view.command ?? ''}${view.output ? '\n\n' + view.output : ''}`
      : view.output || (view.kind === 'generic' ? view.inputText : '')
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {view.files.map((file, index) => (
        <FilePanel key={`${file.path}:${index}`} file={file} write={view.kind === 'write'} />
      ))}
      {view.kind === 'task' && (
        <div
          data-component="opencode-task"
          className="rounded-md border border-oc-border px-3 py-2 text-oc-ink"
        >
          <span className="text-caption font-medium">{tr('chat.opencode.tool.task')}</span>
          <p className="mt-1 break-words">{view.subtitle}</p>
        </div>
      )}
      {view.kind === 'todo' && (
        <ul className="space-y-1 px-3 py-2">
          {view.todos.map((todo, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden>{todo.status === 'completed' ? '✓' : '○'}</span>
              <span className={todo.status === 'completed' ? 'line-through' : ''}>{todo.text}</span>
              <span className="sr-only">{todo.status}</span>
            </li>
          ))}
        </ul>
      )}
      {view.url && (
        <a
          href={view.url}
          target="_blank"
          rel="noreferrer"
          className="break-all text-oc-ink underline"
        >
          {view.url}
        </a>
      )}
      {content && <OutputPanel text={content} label={view.name} />}
      {view.original && (
        <details className="text-caption text-oc-muted">
          <summary className="cursor-pointer">{tr('chat.opencode.originalTool')}</summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono">
            {stringify(view.original)}
          </pre>
        </details>
      )}
    </div>
  )
}
