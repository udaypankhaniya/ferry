import { SendMessage, StopChat, ClearChat } from '../../wailsjs/go/main/ChatService'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import type { AIProvider } from '../types'

// Streams an assistant reply. Tokens/done/error arrive via events scoped to the
// chatId (see onChatEvents). The returned promise resolves when the stream ends.
export const sendChat = (chatId: string, provider: AIProvider, siteId: string, text: string): Promise<void> =>
  SendMessage(chatId, provider, siteId, text)

export const stopChat = (chatId: string): Promise<void> => StopChat(chatId)
export const clearChat = (chatId: string): Promise<void> => ClearChat(chatId)

// Subscribe to the streaming events for one chat. Returns an unsubscribe fn.
export function onChatEvents(
  chatId: string,
  handlers: { token: (t: string) => void; done: (full: string) => void; error: (msg: string) => void }
): () => void {
  const offToken = EventsOn(`chat:token:${chatId}`, (t: string) => handlers.token(t))
  const offDone = EventsOn(`chat:done:${chatId}`, (full: string) => handlers.done(full))
  const offError = EventsOn(`chat:error:${chatId}`, (msg: string) => handlers.error(msg))
  return () => { offToken(); offDone(); offError() }
}
