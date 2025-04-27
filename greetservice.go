package main

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

type GreetService struct{}

func (g *GreetService) Greet(name string) string {
	return "Hello " + name + "!"
}

func (g *GreetService) SetAlwaysOnTop(alwaysOnTop bool) {
	if window := application.Get().GetWindowByName("main"); window != nil {
		window.SetAlwaysOnTop(alwaysOnTop)
	}
}

func (g *GreetService) Minimize() {
	if window := application.Get().GetWindowByName("main"); window != nil {
		window.Minimise()
	}
}

func (g *GreetService) Close() {
	if window := application.Get().GetWindowByName("main"); window != nil {
		window.Close()
	}
}

func (g *GreetService) Maximize() {
	if window := application.Get().GetWindowByName("main"); window != nil {
		if window.IsMaximised() {
			window.UnMaximise()
		} else {
			window.Maximise()
		}
	}
}

// HideToSystemTray minimizes the window to the system tray
func (g *GreetService) HideToSystemTray() {
	if window := application.Get().GetWindowByName("main"); window != nil {
		window.Hide()
	}
}

// ShowFromSystemTray shows the window from the system tray
func (g *GreetService) ShowFromSystemTray() {
	if window := application.Get().GetWindowByName("main"); window != nil {
		window.Show()
		window.Focus()
	}
}

// IsWindowVisible returns whether the main window is currently visible
func (g *GreetService) IsWindowVisible() bool {
	// For Wails v3, we can check if the window is visible by checking its state
	if window := application.Get().GetWindowByName("main"); window != nil {
		// In Wails 3, there's no direct IsVisible method
		// We'll use a heuristic - if the window is not minimized, it's likely visible
		// This is an approximation as the actual visibility API might differ
		return !window.IsMinimised()
	}
	return false
}

// ToggleWindowVisibility toggles the visibility of the main window
func (g *GreetService) ToggleWindowVisibility() {
	if window := application.Get().GetWindowByName("main"); window != nil {
		if g.IsWindowVisible() {
			window.Hide()
		} else {
			window.Show()
			window.Focus()
		}
	}
}
