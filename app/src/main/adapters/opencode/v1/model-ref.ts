export function modelRef(model: string): { providerID: string; modelID: string } {
  const slash = model.indexOf('/')
  if (slash < 1 || slash === model.length - 1)
    throw new Error('OpenCode 모델은 provider/model 형식이어야 합니다.')
  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) }
}
