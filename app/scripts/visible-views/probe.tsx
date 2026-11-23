import { createDiffRequirementItem } from '@renderer/features/chat/harnesses/common/rightpanel/diffRequirements'
import type { DiffRequirementDraft } from '@renderer/features/chat/reducer/chatReducer'
import { setComputeDiagnostics } from '@renderer/shared/compute/diagnostics'
import { WorkToolBody } from '@renderer/features/chat/harnesses/claude/transcript/WorkToolBody'
import { useRef, useState } from 'react'
import { FileDiffSection } from '@renderer/features/chat/harnesses/common/rightpanel/FileDiffSection'
import { usePanelSelection } from '@renderer/features/chat/hooks/usePanelSelection'
import { VirtualRowMountContext } from '@renderer/shared/ui/virtual/rowMount'
import { createRoot } from 'react-dom/client'
import { VirtualCodeView } from '@renderer/features/chat/components/code/VirtualCodeView'
import { VirtualMarkdownView } from '@renderer/features/chat/components/markdown/VirtualMarkdownView'
import { DiffTable } from '@renderer/features/chat/harnesses/common/transcript/DiffTable'
import { hunksToDiffLines } from '@renderer/shared/compute/diffModel'
import css from '@renderer/styles/app.css?inline'

const timings: string[] = []
Object.assign(window, { computeProbeTimings: timings })
setComputeDiagnostics({ job: (e) => timings.push(e.kind + ':' + e.yields), paint: () => {} })
const style = document.createElement('style')
style.textContent = css
document.head.appendChild(style)
const lines = Array.from({ length: 5001 }, (_, i) => 'const row' + i + ' = ' + i)
const kind = location.hash.slice(1)
const patch = hunksToDiffLines([{ value: lines.join('\n'), added: true }])
const file = {
  path: 'file.ts',
  status: 'modified' as const,
  added: lines.length,
  removed: 0,
  kind: 'text' as const,
  lines: patch
}
const requirement = createDiffRequirementItem({
  id: 'remote',
  sessionId: 'probe',
  base: { kind: 'none' },
  filePath: file.path,
  lines: patch,
  lineIndex: 4600,
  comment: 'selected remote row',
  createdAt: 1
})
function Screen(): React.JSX.Element {
  const owner = useRef<HTMLDivElement>(null),
    tail = useRef<HTMLDivElement>(null)
  const guard = usePanelSelection(owner, kind)
  const [draft, setDraft] = useState<DiffRequirementDraft | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <VirtualRowMountContext.Provider value={guard.notify}>
      <div
        ref={owner}
        onPointerDown={guard.onPointerDown}
        data-selection-suppressed={guard.suppressed ? '' : undefined}
        style={{ width: '100%', height: 384, overflow: 'auto' }}
      >
        {kind === 'work' ? (
          <WorkToolBody
            call={{
              toolUseId: 'probe-work',
              name: 'Task',
              input: lines.join('\n'),
              result: { isError: false, output: lines.map((l) => 'response ' + l).join('\n') }
            }}
          />
        ) : kind.startsWith('git') ? (
          <FileDiffSection
            section={{ path: file.path, added: file.added, removed: 0, patch: file }}
            collapsed={false}
            draft={draft}
            onDraftChange={setDraft}
            activeRequirementId={selected}
            requirements={[requirement]}
            view={{
              layout: kind === 'git-inline' ? 'inline' : 'side-by-side',
              wrapLines: false,
              highlightWords: true,
              ignoreWhitespace: false
            }}
            scrollOwnerRef={owner}
            tailSpacerRef={tail}
            onToggleCollapsed={() => {}}
            onOpenFile={() => {}}
          />
        ) : kind === 'markdown' ? (
          <VirtualMarkdownView
            source={lines.map((_, i) => '## Heading ' + i).join('\n\n')}
            scrollElement={owner}
          />
        ) : kind === 'diff' ? (
          <DiffTable lines={patch} filePath="file.ts" />
        ) : (
          <VirtualCodeView
            code={lines
              .map((line, i) => (i === 2500 ? line + ' // ' + 'x'.repeat(5 * 1024 * 1024) : line))
              .join('\n')}
            lang="typescript"
            showLineNumbers
            scrollElement={owner}
          />
        )}
        <div ref={tail} />
        {kind === 'git-inline' && (
          <button
            style={{ position: 'fixed', right: 0, top: 0 }}
            data-jump=""
            onClick={() => setSelected('remote')}
          >
            Locate
          </button>
        )}
      </div>
    </VirtualRowMountContext.Provider>
  )
}
createRoot(document.getElementById('root')!).render(<Screen />)
