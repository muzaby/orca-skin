import { z } from 'zod'
import type { ArtifactRef } from '../../../shared/artifacts'
import type { RuntimeToolServer } from '../../adapters/runtime-tools'
import type { ArtifactService } from './service'
import { artifactError } from './validation'

const instructions = `Publish a completed HTML or Markdown deliverable into the current Orca conversation.
Use this when the requested result is a document the user should open or save.
Do not publish application internals, configuration, tests, logs or intermediate files
merely because they were created or edited. A requested standalone HTML example can
itself be a deliverable; decide from the user's task, not the folder or extension alone.
Finish writing and checking the file, then call this tool before the final response.
If several files are final deliverables, publish each. Do not claim publication succeeded
unless the tool confirms success. This publishes locally in Orca, not to the web.
The tool stores the published file in Orca's artifacts folder and returns its reference.
Use the completed file in your working directory or the session's additional directories
as input; do not change Orca settings or write directly to its configuration folder.
The current UI provides file cards and file actions; it does not preview document contents.`

export function createArtifactToolServer(
  service: Pick<ArtifactService, 'publish' | 'getRef'>,
  onPublished?: (sessionId: string, artifact: ArtifactRef) => void
): RuntimeToolServer {
  const name = 'publish_artifact'
  return {
    descriptor: {
      id: 'orca_artifacts',
      connectorId: 'orca_artifacts',
      alwaysLoad: true,
      instructions,
      tools: [
        {
          name,
          description:
            'Publish one finished local HTML or Markdown document to this Orca conversation. The input file is copied and preserved. Maximum 5 MiB, UTF-8; path is relative to the current working directory or an allowed absolute local path.',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false
          }
        }
      ]
    },
    implementations: [
      {
        name,
        inputSchema: {
          path: z.string().min(1).max(4096),
          title: z.string().trim().min(1).max(160).optional()
        },
        async handler(input, context) {
          if (!context)
            return {
              isError: true,
              content: [{ type: 'text', text: 'Publisher execution context is unavailable.' }]
            }
          try {
            const signal = context.getSignal()
            const sessionId = await context.waitForSession(signal)
            const receipt = await service.publish(input, {
              sessionId,
              cwd: context.cwd,
              extraDirs: context.extraDirs,
              signal,
              isCurrent: () => !signal.aborted
            })
            // Publishing is already committed. A lost UI notification must not claim that it failed.
            try {
              onPublished?.(sessionId, service.getRef(sessionId, receipt.publicationId))
            } catch {
              /* reload recovers the committed row */
            }
            return { content: [{ type: 'text', text: JSON.stringify(receipt) }] }
          } catch (error) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Artifact publication failed: ${artifactError(error).message}`
                }
              ]
            }
          }
        }
      }
    ]
  }
}
