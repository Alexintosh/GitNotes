import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Select, theme, Space } from 'antd';
import { GithubOutlined, RedoOutlined } from '@ant-design/icons';
import { GitNotesService } from "../../../bindings/changeme/services";

const { Option } = Select;

interface RepositorySettingsProps {
  onConnected: () => void;
  isConnected: boolean;
}

interface SettingsFormData {
  repoURL: string;
  localPath: string;
  token: string;
  syncInterval: number;
}

type ValidateStatus = "" | "success" | "warning" | "error" | "validating" | undefined;

const RepositorySettings = ({ onConnected, isConnected }: RepositorySettingsProps) => {
  const [form] = Form.useForm<SettingsFormData>();
  const [connecting, setConnecting] = useState(false);
  const [validateStatus, setValidateStatus] = useState<ValidateStatus>("");
  const [forceEdit, setForceEdit] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        const settingsJson = await GitNotesService.LoadSettings();
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          if (settings.repoURL) {
            form.setFieldsValue({
              repoURL: settings.repoURL,
              localPath: settings.localPath,
              token: settings.token, // Load token from settings
              syncInterval: settings.syncInterval || 300, // Default 5 minutes
            });
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [form]);

  const validateConnection = async (values: SettingsFormData) => {
    setValidateStatus("validating");
    try {
      await GitNotesService.ValidateConnection(values.repoURL, values.token);
      setValidateStatus("success");
      message.success('Connection validated successfully');
      return true;
    } catch (error) {
      setValidateStatus("error");
      message.error(`Connection validation failed: ${error}`);
      return false;
    }
  };

  const handleConnect = async (values: SettingsFormData) => {
    setConnecting(true);
    
    try {
      // First validate the connection
      const isValid = await validateConnection(values);
      if (!isValid) {
        setConnecting(false);
        return;
      }
      
      // Then connect to the repository
      await GitNotesService.ConnectRepository(values.repoURL, values.localPath, values.token);
      
      // Save settings including token
      const settingsToSave = {
        repoURL: values.repoURL,
        localPath: values.localPath,
        token: values.token, // Save token in settings
        syncInterval: values.syncInterval
      };
      await GitNotesService.SaveSettings(JSON.stringify(settingsToSave));
      
      // Start auto-sync if interval is specified
      if (values.syncInterval > 0) {
        await GitNotesService.StartAutomaticSync(values.syncInterval);
      }
      
      message.success('Successfully connected to repository');
      setForceEdit(false); // Turn off edit mode on successful connection
      onConnected();
    } catch (error) {
      message.error(`Failed to connect: ${error}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleForceEdit = () => {
    setForceEdit(true);
  };

  const handleCancelEdit = () => {
    setForceEdit(false);
    if (isConnected) {
      onConnected(); // Go back on cancel if supposedly connected
    } else {
      // If not connected, reload the settings
      loadSettings();
    }
  };

  const loadSettings = async () => {
    try {
      const settingsJson = await GitNotesService.LoadSettings();
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        if (settings.repoURL) {
          form.setFieldsValue({
            repoURL: settings.repoURL,
            localPath: settings.localPath,
            token: settings.token, // Load token from settings
            syncInterval: settings.syncInterval || 300,
          });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px', color: token.colorTextHeading }}>
        <GithubOutlined /> {forceEdit ? 'Edit Repository Connection' : 'Connect to Your GitHub Repository'}
      </h2>
      
      {isConnected && !forceEdit && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <p>Status: <span style={{ color: token.colorSuccess }}>Connected</span></p>
          <Space>
            <Button 
              type="primary" 
              icon={<RedoOutlined />}
              onClick={handleForceEdit}
            >
              Edit Connection
            </Button>
            <Button 
              onClick={() => onConnected()}
            >
              Back
            </Button>
          </Space>
        </div>
      )}
      
      {(!isConnected || forceEdit) && (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleConnect}
          initialValues={{
            syncInterval: 300 // 5 minutes default
          }}
        >
          <Form.Item
            name="repoURL"
            label="Repository URL"
            rules={[{ required: true, message: 'Please enter the GitHub repository URL' }]}
            validateStatus={validateStatus}
          >
            <Input 
              placeholder="https://github.com/username/repo.git" 
              disabled={connecting}
            />
          </Form.Item>
          
          <Form.Item
            name="localPath"
            label="Local Storage Path"
            rules={[{ required: true, message: 'Please enter where to store the repository locally' }]}
          >
            <Input 
              placeholder="/path/to/local/repo" 
              disabled={connecting}
            />
          </Form.Item>
          
          <Form.Item
            name="token"
            label="GitHub Personal Access Token (PAT)"
            rules={[{ required: true, message: 'Please enter your GitHub PAT' }]}
            extra="Token must have 'repo' scope permissions"
          >
            <Input.Password 
              placeholder="github_pat_..." 
              disabled={connecting}
            />
          </Form.Item>
          
          <Form.Item
            name="syncInterval"
            label="Auto-Sync Interval"
          >
            <Select disabled={connecting}>
              <Option value={60}>Every minute</Option>
              <Option value={300}>Every 5 minutes</Option>
              <Option value={900}>Every 15 minutes</Option>
              <Option value={1800}>Every 30 minutes</Option>
              <Option value={3600}>Every hour</Option>
              <Option value={0}>Disabled (Manual sync only)</Option>
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={connecting}
                style={{ flex: 1 }}
              >
                {connecting ? 'Connecting...' : 'Connect Repository'}
              </Button>
              
              {forceEdit && (
                <Button 
                  onClick={handleCancelEdit}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      )}
      
      {(!isConnected && !forceEdit) && (
        <Button 
          type="primary" 
          onClick={() => onConnected()}
          block
          style={{ marginTop: '20px' }}
        >
          Back
        </Button>
      )}
    </div>
  );
};

export default RepositorySettings; 