import React from 'react';
import { Tooltip, Button, Row, Space } from 'antd';
import { 
  BoldOutlined, 
  ItalicOutlined, 
  OrderedListOutlined, 
  UnorderedListOutlined, 
  LinkOutlined,
  PictureOutlined,
  CodeOutlined
} from '@ant-design/icons';

interface MarkdownToolbarProps {
  onFormat: (
    formatter: (
      text: string,
      start: number,
      end: number
    ) => { text: string; newCursorPos: number }
  ) => void;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onFormat }) => {
  const formatActions = [
    {
      icon: <BoldOutlined />,
      title: 'Bold',
      shortcut: '⌘+B',
      formatFn: (text: string, start: number, end: number) => {
        const selectedText = text.substring(start, end);
        const replacement = selectedText ? `**${selectedText}**` : '**Bold text**';
        const newText = text.substring(0, start) + replacement + text.substring(end);
        const newCursorPos = selectedText ? start + replacement.length : start + 2;
        return { text: newText, newCursorPos };
      }
    },
    {
      icon: <ItalicOutlined />,
      title: 'Italic',
      shortcut: '⌘+I',
      formatFn: (text: string, start: number, end: number) => {
        const selectedText = text.substring(start, end);
        const replacement = selectedText ? `*${selectedText}*` : '*Italic text*';
        const newText = text.substring(0, start) + replacement + text.substring(end);
        const newCursorPos = selectedText ? start + replacement.length : start + 1;
        return { text: newText, newCursorPos };
      }
    },
    {
      title: 'Heading',
      shortcut: '⌘+H',
      icon: 'H',
      formatFn: (text: string, start: number, end: number) => {
        let lineStart = start;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
          lineStart--;
        }
        
        const currentLine = text.substring(lineStart, end);
        const headingMatch = currentLine.match(/^(#{1,6})\s/);
        
        let newText;
        if (headingMatch) {
          const level = headingMatch[1].length;
          if (level < 6) {
            newText = text.substring(0, lineStart) + '#'.repeat(level + 1) + ' ' + 
                     text.substring(lineStart + headingMatch[0].length);
          } else {
            newText = text.substring(0, lineStart) + text.substring(lineStart + headingMatch[0].length);
          }
        } else {
          newText = text.substring(0, lineStart) + '## ' + text.substring(lineStart);
        }
        
        return { text: newText, newCursorPos: start + 3 };
      }
    },
    {
      icon: <UnorderedListOutlined />,
      title: 'Bullet List',
      shortcut: '⌘+U',
      formatFn: (text: string, start: number, end: number) => {
        const selectedText = text.substring(start, end);
        if (selectedText) {
          const lines = selectedText.split('\n');
          const formattedText = lines.map(line => line.trim() ? `- ${line}` : line).join('\n');
          const newText = text.substring(0, start) + formattedText + text.substring(end);
          return { text: newText, newCursorPos: start + formattedText.length };
        } else {
          const newText = text.substring(0, start) + '- ' + text.substring(end);
          return { text: newText, newCursorPos: start + 2 };
        }
      }
    },
    {
      icon: <OrderedListOutlined />,
      title: 'Numbered List',
      shortcut: '⌘+O',
      formatFn: (text: string, start: number, end: number) => {
        const selectedText = text.substring(start, end);
        if (selectedText) {
          const lines = selectedText.split('\n');
          const formattedText = lines.map((line, i) => 
            line.trim() ? `${i + 1}. ${line}` : line
          ).join('\n');
          const newText = text.substring(0, start) + formattedText + text.substring(end);
          return { text: newText, newCursorPos: start + formattedText.length };
        } else {
          const newText = text.substring(0, start) + '1. ' + text.substring(end);
          return { text: newText, newCursorPos: start + 3 };
        }
      }
    },
    {
      icon: <LinkOutlined />,
      title: 'Link',
      shortcut: '⌘+K',
      formatFn: (text: string, start: number, end: number) => {
        const selectedText = text.substring(start, end);
        const replacement = selectedText ? `[${selectedText}](url)` : '[Link text](url)';
        const newText = text.substring(0, start) + replacement + text.substring(end);
        const urlStartPos = newText.indexOf('](', start) + 2;
        return { text: newText, newCursorPos: urlStartPos };
      }
    },
    {
      icon: <PictureOutlined />,
      title: 'Image',
      shortcut: '⌘+Shift+P',
      formatFn: (text: string, start: number, end: number) => {
        const selectedText = text.substring(start, end);
        const replacement = selectedText ? `![${selectedText}](url)` : '![Image alt text](url)';
        const newText = text.substring(0, start) + replacement + text.substring(end);
        const urlStartPos = newText.indexOf('](', start) + 2;
        return { text: newText, newCursorPos: urlStartPos };
      }
    },
    {
      icon: <CodeOutlined />,
      title: 'Code',
      shortcut: '⌘+J',
      formatFn: (text: string, start: number, end: number) => {
        const selectedText = text.substring(start, end);
        if (selectedText.includes('\n')) {
          const replacement = '```\n' + selectedText + '\n```';
          const newText = text.substring(0, start) + replacement + text.substring(end);
          return { text: newText, newCursorPos: start + 4 };
        } else {
          const replacement = selectedText ? '`' + selectedText + '`' : '`code`';
          const newText = text.substring(0, start) + replacement + text.substring(end);
          const newCursorPos = selectedText ? start + replacement.length : start + 1;
          return { text: newText, newCursorPos };
        }
      }
    }
  ];

  return (
    <Row>
      <Space>
        {formatActions.map((action, index) => (
          <Tooltip key={index} title={`${action.title} (${action.shortcut})`}>
            <Button
              type="text"
              icon={action.icon}
              onClick={() => onFormat(action.formatFn)}
            >
              {typeof action.icon === 'string' ? action.icon : null}
            </Button>
          </Tooltip>
        ))}
      </Space>
    </Row>
  );
};

export default MarkdownToolbar; 