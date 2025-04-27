import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Button, Space, Spin, message, theme, Tooltip } from 'antd';
import { SaveOutlined, SyncOutlined, EditOutlined, EyeOutlined, ColumnWidthOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { vim } from '@replit/codemirror-vim';
import { EditorView } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { GitNotesService } from '../../../bindings/changeme/services';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import './MarkdownPreview.css';
import MarkdownToolbar from './MarkdownToolbar';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (__) {}
    }
    return ''; // use external default escaping
  }
});

// View modes for the editor
enum ViewMode {
  EDIT = 'edit',
  PREVIEW = 'preview',
  SPLIT = 'split'
}

interface MarkdownEditorProps {
  filePath: string | null;
  isConnected: boolean;
  vimModeEnabled: boolean;
}

const MarkdownEditor = ({ filePath, isConnected, vimModeEnabled }: MarkdownEditorProps) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EDIT);
  
  // Split pane resizing state
  const [splitRatio, setSplitRatio] = useState<number>(0.5); // Default to 50/50 split
  
  // Removing unused selection state
  const codeMirrorRef = useRef<any>(null);
  
  const lastSavedContent = useRef<string>('');
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('markdownEditorViewMode');
    if (savedViewMode && Object.values(ViewMode).includes(savedViewMode as ViewMode)) {
      setViewMode(savedViewMode as ViewMode);
    }
    
    // Load saved split ratio
    const savedSplitRatio = localStorage.getItem('markdownEditorSplitRatio');
    if (savedSplitRatio) {
      setSplitRatio(parseFloat(savedSplitRatio));
    }
  }, []);

  // Save view mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('markdownEditorViewMode', viewMode);
  }, [viewMode]);
  
  // Save split ratio to localStorage
  useEffect(() => {
    localStorage.setItem('markdownEditorSplitRatio', splitRatio.toString());
  }, [splitRatio]);

  // Load file content when filePath changes
  useEffect(() => {
    if (filePath && isConnected) {
      loadFileContent();
    } else {
      setContent('');
      lastSavedContent.current = '';
    }
    
    // Clean up auto-save timer on unmount or when filePath changes
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [filePath, isConnected]);

  // Poll sync status periodically
  useEffect(() => {
    if (isConnected) {
      const statusInterval = setInterval(async () => {
        try {
          const status = await GitNotesService.GetSyncStatus();
          setSyncStatus(status);
        } catch (error) {
          console.error('Error getting sync status:', error);
        }
      }, 1000);
      
      // Clean up interval on unmount
      return () => clearInterval(statusInterval);
    }
  }, [isConnected]);

  const loadFileContent = async () => {
    if (!filePath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const fileContent = await GitNotesService.GetFileContent(filePath);
      setContent(fileContent);
      lastSavedContent.current = fileContent;
    } catch (error) {
      console.error('Error loading file content:', error);
      setError(`Failed to load file: ${error}`);
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  const saveFileContent = async () => {
    if (!filePath || !isConnected) return;
    
    // Don't save if content hasn't changed
    if (content === lastSavedContent.current) return;
    
    setSaving(true);
    try {
      await GitNotesService.WriteFileContent(filePath, content);
      lastSavedContent.current = content;
      message.success('File saved successfully');
    } catch (error) {
      console.error('Error saving file:', error);
      message.error(`Failed to save file: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    
    // Set up auto-save timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    
    autoSaveTimer.current = setTimeout(() => {
      saveFileContent();
    }, 2000); // Auto-save 2 seconds after typing stops
  };

  const handleSyncRequest = async () => {
    try {
      await GitNotesService.TriggerManualSync();
      message.success('Sync requested');
    } catch (error) {
      message.error(`Sync failed: ${error}`);
    }
  };

  // Define handleFormat before it's used in the custom keymap
  const handleFormat = useCallback((formatter: (text: string, start: number, end: number) => { text: string, newCursorPos?: number }) => {
    if (!codeMirrorRef.current) return;
    
    const text = content;
    const selection = codeMirrorRef.current.state.selection.main;
    const start = selection.from;
    const end = selection.to;
    
    const result = formatter(text, start, end);
    setContent(result.text);
    
    // Set up auto-save timer after content change
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    
    autoSaveTimer.current = setTimeout(() => {
      saveFileContent();
    }, 2000);
    
    // Schedule cursor position update after the content change is applied
    setTimeout(() => {
      if (codeMirrorRef.current && result.newCursorPos !== undefined) {
        // Update cursor position
        const cursorPos = result.newCursorPos;
        codeMirrorRef.current.dispatch({
          selection: { anchor: cursorPos }
        });
        
        // Focus the editor
        codeMirrorRef.current.focus();
      }
    }, 0);
  }, [content, saveFileContent]);

  // Create custom keymap for markdown shortcuts after handleFormat is defined
  const createMarkdownKeymap = useCallback(() => {
    if (vimModeEnabled) return []; // Don't add our shortcuts if vim mode is enabled
    
    return keymap.of([
      {
        key: 'Mod-b',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
            const selectedText = text.substring(start, end);
            const replacement = selectedText ? `**${selectedText}**` : '**Bold text**';
            const newText = text.substring(0, start) + replacement + text.substring(end);
            const newCursorPos = selectedText ? start + replacement.length : start + 2;
            return { text: newText, newCursorPos };
          });
          
          return true;
        }
      },
      {
        key: 'Mod-i',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
            const selectedText = text.substring(start, end);
            const replacement = selectedText ? `*${selectedText}*` : '*Italic text*';
            const newText = text.substring(0, start) + replacement + text.substring(end);
            const newCursorPos = selectedText ? start + replacement.length : start + 1;
            return { text: newText, newCursorPos };
          });
          
          return true;
        }
      },
      {
        key: 'Mod-h',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
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
          });
          
          return true;
        }
      },
      {
        key: 'Mod-k',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
            const selectedText = text.substring(start, end);
            const replacement = selectedText ? `[${selectedText}](url)` : '[Link text](url)';
            const newText = text.substring(0, start) + replacement + text.substring(end);
            const urlStartPos = newText.indexOf('](', start) + 2;
            return { text: newText, newCursorPos: urlStartPos };
          });
          
          return true;
        }
      },
      {
        key: 'Mod-j',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
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
          });
          
          return true;
        }
      },
      {
        key: 'Mod-u',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
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
          });
          
          return true;
        }
      },
      {
        key: 'Mod-o',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
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
          });
          
          return true;
        }
      },
      {
        key: 'Mod-Shift-p',
        run: (view) => {
          if (!codeMirrorRef.current) return false;
          
          handleFormat((text, start, end) => {
            const selectedText = text.substring(start, end);
            const replacement = selectedText ? `![${selectedText}](url)` : '![Image alt text](url)';
            const newText = text.substring(0, start) + replacement + text.substring(end);
            const urlStartPos = newText.indexOf('](', start) + 2;
            return { text: newText, newCursorPos: urlStartPos };
          });
          
          return true;
        }
      },
      {
        key: 'Mod-s',
        run: () => {
          saveFileContent();
          return true;
        }
      }
    ]);
  }, [handleFormat, saveFileContent, vimModeEnabled]);

  const getExtensions = () => {
    const extensions = [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      createMarkdownKeymap(), // Add our custom keymap
    ];
    
    if (vimModeEnabled) {
      extensions.push(vim());
    }
    
    return extensions;
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // Function to handle resize dragging
  const handleResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const startX = e.clientX;
    const startRatio = splitRatio;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const deltaX = moveEvent.clientX - startX;
      const deltaRatio = deltaX / containerWidth;
      
      // Update ratio, keeping it between 10% and 90%
      const newRatio = Math.min(Math.max(0.1, startRatio + deltaRatio), 0.9);
      setSplitRatio(newRatio);
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Reset cursor and user selection
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    // Set cursor and prevent selection during resize
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Add event listeners
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Sync scroll between editor and preview in split mode
  const handleEditorScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (viewMode !== ViewMode.SPLIT || !previewRef.current || !editorRef.current) return;
    
    const editor = e.currentTarget;
    const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    const preview = previewRef.current;
    
    // Apply the same scroll percentage to the preview
    preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
  };

  const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (viewMode !== ViewMode.SPLIT || !previewRef.current || !editorRef.current) return;
    
    const preview = e.currentTarget;
    const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    const editor = editorRef.current;
    
    // Apply the same scroll percentage to the editor
    editor.scrollTop = scrollPercentage * (editor.scrollHeight - editor.clientHeight);
  };

  // Track selection changes in the editor - removing this function as it sets an unused state
  const handleCursorActivity = useCallback((view: any) => {
    // Removing unused selection state update
  }, []);

  // Render the markdown preview component
  const renderMarkdownPreview = () => {
    return (
      <div 
        ref={previewRef}
        onScroll={handlePreviewScroll}
        className="markdown-preview" 
        style={{ 
          padding: '20px', 
          overflowY: 'auto',
          height: '100%',
          backgroundColor: token.colorBgContainer,
          color: token.colorText
        }}
      >
        <div 
          className="markdown-content" 
          dangerouslySetInnerHTML={{ __html: md.render(content) }}
        />
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '20px'
      }}>
        <Alert
          message="Not Connected"
          description="Please connect to a repository first"
          type="info"
          showIcon
        />
      </div>
    );
  }

  if (!filePath) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        backgroundColor: token.colorBgContainer
      }}>
        <Alert
          message="No File Selected"
          description="Please select a Markdown file from the repository tree"
          type="info"
          showIcon
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Spin tip="Loading file..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert
          message="Error Loading File"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '8px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`
      }}>
        <div style={{ fontSize: '14px', color: token.colorTextSecondary }}>
          {filePath ? filePath.split('/').pop() : 'No file selected'}
        </div>
        <Space>
          <Space.Compact>
            <Tooltip title="Edit Mode">
              <Button
                icon={<EditOutlined />}
                type={viewMode === ViewMode.EDIT ? 'primary' : 'default'}
                onClick={() => handleViewModeChange(ViewMode.EDIT)}
                size="small"
              />
            </Tooltip>
            <Tooltip title="Preview Mode">
              <Button
                icon={<EyeOutlined />}
                type={viewMode === ViewMode.PREVIEW ? 'primary' : 'default'}
                onClick={() => handleViewModeChange(ViewMode.PREVIEW)}
                size="small"
              />
            </Tooltip>
            <Tooltip title="Split Mode">
              <Button
                icon={<ColumnWidthOutlined />}
                type={viewMode === ViewMode.SPLIT ? 'primary' : 'default'}
                onClick={() => handleViewModeChange(ViewMode.SPLIT)}
                size="small"
              />
            </Tooltip>
          </Space.Compact>
          <span style={{ fontSize: '12px', color: token.colorTextDescription }}>
            {syncStatus}
          </span>
          <Button 
            icon={<SaveOutlined />} 
            onClick={saveFileContent} 
            loading={saving}
            size="small"
          >
            Save
          </Button>
          <Button 
            icon={<SyncOutlined />} 
            onClick={handleSyncRequest}
            size="small"
          >
            Sync
          </Button>
        </Space>
      </div>
      
      {/* Add Markdown Toolbar */}
      {(viewMode === ViewMode.EDIT || viewMode === ViewMode.SPLIT) && (
        <div 
          style={{ 
            padding: '4px 8px', 
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            backgroundColor: token.colorBgElevated
          }}
        >
          <MarkdownToolbar onFormat={handleFormat} />
        </div>
      )}
      
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          display: 'flex',
          position: 'relative'
        }}
      >
        {/* Show editor in EDIT mode or SPLIT mode */}
        {(viewMode === ViewMode.EDIT || viewMode === ViewMode.SPLIT) && (
          <div 
            ref={editorRef}
            onScroll={handleEditorScroll}
            style={{ 
              width: viewMode === ViewMode.SPLIT ? `${splitRatio * 100}%` : '100%', 
              overflow: 'auto',
              height: '100%'
            }}
          >
            <CodeMirror
              value={content}
              height="100%"
              extensions={getExtensions()}
              onChange={handleContentChange}
              theme={token.colorBgContainer === '#ffffff' ? 'light' : 'dark'}
              onCreateEditor={(editor) => {
                codeMirrorRef.current = editor;
                editor.focus();
              }}
              onStatistics={(view) => handleCursorActivity(view)}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                highlightSpecialChars: true,
                foldGutter: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                syntaxHighlighting: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: true,
                highlightSelectionMatches: true,
              }}
            />
          </div>
        )}
        
        {/* Split resizer handle */}
        {viewMode === ViewMode.SPLIT && (
          <div 
            onMouseDown={handleResize}
            style={{
              width: '8px',
              cursor: 'col-resize',
              background: 'transparent',
              position: 'relative',
              zIndex: 100,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '0 -4px'
            }}
          >
            <div style={{
              width: '2px',
              height: '40px',
              backgroundColor: token.colorBorderSecondary,
              borderRadius: '1px'
            }} />
          </div>
        )}
        
        {/* Show preview in PREVIEW mode or SPLIT mode */}
        {(viewMode === ViewMode.PREVIEW || viewMode === ViewMode.SPLIT) && (
          <div style={{ 
            width: viewMode === ViewMode.SPLIT ? `${(1 - splitRatio) * 100}%` : '100%',
            height: '100%'
          }}>
            {renderMarkdownPreview()}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor; 