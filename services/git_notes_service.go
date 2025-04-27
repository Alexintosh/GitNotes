package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// GitNotesService is the main service that combines all other services
// and is exposed to the Wails frontend
type GitNotesService struct {
	repoService *RepositoryService
	fileService *FileService
	syncManager *SyncManager
	syncActive  bool
	stopSync    chan struct{}
}

// NewGitNotesService creates a new GitNotesService instance
func NewGitNotesService() *GitNotesService {
	repoService := NewRepositoryService()
	fileService := NewFileService(repoService)

	return &GitNotesService{
		repoService: repoService,
		fileService: fileService,
		syncManager: nil,
		syncActive:  false,
		stopSync:    make(chan struct{}),
	}
}

// ConnectRepository connects to a GitHub repository
func (gns *GitNotesService) ConnectRepository(repoURL, localPath, token string) error {
	// Stop sync if it's already running
	if gns.syncActive {
		gns.StopAutomaticSync()
	}

	// If no token is provided, try to get it from settings
	if token == "" {
		settingsJson, err := gns.LoadSettings()
		if err == nil && settingsJson != "{}" {
			var settings map[string]interface{}
			if err := json.Unmarshal([]byte(settingsJson), &settings); err == nil {
				if tokenVal, ok := settings["token"].(string); ok && tokenVal != "" {
					token = tokenVal
				}
			}
		}
	}

	// Connect to the repository
	err := gns.repoService.ConnectRepository(repoURL, localPath, token)
	if err != nil {
		return err
	}

	// Create GitService and SyncManager after successful connection
	gitService, err := NewGitService(localPath, repoURL)
	if err != nil {
		return err
	}

	// Initialize SyncManager
	gns.syncManager = NewSyncManager(gitService)

	return nil
}

// ValidateConnection tests if the repository connection works
func (gns *GitNotesService) ValidateConnection(repoURL, token string) error {
	err := gns.repoService.ValidateConnection(repoURL, token)
	if err != nil {
		return err
	}
	return nil
}

// GetRepositoryStructure returns the directory structure of the repository
func (gns *GitNotesService) GetRepositoryStructure() (string, error) {
	if !gns.repoService.IsConnected() {
		return "", errors.New("not connected to a repository")
	}

	rootNode, err := gns.fileService.GetRepositoryStructure()
	if err != nil {
		return "", err
	}

	// Convert the file tree to JSON
	jsonData, err := json.Marshal(rootNode)
	if err != nil {
		return "", fmt.Errorf("error marshaling file tree: %w", err)
	}

	return string(jsonData), nil
}

// GetFileContent reads and returns the content of a file
func (gns *GitNotesService) GetFileContent(filePath string) (string, error) {
	if !gns.repoService.IsConnected() {
		return "", errors.New("not connected to a repository")
	}

	return gns.fileService.GetFileContent(filePath)
}

// WriteFileContent writes content to a file
func (gns *GitNotesService) WriteFileContent(filePath string, content string) error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	return gns.fileService.WriteFileContent(filePath, content)
}

// GetChildrenOfPath gets the direct children of a directory
func (gns *GitNotesService) GetChildrenOfPath(dirPath string) (string, error) {
	if !gns.repoService.IsConnected() {
		return "", errors.New("not connected to a repository")
	}

	children, err := gns.fileService.GetChildrenOfPath(dirPath)
	if err != nil {
		return "", err
	}

	// Convert to JSON
	jsonData, err := json.Marshal(children)
	if err != nil {
		return "", fmt.Errorf("error marshaling children: %w", err)
	}

	return string(jsonData), nil
}

// IsMarkdownFile checks if a file is a Markdown file
func (gns *GitNotesService) IsMarkdownFile(filePath string) bool {
	return gns.fileService.IsMarkdownFile(filePath)
}

// CreateFile creates a new file with the given content
func (gns *GitNotesService) CreateFile(filePath string, content string) error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	return gns.fileService.CreateFile(filePath, content)
}

// CreateDirectory creates a new directory
func (gns *GitNotesService) CreateDirectory(dirPath string) error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	return gns.fileService.CreateDirectory(dirPath)
}

// DeleteFile deletes a file
func (gns *GitNotesService) DeleteFile(filePath string) error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	return gns.fileService.DeleteFile(filePath)
}

// TriggerManualSync performs a manual synchronization with the remote repository
func (gns *GitNotesService) TriggerManualSync() error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	if gns.syncManager == nil {
		return errors.New("sync manager not initialized")
	}

	// Use the SyncManager to trigger a sync with detailed status tracking
	_, err := gns.syncManager.TriggerManualSync()
	return err
}

// GetSyncStatus returns the current synchronization status
func (gns *GitNotesService) GetSyncStatus() string {
	if gns.syncManager == nil {
		if !gns.repoService.IsConnected() {
			return "Disconnected"
		}
		return "Connected"
	}

	return gns.syncManager.GetSyncStatus()
}

// GetSyncHistory returns the synchronization history as JSON
func (gns *GitNotesService) GetSyncHistory() (string, error) {
	if gns.syncManager == nil {
		return "[]", nil
	}

	history := gns.syncManager.GetSyncHistory()

	// Convert to JSON
	historyJSON, err := json.Marshal(history)
	if err != nil {
		return "", fmt.Errorf("error marshaling sync history: %w", err)
	}

	return string(historyJSON), nil
}

// StartAutomaticSync starts automatic synchronization with the remote repository
func (gns *GitNotesService) StartAutomaticSync(intervalSeconds int) error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	if gns.syncManager == nil {
		return errors.New("sync manager not initialized")
	}

	// Don't start if it's already running
	if gns.syncActive {
		return nil
	}

	// Default interval if not provided
	if intervalSeconds <= 0 {
		intervalSeconds = 300 // 5 minutes
	}

	// Start the sync loop in a goroutine
	gns.stopSync = make(chan struct{})
	gns.syncActive = true

	go func() {
		ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// Perform sync using the SyncManager
				_, err := gns.syncManager.TriggerManualSync()
				if err != nil {
					// Log the error but continue the sync loop
					fmt.Printf("Auto-sync error: %v\n", err)
				}
			case <-gns.stopSync:
				return
			}
		}
	}()

	return nil
}

// StopAutomaticSync stops automatic synchronization
func (gns *GitNotesService) StopAutomaticSync() {
	if gns.syncActive {
		close(gns.stopSync)
		gns.syncActive = false
	}
}

// IsAutoSyncActive returns whether automatic synchronization is active
func (gns *GitNotesService) IsAutoSyncActive() bool {
	return gns.syncActive
}

// DetectConflicts checks for and returns any Git merge conflicts
func (gns *GitNotesService) DetectConflicts() (string, error) {
	if !gns.repoService.IsConnected() {
		return "", errors.New("not connected to a repository")
	}

	if gns.syncManager == nil {
		return "", errors.New("sync manager not initialized")
	}

	conflicts, err := gns.syncManager.DetectConflicts()
	if err != nil {
		return "", err
	}

	// Convert to JSON
	conflictsJSON, err := json.Marshal(conflicts)
	if err != nil {
		return "", fmt.Errorf("error marshaling conflicts: %w", err)
	}

	return string(conflictsJSON), nil
}

// GetConflictDetails provides detailed information about any detected conflicts
func (gns *GitNotesService) GetConflictDetails() (string, error) {
	if !gns.repoService.IsConnected() {
		return "", errors.New("not connected to a repository")
	}

	if gns.syncManager == nil {
		return "", errors.New("sync manager not initialized")
	}

	details := gns.syncManager.GetConflictDetails()

	// Convert to JSON
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		return "", fmt.Errorf("error marshaling conflict details: %w", err)
	}

	return string(detailsJSON), nil
}

// AbortSyncWithConflicts aborts a sync operation that has conflicts
func (gns *GitNotesService) AbortSyncWithConflicts() error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	if gns.syncManager == nil {
		return errors.New("sync manager not initialized")
	}

	return gns.syncManager.AbortSync()
}

// SetConflictResolutionStrategy sets the conflict resolution strategy
// Valid strategies are:
// - "manual": Requires user to manually resolve conflicts
// - "ours": Automatically use our/local changes
// - "theirs": Automatically use their/remote changes
// - "both": Keep both sets of changes with conflict markers
func (gns *GitNotesService) SetConflictResolutionStrategy(strategy string) error {
	if !gns.repoService.IsConnected() {
		return errors.New("repository not connected")
	}
	if gns.syncManager == nil {
		return errors.New("sync manager not initialized")
	}

	// Validate and convert the strategy string
	var conflictStrategy ConflictStrategy
	switch strategy {
	case "manual":
		conflictStrategy = ConflictStrategyManual
	case "ours":
		conflictStrategy = ConflictStrategyOurs
	case "theirs":
		conflictStrategy = ConflictStrategyTheirs
	case "both":
		conflictStrategy = ConflictStrategyBoth
	default:
		return fmt.Errorf("invalid conflict resolution strategy: %s", strategy)
	}

	gns.syncManager.SetConflictStrategy(conflictStrategy)
	return nil
}

// ResolveConflictsWithStrategy resolves conflicts using the specified strategy
func (gns *GitNotesService) ResolveConflictsWithStrategy(strategy string) error {
	if !gns.repoService.IsConnected() {
		return errors.New("not connected to a repository")
	}

	if gns.syncManager == nil {
		return errors.New("sync manager not initialized")
	}

	// Validate and convert the strategy string
	var conflictStrategy ConflictStrategy
	switch strategy {
	case "manual":
		return fmt.Errorf("manual strategy requires user intervention, not automatic resolution")
	case "ours":
		conflictStrategy = ConflictStrategyOurs
	case "theirs":
		conflictStrategy = ConflictStrategyTheirs
	case "both":
		conflictStrategy = ConflictStrategyBoth
	default:
		return fmt.Errorf("invalid conflict resolution strategy: %s", strategy)
	}

	return gns.syncManager.ResolveConflictWithStrategy(conflictStrategy)
}

// GetSettings returns the current application settings
func (gns *GitNotesService) GetSettings() (string, error) {
	// First try to load settings from file to get any stored token
	storedSettings, err := gns.LoadSettings()
	var settingsMap map[string]interface{}

	if err == nil && storedSettings != "{}" {
		// Parse stored settings
		if err := json.Unmarshal([]byte(storedSettings), &settingsMap); err != nil {
			settingsMap = make(map[string]interface{})
		}
	} else {
		// Initialize empty settings map
		settingsMap = make(map[string]interface{})
	}

	// Update with current runtime values
	if gns.repoService.IsConnected() {
		settingsMap["repoURL"] = gns.repoService.repoURL
		settingsMap["localRepoPath"] = gns.repoService.localRepoPath
		settingsMap["isConnected"] = gns.repoService.isConnected
		settingsMap["syncActive"] = gns.syncActive
	}

	jsonData, err := json.Marshal(settingsMap)
	if err != nil {
		return "{}", fmt.Errorf("error marshaling settings: %w", err)
	}

	return string(jsonData), nil
}

// SaveSettings saves the application settings to a file
func (gns *GitNotesService) SaveSettings(settings string) error {
	// Get the config directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("error getting home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".gitnotes")
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return fmt.Errorf("error creating config directory: %w", err)
	}

	// Save settings to file
	settingsFile := filepath.Join(configDir, "settings.json")
	if err := os.WriteFile(settingsFile, []byte(settings), 0600); err != nil {
		return fmt.Errorf("error writing settings file: %w", err)
	}

	return nil
}

// LoadSettings loads the application settings from a file
func (gns *GitNotesService) LoadSettings() (string, error) {
	// Get the config directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "{}", fmt.Errorf("error getting home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".gitnotes")
	settingsFile := filepath.Join(configDir, "settings.json")

	// Check if file exists
	if _, err := os.Stat(settingsFile); os.IsNotExist(err) {
		// Return empty settings if file doesn't exist
		return "{}", nil
	}

	// Read the settings file
	data, err := os.ReadFile(settingsFile)
	if err != nil {
		return "{}", fmt.Errorf("error reading settings file: %w", err)
	}

	return string(data), nil
}
