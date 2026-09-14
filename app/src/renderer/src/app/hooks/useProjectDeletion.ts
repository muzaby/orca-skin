import { useCallback, useRef } from 'react'
import { matchPath, useNavigate } from 'react-router-dom'
import { chatActions } from '../../features/chat'
import { projectsActions, useProjectsState } from '../../features/projects'
import { projectNavActions, sessionsActions } from '../../features/sessions'
import { useI18n } from '../../shared/i18n'
import { openConfirmDialog } from '../../shared/ui/confirmDialogStore'

// 셸 단일 인스턴스가 Nav와 개별 페이지의 삭제를 조합한다. feature는 자기 상태만 정리한다.
export function useProjectDeletion(): (projectId: string) => void {
  const navigate = useNavigate()
  const projects = useProjectsState((state) => state.list)
  const { tr } = useI18n()
  const pending = useRef(new Set<string>())

  return useCallback(
    (projectId: string): void => {
      const project = projects.find((item) => item.id === projectId)
      if (!project || pending.current.has(projectId)) return
      openConfirmDialog({
        title: tr('projects.deleteDialogTitle'),
        message: tr('projects.deleteDialogMessage', { name: project.name }),
        confirmLabel: tr('common.delete'),
        danger: true,
        onConfirm: () => {
          if (pending.current.has(projectId)) return
          pending.current.add(projectId)
          void (async () => {
            try {
              // remove는 DB 성공 후 로컬 catalog만 정리한다. 후속 조회 실패와 삭제 실패를 섞지 않는다.
              await projectsActions.remove(projectId)
            } catch {
              window.alert(tr('projects.deleteFailed'))
              return
            } finally {
              pending.current.delete(projectId)
            }
            sessionsActions.detachProject(projectId)
            chatActions.detachProject(projectId)
            projectNavActions.remove(projectId)
            // Promise가 대기하는 동안 사용자가 이동할 수 있으므로 완료 시 브라우저의 현재
            // pathname을 직접 읽는다. 요청을 시작한 render의 location을 캡처하지 않는다.
            if (
              matchPath('/projects/:projectId', window.location.pathname)?.params.projectId ===
              projectId
            )
              navigate('/projects', { replace: true })
          })()
        }
      })
    },
    [navigate, projects, tr]
  )
}
