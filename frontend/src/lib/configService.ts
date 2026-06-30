import { GetLastLocalPath, SetLastLocalPath } from '../../wailsjs/go/main/ConfigService'

// Persisted UI prefs (backed by ~/.ferry/config.json on the Go side — reliable
// across launches, unlike the webview's localStorage).
export const getLastLocalPath = (): Promise<string> => GetLastLocalPath()
export const setLastLocalPath = (path: string): Promise<void> => SetLastLocalPath(path)
