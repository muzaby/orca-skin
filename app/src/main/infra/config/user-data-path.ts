// 플러그인의 데이터 스키마/보관 정책을 알지 않는 앱 경로 자원.
export async function userDataPath(): Promise<string> {
  const { app } = await import('electron')
  return app.getPath('userData')
}
