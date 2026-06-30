package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Ollama is the default, local-first provider. It talks to a locally running
// Ollama daemon — data never leaves the machine. This path must work fully
// offline; cloud providers are the opt-in exception, not this one.
type Ollama struct {
	BaseURL string // default http://localhost:11434
	Model   string // default llama3.2
	client  *http.Client
}

// NewOllama constructs the provider. Empty baseURL/model fall back to defaults.
func NewOllama(baseURL, model string) *Ollama {
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	if model == "" {
		model = "llama3.2"
	}
	return &Ollama{
		BaseURL: baseURL,
		Model:   model,
		client:  &http.Client{Timeout: 120 * time.Second},
	}
}

func (o *Ollama) Name() string { return "ollama" }

type ollamaMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ollamaChatRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Stream   bool            `json:"stream"`
	Format   string          `json:"format,omitempty"`
}

type ollamaChatResponse struct {
	Message ollamaMessage `json:"message"`
	Error   string        `json:"error,omitempty"`
}

// chat issues a single non-streaming /api/chat call and returns the assistant text.
func (o *Ollama) chat(ctx context.Context, userMsg string) (string, error) {
	body, _ := json.Marshal(ollamaChatRequest{
		Model: o.Model,
		Messages: []ollamaMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMsg},
		},
		Stream: false,
		Format: "json", // constrain output to the JSON shape we parse
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.BaseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := o.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama: %w (is the Ollama daemon running?)", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama: status %d", resp.StatusCode)
	}

	var out ollamaChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("ollama: decode: %w", err)
	}
	if out.Error != "" {
		return "", fmt.Errorf("ollama: %s", out.Error)
	}
	return out.Message.Content, nil
}

// StreamChat streams a chat completion from Ollama (/api/chat, stream:true →
// NDJSON, one JSON object per line).
func (o *Ollama) StreamChat(ctx context.Context, messages []Message, onToken func(string)) error {
	msgs := make([]ollamaMessage, len(messages))
	for i, m := range messages {
		msgs[i] = ollamaMessage{Role: m.Role, Content: m.Content}
	}
	body, _ := json.Marshal(ollamaChatRequest{Model: o.Model, Messages: msgs, Stream: true})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.BaseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := o.client.Do(req)
	if err != nil {
		return fmt.Errorf("ollama: %w (is the Ollama daemon running?)", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ollama: status %d", resp.StatusCode)
	}

	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var chunk struct {
			Message ollamaMessage `json:"message"`
			Done    bool          `json:"done"`
			Error   string        `json:"error"`
		}
		if err := json.Unmarshal(line, &chunk); err != nil {
			continue
		}
		if chunk.Error != "" {
			return fmt.Errorf("ollama: %s", chunk.Error)
		}
		if chunk.Message.Content != "" {
			onToken(chunk.Message.Content)
		}
		if chunk.Done {
			break
		}
	}
	return sc.Err()
}

func (o *Ollama) Explain(ctx context.Context, c CommandContext) (Suggestion, error) {
	raw, err := o.chat(ctx, buildExplain(RedactContext(c)))
	if err != nil {
		return Suggestion{}, err
	}
	return parseSuggestion(raw), nil
}

func (o *Ollama) Translate(ctx context.Context, nl string, host HostInfo) (Suggestion, error) {
	raw, err := o.chat(ctx, buildTranslate(Redact(nl), host))
	if err != nil {
		return Suggestion{}, err
	}
	return parseSuggestion(raw), nil
}

// parseSuggestion decodes the model's JSON reply. If the model didn't honor the
// JSON contract, fall back to treating the whole reply as a plain explanation.
func parseSuggestion(raw string) Suggestion {
	var s Suggestion
	if err := json.Unmarshal([]byte(raw), &s); err == nil {
		return s
	}
	return Suggestion{Explanation: raw}
}
