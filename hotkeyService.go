package main

import (
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.design/x/hotkey"
)

// HotkeySettings represents the hotkey configuration
type HotkeySettings struct {
	Modifiers []string `json:"modifiers"`
	Key       string   `json:"key"`
}

// DefaultHotkeySettings returns the default hotkey settings
func DefaultHotkeySettings() HotkeySettings {
	return HotkeySettings{
		Modifiers: []string{"ctrl", "shift"},
		Key:       "s",
	}
}

// HotkeyService manages hotkey registration and configuration
type HotkeyService struct {
	settings     HotkeySettings
	hk           *hotkey.Hotkey
	mu           sync.Mutex
	configFile   string
	mainWindow   *application.WebviewWindow
	isRegistered bool
}

// stringToModifier converts string modifier names to hotkey.Modifier
func stringToModifier(mod string) hotkey.Modifier {
	switch mod {
	case "ctrl":
		return hotkey.ModCtrl
	case "shift":
		return hotkey.ModShift
	case "alt":
		return 2 // ModAlt value is 2
	case "cmd", "meta":
		return 8 // ModMeta value is 8
	default:
		return hotkey.ModCtrl
	}
}

// stringToKey converts string key name to hotkey.Key
func stringToKey(key string) hotkey.Key {
	switch key {
	case "a":
		return hotkey.KeyA
	case "b":
		return hotkey.KeyB
	case "c":
		return hotkey.KeyC
	case "d":
		return hotkey.KeyD
	case "e":
		return hotkey.KeyE
	case "f":
		return hotkey.KeyF
	case "g":
		return hotkey.KeyG
	case "h":
		return hotkey.KeyH
	case "i":
		return hotkey.KeyI
	case "j":
		return hotkey.KeyJ
	case "k":
		return hotkey.KeyK
	case "l":
		return hotkey.KeyL
	case "m":
		return hotkey.KeyM
	case "n":
		return hotkey.KeyN
	case "o":
		return hotkey.KeyO
	case "p":
		return hotkey.KeyP
	case "q":
		return hotkey.KeyQ
	case "r":
		return hotkey.KeyR
	case "s":
		return hotkey.KeyS
	case "t":
		return hotkey.KeyT
	case "u":
		return hotkey.KeyU
	case "v":
		return hotkey.KeyV
	case "w":
		return hotkey.KeyW
	case "x":
		return hotkey.KeyX
	case "y":
		return hotkey.KeyY
	case "z":
		return hotkey.KeyZ
	case "0":
		return hotkey.Key0
	case "1":
		return hotkey.Key1
	case "2":
		return hotkey.Key2
	case "3":
		return hotkey.Key3
	case "4":
		return hotkey.Key4
	case "5":
		return hotkey.Key5
	case "6":
		return hotkey.Key6
	case "7":
		return hotkey.Key7
	case "8":
		return hotkey.Key8
	case "9":
		return hotkey.Key9
	default:
		return hotkey.KeyS // Default to S
	}
}

// GetAvailableModifiers returns a list of available modifier keys
func (h *HotkeyService) GetAvailableModifiers() []string {
	return []string{"ctrl", "shift", "alt", "meta"}
}

// GetAvailableKeys returns a list of available keys
func (h *HotkeyService) GetAvailableKeys() []string {
	return []string{
		"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
		"n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
		"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	}
}
