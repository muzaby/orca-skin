import { useMemo } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { CopyIconButton } from '../../../../../shared/ui/CopyIconButton'
import { DiffTable } from '../../common/transcript/DiffTable'
import { buildDiffLines } from '../../../lib/diffLines'
import { unifiedDiffLines } from '../../../lib/unifiedDiffLines'
import { stringify } from '../../../format'
import type { OpenCodeFileView, OpenCodeToolView } from '../toolPresentation'
import { OpenCodeIcon } from '../Icon'
import { useToolDisclosure } from './viewState'

export function OutputPanel({
  text,
  label,
  command,
  error = false
}: {
  text: string
  label: string
  command?: string
  error?: boolean
}): React.JSX.Element {
  const { tr } = useI18n()
  const shell = command !== undefined
  const copied = shell ? `$ ${command}${text ? '\n\n' + text : ''}` : text
  return (
    <div
      data-component={shell ? 'opencode-shell-output' : 'opencode-tool-output'}
      className="group/oc-output relative overflow-hidden rounded-[6px] border-[0.5px] border-oc-border bg-oc-surface"
    >
      <div className="absolute right-[4px] top-[4px] z-10 opacity-0 transition-opacity group-hover/oc-output:opacity-100 group-focus-within/oc-output:opacity-100">
        <CopyIconButton text={copied} title={tr('common.copy')} />
      </div>
      <div
        tabIndex={0}
        data-scrollable=""
        aria-label={label}
        className="max-h-[240px] overflow-auto outline-none ring-focus [scrollbar-width:none]"
      >
        {shell && (
          <pre
            data-slot="shell-command"
            className="m-0 whitespace-pre-wrap break-words p-[12px] pr-[40px] font-mono text-[calc(13px*var(--transcript-text-scale,1))] font-[440] leading-[20px] text-oc-ink"
          >
            $ {command}
          </pre>
        )}
        {text && (
          <pre
            data-slot="tool-output"
            className={`m-0 whitespace-pre-wrap break-words p-[12px] pr-[40px] font-mono text-[calc(13px*var(--transcript-text-scale,1))] font-[440] leading-[20px] ${shell ? 'border-t-[0.5px] border-oc-border bg-oc-layer-1' : ''} ${error ? 'text-oc-bad' : shell ? 'text-oc-muted' : 'text-oc-ink'}`}
          >
            {text}
          </pre>
        )}
      </div>
    </div>
  )
}
function FilePanel({
  file,
  write,
  disclosureKey
}: {
  file: OpenCodeFileView
  write: boolean
  disclosureKey: string
}): React.JSX.Element {
  const { tr } = useI18n()
  const [open, setOpen] = useToolDisclosure(disclosureKey, true)
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
      open={open}
      className="group/oc-file rounded-[8px] border-[0.5px] border-oc-border bg-oc-surface"
      data-component="opencode-file-diff"
    >
      <summary
        onClick={(event) => {
          event.preventDefault()
          setOpen((value) => !value)
        }}
        className="sticky top-[var(--oc-sticky-top)] z-10 flex min-h-[36px] cursor-pointer list-none items-center gap-[8px] rounded-[8px] bg-oc-surface px-[12px] py-[8px] text-[calc(13px*var(--transcript-text-scale,1))] leading-[20px] text-oc-ink outline-none ring-focus"
      >
        <OpenCodeIcon name="code-slash" className="text-oc-faint" />
        <span className="min-w-0 flex-1 truncate" title={file.path}>
          {file.path}
        </span>
        {!write && lines.length > 0 && (
          <span className="shrink-0 font-mono">
            <span className="text-oc-good">+{added}</span>{' '}
            <span className="text-oc-bad">−{removed}</span>
          </span>
        )}
        <OpenCodeIcon
          name="chevron-down"
          size={14}
          className="-rotate-90 text-oc-faint group-open/oc-file:rotate-0"
        />
      </summary>
      {write ? (
        <OutputPanel text={file.after ?? file.patch ?? ''} label={file.path} />
      ) : lines.length > 0 ? (
        <div
          className="max-h-[384px] overflow-auto border-t border-oc-border"
          tabIndex={0}
          data-scrollable=""
          aria-label={tr('chat.opencode.fileDiff')}
        >
          <DiffTable lines={lines} filePath={file.path} appearance={diffAppearance} />
        </div>
      ) : (
        <OutputPanel text={file.patch ?? ''} label={file.path} />
      )}
    </details>
  )
}
export function ToolBody({
  view,
  disclosureKey = view.name
}: {
  view: OpenCodeToolView
  disclosureKey?: string
}): React.JSX.Element {
  const { tr } = useI18n()
  const content = view.output || (view.kind === 'generic' ? view.inputText : '')
  return (
    <div className="flex min-w-0 flex-col gap-[8px]">
      {view.files.map((file, index) => (
        <FilePanel
          key={`${file.path}:${index}`}
          file={file}
          write={view.kind === 'write'}
          disclosureKey={`file:${disclosureKey}:${file.path}:${index}`}
        />
      ))}
      {view.kind === 'task' && (
        <div
          data-component="opencode-task"
          className="rounded-[8px] bg-oc-layer-2 px-[12px] py-[8px] text-oc-ink"
        >
          <span className="font-[530] leading-[20px]">{tr('chat.opencode.tool.task')}</span>
          <p className="mt-[4px] break-words">{view.subtitle}</p>
        </div>
      )}
      {view.kind === 'todo' && (
        <ul className="space-y-1 px-[12px] py-[8px]">
          {view.todos.map((todo, index) => (
            <li key={index} className="flex gap-[8px]">
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
          className="break-all text-oc-accent hover:underline"
        >
          {view.url}
        </a>
      )}
      {(content || view.kind === 'shell') && (
        <OutputPanel
          text={content}
          label={view.name}
          command={view.kind === 'shell' ? (view.command ?? '') : undefined}
          error={view.outcome === 'failed'}
        />
      )}
      {view.original && (
        <details className="text-caption text-oc-muted">
          <summary className="cursor-pointer">{tr('chat.opencode.originalTool')}</summary>
          <pre
            data-scrollable=""
            className="mt-[8px] max-h-[240px] overflow-auto whitespace-pre-wrap break-words font-mono"
          >
            {stringify(view.original)}
          </pre>
        </details>
      )}
    </div>
  )
}
import { diffAppearance } from './diffAppearance'
