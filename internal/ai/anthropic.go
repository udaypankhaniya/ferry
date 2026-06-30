package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Anthropic is an opt-in cloud provider (Claude). Data leaves the machine —
// the UI must make this visible (amber trust state). Secrets are stripped via
// Redact/RedactContext before any request, same as every other provider.
//
// Implemented with raw net/http rather than the official anthropic-sdk-go to
// honor Ferry's lightweight pillar (no heavy dependency tree) and to match the
// hand-rolled Ollama provider. The Messages API call here is a single endpoint.
type Anthropic struct {
	APIKey string
	Model  string // default claude-opus-4-8
	client *http.Client
}

func NewAnthropic(apiKey, model string) *Anthropic {
	if model == "" {
		// Default per Anthropic guidance: latest, most capable. Configurable in settings.
		model = "claude-opus-4-8"
	}
	return &Anthropic{
		APIKey: apiKey,
		Model:  model,
		client: &http.Client{Timeout: 120 * time.Second},
	}
}

func (a *Anthropic) Name() string { return "anthropic" }

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// outputConfig pins the response to our {explanation, commands[]} JSON shape.
// Structured outputs replace assistant prefill (which 400s on Claude 4.6+).
type anthropicOutputConfig struct {
	Format anthropicFormat `json:"format"`
}

type anthropicFormat struct {
	Type   string         `json:"type"` // "json_schema"
	Schema map[string]any `json:"schema"`
}

type anthropicRequest struct {
	Model        string                 `json:"model"`
	MaxTokens    int                    `json:"max_tokens"`
	System       string                 `json:"system,omitempty"`
	Messages     []anthropicMessage     `json:"messages"`
	OutputConfig *anthropicOutputConfig `json:"output_config,omitempty"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	StopReason string `json:"stop_reason"`
	Error      *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// suggestionSchema is the JSON schema structured outputs validate against.
// Numerical/length constraints are intentionally omitted (unsupported).
var suggestionSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"explanation": map[string]any{"type": "string"},
		"commands": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
	},
	"required":             []string{"explanation", "commands"},
	"additionalProperties": false,
}

func (a *Anthropic) chat(ctx context.Context, userMsg string) (string, error) {
	body, _ := json.Marshal(anthropicRequest{
		Model:     a.Model,
		MaxTokens: 4096,
		System:    systemPrompt,
		Messages:  []anthropicMessage{{Role: "user", Content: userMsg}},
		OutputConfig: &anthropicOutputConfig{
			Format: anthropicFormat{Type: "json_schema", Schema: suggestionSchema},
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-api-key", a.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic: %w", err)
	}
	defer resp.Body.Close()

	var out anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("anthropic: decode: %w", err)
	}
	if out.Error != nil {
		return "", fmt.Errorf("anthropic: %s", out.Error.Message)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic: status %d", resp.StatusCode)
	}
	// Safety classifiers can decline a request (HTTP 200, stop_reason "refusal").
	if out.StopReason == "refusal" {
		return "", fmt.Errorf("anthropic: request was declined by the model's safety system")
	}
	for _, c := range out.Content {
		if c.Type == "text" {
			return c.Text, nil
		}
	}
	return "", fmt.Errorf("anthropic: empty response")
}

type anthropicStreamRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
	Stream    bool               `json:"stream"`
}

// StreamChat streams a chat completion from Anthropic. System messages are
// pulled out into the top-level `system` field (Anthropic requires messages to
// be user/assistant only). SSE deltas of type text_delta are emitted.
func (a *Anthropic) StreamChat(ctx context.Context, messages []Message, onToken func(string)) error {
	var system []string
	var msgs []anthropicMessage
	for _, m := range messages {
		if m.Role == "system" {
			system = append(system, m.Content)
			continue
		}
		msgs = append(msgs, anthropicMessage{Role: m.Role, Content: m.Content})
	}
	body, _ := json.Marshal(anthropicStreamRequest{
		Model:     a.Model,
		MaxTokens: 4096,
		System:    strings.Join(system, "\n\n"),
		Messages:  msgs,
		Stream:    true,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-api-key", a.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("anthropic: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("anthropic: status %d", resp.StatusCode)
	}

	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue // ignore "event:" lines and blanks
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		var ev struct {
			Type  string `json:"type"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &ev); err != nil {
			continue
		}
		if ev.Type == "content_block_delta" && ev.Delta.Type == "text_delta" && ev.Delta.Text != "" {
			onToken(ev.Delta.Text)
		}
		if ev.Type == "message_stop" {
			break
		}
	}
	return sc.Err()
}

func (a *Anthropic) Explain(ctx context.Context, c CommandContext) (Suggestion, error) {
	raw, err := a.chat(ctx, buildExplain(RedactContext(c)))
	if err != nil {
		return Suggestion{}, err
	}
	return parseSuggestion(raw), nil
}

func (a *Anthropic) Translate(ctx context.Context, nl string, host HostInfo) (Suggestion, error) {
	raw, err := a.chat(ctx, buildTranslate(Redact(nl), host))
	if err != nil {
		return Suggestion{}, err
	}
	return parseSuggestion(raw), nil
}
