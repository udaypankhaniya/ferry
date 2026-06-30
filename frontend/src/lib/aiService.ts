import { Explain, Translate, RunCommand, OllamaAvailable, SetAPIKey, HasAPIKey } from '../../wailsjs/go/main/AIService'
import type { Suggestion, CommandError, AIProvider } from '../types'

// Run a command in exec mode (clean stdout/stderr/exit) for AI context + history.
export const runCommand = (siteID: string, command: string): Promise<CommandError> =>
  RunCommand(siteID, command) as Promise<CommandError>

// Explain why a command failed and propose a fix.
export const explain = (
  provider: AIProvider,
  siteID: string,
  result: CommandError
): Promise<Suggestion> =>
  Explain(provider, siteID, result as never) as Promise<Suggestion>

// Translate a natural-language request into reviewable shell commands.
export const translate = (
  provider: AIProvider,
  siteID: string,
  nl: string
): Promise<Suggestion> =>
  Translate(provider, siteID, nl) as Promise<Suggestion>

// Whether a local Ollama daemon is reachable (used to default to local).
export const ollamaAvailable = (): Promise<boolean> => OllamaAvailable()

// Store (or clear, with an empty key) a cloud provider's API key. Cloud only.
export const setAPIKey = (provider: 'anthropic' | 'openai', key: string): Promise<void> =>
  SetAPIKey(provider, key)

// Whether a cloud provider has a stored key (never exposes the key itself).
export const hasAPIKey = (provider: 'anthropic' | 'openai'): Promise<boolean> =>
  HasAPIKey(provider)
