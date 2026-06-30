export type Protocol = 'sftp' | 'ssh' | 'ftp'
export type AuthType = 'password' | 'key' | 'agent'
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error'
export type AIProvider = 'ollama' | 'anthropic' | 'openai'
export type AIPanelState = 'idle' | 'thinking' | 'error-detected' | 'suggestion' | 'nl-command'
export type TransferStatus = 'pending' | 'active' | 'done' | 'failed'
export type TransferDirection = 'upload' | 'download'

export interface Site {
  id: string
  name: string
  host: string
  port: number
  protocol: Protocol
  username: string
  authType: AuthType
  keyPath?: string
  group?: string
  lastConnected?: string
}

export interface FileEntry {
  name: string
  path: string
  size: number
  modified: string
  permissions: string
  isDir: boolean
  isSymlink: boolean
  isHidden: boolean
}

export interface TransferItem {
  id: string
  siteId: string
  filename: string
  direction: TransferDirection
  srcPath: string  // upload: local source · download: remote source
  destPath: string // upload: remote dest · download: local dest
  progress: number
  bytesTotal: number
  bytesDone: number
  speedBps: number
  etaSecs: number
  status: TransferStatus
  error?: string
}

export interface Suggestion {
  explanation: string
  commands: string[]
}

export interface CommandError {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  host: string
}
