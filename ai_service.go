package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"ferry/internal/ai"
	"ferry/internal/capture"
	"ferry/internal/history"
	"ferry/internal/vault"
)

// vaultKey namespaces a provider's API key inside the credential vault, keeping
// it distinct from per-site secrets.
func vaultKey(provider string) string { return "ai:" + provider }

// CommandResult is the structured outcome of an exec-mode command, shared with
// the frontend (mirrors the TS CommandError type). Host is an alias only.
type CommandResult struct {
	Command  string `json:"command"`
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
	Host     string `json:"host"`
}

// AIService runs exec-mode commands for AI context and brokers provider calls.
// Bound to the frontend. Ollama is the default; cloud providers (Anthropic,
// OpenAI) are opt-in and require an API key stored via SetAPIKey.
type AIService struct {
	siteSvc *SiteService
	sshSvc  *SSHService
	hist    *history.DB

	ollamaURL      string // empty → provider default
	ollamaModel    string // empty → provider default
	anthropicModel string // empty → provider default (claude-opus-4-8)
	openaiModel    string // empty → provider default (gpt-4o)
}

func NewAIService(siteSvc *SiteService, sshSvc *SSHService) (*AIService, error) {
	h, err := history.Open()
	if err != nil {
		return nil, err
	}
	return &AIService{siteSvc: siteSvc, sshSvc: sshSvc, hist: h}, nil
}

// provider builds a provider by name. Cloud providers require a stored API key
// (opt-in) — never silently fall back to a cloud provider.
func (a *AIService) provider(name string) (ai.Provider, error) {
	switch name {
	case "ollama", "":
		return ai.NewOllama(a.ollamaURL, a.ollamaModel), nil
	case "anthropic":
		key, err := vault.Load(vaultKey("anthropic"))
		if err != nil || key == "" {
			return nil, fmt.Errorf("Claude (cloud) needs an API key — add one in settings to opt in")
		}
		return ai.NewAnthropic(key, a.anthropicModel), nil
	case "openai":
		key, err := vault.Load(vaultKey("openai"))
		if err != nil || key == "" {
			return nil, fmt.Errorf("OpenAI (cloud) needs an API key — add one in settings to opt in")
		}
		return ai.NewOpenAI(key, a.openaiModel), nil
	default:
		return nil, fmt.Errorf("unknown provider %q", name)
	}
}

// SetAPIKey stores (or, with an empty key, clears) a cloud provider's API key
// in the OS keychain / encrypted vault. Bound to the frontend settings UI.
func (a *AIService) SetAPIKey(provider, key string) error {
	switch provider {
	case "anthropic", "openai":
	default:
		return fmt.Errorf("unknown provider %q", provider)
	}
	if key == "" {
		return vault.Delete(vaultKey(provider))
	}
	return vault.Store(vaultKey(provider), key)
}

// HasAPIKey reports whether a cloud provider has a stored key — lets the UI
// show the provider as configured without ever exposing the key.
func (a *AIService) HasAPIKey(provider string) bool {
	key, err := vault.Load(vaultKey(provider))
	return err == nil && key != ""
}

// hostAlias returns a human label for a site (never credentials).
func (a *AIService) hostAlias(siteID string) string {
	sites, err := a.siteSvc.GetSites()
	if err != nil {
		return siteID
	}
	for _, s := range sites {
		if s.ID == siteID {
			if s.Name != "" {
				return s.Name
			}
			return s.Host
		}
	}
	return siteID
}

// RunCommand executes a command on the connected host via exec mode, records it
// to history, and returns the clean result. A non-zero ExitCode is data, not an
// error — the frontend decides whether to wake the AI panel.
func (a *AIService) RunCommand(siteID, command string) (CommandResult, error) {
	client, ok := a.sshSvc.clientFor(siteID)
	if !ok {
		return CommandResult{}, fmt.Errorf("not connected to site %s", siteID)
	}

	alias := a.hostAlias(siteID)
	recent, _ := a.hist.RecentCommands(siteID, 10)

	cc, err := capture.Run(client, command, alias, "", recent)
	if err != nil {
		return CommandResult{}, err
	}

	_ = a.hist.RecordCommand(history.CommandRecord{
		SiteID:   siteID,
		Host:     alias,
		Command:  command,
		ExitCode: cc.ExitCode,
		Stdout:   cc.Stdout,
		Stderr:   cc.Stderr,
	})

	return CommandResult{
		Command:  command,
		Stdout:   cc.Stdout,
		Stderr:   cc.Stderr,
		ExitCode: cc.ExitCode,
		Host:     alias,
	}, nil
}

// Explain asks the provider why a command failed and how to fix it.
// Secrets are stripped inside the provider (RedactContext) before any send.
func (a *AIService) Explain(providerName, siteID string, result CommandResult) (ai.Suggestion, error) {
	p, err := a.provider(providerName)
	if err != nil {
		return ai.Suggestion{}, err
	}
	recent, _ := a.hist.RecentCommands(siteID, 10)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return p.Explain(ctx, ai.CommandContext{
		Command:  result.Command,
		Stdout:   result.Stdout,
		Stderr:   result.Stderr,
		ExitCode: result.ExitCode,
		Host:     a.hostAlias(siteID),
		Recent:   recent,
	})
}

// Translate turns a natural-language request into reviewable shell commands.
func (a *AIService) Translate(providerName, siteID, nl string) (ai.Suggestion, error) {
	p, err := a.provider(providerName)
	if err != nil {
		return ai.Suggestion{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	return p.Translate(ctx, nl, ai.HostInfo{Alias: a.hostAlias(siteID)})
}

// OllamaAvailable reports whether a local Ollama daemon is reachable, so the UI
// can default to local and prompt for a cloud key only when it isn't.
func (a *AIService) OllamaAvailable() bool {
	url := a.ollamaURL
	if url == "" {
		url = "http://localhost:11434"
	}
	client := &http.Client{Timeout: 1500 * time.Millisecond}
	resp, err := client.Get(url + "/api/tags")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
