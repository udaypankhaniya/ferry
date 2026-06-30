package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()
	ping := NewPingService()

	siteSvc, err := NewSiteService()
	if err != nil {
		log.Fatalf("site service: %v", err)
	}
	sshSvc := NewSSHService(siteSvc)
	localFS := NewLocalFSService()

	aiSvc, err := NewAIService(siteSvc, sshSvc)
	if err != nil {
		log.Fatalf("ai service: %v", err)
	}
	cfgSvc := NewConfigService()
	chatSvc := NewChatService(aiSvc)

	err = wails.Run(&options.App{
		Title:     "Ferry",
		Width:     1280,
		Height:    800,
		MinWidth:  960,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// bg-base from design tokens (VS Code Dark+): #1E1E1E
		BackgroundColour: &options.RGBA{R: 30, G: 30, B: 30, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			sshSvc.setContext(ctx)
			chatSvc.setContext(ctx)
		},
		Bind: []interface{}{
			app,
			ping,
			siteSvc,
			sshSvc,
			localFS,
			aiSvc,
			cfgSvc,
			chatSvc,
		},
	})
	if err != nil {
		log.Fatalf("wails: %v", err)
	}
}
