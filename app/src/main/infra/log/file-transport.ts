// JSONL 파일 transport (0123 AC4·AC9) — append 버퍼 + 주기 flush + 크기 기반 로테이션.
// 쓰기 실패(디스크 부족·권한)는 transport 를 스스로 비활성화하고 emergency 1줄만 남긴다 —
// 앱 기능은 절대 중단시키지 않는다(AC3·AC14). fatal/종료 경로는 flushSync() 로 유실을 막는다.
// 경로·fs 는 생성자 주입이라 electron 비의존 → vitest(tmp dir) 대상.

import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'

export interface LogTransport {
  write(line: string): void
  flushSync(): void
  close(): void
}

export interface FileTransportOptions {
  dir: string
  baseName?: string
  maxBytes?: number
  maxFiles?: number
  flushIntervalMs?: number
  // transport 내부 장애 보고 채널 — 로거 재귀 호출 금지라 콘솔 emergency 를 주입받는다.
  onInternalError?: (message: string) => void
}

const DEFAULT_BASE = 'application.jsonl'
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_MAX_FILES = 5
const DEFAULT_FLUSH_MS = 500

export class FileTransport implements LogTransport {
  private readonly dir: string
  private readonly baseName: string
  private readonly maxBytes: number
  private readonly maxFiles: number
  private readonly onInternalError: (message: string) => void

  private buffer: string[] = []
  private currentBytes = 0
  private disabled = false
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(options: FileTransportOptions) {
    this.dir = options.dir
    this.baseName = options.baseName ?? DEFAULT_BASE
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
    this.onInternalError = options.onInternalError ?? (() => {})
    try {
      mkdirSync(this.dir, { recursive: true })
      // 재실행 시 기존 파일에 이어쓴다 — 크기를 이어받아 로테이션 연속성 보장(AC4).
      this.currentBytes = existsSync(this.basePath()) ? statSync(this.basePath()).size : 0
      const interval = options.flushIntervalMs ?? DEFAULT_FLUSH_MS
      if (interval > 0) {
        this.timer = setInterval(() => this.flushSync(), interval)
        // 타이머가 프로세스 종료를 붙잡지 않도록 — 종료 flush 는 close() 가 보장.
        this.timer.unref?.()
      }
    } catch (err) {
      this.disable(`init failed: ${message(err)}`)
    }
  }

  write(line: string): void {
    if (this.disabled) return
    this.buffer.push(line)
  }

  flushSync(): void {
    if (this.disabled || this.buffer.length === 0) return
    const chunk = this.buffer.join('\n') + '\n'
    this.buffer = []
    try {
      this.rotateIfNeeded(Buffer.byteLength(chunk))
      appendFileSync(this.basePath(), chunk, 'utf8')
      this.currentBytes += Buffer.byteLength(chunk)
    } catch (err) {
      this.disable(`write failed: ${message(err)}`)
    }
  }

  close(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.flushSync()
  }

  get isDisabled(): boolean {
    return this.disabled
  }

  private basePath(): string {
    return join(this.dir, this.baseName)
  }

  private rotatedPath(index: number): string {
    const dot = this.baseName.lastIndexOf('.')
    const stem = dot === -1 ? this.baseName : this.baseName.slice(0, dot)
    const ext = dot === -1 ? '' : this.baseName.slice(dot)
    return join(this.dir, `${stem}.${index}${ext}`)
  }

  // base → .1 → .2 … 시프트. 보관 상한(maxFiles, base 포함) 초과분은 가장 오래된 것부터 삭제.
  private rotateIfNeeded(incomingBytes: number): void {
    if (this.currentBytes + incomingBytes <= this.maxBytes) return
    if (!existsSync(this.basePath())) return
    const oldest = this.maxFiles - 1
    if (oldest < 1) return
    if (existsSync(this.rotatedPath(oldest))) rmSync(this.rotatedPath(oldest))
    for (let i = oldest - 1; i >= 1; i--) {
      if (existsSync(this.rotatedPath(i))) renameSync(this.rotatedPath(i), this.rotatedPath(i + 1))
    }
    renameSync(this.basePath(), this.rotatedPath(1))
    this.currentBytes = 0
  }

  private disable(reason: string): void {
    this.disabled = true
    this.buffer = []
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.onInternalError(`file transport disabled: ${reason}`)
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
