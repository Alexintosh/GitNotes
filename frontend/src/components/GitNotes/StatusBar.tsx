import { Button, Tooltip, Switch, theme } from 'antd';
import { 
  SettingOutlined, 
  SyncOutlined, 
  ClockCircleOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { GitNotesService } from '../../../bindings/changeme/services';
import { useAppStore } from '../../stores/useAppStore';

interface StatusBarProps {
  onToggleSettings: () => void;
  onToggleVimMode: () => void;
  vimModeEnabled: boolean;
  isConnected: boolean;
  isAutoSyncActive: boolean;
  lastSyncStatus: 'success' | 'failed' | 'in-progress' | null;
  lastSyncTime: string | null;
  onReconnect?: () => Promise<void>;
}

const StatusBar: React.FC<StatusBarProps> = ({
  onToggleSettings,
  onToggleVimMode,
  vimModeEnabled,
  isConnected,
  isAutoSyncActive,
  lastSyncStatus,
  lastSyncTime,
  onReconnect,
}) => {
  const { settings, updateSettings } = useAppStore();
  const { token } = theme.useToken();

  const handleToggleDarkMode = (checked: boolean) => {
    updateSettings({ isDarkMode: checked });
  };

  const handleManualSync = async () => {
    if (!isConnected) return;
    
    try {
      await GitNotesService.TriggerManualSync();
    } catch (error) {
      console.error('Error triggering manual sync:', error);
    }
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';
    
    const syncDate = new Date(lastSyncTime);
    return syncDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Custom dot styles using theme tokens for better visibility
  const connectedDotStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '6px',
    backgroundColor: isConnected ? token.colorSuccess : token.colorError
  };

  return (
    <div className="status-bar" style={{ 
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      backgroundColor: token.colorBgElevated,
      color: token.colorText
    }}>
      <div className="status-indicator">
        <div style={connectedDotStyle} />
        <span>
          {isConnected ? 'Connected' : 'Disconnected'}
          {isConnected && isAutoSyncActive && ' (Auto-sync on)'}
        </span>
        
        {isConnected && lastSyncTime && (
          <Tooltip title={`Last sync ${lastSyncStatus || ''}`}>
            <span style={{ marginLeft: '12px', color: token.colorTextSecondary }}>
              <ClockCircleOutlined style={{ marginRight: '4px' }} />
              {formatLastSyncTime()}
            </span>
          </Tooltip>
        )}
      </div>
      
      <div className="status-actions">
        <Tooltip title="Vim Mode">
          <Switch 
            size="small" 
            checked={vimModeEnabled} 
            onChange={onToggleVimMode}
            checkedChildren={<CodeOutlined />}
            unCheckedChildren={<CodeOutlined />}
          />
        </Tooltip>
        
        <Tooltip title="Dark Mode">
          <Switch 
            size="small" 
            checked={settings.isDarkMode} 
            onChange={handleToggleDarkMode}
          />
        </Tooltip>
        
        {isConnected && (
          <Tooltip title="Manual Sync">
            <Button 
              type="text" 
              icon={<SyncOutlined />} 
              size="small" 
              onClick={handleManualSync}
              style={{ color: token.colorPrimary }}
            />
          </Tooltip>
        )}
        
        {!isConnected && onReconnect && (
          <Tooltip title="Reconnect">
            <Button 
              type="text" 
              icon={<SyncOutlined />} 
              size="small" 
              onClick={onReconnect}
              style={{ color: token.colorWarning }}
            />
          </Tooltip>
        )}
        
        <Tooltip title="Settings">
          <Button 
            type="text" 
            icon={<SettingOutlined />} 
            size="small" 
            onClick={onToggleSettings}
            style={{ color: token.colorPrimary }}
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default StatusBar; 