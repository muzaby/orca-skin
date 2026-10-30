// 로그인 프리 연결 결과(호스트 모델 목록) → runtime config 조각 (0291).
//
// 배포 augmenter 가 `auth.connectionValue(id)` 를 받아 이 두 함수로 `availableModels`·
// `modelDetails` 를 만든다. 연결 결과는 배포가 정한 unknown 이므로 형상이 틀리면 undefined 다.
//
// 순수 모듈이다.
import type {
  HarnessListedModel,
  HarnessModelDetail
} from '../../../adapters/common/harness-config'
import { isRecord } from '../../../../shared/obj'

function listedModelOf(value: unknown): HarnessListedModel | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') return undefined
  if (value.name !== undefined && typeof value.name !== 'string') return undefined
  if (
    value.variants !== undefined &&
    (!Array.isArray(value.variants) || value.variants.some((v) => typeof v !== 'string'))
  ) {
    return undefined
  }
  return {
    id: value.id,
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
    ...(Array.isArray(value.variants) ? { variants: [...(value.variants as string[])] } : {})
  }
}

// 연결 결과가 `HarnessListedModel[]` 형상이면 그 사본을, 아니면 undefined 를 돌려준다.
export function listedModelsOf(value: unknown): HarnessListedModel[] | undefined {
  if (!Array.isArray(value)) return undefined
  const models: HarnessListedModel[] = []
  for (const item of value) {
    const model = listedModelOf(item)
    if (!model) return undefined
    models.push(model)
  }
  return models
}

export function runtimeModelsFromListing(listing: readonly HarnessListedModel[]): {
  availableModels: string[]
  modelDetails: Record<string, HarnessModelDetail>
} {
  const availableModels: string[] = []
  const modelDetails: Record<string, HarnessModelDetail> = {}
  for (const model of listing) {
    if (model.id in modelDetails) continue
    availableModels.push(model.id)
    modelDetails[model.id] = {
      ...(model.name !== undefined ? { name: model.name } : {}),
      ...(model.variants !== undefined ? { variants: [...model.variants] } : {})
    }
  }
  return { availableModels, modelDetails }
}
