package main

import "time"

// PingService proves the Go→frontend bridge works end-to-end.
// Remove or gut once a real service is wired.
type PingService struct{}

func NewPingService() *PingService {
	return &PingService{}
}

func (p *PingService) Ping() string {
	return "pong @ " + time.Now().Format(time.RFC3339)
}
