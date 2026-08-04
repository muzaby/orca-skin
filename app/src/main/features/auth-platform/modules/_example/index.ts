// 예시 auth 패키지 (0157) — **등록되지 않는다.** `../index.ts` 배럴에 추가해야 활성화된다.
//
// 폐쇄망 배포가 자기 패키지를 만들 때의 참조 구현이다. 두 가지를 보여준다:
//   1. ADFS/WIA browser session provider — 앱 로그인과 사내 서비스가 같은 session group 공유
//   2. static PAT provider — REST API 가 웹 세션 쿠키를 인정하지 않는 서비스용
//
// 두 provider 는 같은 `AuthProviderV1` 계약을 구현하고 같은 conformance suite 를 통과한다.

import { createAdfsWiaProvider } from '../../providers/corp-adfs-wia'
import { createStaticCredentialProvider } from '../../providers/static-credential'
import type { AuthPluginPackage } from '../index'

const PLUGIN_ID = 'corp-services'
const ADFS_ORIGIN = 'https://adfs.example.invalid'
const WIKI_ORIGIN = 'https://wiki.example.invalid'

export const examplePackage: AuthPluginPackage = {
  // manifest 는 built-in 도 통과해야 하는 등록 위생 계약이다 (AUTH-PLAT-012).
  manifest: {
    schemaVersion: 1,
    id: PLUGIN_ID,
    version: '1.0.0',
    contributes: {
      authProviders: [
        {
          id: 'corp-adfs-wia',
          apiVersion: 1,
          label: '사내 ADFS 로그인',
          targets: ['application', 'connector'],
          mechanisms: ['adfs_browser_session'],
          capabilities: ['browser_session', 'status', 'logout'],
          allowedOrigins: [ADFS_ORIGIN, WIKI_ORIGIN],
          sessionGroup: 'corp-adfs'
        },
        {
          id: 'corp-wiki-pat',
          apiVersion: 1,
          label: '사내 위키 PAT',
          targets: ['connector'],
          mechanisms: ['personal_access_token'],
          capabilities: ['status', 'logout'],
          allowedOrigins: [WIKI_ORIGIN]
        }
      ],
      connectors: []
    }
  },
  providers: [
    createAdfsWiaProvider({
      id: 'corp-adfs-wia',
      pluginId: PLUGIN_ID,
      label: '사내 ADFS 로그인',
      sessionGroup: 'corp-adfs',
      loginUrl: `${ADFS_ORIGIN}/adfs/ls/?wa=wsignin1.0`,
      doneUrlPrefix: `${WIKI_ORIGIN}/home`,
      authenticationProbeUrl: `${WIKI_ORIGIN}/rest/api/user/current`,
      allowedOrigins: [ADFS_ORIGIN, WIKI_ORIGIN]
    }),
    createStaticCredentialProvider({
      id: 'corp-wiki-pat',
      pluginId: PLUGIN_ID,
      label: '사내 위키 PAT',
      mechanism: 'personal_access_token',
      service: 'corp-wiki',
      probeUrl: `${WIKI_ORIGIN}/rest/api/user/current`,
      allowedOrigins: [WIKI_ORIGIN],
      // 위 manifest 선언과 같아야 한다. 빠뜨리면 factory 기본값(`['application','connector']`)이
      // 들어가 registry 가 패키지를 거부하고, 그 검사가 없던 때는 **prod 로그인 게이트가
      // 켜졌다**(0164 D1). 복사해 가는 템플릿이므로 여기서부터 맞아야 한다.
      targets: ['connector']
    })
  ]
}
