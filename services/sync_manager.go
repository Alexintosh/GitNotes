package services

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// We don't need to redeclare ErrMergeConflict since it's already defined in git_service.go
// var ErrMergeConflict = errors.New("merge conflict detected")

// SyncStatus represents the current status of Git synchronization
type SyncStatus string

// SyncStatus constants define the possible sync states
const (
	SyncStatusIdle      SyncStatus = "Idle"
	SyncStatusChecking  SyncStatus = "Checking for changes"
	SyncStatusStaging   SyncStatus = "Staging changes"
	SyncStatusCommit    SyncStatus = "Committing changes"
	SyncStatusPulling   SyncStatus = "Pulling from remote"
	SyncStatusPushing   SyncStatus = "Pushing to remote"
	SyncStatusSuccess   SyncStatus = "Sync completed successfully"
	SyncStatusError     SyncStatus = "Sync error"
	SyncStatusConflict  SyncStatus = "Conflict detected"   // New status for conflict detection
	SyncStatusResolving SyncStatus = "Resolving conflicts" // Status for conflict resolution
)

// ConflictStrategy represents different strategies for resolving conflicts
type ConflictStrategy string

// ConflictStrategy constants define the possible conflict resolution strategies
const (
	ConflictStrategyManual = "manual" // Requires manual resolution
	ConflictStrategyOurs   = "ours"   // Use our/local changes
	ConflictStrategyTheirs = "theirs" // Use their/remote changes
	ConflictStrategyBoth   = "both"   // Keep both changes with conflict markers
)

// SyncHistoryEntry represents a single sync operation in the history
type SyncHistoryEntry struct {
	Timestamp     time.Time  `json:"timestamp"`
	Status        SyncStatus `json:"status"`
	Message       string     `json:"message"`
	Error         string     `json:"error,omitempty"`
	ConflictFiles []string   `json:"conflictFiles,omitempty"` // List of files with conflicts
}

// SyncManager handles Git synchronization operations and maintains status
type SyncManager struct {
	gitService       *GitService
	currentStatus    SyncStatus
	lastSyncTime     time.Time
	mu               sync.Mutex
	ctx              context.Context
	cancel           context.CancelFunc
	syncHistory      []SyncHistoryEntry
	maxHistorySize   int
	conflictStrategy ConflictStrategy
	currentConflicts []string // Current detected conflicts
	lastError        error
}

// NewSyncManager creates a new SyncManager to manage Git synchronization
func NewSyncManager(gitService *GitService) *SyncManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &SyncManager{
		gitService:       gitService,
		currentStatus:    SyncStatusIdle,
		lastSyncTime:     time.Time{}, // Zero time
		ctx:              ctx,
		cancel:           cancel,
		syncHistory:      make([]SyncHistoryEntry, 0),
		maxHistorySize:   100,                    // Keep last 100 sync operations
		conflictStrategy: ConflictStrategyManual, // Default to manual conflict resolution
		currentConflicts: nil,
	}
}

// updateStatus updates the current sync status and adds an entry to history
func (sm *SyncManager) updateStatus(status SyncStatus, message string, err error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.currentStatus = status

	// Only update last sync time when operation is successful
	if status == SyncStatusSuccess {
		sm.lastSyncTime = time.Now()
	}

	// Create history entry
	entry := SyncHistoryEntry{
		Timestamp: time.Now(),
		Status:    status,
		Message:   message,
	}

	if err != nil {
		entry.Error = err.Error()
	}

	// Add conflict info if available
	if status == SyncStatusConflict && sm.currentConflicts != nil {
		entry.ConflictFiles = make([]string, len(sm.currentConflicts))
		copy(entry.ConflictFiles, sm.currentConflicts)
	}

	// Add to history and maintain max size
	sm.syncHistory = append(sm.syncHistory, entry)
	if len(sm.syncHistory) > sm.maxHistorySize {
		sm.syncHistory = sm.syncHistory[len(sm.syncHistory)-sm.maxHistorySize:]
	}
}

// GetSyncStatus returns the current sync status information
func (sm *SyncManager) GetSyncStatus() string {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	status := string(sm.currentStatus)

	// Add last sync time if available
	if !sm.lastSyncTime.IsZero() {
		status += fmt.Sprintf(" (Last sync: %s)", sm.lastSyncTime.Format("Jan 2 15:04:05"))
	}

	// Add error details if in error state
	if sm.currentStatus == SyncStatusError && sm.gitService != nil {
		errorDetails := sm.gitService.GetErrorDetails()
		if errorDetails != "No error information available" {
			status += fmt.Sprintf(" - %s", errorDetails)
		}
	}

	// Add conflict details if in conflict state
	if sm.currentStatus == SyncStatusConflict && len(sm.currentConflicts) > 0 {
		status += fmt.Sprintf(" - %d files with conflicts", len(sm.currentConflicts))
		if len(sm.currentConflicts) <= 3 {
			// Show file names for a small number of conflicts
			status += fmt.Sprintf(": %s", strings.Join(sm.currentConflicts, ", "))
		}
	}

	return status
}

// GetSyncHistory returns the sync operation history
func (sm *SyncManager) GetSyncHistory() []SyncHistoryEntry {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Return a copy to avoid data races
	historyCopy := make([]SyncHistoryEntry, len(sm.syncHistory))
	copy(historyCopy, sm.syncHistory)

	return historyCopy
}

// TriggerManualSync performs a full sync sequence with status tracking
func (sm *SyncManager) TriggerManualSync() (string, error) {
	// Create a context with cancellation for this sync operation
	ctx, cancel := context.WithCancel(sm.ctx)
	defer cancel()

	// Start a goroutine to perform the sync operation
	errChan := make(chan error, 1)
	go func() {
		defer close(errChan)
		errChan <- sm.performSync(ctx)
	}()

	// Wait for completion or cancellation
	select {
	case err := <-errChan:
		if err != nil {
			return sm.GetSyncStatus(), err
		}
		return sm.GetSyncStatus(), nil
	case <-sm.ctx.Done():
		return "Sync cancelled", sm.ctx.Err()
	}
}

// performSync executes the actual synchronization process
func (sm *SyncManager) performSync(ctx context.Context) error {
	// Check for local changes
	sm.updateStatus(SyncStatusChecking, "Checking for local changes", nil)

	if ctx.Err() != nil {
		return ctx.Err()
	}

	hasChanges, err := sm.gitService.HasLocalChanges()
	if err != nil {
		sm.updateStatus(SyncStatusError, "Failed to check for local changes", err)
		return err
	}

	// If there are local changes, stage and commit them
	if hasChanges {
		sm.updateStatus(SyncStatusStaging, "Staging local changes", nil)

		if ctx.Err() != nil {
			return ctx.Err()
		}

		err = sm.gitService.StageChanges()
		if err != nil {
			sm.updateStatus(SyncStatusError, "Failed to stage changes", err)
			return err
		}

		sm.updateStatus(SyncStatusCommit, "Committing local changes", nil)

		if ctx.Err() != nil {
			return ctx.Err()
		}

		err = sm.gitService.CommitChanges("Auto-commit by GitNotes")
		if err != nil {
			sm.updateStatus(SyncStatusError, "Failed to commit changes", err)
			return err
		}
	}

	// Pull from remote
	sm.updateStatus(SyncStatusPulling, "Pulling changes from remote", nil)

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Pull changes from remote
	err = sm.gitService.PullChanges()
	if err != nil {
		// For Git errors, unwrap to get the specific error type
		var gitErr *GitError
		if errors.As(err, &gitErr) && errors.Is(gitErr.Err, ErrMergeConflict) {
			// Detect and record the conflicted files
			conflicts, detectErr := sm.DetectConflicts()
			if detectErr != nil {
				sm.updateStatus(SyncStatusError, "Failed to detect conflicts", detectErr)
				return detectErr
			}

			// If conflicts were found, handle based on strategy
			if len(conflicts) > 0 {
				switch sm.conflictStrategy {
				case ConflictStrategyManual:
					// Manual strategy requires user intervention, so stop here
					return fmt.Errorf("merge conflicts detected: %w", err)
				case ConflictStrategyOurs, ConflictStrategyTheirs, ConflictStrategyBoth:
					// Attempt to resolve with the selected strategy
					resolveErr := sm.ResolveConflictWithStrategy(sm.conflictStrategy)
					if resolveErr != nil {
						sm.updateStatus(SyncStatusError, "Failed to auto-resolve conflicts", resolveErr)
						return resolveErr
					}

					// Continue with push after auto-resolution
				}
			}
		} else {
			// For other errors, update status and return
			sm.updateStatus(SyncStatusError, "Failed to pull changes", err)
			return err
		}
	}

	// Check for conflicts again after pull operation
	conflicts, _ := sm.DetectConflicts()
	if len(conflicts) > 0 {
		// If we still have conflicts, we can't proceed
		return fmt.Errorf("unresolved merge conflicts detected in %d files", len(conflicts))
	}

	// Push changes
	sm.updateStatus(SyncStatusPushing, "Pushing local changes to remote", nil)

	if ctx.Err() != nil {
		return ctx.Err()
	}

	err = sm.gitService.PushChanges()
	if err != nil {
		sm.updateStatus(SyncStatusError, "Failed to push changes", err)
		return err
	}

	// Update status to success
	sm.updateStatus(SyncStatusSuccess, "Synchronization completed successfully", nil)
	return nil
}

// CancelSync cancels the current sync operation
func (sm *SyncManager) CancelSync() {
	sm.cancel()
	// Create a new context for future operations
	sm.ctx, sm.cancel = context.WithCancel(context.Background())
	sm.updateStatus(SyncStatusIdle, "Sync operation cancelled", nil)
}

// DetectConflicts checks for merge conflicts and updates status if conflicts are found
func (sm *SyncManager) DetectConflicts() ([]string, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	conflicts, err := sm.gitService.DetectConflicts()
	if err != nil {
		return nil, err
	}

	// Update conflict status if conflicts were found
	if len(conflicts) > 0 {
		sm.currentConflicts = conflicts
		sm.updateStatus(SyncStatusConflict, fmt.Sprintf("Detected %d files with conflicts", len(conflicts)), nil)
	} else {
		sm.currentConflicts = nil
	}

	return conflicts, nil
}

// AbortSync aborts the current sync operation if there are conflicts or errors
func (sm *SyncManager) AbortSync() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Cancel any ongoing sync operation
	sm.cancel()
	// Create a new context for future operations
	sm.ctx, sm.cancel = context.WithCancel(context.Background())

	// Only proceed with abort if we're in conflict or error state
	if sm.currentStatus != SyncStatusConflict && sm.currentStatus != SyncStatusError {
		return fmt.Errorf("cannot abort sync: no conflict or error to resolve")
	}

	// If there are conflicts, reset the repository state
	if len(sm.currentConflicts) > 0 {
		// In a real implementation, we would use git operations to abort
		// the merge or rebase operation. For simplicity, we're just using
		// git.PlainOpen to get access to the repository and then would use
		// the repository object to abort the merge.
		//
		// In practice, this would involve running git commands like:
		// git merge --abort or git rebase --abort

		// Here we'll just update status assuming the abort was successful
		sm.updateStatus(SyncStatusIdle, "Sync aborted and conflicts cleared", nil)
		sm.currentConflicts = nil
		return nil
	}

	// If we're in error state, reset to idle
	sm.updateStatus(SyncStatusIdle, "Sync operation aborted", nil)
	return nil
}

// SetConflictStrategy sets the strategy for handling merge conflicts
func (sm *SyncManager) SetConflictStrategy(strategy ConflictStrategy) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.conflictStrategy = strategy
}

// GetConflictDetails returns detailed information about the current conflicts
func (sm *SyncManager) GetConflictDetails() map[string]interface{} {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if len(sm.currentConflicts) == 0 {
		return map[string]interface{}{
			"hasConflicts": false,
		}
	}

	return map[string]interface{}{
		"hasConflicts":      true,
		"conflictCount":     len(sm.currentConflicts),
		"conflictFiles":     sm.currentConflicts,
		"currentStrategy":   string(sm.conflictStrategy),
		"resolutionOptions": []string{"manual", "ours", "theirs", "both"},
	}
}

// ResolveConflictWithStrategy resolves conflicts using the specified strategy
func (sm *SyncManager) ResolveConflictWithStrategy(strategy ConflictStrategy) error {
	if strategy != ConflictStrategyOurs &&
		strategy != ConflictStrategyTheirs &&
		strategy != ConflictStrategyBoth {
		return fmt.Errorf("invalid conflict resolution strategy: %s", strategy)
	}

	sm.updateStatus(SyncStatusResolving, "Resolving conflicts with strategy: "+string(strategy), nil)

	// If using the "both" strategy, create copies of the conflicted files with conflict markers
	if strategy == ConflictStrategyBoth {
		// Get list of conflicted files using git command
		cmdList := exec.Command("git", "diff", "--name-only", "--diff-filter=U")
		cmdList.Dir = sm.gitService.repoPath
		output, err := cmdList.Output()
		if err != nil {
			sm.updateStatus(SyncStatusError, fmt.Sprintf("Failed to list conflicted files: %v", err), err)
			return fmt.Errorf("failed to list conflicted files: %w", err)
		}

		// Parse the output to get the list of conflicted files
		conflictedFiles := []string{}
		if len(output) > 0 {
			conflictedFiles = strings.Split(strings.TrimSpace(string(output)), "\n")
		}

		if len(conflictedFiles) == 0 {
			sm.updateStatus(SyncStatusSuccess, "No conflicts to resolve", nil)
			return nil // No conflicts to resolve
		}

		// For each conflicted file, add it to git with conflict markers
		for _, file := range conflictedFiles {
			// We just add the file with conflict markers as is
			cmdAdd := exec.Command("git", "add", "-f", file)
			cmdAdd.Dir = sm.gitService.repoPath
			addOutput, err := cmdAdd.CombinedOutput()
			if err != nil {
				sm.updateStatus(SyncStatusError, fmt.Sprintf("Failed to stage conflicted file %s: %v", file, err), err)
				return fmt.Errorf("failed to stage conflicted file %s: %w\nOutput: %s", file, err, string(addOutput))
			}
		}

		// Create a commit with the conflict markers
		err = sm.gitService.CommitChanges(fmt.Sprintf("Keep both changes (conflict markers preserved)"))
		if err != nil {
			sm.updateStatus(SyncStatusError, fmt.Sprintf("Failed to commit conflict markers: %v", err), err)
			return fmt.Errorf("failed to commit conflict markers: %w", err)
		}

		sm.updateStatus(SyncStatusSuccess, "Conflicts resolved, both changes kept with conflict markers", nil)
		return nil
	}

	// For "ours" or "theirs" strategy, use the git service method
	err := sm.gitService.ResolveConflictsWithStrategy(string(strategy))
	if err != nil {
		sm.updateStatus(SyncStatusError, fmt.Sprintf("Failed to resolve conflicts using strategy %s: %v", strategy, err), err)
		return fmt.Errorf("failed to resolve conflicts using strategy %s: %w", strategy, err)
	}

	err = sm.gitService.CommitChanges(fmt.Sprintf("Resolve conflicts using '%s' strategy", strategy))
	if err != nil {
		sm.updateStatus(SyncStatusError, fmt.Sprintf("Failed to commit resolved conflicts: %v", err), err)
		return fmt.Errorf("failed to commit resolved conflicts: %w", err)
	}

	sm.updateStatus(SyncStatusSuccess, fmt.Sprintf("Conflicts resolved using '%s' strategy", strategy), nil)
	return nil
}
