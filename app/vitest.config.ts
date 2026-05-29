import { defineConfig } from 'vitest/config'

// 순수 함수 단위 테스트 전용. main 모듈 중 electron 비의존 부분(expand/convert 등)만 대상.
// electron 의존 모듈(store/secret-store)은 import 하지 않으므로 node 환경으로 충분하다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
