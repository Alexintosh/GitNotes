import React, { useState, useEffect, useRef } from 'react';
import { Layout, ConfigProvider, theme, message, Spin } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useAppStore } from '../../stores/useAppStore';
import FileTree from './FileTree';
import MarkdownEditor from './MarkdownEditor';
import RepositorySettings from './RepositorySettings';
import StatusBar from './StatusBar';
import { GitNotesService } from '../../../bindings/changeme/services';

import 'react-resizable/css/styles.css';
import './MainLayout.css';

const { Content, Sider } = Layout;
const { darkAlgorithm, defaultAlgorithm } = theme;

const MainLayout = () => {
  const { settings, syncStatus, updateSyncStatus, fileState, setCurrentFile, updateSettings } = useAppStore();
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [vimModeEnabled, setVimModeEnabled] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const minSidebarWidth = 200;
  const maxSidebarWidth = 500;
  const collapsedWidth = 0;

  const resizeRef = useRef<HTMLDivElement>(null);
  const initialPosRef = useRef<number>(0);
  const initialWidthRef = useRef<number>(sidebarWidth);

  // On mount, verify connection status from backend
  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        setIsInitializing(true);
        // Get actual settings from backend
        const settingsJson = await GitNotesService.GetSettings();
        const serverSettings = JSON.parse(settingsJson);
        
        // Update local settings from server data
        updateSettings({
          repoURL: serverSettings.repoURL || '',
          localPath: serverSettings.localRepoPath || '',
        });
        
        if (serverSettings.isConnected) {
          // Backend says we're connected, but verify we can access files
          try {
            // Try to get repository structure to verify true connection
            await GitNotesService.GetRepositoryStructure();
            // Successfully retrieved structure, we're truly connected
            updateSyncStatus({ isConnected: true });
            setIsSettingsVisible(false);
          } catch (error) {
            console.error("Repository inaccessible:", error);
            // Backend thinks we're connected but can't access files
            updateSyncStatus({ isConnected: false });
            setIsSettingsVisible(true);
            message.error("Repository is configured but not accessible. Please check connection settings.");
          }
        } else {
          // Backend says we're not connected, force settings to open
          updateSyncStatus({ isConnected: false });
          setIsSettingsVisible(true);
        }
      } catch (error) {
        console.error("Error checking connection status:", error);
        // If we can't verify, assume we're not connected
        updateSyncStatus({ isConnected: false });
        setIsSettingsVisible(true);
      } finally {
        setIsInitializing(false);
      }
    };
    
    checkConnectionStatus();
  }, []);

  // Function to reconnect to the repository
  const handleReconnect = async () => {
    if (settings.repoURL && settings.localPath) {
      try {
        setReconnecting(true);
        await GitNotesService.ConnectRepository(settings.repoURL, settings.localPath, '');
        // Verify connection was successful by checking repository structure
        try {
          await GitNotesService.GetRepositoryStructure();
          updateSyncStatus({ isConnected: true });
          setIsSettingsVisible(false);
        } catch (error) {
          message.error(`Repository connected but can't fetch files: ${error}`);
          updateSyncStatus({ isConnected: false });
          setIsSettingsVisible(true);
        }
      } catch (error) {
        message.error(`Failed to connect: ${error}`);
        updateSyncStatus({ isConnected: false });
        setIsSettingsVisible(true);
      } finally {
        setReconnecting(false);
      }
    } else {
      message.error("Repository URL and local path are required");
      setIsSettingsVisible(true);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setCurrentFile(filePath);
  };

  const handleToggleSettings = () => {
    setIsSettingsVisible(!isSettingsVisible);
  };

  const handleToggleVimMode = () => {
    setVimModeEnabled(!vimModeEnabled);
  };

  // Sidebar resize handlers
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    initialPosRef.current = e.clientX;
    initialWidthRef.current = sidebarWidth;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (isResizing) {
      const delta = e.clientX - initialPosRef.current;
      const newWidth = Math.max(
        minSidebarWidth, 
        Math.min(maxSidebarWidth, initialWidthRef.current + delta)
      );
      setSidebarWidth(newWidth);
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Add a loading indicator when initializing or reconnecting to the repository
  if (isInitializing || reconnecting) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin tip={reconnecting ? "Reconnecting to repository..." : "Checking connection status..."} />
      </div>
    );
  }

  const handleConnected = () => {
    setIsSettingsVisible(false);
    updateSyncStatus({ isConnected: true });
  };

  return (
    <ConfigProvider theme={{ algorithm: settings.isDarkMode ? darkAlgorithm : defaultAlgorithm }}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {isSettingsVisible ? (
          <RepositorySettings 
            onConnected={handleConnected}
            isConnected={syncStatus.isConnected}
          />
        ) : (
          <>
            <Layout style={{ height: '100%' }}>
              <div style={{ position: 'relative' }}>
                <Sider 
                  width={isSidebarCollapsed ? collapsedWidth : sidebarWidth} 
                  className="resizable-sidebar"
                  theme={settings.isDarkMode ? 'dark' : 'light'}
                  collapsed={isSidebarCollapsed}
                  collapsedWidth={collapsedWidth}
                  trigger={null}
                >
                  {!isSidebarCollapsed && (
                    <>
                      <div style={{ height: '100%', overflow: 'auto' }}>
                        <FileTree 
                          onFileSelect={handleFileSelect} 
                          isConnected={syncStatus.isConnected}
                        />
                      </div>
                      <div 
                        className={`resize-handle ${isResizing ? 'active' : ''}`}
                        onMouseDown={handleResizeStart}
                        ref={resizeRef}
                      />
                    </>
                  )}
                </Sider>
                <div 
                  className={`sidebar-toggle-button ${isSidebarCollapsed ? 'collapsed' : ''}`}
                  onClick={toggleSidebar}
                >
                  {isSidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                </div>
              </div>
              <Content style={{ height: '100%', overflow: 'auto' }}>
                <MarkdownEditor
                  filePath={fileState.currentFilePath}
                  isConnected={syncStatus.isConnected}
                  vimModeEnabled={vimModeEnabled}
                />
              </Content>
            </Layout>
            <StatusBar
              isConnected={syncStatus.isConnected}
              isAutoSyncActive={syncStatus.isAutoSyncActive || false}
              lastSyncStatus={syncStatus.lastSyncStatus}
              lastSyncTime={syncStatus.lastSyncTime}
              onToggleSettings={handleToggleSettings}
              vimModeEnabled={vimModeEnabled}
              onToggleVimMode={handleToggleVimMode}
              onReconnect={handleReconnect}
            />
          </>
        )}
      </div>
    </ConfigProvider>
  );
};

export default MainLayout; 