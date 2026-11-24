import { createElement } from 'react'
import { it, vi } from 'vitest'
import { expectVirtualKeys } from '../../../shared/ui/virtual/rowKeys.testfixture'
import { CATALOG_VIRTUALIZE_AFTER } from '../../../shared/ui/virtual/limits'

import { ProjectsScreen } from './ProjectsScreen'

it('gives the virtualizer the project IDs in visible order', () => {
  const projects = Array.from({ length: CATALOG_VIRTUALIZE_AFTER + 1 }, (_, i) => ({
    id: 'project-' + (100 - i),
    name: 'Project',
    cwd: null,
    createdAt: 0,
    updatedAt: 0,
    instructions: '',
    pinnedAt: null
  }))
  expectVirtualKeys(
    createElement(ProjectsScreen, {
      projects,
      loading: false,
      onOpenProject: vi.fn(),
      onCreate: vi.fn(),
      onTogglePin: vi.fn()
    }),
    projects.map((project) => project.id)
  )
})
