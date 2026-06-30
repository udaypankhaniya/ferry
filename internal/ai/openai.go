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

// OpenAI is an opt-in cloud provider. Data leaves the machine — the UI must
// surface the amber trust state. Secrets are stripped before any request.
// Raw net/http, matching the other providers (lightweight pillar).
type OpenAI struct {
	APIKey string
	Model  string // default gpt-4o
	client *http.Client
}

func NewOpenAI(apiKey, model string) *OpenAI {
	if model == "" {
		model = "gpt-4o"
	}
	return &OpenAI{
		APIKey: apiKey,
		Model:  model,
		client: &http.Client{Timeout: 120 * time.Second},
	}
}

func (o *OpenAI) Name() string { return "openai" }

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIRequest struct {
	Model          string          `json:"model"`
	Messages       []openAIMessage `json:"messages"`
	ResponseFormat struct {
		Type string `json:"type"` // "json_object"
	} `json:"response_format"`
}

type openAIResponse struct {
	Choices []struct {
		Message openAIMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (o *OpenAI) chat(ctx context.Context, userMsg string) (string, error) {
	reqBody := openAIRequest{
		Model: o.Model,
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMsg},
		},
	}
	reqBody.ResponseFormat.Type = "json_object"
	body, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.APIKey)

	resp, err := o.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai: %w", err)
	}
	defer resp.Body.Close()

	var out openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("openai: decode: %w", err)
	}
	if out.Error != nil {
		return "", fmt.Errorf("openai: %s", out.Error.Message)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai: status %d", resp.StatusCode)
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("openai: empty response")
	}
	return out.Choices[0].Message.Content, nil
}

// StreamChat streams a chat completion from OpenAI (chat/completions,
// stream:true → SSE "data: {json}" lines, terminated by "data: [DONE]").
func (o *OpenAI) StreamChat(ctx context.Context, messages []Message, onToken func(string)) error {
	msgs := make([]openAIMessage, len(messages))
	for i, m := range messages {
		msgs[i] = openAIMessage{Role: m.Role, Content: m.Content}
	}
	reqBody := map[string]any{"model": o.Model, "messages": msgs, "stream": true}
	body, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.APIKey)

	resp, err := o.client.Do(req)
	if err != nil {
		return fmt.Errorf("openai: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("openai: status %d", resp.StatusCode)
	}

	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			onToken(chunk.Choices[0].Delta.Content)
		}
	}
	return sc.Err()
}

func (o *OpenAI) Explain(ctx context.Context, c CommandContext) (Suggestion, error) {
	raw, err := o.chat(ctx, buildExplain(RedactContext(c)))
	if err != nil {
		return Suggestion{}, err
	}
	return parseSuggestion(raw), nil
}

func (o *OpenAI) Translate(ctx context.Context, nl string, host HostInfo) (Suggestion, error) {
	raw, err := o.chat(ctx, buildTranslate(Redact(nl), host))
	if err != nil {
		return Suggestion{}, err
	}
	return parseSuggestion(raw), nil
}
