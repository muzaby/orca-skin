import { describe, expect, it } from 'vitest'
import { resolveUpdateFeed } from './updater-feed'

describe('resolveUpdateFeed', () => {
  it('미설정이면 비활성 아님 + feed 없음(내장 publish 피드 사용)', () => {
    expect(resolveUpdateFeed(undefined)).toEqual({ disabled: false })
  })

  it('enabled:false 는 비활성 + feed 없음', () => {
    expect(resolveUpdateFeed({ enabled: false })).toEqual({ disabled: true })
    // provider/필드가 남아 있어도 enabled:false 가 우선한다
    expect(resolveUpdateFeed({ enabled: false, provider: 's3', bucket: 'orca' })).toEqual({
      disabled: true
    })
  })

  it('github → owner/repo + 미설정 필드 생략', () => {
    expect(resolveUpdateFeed({ provider: 'github', owner: 'muzaby', repo: 'orca-skin' })).toEqual({
      disabled: false,
      feed: { provider: 'github', owner: 'muzaby', repo: 'orca-skin' }
    })
  })

  it('github host/protocol(GitHub Enterprise) 전달', () => {
    expect(
      resolveUpdateFeed({
        provider: 'github',
        owner: 'infra',
        repo: 'orca',
        host: 'github.company.com',
        protocol: 'https',
        channel: 'latest'
      })
    ).toEqual({
      disabled: false,
      feed: {
        provider: 'github',
        owner: 'infra',
        repo: 'orca',
        host: 'github.company.com',
        protocol: 'https',
        channel: 'latest'
      }
    })
  })

  it('generic → url + channel', () => {
    expect(
      resolveUpdateFeed({ provider: 'generic', url: 'https://updates.internal/orca/' })
    ).toEqual({
      disabled: false,
      feed: { provider: 'generic', url: 'https://updates.internal/orca/' }
    })
  })

  it('s3(AWS) → bucket/region, endpoint 없이도 유효', () => {
    expect(
      resolveUpdateFeed({ provider: 's3', bucket: 'orca-updates', region: 'ap-northeast-2' })
    ).toEqual({
      disabled: false,
      feed: { provider: 's3', bucket: 'orca-updates', region: 'ap-northeast-2' }
    })
  })

  it('s3(MinIO/S3-호환) → endpoint + path 전달, 미설정 필드 생략', () => {
    expect(
      resolveUpdateFeed({
        provider: 's3',
        bucket: 'orca-updates',
        endpoint: 'http://minio.internal:9000',
        path: 'win',
        channel: 'latest'
      })
    ).toEqual({
      disabled: false,
      feed: {
        provider: 's3',
        bucket: 'orca-updates',
        endpoint: 'http://minio.internal:9000',
        path: 'win',
        channel: 'latest'
      }
    })
  })
})
