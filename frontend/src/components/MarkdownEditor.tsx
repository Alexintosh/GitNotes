import { useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { useDark } from '../hooks/useDark';
import { Card, Typography, Space, Button } from 'antd';
import { vim } from '@replit/codemirror-vim';

const { Title } = Typography;

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  height?: string;
  useVimMode?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  initialValue = '',
  onChange,
  height = '500px',
  useVimMode = false,
}) => {
  const [value, setValue] = useState(initialValue);
  const { isDark } = useDark();

  const handleChange = useCallback((val: string) => {
    setValue(val);
    onChange?.(val);
  }, [onChange]);

  return (
    <Card title={<Title level={3}>Markdown Editor</Title>} style={{ width: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <CodeMirror
          value={value}
          height={height}
          extensions={[
            markdown({ 
              base: markdownLanguage, 
              codeLanguages: languages 
            }),
            ...(useVimMode ? [vim()] : []),
          ]}
          onChange={handleChange}
          theme={isDark ? 'dark' : 'light'}
          style={{ 
            fontSize: '1rem',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        />
        
        <div style={{ marginTop: '16px' }}>
          <Button 
            type="primary" 
            onClick={() => {
              // You can add save functionality here
              console.log('Saving markdown:', value);
            }}
          >
            Save
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default MarkdownEditor; 