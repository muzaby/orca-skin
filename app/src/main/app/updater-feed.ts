// orca.json `update` → electron-updater setFeedURL 옵션 조립 (순수 함수).
// updater.ts 는 `electron` 을 import 하므로 순수 vitest 로 로드할 수 없다(0124 electron-free
// 분리 선례). 피드 옵션 조립을 electron 미의존 모듈로 빼서 단위 테스트를 보존한다.
//
// electron-updater@6 은 setFeedURL 에 s3/spaces 옵션을 받으면 런타임에
// getS3LikeProviderBaseUrl 로 generic HTTP(S) base URL 로 변환한다. endpoint 를 주면
// `${endpoint}/${bucket}` 이 되어 사내 MinIO/S3-호환 서버를 가리킨다(미지정 시 AWS S3).
// github provider 는 host 로 GitHub Enterprise 를 지원한다.

import type { UpdateConfig } from '../infra/config/orca-file'

type UpdateFeedOptions =
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

interface ResolvedUpdateFeed {
  // enabled:false → 업데이터 전체 비활성(check() 가 feed-not-configured 로 저하).
  disabled: boolean
  // 미설정(undefined)이면 setFeedURL 을 호출하지 않는다 = electron-builder 내장 publish 피드 사용.
  feed?: UpdateFeedOptions
}

// provider 별로 피드에 실어 나를 필드 목록. 세 갈래가 "값이 있는 것만 담는다" 는 같은 규칙을
// 반복하던 것을 표로 접었다(0149) — 한 갈래에만 오타가 나서 그 provider 만 조용히 필드를
// 흘리던 실수 모드를 없앤다. 새 필드는 여기 한 줄만 더하면 된다.
const FEED_FIELDS = {
  github: ['owner', 'repo', 'host', 'protocol', 'channel'],
  generic: ['url', 'channel'],
  s3: ['bucket', 'region', 'endpoint', 'path', 'channel']
} as const satisfies Record<UpdateFeedOptions['provider'], readonly string[]>

export function resolveUpdateFeed(update: UpdateConfig | undefined): ResolvedUpdateFeed {
  if (update?.enabled === false) return { disabled: true }
  if (!update) return { disabled: false }
  const keys: readonly string[] | undefined = FEED_FIELDS[update.provider]
  if (!keys) return { disabled: false }

  const feed = { provider: update.provider } as Record<string, unknown>
  const source = update as unknown as Record<string, unknown>
  for (const key of keys) {
    const value = source[key]
    if (value) feed[key] = value
  }
  return { disabled: false, feed: feed as UpdateFeedOptions }
}
