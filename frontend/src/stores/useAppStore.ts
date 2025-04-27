import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppSettings {
  repoURL: string;
  localPath: string;
  autoSyncInterval: number; // in seconds
  isDarkMode: boolean;
  conflictStrategy: 'manual' | 'ours' | 'theirs' | 'both';
}

interface FileState {
  currentFilePath: string | null;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
}

interface ConflictInfo {
  hasConflicts: boolean;
  conflictFiles: string[];
  conflictCount: number;
}

interface SyncStatus {
  isConnected: boolean;
  isAutoSyncActive: boolean;
  lastSyncTime: string | null;
  lastSyncStatus: 'success' | 'failed' | 'in-progress' | 'conflict' | null;
  currentStatus: string;
  statusDetail: string;
  conflicts: ConflictInfo | null;
}

interface AppState {
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  
  // File editing state
  fileState: FileState;
  setCurrentFile: (filePath: string | null) => void;
  setIsEditing: (isEditing: boolean) => void;
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void;
  
  // Sync status
  syncStatus: SyncStatus;
  updateSyncStatus: (status: Partial<SyncStatus>) => void;
  updateConflictInfo: (conflicts: ConflictInfo | null) => void;
  setConflictStrategy: (strategy: 'manual' | 'ours' | 'theirs' | 'both') => void;
  clearConflicts: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Default settings
      settings: {
        repoURL: '',
        localPath: '',
        autoSyncInterval: 300, // 5 minutes default
        isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        conflictStrategy: 'manual',
      },
      updateSettings: (newSettings) => 
        set((state) => ({ 
          settings: { ...state.settings, ...newSettings } 
        })),
      
      // Default file state
      fileState: {
        currentFilePath: null,
        isEditing: false,
        hasUnsavedChanges: false,
      },
      setCurrentFile: (filePath) => 
        set((state) => ({ 
          fileState: { 
            ...state.fileState, 
            currentFilePath: filePath,
            hasUnsavedChanges: false,
          } 
        })),
      setIsEditing: (isEditing) => 
        set((state) => ({ 
          fileState: { ...state.fileState, isEditing } 
        })),
      setHasUnsavedChanges: (hasUnsavedChanges) => 
        set((state) => ({ 
          fileState: { ...state.fileState, hasUnsavedChanges } 
        })),
      
      // Default sync status
      syncStatus: {
        isConnected: false,
        isAutoSyncActive: false,
        lastSyncTime: null,
        lastSyncStatus: null,
        currentStatus: 'Idle',
        statusDetail: '',
        conflicts: null,
      },
      updateSyncStatus: (status) => 
        set((state) => ({ 
          syncStatus: { ...state.syncStatus, ...status } 
        })),
      updateConflictInfo: (conflicts) =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            conflicts,
            lastSyncStatus: conflicts && conflicts.hasConflicts ? 'conflict' : state.syncStatus.lastSyncStatus,
            currentStatus: conflicts && conflicts.hasConflicts ? 'Conflict detected' : state.syncStatus.currentStatus,
          }
        })),
      setConflictStrategy: (strategy) =>
        set((state) => ({
          settings: {
            ...state.settings,
            conflictStrategy: strategy,
          }
        })),
      clearConflicts: () =>
        set((state) => ({
          syncStatus: {
            ...state.syncStatus,
            conflicts: null,
            lastSyncStatus: 'success',
            currentStatus: 'Idle',
            statusDetail: 'Conflicts resolved',
          }
        })),
    }),
    {
      name: 'git-notes-storage',
      partialize: (state) => ({
        settings: state.settings,
        syncStatus: {
          isConnected: state.syncStatus.isConnected,
          isAutoSyncActive: state.syncStatus.isAutoSyncActive,
        },
      }),
    }
  )
); 