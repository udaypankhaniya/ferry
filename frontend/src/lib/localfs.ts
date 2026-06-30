import { HomeDir, ListDir, MkdirAll, Remove, Rename } from '../../wailsjs/go/main/LocalFSService'
import type { FileEntry } from '../types'

export const homeDir = (): Promise<string> => HomeDir()
export const listLocalDir = (path: string): Promise<FileEntry[]> =>
  ListDir(path) as Promise<FileEntry[]>
export const mkdirLocal = (path: string) => MkdirAll(path)
export const removeLocal = (path: string) => Remove(path)
export const renameLocal = (old: string, newPath: string) => Rename(old, newPath)
