// safeStorage(OS 키체인) 암호화 헬퍼. 비밀(MCP 인증 토큰 등)을 평문으로 디스크에 남기지 않기
// 위해 base64 암호문으로만 저장한다. secret-store.ts 가 소비한다 (구 mcp/crypto.ts —
// config↔mcp 역방향 import 제거를 위해 config/ 로 이동, handoff 0011).

import { safeStorage } from 'electron'

export function encrypt(plain: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage 암호화를 사용할 수 없어 인증값을 저장할 수 없습니다.')
  }
  return safeStorage.encryptString(plain).toString('base64')
}

export function decrypt(b64: string): string {
  return safeStorage.decryptString(Buffer.from(b64, 'base64'))
}

// 복호화 실패(키체인 잠김·다른 사용자 등)는 null 반환 — 호출부가 비밀 없는 것으로 안전 처리.
export function safeDecrypt(b64: string): string | null {
  try {
    return decrypt(b64)
  } catch {
    return null
  }
}
