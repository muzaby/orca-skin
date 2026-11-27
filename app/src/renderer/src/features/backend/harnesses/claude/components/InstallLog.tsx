import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { useVirtualRows } from '../../../../../shared/ui/virtual/useVirtualRows'
import { VIRTUAL_ROW_ESTIMATE_PX } from '../../../../../shared/ui/virtual/limits'
import { VirtualRowMountContext } from '../../../../../shared/ui/virtual/rowMount'
import { usePanelSelection } from '../../../../../shared/ui/virtual/usePanelSelection'
import type { InstallLogArchive } from './installLogArchive'

interface Props {
  generation: number
  archive: InstallLogArchive
  revision: number
}

export function InstallLog(props: Props): React.JSX.Element {
  const scroller = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const selection = usePanelSelection(scroller, String(props.generation))
  useLayoutEffect(() => {
    following.current = true
  }, [props.generation])
  return (
    <div
      ref={scroller}
      onPointerDown={selection.onPointerDown}
      onScroll={(event) => {
        const el = event.currentTarget
        following.current =
          el.scrollHeight - el.clientHeight - el.scrollTop < VIRTUAL_ROW_ESTIMATE_PX
      }}
      tabIndex={0}
      className="mb-3 max-h-[200px] overflow-auto rounded-r4 border border-border bg-bg p-2 font-mono text-[11.5px] text-ink2"
    >
      <VirtualRowMountContext.Provider value={selection.notify}>
        <LogRows {...props} scroller={scroller} following={following} />
      </VirtualRowMountContext.Provider>
    </div>
  )
}

function LogRows({
  archive,
  generation,
  revision,
  scroller,
  following
}: Props & {
  scroller: RefObject<HTMLDivElement | null>
  following: RefObject<boolean>
}): React.JSX.Element {
  const { tr } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  const getKey = useCallback(
    (index: number) => `${generation}:${archive.rows[index].offset}`,
    [archive, generation]
  )
  const list = useVirtualRows(archive.rows.length, root, scroller, undefined, getKey)
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && following.current) el.scrollTo({ top: el.scrollHeight })
  }, [following, scroller, revision, generation])
  return (
    <div
      ref={root}
      className="relative whitespace-pre"
      style={{ height: archive.rows.length ? list.getTotalSize() : undefined }}
    >
      {!archive.rows.length && tr('backend.installer.preparing')}
      {list.getVirtualItems().map((row) => (
        <div
          key={row.key}
          className="absolute left-0 right-0"
          style={{
            top: row.start - list.options.scrollMargin,
            height: row.size,
            lineHeight: `${row.size}px`
          }}
        >
          {archive.rows[row.index].text.endsWith('\n')
            ? archive.rows[row.index].text.slice(0, -1)
            : archive.rows[row.index].text}
        </div>
      ))}
    </div>
  )
}
