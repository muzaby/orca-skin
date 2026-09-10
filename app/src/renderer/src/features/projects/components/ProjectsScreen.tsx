import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { CreateProjectModal } from './CreateProjectModal'
import { ProjectCatalogRow } from './ProjectCatalogRow'
import { useI18n } from '../../../shared/i18n'
import type { Project } from '../../../../../shared/ipc'

interface ProjectsScreenProps {
  projects: Project[]
  loading: boolean
  onOpenProject: (id: string) => void
  onCreate: (name: string, instructions: string) => Promise<void>
  onTogglePin: (id: string, pinned: boolean) => void
}

export function ProjectsScreen({
  projects,
  loading,
  onOpenProject,
  onCreate,
  onTogglePin
}: ProjectsScreenProps): React.JSX.Element {
  const { tr } = useI18n()
  const [createOpen, setCreateOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'pinned'>('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const unpinningId = useRef<string | null>(null)
  const id = useId()
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visible = useMemo(
    () =>
      projects.filter(
        (project) =>
          (tab === 'all' || project.pinnedAt != null) &&
          (!normalizedQuery ||
            `${project.name}\n${project.cwd ?? ''}`.toLocaleLowerCase().includes(normalizedQuery))
      ),
    [projects, tab, normalizedQuery]
  )
  useEffect(() => {
    if (
      unpinningId.current == null ||
      visible.some((project) => project.id === unpinningId.current)
    )
      return
    unpinningId.current = null
    if (document.activeElement === document.body)
      activeTabRef.current?.focus({ preventScroll: true })
  }, [visible])
  const closeSearch = (): void => {
    setSearchOpen(false)
    setQuery('')
    searchRef.current?.focus({ preventScroll: true })
  }
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  return (
    <section data-project-catalog="" className="flex min-h-0 min-w-0 flex-1 pb-2 pr-2">
      <div className="@container/catalog min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] px-8 pb-10 pt-10">
          <div className="flex items-center gap-3">
            <h1 className="m-0 font-serif text-[30px] font-medium tracking-[-0.02em] text-ink">
              {tr('projects.title')}
              <span className="ml-2.5 align-middle font-sans text-footnote font-normal tracking-normal text-ink3">
                {tr('common.count', { count: projects.length })}
              </span>
            </h1>
            <Button
              size="small"
              leadingIcon="plus"
              className="ml-auto"
              onClick={() => setCreateOpen(true)}
            >
              {tr('projects.newProject')}
            </Button>
          </div>
          <div className="mb-4 mt-6 flex items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label={tr('projects.title')}
              className="flex gap-1"
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 'all'
                    : event.key === 'End'
                      ? 'pinned'
                      : tab === 'all'
                        ? 'pinned'
                        : 'all'
                setTab(next)
                event.currentTarget
                  .querySelector<HTMLButtonElement>(`[data-project-tab=${next}]`)
                  ?.focus()
              }}
            >
              {(['all', 'pinned'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  ref={tab === value ? activeTabRef : undefined}
                  id={`${id}-${value}`}
                  data-project-tab={value}
                  aria-selected={tab === value}
                  aria-controls={`${id}-items`}
                  tabIndex={tab === value ? 0 : -1}
                  onClick={() => setTab(value)}
                  className={`rounded-r4 px-3 py-1.5 text-footnote transition-colors hide-focus-ring ring-focus ${tab === value ? 'bg-fill-uncontained-active font-medium text-ink' : 'text-ink3 hover:bg-fill-uncontained-hover hover:text-ink'}`}
                >
                  {tr(`artifactCatalog.${value}`)}
                </button>
              ))}
            </div>
            <Button
              ref={searchRef}
              iconOnly
              leadingIcon="search"
              pressed={searchOpen}
              aria-label={tr('projects.search')}
              title={tr('projects.search')}
              aria-expanded={searchOpen}
              aria-controls={`${id}-search`}
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            />
          </div>
          {searchOpen && (
            <div className="mb-4 flex items-center gap-2 rounded-r4 border border-border bg-panel px-3 focus-within:border-border-strong">
              <Icon name="search" size={16} className="shrink-0 text-ink3" />
              <input
                ref={inputRef}
                id={`${id}-search`}
                type="search"
                value={query}
                aria-label={tr('projects.search')}
                placeholder={tr('projects.searchPlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    closeSearch()
                  }
                }}
                className="min-w-0 flex-1 bg-transparent py-2.5 text-footnote text-ink outline-none placeholder:text-ink3"
              />
            </div>
          )}
          <div
            role="tabpanel"
            id={`${id}-items`}
            aria-labelledby={`${id}-${tab}`}
            aria-busy={loading}
          >
            {loading && projects.length === 0 ? (
              <p role="status" className="py-16 text-center text-footnote text-ink3">
                {tr('common.loading')}
              </p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-ink3">
                <Icon
                  name={normalizedQuery ? 'search' : tab === 'pinned' ? 'pin' : 'folder'}
                  size={28}
                />
                <p role="status" className="text-footnote">
                  {tr(
                    normalizedQuery
                      ? 'projects.noMatches'
                      : tab === 'pinned'
                        ? 'projects.emptyPinned'
                        : 'projects.emptyTitle'
                  )}
                </p>
                {projects.length === 0 && (
                  <Button size="small" leadingIcon="plus" onClick={() => setCreateOpen(true)}>
                    {tr('projects.createFirst')}
                  </Button>
                )}
              </div>
            ) : (
              <ul className="m-0 list-none divide-y divide-border p-0">
                {visible.map((project) => (
                  <ProjectCatalogRow
                    key={project.id}
                    project={project}
                    onOpen={() => onOpenProject(project.id)}
                    onTogglePin={(id, pinned) => {
                      if (tab === 'pinned' && !pinned) unpinningId.current = id
                      onTogglePin(id, pinned)
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (name, instructions) => {
          await onCreate(name, instructions)
          setTab('all')
          setQuery('')
          setSearchOpen(false)
        }}
      />
    </section>
  )
}
