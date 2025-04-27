package services

import (
	"errors"
	"fmt"
	"runtime"

	"github.com/keybase/go-keychain"
)

// CredentialService handles secure storage and retrieval of credentials
type CredentialService struct {
	// Service name used for keychain entries
	serviceName string
}

// NewCredentialService creates a new CredentialService instance
func NewCredentialService() *CredentialService {
	return &CredentialService{
		serviceName: "GitNotesApp",
	}
}

// StoreCredential securely stores a credential for the given repository URL
func (cs *CredentialService) StoreCredential(repoURL, token string) error {
	if runtime.GOOS != "darwin" && runtime.GOOS != "ios" {
		// For non-macOS systems, we'd need different implementations
		// For now, we'll focus on macOS since the user's platform is darwin
		return errors.New("secure credential storage is currently only implemented for macOS")
	}

	// Create a keychain item
	item := keychain.NewItem()
	item.SetSecClass(keychain.SecClassGenericPassword)
	item.SetService(cs.serviceName)
	item.SetAccount(repoURL)
	item.SetLabel(fmt.Sprintf("GitNotes: %s", repoURL))
	item.SetData([]byte(token))
	item.SetSynchronizable(keychain.SynchronizableNo)
	item.SetAccessible(keychain.AccessibleWhenUnlocked)

	// Delete any existing item before adding
	_ = keychain.DeleteItem(item)

	// Add the new item
	err := keychain.AddItem(item)
	if err != nil {
		return fmt.Errorf("failed to store credential in keychain: %w", err)
	}

	return nil
}

// GetCredential retrieves a credential for the given repository URL
func (cs *CredentialService) GetCredential(repoURL string) (string, error) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "ios" {
		// For non-macOS systems, we'd need different implementations
		return "", errors.New("secure credential retrieval is currently only implemented for macOS")
	}

	// Create a query item
	query := keychain.NewItem()
	query.SetSecClass(keychain.SecClassGenericPassword)
	query.SetService(cs.serviceName)
	query.SetAccount(repoURL)
	query.SetMatchLimit(keychain.MatchLimitOne)
	query.SetReturnData(true)

	// Query the keychain
	results, err := keychain.QueryItem(query)
	if err != nil {
		return "", fmt.Errorf("failed to query keychain: %w", err)
	}

	if len(results) == 0 {
		return "", fmt.Errorf("no credentials found for %s", repoURL)
	}

	// Return the first result's data as a string
	return string(results[0].Data), nil
}

// DeleteCredential removes a credential for the given repository URL
func (cs *CredentialService) DeleteCredential(repoURL string) error {
	if runtime.GOOS != "darwin" && runtime.GOOS != "ios" {
		// For non-macOS systems, we'd need different implementations
		return errors.New("secure credential deletion is currently only implemented for macOS")
	}

	// Create a delete item
	item := keychain.NewItem()
	item.SetSecClass(keychain.SecClassGenericPassword)
	item.SetService(cs.serviceName)
	item.SetAccount(repoURL)

	// Delete the item
	err := keychain.DeleteItem(item)
	if err != nil {
		return fmt.Errorf("failed to delete credential from keychain: %w", err)
	}

	return nil
}
