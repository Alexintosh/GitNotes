import React, { useState, useEffect } from 'react';
import { Tooltip, Badge, Tag } from 'antd';
import { 
  SyncOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { GitNotesService } from '../../../bindings/changeme/services';

interface SyncStatusDisplayProps {
  isConnected: boolean;
  lastSyncTime: string | null;
  className?: string;
}

const SyncStatusDisplay: React.FC<SyncStatusDisplayProps> = ({
  isConnected,
  lastSyncTime,
  className,
}) => {
  const [syncStatus, setSyncStatus] = useState<string>('Idle');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [hasConflicts, setHasConflicts] = useState<boolean>(false);
  
  // Poll for status updates when connected
  useEffect(() => {
    if (!isConnected) return;
    
    const fetchStatus = async () => {
      try {
        const statusJson = await GitNotesService.GetSyncStatus();
        const status = JSON.parse(statusJson);
        setSyncStatus(status.status || 'Idle');
        setStatusDetail(status.message || '');
        
        // Check if we're in a conflict state
        setHasConflicts(status.status === 'Conflict detected');
        
        // Update loading state based on status
        setIsLoading(['Checking for changes', 'Staging changes', 'Committing changes', 
                      'Pulling from remote', 'Pushing to remote', 'Syncing'].includes(status.status));
      } catch (error) {
        console.error('Error fetching sync status:', error);
      }
    };
    
    // Initial fetch
    fetchStatus();
    
    // Set up polling interval
    const intervalId = setInterval(fetchStatus, 2000);
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, [isConnected]);
  
  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';
    
    const syncDate = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    return syncDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const getStatusIcon = () => {
    if (isLoading) {
      return <SyncOutlined className="sync-icon-spinning" />;
    }
    
    if (hasConflicts) {
      return <ExclamationCircleOutlined className="conflict-indicator" />;
    }
    
    switch (syncStatus) {
      case 'Sync completed successfully':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'Sync error':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return <ClockCircleOutlined />;
    }
  };
  
  const getStatusTag = () => {
    if (hasConflicts) {
      return <Tag color="warning" className="sync-status-tag">Conflicts</Tag>;
    }
    
    if (isLoading) {
      return <Tag color="processing" className="sync-status-tag">{syncStatus}</Tag>;
    }
    
    switch (syncStatus) {
      case 'Sync completed successfully':
        return <Tag color="success" className="sync-status-tag">Success</Tag>;
      case 'Sync error':
        return <Tag color="error" className="sync-status-tag">Error</Tag>;
      case 'Idle':
        return <Tag className="sync-status-tag">Idle</Tag>;
      default:
        return <Tag className="sync-status-tag">{syncStatus}</Tag>;
    }
  };
  
  if (!isConnected) {
    return (
      <div className={className || ''}>
        <Tag color="error">Disconnected</Tag>
      </div>
    );
  }
  
  return (
    <div className={className || ''}>
      <Tooltip title={statusDetail || syncStatus}>
        <Badge 
          count={hasConflicts ? '!' : 0} 
          dot={hasConflicts}
          offset={[0, 5]}
          style={{ backgroundColor: hasConflicts ? '#faad14' : '#f5222d' }}
        >
          {getStatusIcon()} 
          <span style={{ marginLeft: '5px', marginRight: '8px' }}>
            {getStatusTag()}
          </span>
        </Badge>
      </Tooltip>
      
      {lastSyncTime && (
        <Tooltip title="Last synchronized">
          <span style={{ marginLeft: '8px', fontSize: '0.9em', opacity: 0.8 }}>
            {formatLastSyncTime()}
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default SyncStatusDisplay; 