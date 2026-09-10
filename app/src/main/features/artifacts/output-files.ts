import type { TurnExtensions } from '../../adapters/turn'
import type { ArtifactRef } from '../../../shared/artifacts'
import { prepareOutputDirectory } from './files'
import type { ArtifactService } from './service'

export async function createWorkOutputFiles(
  service: Pick<ArtifactService, 'captureOutput'>,
  cwd: string,
  onCaptured: (sessionId: string, file: ArtifactRef) => void
): Promise<NonNullable<TurnExtensions['outputFiles']>> {
  const directory = await prepareOutputDirectory(cwd)
  return {
    directory,
    async capture(path, context, expectedContent) {
      const signal = context.getSignal()
      const sessionId = await context.waitForSession(signal)
      const file = await service.captureOutput(
        path,
        directory,
        {
          sessionId,
          cwd: context.cwd,
          extraDirs: context.extraDirs,
          signal,
          isCurrent: () => !signal.aborted
        },
        expectedContent
      )
      if (file) {
        try {
          onCaptured(sessionId, file)
        } catch {
          // 이미 커밋된 파일은 목록을 다시 읽으면 복구된다.
        }
      }
      return file
    }
  }
}
