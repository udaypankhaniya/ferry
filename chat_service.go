package main

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"ferry/internal/ai"
)

// Context-management knobs. Budgets are in characters (~4 chars/token) so they
// work across every provider without a model-specific tokenizer.
const (
	chatCharBudget = 12000 // when history exceeds this, summarize the oldest turns
	chatKeepRecent = 6     // verbatim turns kept after summarization
)

const chatSystemPrompt = `You are Ferry's terminal assistant, embedded in an SSH/SFTP client.
Help with shell commands, SSH/SFTP, and debugging failures. Be concise and practical.
Use Markdown. Put any runnable command in its own fenced code block so the user can review and run it.
Never include secrets, credentials, or private keys in your replies.`

// chatConversation is the server-side memory for one chat: full turns plus a
// rolling summary of older turns that were compressed out of the window.
type chatConversation struct {
	messages []ai.Message
	summary  string
	cancel   context.CancelFunc
}

// ChatService is the conversational AI backend: per-chat memory, context-window
// management (summarize-on-overflow), and streaming replies pushed to the
// frontend over Wails events. Go-native — no LangChain/sidecar.
//
// Events (scoped by frontend-generated chatID):
//   - "chat:token:<chatID>" — a text delta (string)
//   - "chat:done:<chatID>"  — the full assistant message (string)
//   - "chat:error:<chatID>" — an error message (string)
type ChatService struct {
	ctx   context.Context
	mu    sync.Mutex
	chats map[string]*chatConversation
	aiSvc *AIService
}

func NewChatService(aiSvc *AIService) *ChatService {
	return &ChatService{chats: make(map[string]*chatConversation), aiSvc: aiSvc}
}

func (s *ChatService) setContext(ctx context.Context) { s.ctx = ctx }

// ClearChat resets a conversation's memory (new chat).
func (s *ChatService) ClearChat(chatID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.chats[chatID]; ok && c.cancel != nil {
		c.cancel()
	}
	delete(s.chats, chatID)
}

// StopChat cancels an in-flight stream for a chat.
func (s *ChatService) StopChat(chatID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.chats[chatID]; ok && c.cancel != nil {
		c.cancel()
	}
}

// SendMessage appends the user's message, manages the context window, and
// streams the assistant reply over events. Blocks until the stream ends; the UI
// is driven by the events, not the return value.
func (s *ChatService) SendMessage(chatID, providerName, siteID, text string) error {
	prov, err := s.aiSvc.provider(providerName)
	if err != nil {
		s.emit("chat:error:"+chatID, err.Error())
		return err
	}
	streamer, ok := prov.(ai.Streamer)
	if !ok {
		msg := fmt.Sprintf("%s does not support chat streaming", providerName)
		s.emit("chat:error:"+chatID, msg)
		return fmt.Errorf("%s", msg)
	}

	s.mu.Lock()
	conv := s.chats[chatID]
	if conv == nil {
		conv = &chatConversation{}
		s.chats[chatID] = conv
	}
	conv.messages = append(conv.messages, ai.Message{Role: "user", Content: text})

	// Compress older turns if the window is getting large.
	s.summarizeIfNeeded(conv, streamer)

	sendMsgs := s.buildSendMessages(conv, siteID)
	ctx, cancel := context.WithCancel(context.Background())
	conv.cancel = cancel
	s.mu.Unlock()
	defer cancel()

	var sb strings.Builder
	streamErr := streamer.StreamChat(ctx, sendMsgs, func(tok string) {
		sb.WriteString(tok)
		s.emit("chat:token:"+chatID, tok)
	})

	full := sb.String()
	s.mu.Lock()
	if full != "" {
		conv.messages = append(conv.messages, ai.Message{Role: "assistant", Content: full})
	}
	conv.cancel = nil
	s.mu.Unlock()

	// A cancel (Stop) is not an error — keep the partial reply.
	if streamErr != nil && ctx.Err() == nil {
		s.emit("chat:error:"+chatID, streamErr.Error())
		return streamErr
	}
	s.emit("chat:done:"+chatID, full)
	return nil
}

// buildSendMessages assembles what actually goes to the provider: the system
// prompt (+ host context + rolling summary), then redacted history. Secrets are
// stripped here — nothing reaches a provider un-redacted.
func (s *ChatService) buildSendMessages(conv *chatConversation, siteID string) []ai.Message {
	var system strings.Builder
	system.WriteString(chatSystemPrompt)
	if alias := s.aiSvc.hostAlias(siteID); alias != "" && alias != siteID {
		fmt.Fprintf(&system, "\n\nActive host: %s.", alias)
	}
	if conv.summary != "" {
		fmt.Fprintf(&system, "\n\nSummary of earlier conversation:\n%s", conv.summary)
	}

	out := make([]ai.Message, 0, len(conv.messages)+1)
	out = append(out, ai.Message{Role: "system", Content: system.String()})
	for _, m := range conv.messages {
		out = append(out, ai.Message{Role: m.Role, Content: ai.Redact(m.Content)})
	}
	return out
}

// summarizeIfNeeded compresses the oldest turns into conv.summary once the
// history exceeds the char budget, keeping the most recent turns verbatim.
func (s *ChatService) summarizeIfNeeded(conv *chatConversation, streamer ai.Streamer) {
	if convChars(conv) <= chatCharBudget || len(conv.messages) <= chatKeepRecent {
		return
	}
	older := conv.messages[:len(conv.messages)-chatKeepRecent]
	recent := conv.messages[len(conv.messages)-chatKeepRecent:]

	var transcript strings.Builder
	if conv.summary != "" {
		fmt.Fprintf(&transcript, "Previous summary:\n%s\n\n", conv.summary)
	}
	for _, m := range older {
		fmt.Fprintf(&transcript, "%s: %s\n", m.Role, ai.Redact(m.Content))
	}

	prompt := []ai.Message{
		{Role: "system", Content: "Summarize this conversation so it can continue with full context. Keep key facts, decisions, host/command details, and unresolved questions. Be concise."},
		{Role: "user", Content: transcript.String()},
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var sb strings.Builder
	if err := streamer.StreamChat(ctx, prompt, func(tok string) { sb.WriteString(tok) }); err != nil {
		return // summarization is best-effort; keep full history on failure
	}
	if sb.Len() > 0 {
		conv.summary = sb.String()
		conv.messages = append([]ai.Message(nil), recent...)
	}
}

func convChars(conv *chatConversation) int {
	n := len(conv.summary)
	for _, m := range conv.messages {
		n += len(m.Content)
	}
	return n
}

func (s *ChatService) emit(event, payload string) {
	if s.ctx != nil {
		runtime.EventsEmit(s.ctx, event, payload)
	}
}
