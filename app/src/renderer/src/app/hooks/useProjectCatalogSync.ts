import { reportError } from '../../shared/errors'
import { useEffect } from 'react'
import { chatApi } from '../../shared/api/ipc'
import { projectsActions } from '../../features/projects'
import { projectNavActions, sessionsActions } from '../../features/sessions'

// 초기 목록이나 활성 대화에서 신규 여부를 추측하지 않는다. main의 실제 생성 영수증만 소비한다.
export function useProjectCatalogSync(): void {
  useEffect(
    () =>
      chatApi.onEvent((event) => {
        if (event.type !== 'session.updated' || event.patch.projectCreated !== true) return
        const projectId = event.patch.projectId
        if (!projectId || !projectNavActions.announceCreated(projectId)) return
        void projectsActions.refresh().catch((error) => {
          reportError({
            event: 'projects.refresh.failed',
            scope: 'projects',
            title: 'loadFailed',
            error: error
          })
        })
        void sessionsActions.loadProject(projectId).catch((error) => {
          reportError({
            event: 'sessions.project-load.failed',
            scope: 'sessions',
            title: 'loadFailed',
            error: error
          })
        })
      }),
    []
  )
}
