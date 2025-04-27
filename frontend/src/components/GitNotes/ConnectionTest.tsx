import { useState } from 'react';
import { Card, Button, Input, Space, message, Typography, Alert } from 'antd';
import { GitNotesService } from '../../../bindings/changeme/services';

const { Title, Text } = Typography;

const ConnectionTest = () => {
  const [repoUrl, setRepoUrl] = useState('https://github.com/username/repo.git');
  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const validateConnection = async () => {
    try {
      setValidating(true);
      setValidationResult(null);
      
      await GitNotesService.ValidateConnection(repoUrl, token);
      
      setValidationResult({
        success: true,
        message: 'Connection validated successfully!'
      });
      message.success('Connection validated successfully!');
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        success: false,
        message: `Error: ${error}`
      });
      message.error(`Validation failed: ${error}`);
    } finally {
      setValidating(false);
    }
  };

  return (
    <Card title={<Title level={3}>GitNotes Connection Test</Title>} style={{ maxWidth: '600px', margin: '20px auto' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>Test the connection to your GitHub repository:</Text>
        
        <Input
          placeholder="Repository URL"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          style={{ marginBottom: '10px' }}
        />
        
        <Input.Password
          placeholder="GitHub Personal Access Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ marginBottom: '20px' }}
        />
        
        <Button 
          type="primary" 
          onClick={validateConnection}
          loading={validating}
          block
        >
          Validate Connection
        </Button>
        
        {validationResult && (
          <Alert
            message={validationResult.success ? "Success" : "Error"}
            description={validationResult.message}
            type={validationResult.success ? "success" : "error"}
            showIcon
            style={{ marginTop: '20px' }}
          />
        )}
      </Space>
    </Card>
  );
};

export default ConnectionTest; 