package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

// RepositoryService handles Git repository operations
type RepositoryService struct {
	localRepoPath string
	repoURL       string
	credService   *CredentialService
	repository    *git.Repository
	isConnected   bool
}

// NewRepositoryService creates a new RepositoryService instance
func NewRepositoryService() *RepositoryService {
	return &RepositoryService{
		credService: NewCredentialService(),
		isConnected: false,
	}
}

// ConnectRepository connects to the specified Git repository
// If the repository is not already cloned, it will clone it.
// If it is already cloned, it will open the existing repository.
// If token is empty, it will attempt to use a previously stored token.
func (rs *RepositoryService) ConnectRepository(repoURL, localPath, token string) error {
	// Check if inputs are valid
	if repoURL == "" {
		return errors.New("repository URL is required")
	}
	if localPath == "" {
		return errors.New("local path is required")
	}

	// Store the credentials securely if token is provided
	if token != "" {
		err := rs.credService.StoreCredential(repoURL, token)
		if err != nil {
			return fmt.Errorf("failed to store credentials: %w", err)
		}
	}

	// Store the repository information
	rs.repoURL = repoURL
	rs.localRepoPath = localPath

	// Check if the repository already exists locally
	if _, err := os.Stat(filepath.Join(localPath, ".git")); err == nil {
		// Open existing repository
		repo, err := git.PlainOpen(localPath)
		if err != nil {
			return fmt.Errorf("error opening existing repository: %w", err)
		}
		rs.repository = repo
		rs.isConnected = true
		return nil
	}

	// Repository does not exist, clone it
	return rs.cloneRepository()
}

// cloneRepository clones the remote repository to the local path
func (rs *RepositoryService) cloneRepository() error {
	// Ensure the parent directory exists
	if err := os.MkdirAll(filepath.Dir(rs.localRepoPath), 0755); err != nil {
		return fmt.Errorf("error creating parent directories: %w", err)
	}

	// Get stored credentials for this repository
	token, err := rs.credService.GetCredential(rs.repoURL)
	if err != nil {
		// If token not found in keychain, we'll try to proceed anyway
		// Git operations will still work for public repos or if a token is provided at runtime
		fmt.Printf("Warning: Unable to retrieve credentials from keychain: %v\n", err)
		token = "" // Ensure token is empty if not found
	}

	// Setup auth if we have a token
	var auth *http.BasicAuth
	if token != "" {
		auth = &http.BasicAuth{
			Username: "github-token", // This can be any string when using a token
			Password: token,
		}
	}

	// Clone the repository
	repo, err := git.PlainClone(rs.localRepoPath, false, &git.CloneOptions{
		URL:      rs.repoURL,
		Auth:     auth,
		Progress: os.Stdout, // Show progress
	})
	if err != nil {
		return fmt.Errorf("error cloning repository: %w", err)
	}

	rs.repository = repo
	rs.isConnected = true
	return nil
}

// ValidateConnection tests if the repository connection works
func (rs *RepositoryService) ValidateConnection(repoURL, token string) error {
	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "gitnotes-test-*")
	if err != nil {
		return fmt.Errorf("error creating temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir) // Clean up after test

	// Setup auth
	auth := &http.BasicAuth{
		Username: "github-token", // This can be any string when using a token
		Password: token,
	}

	// Try to clone the repository
	_, err = git.PlainClone(tempDir, false, &git.CloneOptions{
		URL:           repoURL,
		Auth:          auth,
		Depth:         1, // Just fetch the latest commit to save time
		SingleBranch:  true,
		Progress:      nil,
		NoCheckout:    true, // Don't check out files to save time
		Tags:          git.NoTags,
		RemoteName:    "origin",
		ReferenceName: "", // Use default branch
	})

	if err != nil {
		return fmt.Errorf("connection validation failed: %w", err)
	}

	return nil
}

// GetRepositoryPath returns the local path to the repository
func (rs *RepositoryService) GetRepositoryPath() string {
	return rs.localRepoPath
}

// IsConnected returns whether the service is connected to a repository
func (rs *RepositoryService) IsConnected() bool {
	return rs.isConnected
}

// UpdateRemote pulls the latest changes from the remote repository
func (rs *RepositoryService) UpdateRemote() error {
	if !rs.isConnected {
		return errors.New("not connected to a repository")
	}

	// Get stored credentials for this repository
	token, err := rs.credService.GetCredential(rs.repoURL)
	if err != nil {
		// If token not found in keychain, we'll try to proceed anyway
		// This can still work for public repos or those with SSH keys
		fmt.Printf("Warning: Unable to retrieve credentials from keychain: %v\n", err)
		token = "" // Ensure token is empty if not found
	}

	// Setup auth if we have a token
	var auth *http.BasicAuth
	if token != "" {
		auth = &http.BasicAuth{
			Username: "github-token", // This can be any string when using a token
			Password: token,
		}
	}

	// Get the worktree
	w, err := rs.repository.Worktree()
	if err != nil {
		return fmt.Errorf("error getting worktree: %w", err)
	}

	// Pull the latest changes
	err = w.Pull(&git.PullOptions{
		Auth:          auth,
		RemoteName:    "origin",
		ReferenceName: "", // Use default branch
		Progress:      os.Stdout,
	})

	// Handle already up-to-date case
	if err == git.NoErrAlreadyUpToDate {
		return nil
	}

	if err != nil {
		return fmt.Errorf("error pulling latest changes: %w", err)
	}

	return nil
}
