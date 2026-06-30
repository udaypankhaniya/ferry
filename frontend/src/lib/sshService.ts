import {
  Connect, Disconnect, ListDir,
  StoreCredential, HasCredential, IsConnected,
  RemoveFile, RenameFile, MkdirRemote,
  UploadFile, DownloadFile,
  OpenShell, WriteShell, ResizeShell, CloseShell,
} from '../../wailsjs/go/main/SSHService'
import type { FileEntry } from '../types'

export const connect = (siteID: string) => Connect(siteID)
export const disconnect = (siteID: string) => Disconnect(siteID)
export const listDir = (siteID: string, path: string): Promise<FileEntry[]> =>
  ListDir(siteID, path) as Promise<FileEntry[]>
export const storeCredential = (siteID: string, secret: string) => StoreCredential(siteID, secret)
export const hasCredential = (siteID: string): Promise<boolean> => HasCredential(siteID)
export const isConnected = (siteID: string): Promise<boolean> => IsConnected(siteID)
export const removeFile = (siteID: string, path: string) => RemoveFile(siteID, path)
export const renameFile = (siteID: string, oldPath: string, newPath: string) =>
  RenameFile(siteID, oldPath, newPath)
export const mkdirRemote = (siteID: string, path: string) => MkdirRemote(siteID, path)
export const uploadFile = (transferID: string, siteID: string, localPath: string, remotePath: string) =>
  UploadFile(transferID, siteID, localPath, remotePath)
export const downloadFile = (transferID: string, siteID: string, remotePath: string, localPath: string) =>
  DownloadFile(transferID, siteID, remotePath, localPath)

// ── interactive terminal (PTY) ──────────────────────────────────────────────
export const openShell = (sessionID: string, siteID: string, cols: number, rows: number) =>
  OpenShell(sessionID, siteID, cols, rows)
export const writeShell = (sessionID: string, data: string) => WriteShell(sessionID, data)
export const resizeShell = (sessionID: string, cols: number, rows: number) =>
  ResizeShell(sessionID, cols, rows)
export const closeShell = (sessionID: string) => CloseShell(sessionID)
