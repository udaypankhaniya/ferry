package ai

import "context"

// CommandContext is the structured payload the capture layer produces.
type CommandContext struct {
	Command  string
	Stdout   string
	Stderr   string
	ExitCode int
	Host     string // alias only, never raw credentials
	OSInfo   string
	Recent   []string // last N commands on this host
}

// HostInfo carries safe, non-credential host metadata for NL→command calls.
type HostInfo struct {
	Alias  string
	OSInfo string
}

// Suggestion is returned by all provider calls. Commands are never auto-run.
// JSON tags double as the wire shape models are asked to emit (see prompt.go).
type Suggestion struct {
	Explanation string   `json:"explanation"`
	Commands    []string `json:"commands"`
}

// Provider is the single interface all AI backends must satisfy.
type Provider interface {
	Name() string
	Explain(ctx context.Context, c CommandContext) (Suggestion, error)
	Translate(ctx context.Context, nl string, host HostInfo) (Suggestion, error)
}

// Message is one turn in a chat conversation.
type Message struct {
	Role    string `json:"role"` // "system" | "user" | "assistant"
	Content string `json:"content"`
}

// Streamer is implemented by providers that support streaming chat. onToken is
// called for each text delta as it arrives; the call returns when the stream
// ends, errors, or ctx is cancelled (Stop). All three providers implement it.
type Streamer interface {
	StreamChat(ctx context.Context, messages []Message, onToken func(string)) error
}
