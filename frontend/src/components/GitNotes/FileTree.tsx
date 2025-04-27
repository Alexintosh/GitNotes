import { useState, useEffect, useRef } from 'react';
import { Tree, Spin, Empty, Menu, Button, message, Input, Switch, Radio, Tooltip, Space } from 'antd';
import { 
  FolderOutlined, 
  FileOutlined, 
  ReloadOutlined, 
  FileMarkdownOutlined,
  FileAddOutlined,
  FolderAddOutlined 
} from '@ant-design/icons';
import type { DirectoryTreeProps } from 'antd/es/tree';
import { GitNotesService } from '../../../bindings/changeme/services';
import { Key } from 'react';

const { DirectoryTree } = Tree;
const { Search } = Input;

export interface FileNodeData {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNodeData[];
}

interface FileTreeProps {
  onFileSelect: (filePath: string) => void;
  isConnected: boolean;
}

type SortOption = 'name-asc' | 'name-desc' | 'type' | 'none';

const FileTree = ({ onFileSelect, isConnected }: FileTreeProps) => {
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<any[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [showOnlyMarkdown, setShowOnlyMarkdown] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('type');
  const [originalData, setOriginalData] = useState<FileNodeData | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: any;
  }>({
    visible: false,
    x: 0,
    y: 0,
    node: null
  });

  // Reference to detect clicks outside context menu
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  // Handle clicks outside the context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu.visible && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu.visible]);

  // Load repo structure when component mounts or connection status changes
  useEffect(() => {
    if (isConnected) {
      loadRepositoryStructure();
    } else {
      setTreeData([]);
      setOriginalData(null);
    }
  }, [isConnected]);

  // Apply filters and sorting when these options change
  useEffect(() => {
    if (originalData) {
      applyFiltersAndSort();
    }
  }, [searchValue, showOnlyMarkdown, sortOption, originalData]);

  const loadRepositoryStructure = async () => {
    setLoading(true);
    try {
      const repoStructureJson = await GitNotesService.GetRepositoryStructure();
      const repoStructure: FileNodeData = JSON.parse(repoStructureJson);
      
      setOriginalData(repoStructure);
      applyFiltersAndSort(repoStructure);
      
    } catch (error) {
      message.error(`Failed to load repository structure: ${error}`);
      console.error('Error loading repository structure:', error);
      setTreeData([]);
      setOriginalData(null);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = (data?: FileNodeData) => {
    const sourceData = data || originalData;
    if (!sourceData) return;
    
    // Apply transformations
    const transformedData = transformToTreeData(
      sourceData, 
      showOnlyMarkdown, 
      searchValue.toLowerCase(), 
      sortOption
    );
    
    setTreeData(transformedData ? [transformedData] : []);
    
    // Expand the root node by default
    if (transformedData) {
      setExpandedKeys([transformedData.key as Key]);
    }
  };

  const isMarkdownFile = (fileName: string): boolean => {
    const lowerCaseName = fileName.toLowerCase();
    return lowerCaseName.endsWith('.md') || lowerCaseName.endsWith('.markdown');
  };

  const shouldIncludeNode = (node: FileNodeData, filterMarkdown: boolean, searchTerm: string): boolean => {
    // Include all directories
    if (node.isDir) return true;
    
    // For files, check if it matches Markdown filter (if active)
    if (filterMarkdown && !isMarkdownFile(node.name)) return false;
    
    // Check if it matches search term
    if (searchTerm && !node.name.toLowerCase().includes(searchTerm)) return false;
    
    return true;
  };

  const transformToTreeData = (
    node: FileNodeData, 
    filterMarkdown: boolean, 
    searchTerm: string,
    sortType: SortOption
  ): any => {
    if (!node) return null;
    
    // Create a result that will be modified based on filters
    const result: any = {
      title: node.name,
      key: node.path,
      isLeaf: !node.isDir,
      icon: getNodeIcon(node),
      data: {
        path: node.path,
        isDir: node.isDir
      }
    };
    
    // Handle children if any
    if (node.children && node.children.length > 0) {
      // Filter children based on Markdown filter and search term
      const filteredChildren = node.children
        .filter(child => !child.name.startsWith('.') && child.name !== '.git')
        .map(child => {
          // Process each child recursively
          if (child.isDir) {
            return transformToTreeData(child, filterMarkdown, searchTerm, sortType);
          } else {
            // For files, apply filter directly
            return shouldIncludeNode(child, filterMarkdown, searchTerm) 
              ? transformToTreeData(child, false, '', sortType) // No filtering on leaf nodes
              : null;
          }
        })
        .filter(Boolean); // Remove null entries
      
      // Sort the filtered children
      const sortedChildren = sortType !== 'none' 
        ? [...filteredChildren].sort((a, b) => {
            const aIsLeaf = a.isLeaf;
            const bIsLeaf = b.isLeaf;
            
            // Handle type-based sorting (folders first)
            if (sortType === 'type') {
              if (!aIsLeaf && bIsLeaf) return -1;
              if (aIsLeaf && !bIsLeaf) return 1;
            }
            
            // Alphabetical sorting
            const nameCompare = a.title.localeCompare(b.title);
            return sortType === 'name-asc' ? nameCompare : -nameCompare;
          })
        : filteredChildren;
      
      result.children = sortedChildren;
    }
    
    return result;
  };

  const getNodeIcon = (node: FileNodeData) => {
    if (node.isDir) return <FolderOutlined />;
    return isMarkdownFile(node.name) ? <FileMarkdownOutlined /> : <FileOutlined />;
  };

  const onSelect: DirectoryTreeProps['onSelect'] = (keys, info) => {
    const node = info.node as any;
    const data = node.data;
    
    // Only select files, not directories
    if (data && !data.isDir) {
      onFileSelect(data.path);
    }
  };

  const onExpand = (keys: Key[], info: any) => {
    setExpandedKeys(keys);
  };

  const handleRefresh = () => {
    loadRepositoryStructure();
  };

  const handleCreateFile = async () => {
    // This would normally open a dialog to create a new file
    message.info('Create file functionality will be implemented soon');
  };

  const handleCreateFolder = async () => {
    // This would normally open a dialog to create a new folder
    message.info('Create folder functionality will be implemented soon');
  };

  const handleDelete = async () => {
    message.info('Delete functionality will be implemented soon');
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  const handleSortChange = (e: any) => {
    setSortOption(e.target.value);
  };

  const handleToggleMarkdownOnly = (checked: boolean) => {
    setShowOnlyMarkdown(checked);
  };

  // Node context menu (right-click)
  const getNodeContextMenu = (node: any) => {
    const isDirectory = node.data?.isDir;
    
    return (
      <Menu>
        {isDirectory ? (
          <>
            <Menu.Item key="newFile" icon={<FileAddOutlined />} onClick={handleCreateFile}>
              New File
            </Menu.Item>
            <Menu.Item key="newFolder" icon={<FolderAddOutlined />} onClick={handleCreateFolder}>
              New Folder
            </Menu.Item>
          </>
        ) : (
          <Menu.Item key="open" onClick={() => onFileSelect(node.data.path)}>
            Open
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item key="delete" danger onClick={handleDelete}>
          Delete
        </Menu.Item>
      </Menu>
    );
  };

  return (
    <div className="file-tree-container" style={{ height: '100%', overflow: 'auto', paddingBottom: '40px' }}>
      <div style={{ padding: '10px' }}>
        <Space style={{ marginBottom: '10px' }} size="small">
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh} 
            size="small"
            loading={loading}
            disabled={!isConnected}
          />
          <Search 
            placeholder="Search files..." 
            size="small" 
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 150 }}
          />
        </Space>
        <div style={{ marginBottom: '10px' }}>
          <Space>
            <Tooltip title="Show only Markdown files">
              <Switch 
                size="small" 
                checked={showOnlyMarkdown} 
                onChange={handleToggleMarkdownOnly}
              />
            </Tooltip>
            <Radio.Group 
              size="small" 
              value={sortOption}
              onChange={handleSortChange}
            >
              <Tooltip title="Sort by type (folders first)">
                <Radio.Button value="type">Type</Radio.Button>
              </Tooltip>
              <Tooltip title="Sort by name (A-Z)">
                <Radio.Button value="name-asc">A-Z</Radio.Button>
              </Tooltip>
              <Tooltip title="Sort by name (Z-A)">
                <Radio.Button value="name-desc">Z-A</Radio.Button>
              </Tooltip>
            </Radio.Group>
          </Space>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="small" />
          </div>
        ) : !isConnected ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="Repository not connected" 
            style={{ margin: '20px 0' }}
          />
        ) : treeData.length === 0 ? (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="No files found" 
            style={{ margin: '20px 0' }}
          />
        ) : (
          <DirectoryTree
            showIcon
            defaultExpandAll={false}
            expandedKeys={expandedKeys}
            onExpand={onExpand}
            onSelect={onSelect}
            treeData={treeData}
            style={{ overflowX: 'auto' }}
          />
        )}
      </div>
      
      {contextMenu.visible && (
        <div 
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
            backgroundColor: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          {getNodeContextMenu(contextMenu.node)}
        </div>
      )}
    </div>
  );
};

export default FileTree; 