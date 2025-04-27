import React, { useState, useEffect } from 'react';
import { Tooltip, Switch, message } from 'antd';
import { GitNotesService } from '../../../bindings/changeme/services';
import SyncButton from './SyncButton';
import SyncStatusDisplay from './SyncStatusDisplay';
import { useAppStore } from '../../stores/useAppStore';
import './SyncControls.css';

interface SyncControlsProps {
  isConnected: boolean;
  className?: string;
}

const SyncControls: React.FC<SyncControlsProps> = ({ 
  isConnected, 
  className 
}) => {
  const { syncStatus, updateSyncStatus, updateConflictInfo } = useAppStore();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isAutoSyncActive, setIsAutoSyncActive] = useState<boolean>(syncStatus.isAutoSyncActive || false);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Initialize with current auto-sync status
  useEffect(() => {
    if (!isConnected) return;
    
    const checkAutoSyncStatus = async () => {
      try {
        const autoSyncActive = await GitNotesService.IsAutoSyncActive();
        setIsAutoSyncActive(autoSyncActive);
        updateSyncStatus({ isAutoSyncActive: autoSyncActive });
      } catch (error) {
        console.error('Error checking auto-sync status:', error);
      }
    };
    
    checkAutoSyncStatus();
  }, [isConnected, updateSyncStatus]);
  
  // Poll for sync status and update state
  useEffect(() => {
    if (!isConnected) return;
    
    const pollSyncStatus = async () => {
      if (isPolling) return;
      
      setIsPolling(true);
      
      try {
        // Get detailed sync status
        const statusJson = await GitNotesService.GetSyncStatus();
        const status = JSON.parse(statusJson);
        
        // Check for active sync or conflicts
        const activeSyncStates = [
          'Checking for changes',
          'Staging changes',
          'Committing changes',
          'Pulling from remote',
          'Pushing to remote',
          'Syncing',
          'Resolving conflicts'
        ];
        
        setIsSyncing(activeSyncStates.includes(status.status));
        
        // Check for conflicts
        if (status.status === 'Conflict detected') {
          try {
            const detailsJson = await GitNotesService.GetConflictDetails();
            const details = JSON.parse(detailsJson);
            if (details.hasConflicts) {
              updateConflictInfo({
                hasConflicts: true,
                conflictFiles: details.conflictFiles || [],
                conflictCount: details.conflictCount || 0
              });
            }
          } catch (conflictError) {
            console.error('Error getting conflict details:', conflictError);
          }
        }
        
        // Update store with status info
        updateSyncStatus({
          lastSyncStatus: status.status === 'Sync completed successfully' 
            ? 'success' 
            : status.status === 'Sync error' ? 'failed' 
            : status.status === 'Conflict detected' ? 'conflict' 
            : activeSyncStates.includes(status.status) ? 'in-progress' 
            : null,
          lastSyncTime: status.lastSyncTime || syncStatus.lastSyncTime,
          currentStatus: status.status,
          statusDetail: status.message || ''
        });
      } catch (error) {
        console.error('Error polling sync status:', error);
      } finally {
        setIsPolling(false);
      }
    };
    
    // Initial poll
    pollSyncStatus();
    
    // Set up interval for polling
    const intervalId = setInterval(pollSyncStatus, 3000);
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, [isConnected, updateSyncStatus, syncStatus.lastSyncTime, isPolling, updateConflictInfo]);
  
  const handleAutoSyncToggle = async (checked: boolean) => {
    if (!isConnected) return;
    
    try {
      if (checked) {
        // Start auto-sync with 5-minute interval (300 seconds)
        await GitNotesService.StartAutomaticSync(300);
        message.success('Automatic synchronization enabled');
      } else {
        // Stop auto-sync
        await GitNotesService.StopAutomaticSync();
        message.info('Automatic synchronization disabled');
      }
      
      // Update state and store
      setIsAutoSyncActive(checked);
      updateSyncStatus({ isAutoSyncActive: checked });
    } catch (error) {
      message.error(`Failed to ${checked ? 'enable' : 'disable'} automatic sync: ${error}`);
    }
  };
  
  const handleSyncStart = () => {
    setIsSyncing(true);
    updateSyncStatus({ 
      lastSyncStatus: 'in-progress', 
      currentStatus: 'Syncing',
      statusDetail: 'Manual sync in progress'
    });
  };
  
  const handleSyncComplete = (success: boolean) => {
    setIsSyncing(false);
    updateSyncStatus({ 
      lastSyncStatus: success ? 'success' : 'failed',
      lastSyncTime: new Date().toISOString(),
      currentStatus: success ? 'Sync completed successfully' : 'Sync error',
      statusDetail: success ? 'Manual sync completed successfully' : 'Manual sync failed'
    });
  };
  
  const hasConflicts = syncStatus.conflicts?.hasConflicts || false;
  
  if (!isConnected) {
    return (
      <div className={`sync-controls ${className || ''}`}>
        <SyncStatusDisplay 
          isConnected={isConnected}
          lastSyncTime={syncStatus.lastSyncTime}
          className="sync-status-display"
        />
        <SyncButton 
          isConnected={isConnected}
          isSyncing={isSyncing}
          hasConflicts={hasConflicts}
          className="sync-button"
        />
      </div>
    );
  }
  
  return (
    <div className={`sync-controls ${className || ''}`}>
      <SyncStatusDisplay 
        isConnected={isConnected}
        lastSyncTime={syncStatus.lastSyncTime}
        className="sync-status-display"
      />
      
      <SyncButton 
        isConnected={isConnected}
        isSyncing={isSyncing}
        hasConflicts={hasConflicts}
        onSyncStart={handleSyncStart}
        onSyncComplete={handleSyncComplete}
        className="sync-button"
      />
      
      <Tooltip title={`${isAutoSyncActive ? 'Disable' : 'Enable'} automatic sync (every 5 minutes)`}>
        <Switch
          size="small"
          checked={isAutoSyncActive}
          onChange={handleAutoSyncToggle}
          checkedChildren="Auto"
          unCheckedChildren="Auto"
          className="auto-sync-switch"
        />
      </Tooltip>
    </div>
  );
};

export default SyncControls; 