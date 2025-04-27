import { Button, Tooltip, Switch, theme } from 'antd';
import { 
  SettingOutlined, 
  CodeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useAppStore } from '../../stores/useAppStore';
import SyncControls from './SyncControls';

interface StatusBarProps {
  onToggleSettings: () => void;
  onToggleVimMode: () => void;
  onToggleSidebar: () => void;
  vimModeEnabled: boolean;
  isSidebarCollapsed: boolean;
  isConnected: boolean;
  isAutoSyncActive: boolean;
  lastSyncStatus: 'success' | 'failed' | 'in-progress' | 'conflict' | null;
  lastSyncTime: string | null;
  onReconnect?: () => Promise<void>;
}

const StatusBar: React.FC<StatusBarProps> = ({
  onToggleSettings,
  onToggleVimMode,
  onToggleSidebar,
  vimModeEnabled,
  isSidebarCollapsed,
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

  return (
    <div className="status-bar" style={{ 
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      backgroundColor: token.colorBgElevated,
      color: token.colorText,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 12px',
      height: '40px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}>
          <Button 
            type="text" 
            icon={isSidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} 
            size="small" 
            onClick={onToggleSidebar}
            style={{ marginRight: '8px', padding: '0 4px' }}
          />
        </Tooltip>
      </div>
      
      <SyncControls 
        isConnected={isConnected} 
        className="sync-controls"
      />
      
      <div className="status-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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