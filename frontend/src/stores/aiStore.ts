import { create } from 'zustand'
import type { AIProvider } from '../types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: boolean
  redacted?: boolean // secrets were stripped from this message before send
}

interface AIStore {
  provider: AIProvider
  cloudThresholdShown: boolean

  // conversation
  chatId: string
  messages: ChatMessage[]
  streaming: boolean

  setProvider: (p: AIProvider) => void
  markCloudThresholdShown: () => void

  addMessage: (m: ChatMessage) => void
  appendToken: (id: string, token: string) => void
  finishMessage: (id: string) => void
  failMessage: (id: string, error: string) => void
  setStreaming: (v: boolean) => void
  newChat: () => void
}

export const useAIStore = create<AIStore>()((set) => ({
  provider: 'ollama',
  cloudThresholdShown: false,

  chatId: crypto.randomUUID(),
  messages: [],
  streaming: false,

  setProvider: (p) => set({ provider: p }),
  markCloudThresholdShown: () => set({ cloudThresholdShown: true }),

  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + token } : m)),
    })),
  finishMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
      streaming: false,
    })),
  failMessage: (id, error) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, streaming: false, error: true, content: m.content || error } : m
      ),
      streaming: false,
    })),
  setStreaming: (v) => set({ streaming: v }),
  newChat: () => set({ chatId: crypto.randomUUID(), messages: [], streaming: false }),
}))
