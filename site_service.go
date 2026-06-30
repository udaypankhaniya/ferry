package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// Site mirrors the frontend Site type.
type Site struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Host          string `json:"host"`
	Port          int    `json:"port"`
	Protocol      string `json:"protocol"`
	Username      string `json:"username"`
	AuthType      string `json:"authType"`
	KeyPath       string `json:"keyPath,omitempty"`
	Group         string `json:"group,omitempty"`
	LastConnected string `json:"lastConnected,omitempty"`
}

// SiteService manages saved connections. Bound to the frontend via Wails.
type SiteService struct {
	db *sql.DB
}

func NewSiteService() (*SiteService, error) {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".ferry")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", filepath.Join(dir, "sites.db"))
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS sites (
			id             TEXT PRIMARY KEY,
			name           TEXT NOT NULL,
			host           TEXT NOT NULL,
			port           INTEGER NOT NULL DEFAULT 22,
			protocol       TEXT NOT NULL DEFAULT 'sftp',
			username       TEXT NOT NULL,
			auth_type      TEXT NOT NULL DEFAULT 'password',
			key_path       TEXT,
			group_name     TEXT,
			last_connected TEXT
		)
	`); err != nil {
		return nil, err
	}
	return &SiteService{db: db}, nil
}

func (s *SiteService) GetSites() ([]Site, error) {
	rows, err := s.db.Query(`SELECT id,name,host,port,protocol,username,auth_type,COALESCE(key_path,''),COALESCE(group_name,''),COALESCE(last_connected,'') FROM sites ORDER BY group_name,name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Site
	for rows.Next() {
		var site Site
		if err := rows.Scan(&site.ID, &site.Name, &site.Host, &site.Port, &site.Protocol, &site.Username, &site.AuthType, &site.KeyPath, &site.Group, &site.LastConnected); err == nil {
			out = append(out, site)
		}
	}
	return out, rows.Err()
}

func (s *SiteService) CreateSite(site Site) (Site, error) {
	_, err := s.db.Exec(
		`INSERT INTO sites (id,name,host,port,protocol,username,auth_type,key_path,group_name) VALUES (?,?,?,?,?,?,?,?,?)`,
		site.ID, site.Name, site.Host, site.Port, site.Protocol, site.Username, site.AuthType, site.KeyPath, site.Group,
	)
	return site, err
}

func (s *SiteService) UpdateSite(site Site) error {
	_, err := s.db.Exec(
		`UPDATE sites SET name=?,host=?,port=?,protocol=?,username=?,auth_type=?,key_path=?,group_name=? WHERE id=?`,
		site.Name, site.Host, site.Port, site.Protocol, site.Username, site.AuthType, site.KeyPath, site.Group, site.ID,
	)
	return err
}

func (s *SiteService) DeleteSite(id string) error {
	_, err := s.db.Exec(`DELETE FROM sites WHERE id=?`, id)
	return err
}

func (s *SiteService) MarkConnected(id string) error {
	_, err := s.db.Exec(`UPDATE sites SET last_connected=? WHERE id=?`, time.Now().Format(time.RFC3339), id)
	return err
}
