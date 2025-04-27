import React, { useState } from 'react';
import { Button, Modal, Spin, List, Radio, Space, Typography, message } from 'antd';
import { SyncOutlined, ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { GitNotesService } from '../../../bindings/changeme/services';
import { useAppStore } from '../../stores/useAppStore';
import './SyncButton.css';

const { Text, Title } = Typography;

type ConflictStrategy = 'manual' | 'ours' | 'theirs';

interface SyncButtonProps {
  isConnected: boolean;
  isSyncing: boolean;
  hasConflicts: boolean;
  onSyncStart?: () => void;
  onSyncComplete?: (success: boolean) => void;
  className?: string;
}

const SyncButton: React.FC<SyncButtonProps> = ({
  isConnected,
  isSyncing,
  hasConflicts,
  onSyncStart,
  onSyncComplete,
  className
}) => {
  const { syncStatus, setConflictStrategy, clearConflicts } = useAppStore();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<ConflictStrategy>('manual');
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);

  const showConflictModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleAbortSync = async () => {
    try {
      await GitNotesService.AbortSyncWithConflicts();
      message.info('Sync aborted. Conflicts have been reset.');
      clearConflicts();
      setIsModalVisible(false);
      if (onSyncComplete) {
        onSyncComplete(false);
      }
    } catch (error) {
      console.error('Error aborting sync:', error);
      message.error('Failed to abort sync operation');
    }
  };

  const handleResolveWithStrategy = async () => {
    setIsResolvingConflict(true);
    try {
      // First set the strategy in the backend
      await GitNotesService.SetConflictResolutionStrategy(selectedStrategy);
      
      // Update the strategy in the app store
      setConflictStrategy(selectedStrategy);
      
      // Resolve conflicts with the set strategy
      await GitNotesService.ResolveConflictsWithStrategy(selectedStrategy);
      
      // Always consider successful if no error was thrown
      message.success(`Conflicts resolved using "${selectedStrategy}" strategy`);
      clearConflicts();
      setIsModalVisible(false);
      
      if (onSyncComplete) {
        onSyncComplete(true);
      }
    } catch (error) {
      console.error('Error resolving conflicts:', error);
      message.error(`Failed to resolve conflicts: ${error}`);
      if (onSyncComplete) {
        onSyncComplete(false);
      }
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleManualSync = async () => {
    if (!isConnected || isSyncing) return;
    
    if (onSyncStart) {
      onSyncStart();
    }
    
    try {
      await GitNotesService.TriggerManualSync();
      
      // Check if there are conflicts after sync
      const detailsJson = await GitNotesService.GetConflictDetails();
      const details = JSON.parse(detailsJson);
      
      if (details.hasConflicts) {
        showConflictModal();
      } else {
        message.success('Sync completed successfully');
        if (onSyncComplete) {
          onSyncComplete(true);
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
      message.error(`Sync failed: ${error}`);
      if (onSyncComplete) {
        onSyncComplete(false);
      }
    }
  };

  // Button state based on connection and sync status
  const getButtonProps = () => {
    if (!isConnected) {
      return {
        icon: <SyncOutlined />,
        disabled: true,
        loading: false,
        title: 'Connect to a repository to enable sync'
      };
    }

    if (isSyncing) {
      return {
        icon: <SyncOutlined spin />,
        disabled: true,
        loading: true,
        title: 'Synchronizing...'
      };
    }

    if (hasConflicts) {
      return {
        icon: <ExclamationCircleOutlined />,
        disabled: false,
        loading: false,
        title: 'Conflicts detected - click to resolve',
        onClick: showConflictModal,
        danger: true
      };
    }

    return {
      icon: <SyncOutlined />,
      disabled: false,
      loading: false,
      title: 'Synchronize with remote repository',
      onClick: handleManualSync
    };
  };

  const buttonProps = getButtonProps();

  return (
    <>
      <Button
        type="primary"
        shape="circle"
        icon={buttonProps.icon}
        disabled={buttonProps.disabled}
        loading={buttonProps.loading}
        title={buttonProps.title}
        onClick={buttonProps.onClick}
        danger={buttonProps.danger}
        className={`sync-button ${className || ''}`}
      />

      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>Merge Conflicts Detected</span>
          </Space>
        }
        open={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="abort" onClick={handleAbortSync}>
            Abort Sync
          </Button>,
          <Button 
            key="resolve" 
            type="primary" 
            loading={isResolvingConflict} 
            onClick={handleResolveWithStrategy}
          >
            Resolve with Strategy
          </Button>
        ]}
        width={600}
      >
        <Spin spinning={isResolvingConflict}>
          <div className="conflict-modal-content">
            <Title level={5}>Choose Resolution Strategy</Title>
            <Radio.Group 
              value={selectedStrategy} 
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="conflict-strategy-group"
            >
              <Space direction="vertical">
                <Radio value="manual">
                  <Text strong>Manual</Text> - Abort sync and manually edit files
                </Radio>
                <Radio value="ours">
                  <Text strong>Keep Ours</Text> - Use local changes over remote changes
                </Radio>
                <Radio value="theirs">
                  <Text strong>Keep Theirs</Text> - Use remote changes over local changes
                </Radio>
              </Space>
            </Radio.Group>

            <Title level={5} style={{ marginTop: 24 }}>Conflicted Files</Title>
            {syncStatus.conflicts?.conflictFiles && syncStatus.conflicts.conflictFiles.length > 0 ? (
              <List
                size="small"
                bordered
                dataSource={syncStatus.conflicts.conflictFiles}
                renderItem={(item) => (
                  <List.Item>
                    <Text code>{item}</Text>
                  </List.Item>
                )}
                className="conflict-files-list"
              />
            ) : (
              <Text type="secondary">No conflict details available</Text>
            )}
          </div>
        </Spin>
      </Modal>
    </>
  );
};

export default SyncButton; 