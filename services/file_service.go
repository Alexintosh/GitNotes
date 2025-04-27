package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// FileNode represents a file or directory in the file system
type FileNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	IsDir    bool       `json:"isDir"`
	Children []FileNode `json:"children,omitempty"`
}

// FileService handles file system operations
type FileService struct {
	repoService *RepositoryService
}

// NewFileService creates a new FileService instance
func NewFileService(repoService *RepositoryService) *FileService {
	return &FileService{
		repoService: repoService,
	}
}

// GetRepositoryStructure returns the directory structure of the repository
func (fs *FileService) GetRepositoryStructure() (FileNode, error) {
	if !fs.repoService.IsConnected() {
		return FileNode{}, errors.New("not connected to a repository")
	}

	repoPath := fs.repoService.GetRepositoryPath()
	rootNode := FileNode{
		Name:  filepath.Base(repoPath),
		Path:  repoPath,
		IsDir: true,
	}

	// Recursively build the file tree
	err := fs.buildFileTree(&rootNode, repoPath, 0, 3) // Max depth of 3 initially to avoid too much data
	if err != nil {
		return FileNode{}, fmt.Errorf("error building file tree: %w", err)
	}

	return rootNode, nil
}

// buildFileTree recursively builds the file tree structure
func (fs *FileService) buildFileTree(node *FileNode, path string, currentDepth, maxDepth int) error {
	// If we've reached the max depth, don't go deeper
	if currentDepth >= maxDepth {
		return nil
	}

	// Read the directory entries
	entries, err := os.ReadDir(path)
	if err != nil {
		return err
	}

	// Skip if no entries
	if len(entries) == 0 {
		return nil
	}

	// Initialize children slice if needed
	if node.Children == nil {
		node.Children = make([]FileNode, 0, len(entries))
	}

	// Process each entry
	for _, entry := range entries {
		// Skip .git directory and hidden files
		if entry.Name() == ".git" || strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		childPath := filepath.Join(path, entry.Name())
		childNode := FileNode{
			Name:  entry.Name(),
			Path:  childPath,
			IsDir: entry.IsDir(),
		}

		// If it's a directory, recursively build its tree
		if entry.IsDir() {
			err := fs.buildFileTree(&childNode, childPath, currentDepth+1, maxDepth)
			if err != nil {
				// Log error but continue with other directories
				fmt.Printf("Error processing directory %s: %v\n", childPath, err)
			}
		}

		node.Children = append(node.Children, childNode)
	}

	return nil
}

// GetFileContent reads and returns the content of a file
func (fs *FileService) GetFileContent(filePath string) (string, error) {
	// Validate path
	if !fs.isPathSafe(filePath) {
		return "", errors.New("invalid file path")
	}

	// Check if file exists and is not a directory
	info, err := os.Stat(filePath)
	if err != nil {
		return "", fmt.Errorf("error accessing file: %w", err)
	}
	if info.IsDir() {
		return "", errors.New("cannot read content of a directory")
	}

	// Read the file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("error reading file: %w", err)
	}

	return string(content), nil
}

// WriteFileContent writes content to a file
func (fs *FileService) WriteFileContent(filePath string, content string) error {
	// Validate path
	if !fs.isPathSafe(filePath) {
		return errors.New("invalid file path")
	}

	// Ensure the directory exists
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("error creating directory: %w", err)
	}

	// Write the file
	err := os.WriteFile(filePath, []byte(content), 0644)
	if err != nil {
		return fmt.Errorf("error writing file: %w", err)
	}

	return nil
}

// isPathSafe checks if a file path is safe to access
// This helps prevent directory traversal attacks
func (fs *FileService) isPathSafe(filePath string) bool {
	if !fs.repoService.IsConnected() {
		return false
	}

	// Get the absolute path of the repository and the file
	repoPath := fs.repoService.GetRepositoryPath()
	absRepoPath, err := filepath.Abs(repoPath)
	if err != nil {
		return false
	}

	absFilePath, err := filepath.Abs(filePath)
	if err != nil {
		return false
	}

	// Check if the file path is within the repository directory
	return strings.HasPrefix(absFilePath, absRepoPath)
}

// GetChildrenOfPath gets the direct children of a directory
func (fs *FileService) GetChildrenOfPath(dirPath string) ([]FileNode, error) {
	// Validate path
	if !fs.isPathSafe(dirPath) {
		return nil, errors.New("invalid directory path")
	}

	// Check if path exists and is a directory
	info, err := os.Stat(dirPath)
	if err != nil {
		return nil, fmt.Errorf("error accessing directory: %w", err)
	}
	if !info.IsDir() {
		return nil, errors.New("path is not a directory")
	}

	// Read the directory entries
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, fmt.Errorf("error reading directory: %w", err)
	}

	// Convert entries to FileNodes
	children := make([]FileNode, 0, len(entries))
	for _, entry := range entries {
		// Skip .git directory and hidden files
		if entry.Name() == ".git" || strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		childPath := filepath.Join(dirPath, entry.Name())
		childNode := FileNode{
			Name:  entry.Name(),
			Path:  childPath,
			IsDir: entry.IsDir(),
		}
		children = append(children, childNode)
	}

	return children, nil
}

// IsMarkdownFile checks if a file is a Markdown file
func (fs *FileService) IsMarkdownFile(filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	return ext == ".md" || ext == ".markdown"
}

// CreateFile creates a new file with the given content
func (fs *FileService) CreateFile(filePath string, content string) error {
	// Check if file already exists
	_, err := os.Stat(filePath)
	if err == nil {
		return errors.New("file already exists")
	}
	if !os.IsNotExist(err) {
		return fmt.Errorf("error checking file: %w", err)
	}

	// Create the file
	return fs.WriteFileContent(filePath, content)
}

// DeleteFile deletes a file
func (fs *FileService) DeleteFile(filePath string) error {
	// Validate path
	if !fs.isPathSafe(filePath) {
		return errors.New("invalid file path")
	}

	// Check if file exists
	_, err := os.Stat(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return errors.New("file does not exist")
		}
		return fmt.Errorf("error checking file: %w", err)
	}

	// Delete the file
	err = os.Remove(filePath)
	if err != nil {
		return fmt.Errorf("error deleting file: %w", err)
	}

	return nil
}

// CreateDirectory creates a new directory
func (fs *FileService) CreateDirectory(dirPath string) error {
	// Validate path
	if !fs.isPathSafe(dirPath) {
		return errors.New("invalid directory path")
	}

	// Check if directory already exists
	_, err := os.Stat(dirPath)
	if err == nil {
		return errors.New("directory already exists")
	}
	if !os.IsNotExist(err) {
		return fmt.Errorf("error checking directory: %w", err)
	}

	// Create the directory
	err = os.MkdirAll(dirPath, 0755)
	if err != nil {
		return fmt.Errorf("error creating directory: %w", err)
	}

	return nil
}
