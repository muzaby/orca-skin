// orca.json `update` → electron-updater setFeedURL 옵션 조립 (순수 함수).
// updater.ts 는 `electron` 을 import 하므로 순수 vitest 로 로드할 수 없다(0124 electron-free
// 분리 선례). 피드 옵션 조립을 electron 미의존 모듈로 빼서 단위 테스트를 보존한다.
//
// electron-updater@6 은 setFeedURL 에 s3/spaces 옵션을 받으면 런타임에
// getS3LikeProviderBaseUrl 로 generic HTTP(S) base URL 로 변환한다. endpoint 를 주면
// `${endpoint}/${bucket}` 이 되어 사내 MinIO/S3-호환 서버를 가리킨다(미지정 시 AWS S3).
// github provider 는 host 로 GitHub Enterprise 를 지원한다.

import type { UpdateConfig } from '../infra/config/orca-file'

export type UpdateFeedOptions =
  | {
      provider: 'github'
      owner?: string
      repo?: string
      host?: string
      protocol?: 'https' | 'http'
      channel?: string
    }
  | { provider: 'generic'; url?: string; channel?: string }
  | {
      provider: 's3'
      bucket?: string
      region?: string
      endpoint?: string
      path?: string
      channel?: string
    }

export interface ResolvedUpdateFeed {
  // enabled:false → 업데이터 전체 비활성(check() 가 feed-not-configured 로 저하).
  disabled: boolean
  // 미설정(undefined)이면 setFeedURL 을 호출하지 않는다 = electron-builder 내장 publish 피드 사용.
  feed?: UpdateFeedOptions
}

export function resolveUpdateFeed(update: UpdateConfig | undefined): ResolvedUpdateFeed {
  if (update?.enabled === false) return { disabled: true }
  if (!update) return { disabled: false }
  if (update.provider === 'github') {
    const feed: UpdateFeedOptions = {
      provider: 'github',
      ...(update.owner ? { owner: update.owner } : {}),
      ...(update.repo ? { repo: update.repo } : {}),
      ...(update.host ? { host: update.host } : {}),
      ...(update.protocol ? { protocol: update.protocol } : {}),
      ...(update.channel ? { channel: update.channel } : {})
    }
    return { disabled: false, feed }
  }
  if (update.provider === 'generic') {
    const feed: UpdateFeedOptions = {
      provider: 'generic',
      ...(update.url ? { url: update.url } : {}),
      ...(update.channel ? { channel: update.channel } : {})
    }
    return { disabled: false, feed }
  }
  if (update.provider === 's3') {
    const feed: UpdateFeedOptions = {
      provider: 's3',
      ...(update.bucket ? { bucket: update.bucket } : {}),
      ...(update.region ? { region: update.region } : {}),
      ...(update.endpoint ? { endpoint: update.endpoint } : {}),
      ...(update.path ? { path: update.path } : {}),
      ...(update.channel ? { channel: update.channel } : {})
    }
    return { disabled: false, feed }
  }
  return { disabled: false }
}
