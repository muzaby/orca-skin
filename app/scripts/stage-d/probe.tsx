import { measurePanelTimings } from './panelTimings'
import { measureCatalogSelection } from './catalogSelection'
import { measureComposerFlow } from './composerFlow'
import { measureResources } from './resourceFlow'
import { measureCalculations } from './calculations'
import { measureStreamOverlap } from './streamOverlap'
import { measureProviderFlow } from './providerFlow'
import { measureCommentIndex, measurePanelInputs } from './panelInputs'
import { measureCatalogs } from './catalogs'
import { measureInstallLog } from './installLog'
import { measureInstallFlow } from './installFlow'
import { measurePlanGeometry } from './planGeometry'
import { measureHeight } from './inputHeight'
import { computeClient, type ComputeJobTiming } from '@renderer/shared/compute/client'
import { setComputeDiagnostics } from '@renderer/shared/compute/diagnostics'
import { imagePixelCount } from '@renderer/shared/compute/imageHeader'
import { UI_TASK_BUDGET_MS } from '../../src/shared/perf-budget'

const code = Array.from(
  { length: 2500 },
  (_, index) => `export const item${index} = ${index}`
).join('\n')
const markdown = 'reading text with **emphasis**\n\n'.repeat(400)

function largest(values: number[]): number | null {
  return values.length ? Math.max(...values) : null
}

interface ImageOverlapRecord {
  imageTimesMs: number[]
  visibleComputeWaitMs: number | null
  markdownWaitMs: number | null
  renderedThumbnails: number
}

async function measure(
  images: string[],
  runs: number
): Promise<{
  records: ImageOverlapRecord[]
  budget: number
}> {
  const client = computeClient()
  const records: ImageOverlapRecord[] = []
  for (let run = 0; run <= runs; run++) {
    const jobs: ComputeJobTiming[] = []
    setComputeDiagnostics({ job: (timing) => jobs.push(timing), paint: () => {} })
    const codeDoc = client.openDocument(
      { id: 'stage-d-diff', revision: run },
      { text: code },
      'compute'
    )
    const markdownDoc = client.openDocument(
      { id: 'stage-d-stream', revision: run },
      { text: markdown },
      'markdown'
    )
    try {
      const previews = images.map(
        (data, index) =>
          client.request(
            {
              kind: 'imageThumb',
              attachmentId: `image-${run}-${index}`,
              mimeType: 'image/png',
              data,
              pixels: imagePixelCount('image/png', data) ?? 0
            },
            { priority: 'background', cacheable: false }
          ).promise
      )
      const diff = client.request(
        {
          kind: 'tokens',
          doc: codeDoc.ref,
          lang: 'typescript',
          theme: 'github-light',
          start: 200,
          end: 240
        },
        { cacheable: false }
      ).promise
      const tail = client.request(
        {
          kind: 'markdown',
          doc: markdownDoc.ref,
          start: 0,
          end: markdown.length
        },
        { cacheable: false }
      ).promise
      const [results] = await Promise.all([Promise.all(previews), diff, tail])
      if (run === 0) continue
      const durations = (kind: ComputeJobTiming['kind'], property: 'wait' | 'run'): number[] =>
        jobs
          .filter((job) => job.kind === kind)
          .map((job) =>
            property === 'run' ? job.endedAt - job.startedAt : job.startedAt - job.enqueuedAt
          )
      records.push({
        imageTimesMs: durations('imageThumb', 'run'),
        visibleComputeWaitMs: largest(durations('tokens', 'wait')),
        markdownWaitMs: largest(durations('markdown', 'wait')),
        renderedThumbnails: results.filter(({ thumbnail }) =>
          thumbnail?.startsWith('data:image/jpeg;')
        ).length
      })
    } finally {
      codeDoc.release()
      markdownDoc.release()
      setComputeDiagnostics(undefined)
    }
  }
  return { records, budget: UI_TASK_BUDGET_MS }
}
Object.assign(window, {
  measurePanelTimings,
  measureCatalogSelection,
  measureResources,
  measureStreamOverlap,
  measureProviderFlow,
  measureInstallFlow,
  measurePanelInputs,
  measureCommentIndex,
  measureComposerFlow,
  measureImageOverlap: measure,
  measureHeight,
  measurePlanGeometry,
  measureInstallLog,
  measureCatalogs,
  measureCalculations
})
