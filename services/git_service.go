package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
)

// Custom error types for specific Git error scenarios
var (
	ErrAuthenticationFailed = errors.New("git authentication failed")
	ErrNetworkIssue         = errors.New("network error during git operation")
	ErrMergeConflict        = errors.New("merge conflict detected")
	ErrRemoteNotFound       = errors.New("remote repository not found")
	ErrLocalChanges         = errors.New("local changes prevent operation")
)

// GitError represents a Git operation error with additional context
type GitError struct {
	Op      string // The operation that failed
	Err     error  // The underlying error
	Details string // Additional error details
}

// Error returns a string representation of the error
func (e *GitError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s failed: %v (%s)", e.Op, e.Err, e.Details)
	}
	return fmt.Sprintf("%s failed: %v", e.Op, e.Err)
}

// Unwrap returns the underlying error
func (e *GitError) Unwrap() error {
	return e.Err
}

// GitService handles Git operations for a repository
type GitService struct {
	repoPath    string
	repository  *git.Repository
	credService *CredentialService
	repoURL     string
	lastError   *GitError // Store the last error for error detail retrieval
}

// NewGitService creates a new GitService for the given repository path
func NewGitService(repoPath string, repoURL string) (*GitService, error) {
	if repoPath == "" {
		return nil, errors.New("repository path is required")
	}

	// Check if the repository exists
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return nil, &GitError{
			Op:  "open_repository",
			Err: err,
		}
	}

	return &GitService{
		repoPath:    repoPath,
		repository:  repo,
		credService: NewCredentialService(),
		repoURL:     repoURL,
	}, nil
}

// getAuth retrieves authentication credentials for Git operations
func (gs *GitService) getAuth() (*http.BasicAuth, error) {
	// Get stored credentials for this repository
	token, err := gs.credService.GetCredential(gs.repoURL)
	if err != nil {
		return nil, &GitError{
			Op:  "get_credentials",
			Err: err,
		}
	}

	return &http.BasicAuth{
		Username: "github-token", // This can be any string when using a token
		Password: token,
	}, nil
}

// classifyError attempts to identify common Git error types from error messages
func (gs *GitService) classifyError(op string, err error) *GitError {
	if err == nil {
		return nil
	}

	errMsg := err.Error()
	gitErr := &GitError{
		Op:  op,
		Err: err,
	}

	// Check for authentication failures
	if strings.Contains(errMsg, "authentication required") ||
		strings.Contains(errMsg, "authentication failed") ||
		strings.Contains(errMsg, "401") {
		gitErr.Err = ErrAuthenticationFailed
		gitErr.Details = "Authentication failed. Check your Personal Access Token."
	} else if strings.Contains(errMsg, "connect:") ||
		strings.Contains(errMsg, "timeout") ||
		strings.Contains(errMsg, "tls") ||
		strings.Contains(errMsg, "network") {
		gitErr.Err = ErrNetworkIssue
		gitErr.Details = "Network issue detected. Check your internet connection."
	} else if strings.Contains(errMsg, "conflict") {
		gitErr.Err = ErrMergeConflict
		gitErr.Details = "Merge conflict detected. Manual resolution required."
	} else if strings.Contains(errMsg, "repository not found") ||
		strings.Contains(errMsg, "404") {
		gitErr.Err = ErrRemoteNotFound
		gitErr.Details = "Remote repository not found. Check the repository URL."
	} else if strings.Contains(errMsg, "local changes") ||
		strings.Contains(errMsg, "uncommitted changes") {
		gitErr.Err = ErrLocalChanges
		gitErr.Details = "Local changes prevent this operation. Commit or stash your changes first."
	}

	// Store the error for later retrieval
	gs.lastError = gitErr
	return gitErr
}

// GetErrorDetails returns human-readable error information for the last error
func (gs *GitService) GetErrorDetails() string {
	if gs.lastError == nil {
		return "No error information available"
	}
	return gs.lastError.Error()
}

// StageChanges stages all changes in the repository (git add .)
func (gs *GitService) StageChanges() error {
	// Get the worktree
	w, err := gs.repository.Worktree()
	if err != nil {
		return gs.classifyError("stage_changes", err)
	}

	// Stage all changes
	err = w.AddWithOptions(&git.AddOptions{
		All: true,
	})
	if err != nil {
		return gs.classifyError("stage_changes", err)
	}

	return nil
}

// CommitChanges commits staged changes with the given message
func (gs *GitService) CommitChanges(message string) error {
	// Get the worktree
	w, err := gs.repository.Worktree()
	if err != nil {
		return gs.classifyError("commit_changes", err)
	}

	// Use a default message if none provided
	if message == "" {
		message = fmt.Sprintf("Auto-commit by GitNotes at %s", time.Now().Format(time.RFC3339))
	}

	// Commit the changes
	_, err = w.Commit(message, &git.CommitOptions{
		Author: &object.Signature{
			Name:  "GitNotes",
			Email: "gitnotes@example.com",
			When:  time.Now(),
		},
	})
	if err != nil {
		return gs.classifyError("commit_changes", err)
	}

	return nil
}

// PullChanges pulls the latest changes from the remote with rebase
func (gs *GitService) PullChanges() error {
	// Get the worktree
	w, err := gs.repository.Worktree()
	if err != nil {
		return gs.classifyError("pull_changes", err)
	}

	// Get authentication
	auth, err := gs.getAuth()
	if err != nil {
		// Try to proceed without auth for public repos
		fmt.Printf("Warning: %v\n", err)
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
		return gs.classifyError("pull_changes", err)
	}

	return nil
}

// PushChanges pushes local commits to the remote repository
func (gs *GitService) PushChanges() error {
	// Get authentication
	auth, err := gs.getAuth()
	if err != nil {
		// Try to proceed without auth for public repos
		fmt.Printf("Warning: %v\n", err)
	}

	// Push to remote
	err = gs.repository.Push(&git.PushOptions{
		Auth:       auth,
		RemoteName: "origin",
		Progress:   os.Stdout,
	})

	// Handle already up-to-date case
	if err == git.NoErrAlreadyUpToDate {
		return nil
	}

	if err != nil {
		return gs.classifyError("push_changes", err)
	}

	return nil
}

// HasLocalChanges checks if there are uncommitted changes in the repository
func (gs *GitService) HasLocalChanges() (bool, error) {
	// Get the worktree
	w, err := gs.repository.Worktree()
	if err != nil {
		return false, gs.classifyError("check_changes", err)
	}

	// Get the status
	status, err := w.Status()
	if err != nil {
		return false, gs.classifyError("check_changes", err)
	}

	// Return true if there are modified, added, or deleted files
	return !status.IsClean(), nil
}

// DetectConflicts checks for merge conflicts in the repository
func (gs *GitService) DetectConflicts() ([]string, error) {
	// Get the worktree
	w, err := gs.repository.Worktree()
	if err != nil {
		return nil, gs.classifyError("detect_conflicts", err)
	}

	// Get the status
	status, err := w.Status()
	if err != nil {
		return nil, gs.classifyError("detect_conflicts", err)
	}

	// Check for conflict markers in the status
	conflictedFiles := []string{}
	for filePath := range status {
		// Read the file content to check for conflict markers
		fullPath := filepath.Join(gs.repoPath, filePath)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			// Skip files we can't read
			continue
		}

		// Check for standard Git conflict markers
		fileContent := string(content)
		if strings.Contains(fileContent, "<<<<<<<") &&
			strings.Contains(fileContent, "=======") &&
			strings.Contains(fileContent, ">>>>>>>") {
			conflictedFiles = append(conflictedFiles, filePath)
		}
	}

	return conflictedFiles, nil
}
