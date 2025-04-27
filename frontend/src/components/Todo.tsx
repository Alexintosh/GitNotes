import React, { useState, useEffect } from 'react';
import { Card, Input, Button, List, Typography, Checkbox, Modal, Space, Tag, Row, Col } from 'antd';
import MarkdownEditor from './MarkdownEditor';
import { DownOutlined, UpOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { nanoid } from 'nanoid';
import { useDark } from '../hooks/useDark';

const { Title, Text } = Typography;

interface TodoItem {
  id: string;
  title: string;
  description: string; // Markdown content
  completed: boolean;
  createdAt: Date;
  priority: 'low' | 'medium' | 'high';
}

interface TodoEditorModalProps {
  visible: boolean;
  todo: TodoItem | null;
  onCancel: () => void;
  onSave: (todo: TodoItem) => void;
}

const TodoEditorModal: React.FC<TodoEditorModalProps> = ({ visible, todo, onCancel, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setDescription(todo.description);
      setPriority(todo.priority);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
    }
  }, [todo]);

  const handleSave = () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    const updatedTodo: TodoItem = {
      id: todo?.id || nanoid(),
      title,
      description,
      completed: todo?.completed || false,
      createdAt: todo?.createdAt || new Date(),
      priority,
    };

    onSave(updatedTodo);
  };

  return (
    <Modal
      title={todo ? 'Edit Todo' : 'Add Todo'}
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          Save
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>Title</Text>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Todo title"
          />
        </div>
        
        <div>
          <Text strong>Priority</Text>
          <div>
            <Space>
              <Button 
                type={priority === 'low' ? 'primary' : 'default'} 
                onClick={() => setPriority('low')}
              >
                Low
              </Button>
              <Button 
                type={priority === 'medium' ? 'primary' : 'default'} 
                onClick={() => setPriority('medium')}
              >
                Medium
              </Button>
              <Button 
                type={priority === 'high' ? 'primary' : 'default'} 
                onClick={() => setPriority('high')}
              >
                High
              </Button>
            </Space>
          </div>
        </div>
        
        <div>
          <Text strong>Description (Markdown)</Text>
          <MarkdownEditor 
            initialValue={description} 
            onChange={setDescription} 
            height="300px"
          />
        </div>
      </Space>
    </Modal>
  );
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    case 'low':
      return 'green';
    default:
      return 'blue';
  }
};

const Todo: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentTodo, setCurrentTodo] = useState<TodoItem | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { isDark } = useDark();

  // In a real app, this would load from a database or API
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      const parsedTodos = JSON.parse(savedTodos).map((todo: any) => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
      }));
      setTodos(parsedTodos);
    }
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    setCurrentTodo(null);
    setModalVisible(true);
  };

  const editTodo = (todo: TodoItem) => {
    setCurrentTodo(todo);
    setModalVisible(true);
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const toggleComplete = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const saveTodo = (todo: TodoItem) => {
    if (currentTodo) {
      // Edit existing todo
      setTodos(todos.map(t => t.id === todo.id ? todo : t));
    } else {
      // Add new todo
      setTodos([...todos, todo]);
    }
    setModalVisible(false);
  };

  const toggleExpand = (id: string) => {
    const newExpandedIds = new Set(expandedIds);
    if (newExpandedIds.has(id)) {
      newExpandedIds.delete(id);
    } else {
      newExpandedIds.add(id);
    }
    setExpandedIds(newExpandedIds);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Todo List</Title>
          </Col>
          <Col>
            <Button type="primary" onClick={addTodo}>
              Add Todo
            </Button>
          </Col>
        </Row>
        
        <Card>
          <List
            itemLayout="vertical"
            dataSource={todos}
            renderItem={(todo) => {
              const isExpanded = expandedIds.has(todo.id);
              
              return (
                <List.Item
                  key={todo.id}
                  actions={[
                    <Button 
                      icon={<EditOutlined />} 
                      onClick={() => editTodo(todo)}
                    >
                      Edit
                    </Button>,
                    <Button 
                      icon={<DeleteOutlined />} 
                      danger 
                      onClick={() => deleteTodo(todo.id)}
                    >
                      Delete
                    </Button>,
                  ]}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <Row align="middle">
                      <Col flex="auto">
                        <Space>
                          <Checkbox 
                            checked={todo.completed} 
                            onChange={() => toggleComplete(todo.id)}
                          />
                          <Text 
                            style={{ 
                              fontSize: '16px', 
                              textDecoration: todo.completed ? 'line-through' : 'none',
                              opacity: todo.completed ? 0.5 : 1
                            }}
                            strong
                          >
                            {todo.title}
                          </Text>
                          <Tag color={getPriorityColor(todo.priority)}>
                            {todo.priority}
                          </Tag>
                        </Space>
                      </Col>
                      <Col>
                        <Button 
                          type="text" 
                          icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
                          onClick={() => toggleExpand(todo.id)}
                        />
                      </Col>
                    </Row>
                  </div>
                  
                  {isExpanded && (
                    <div 
                      className="markdown-body"
                      style={{ 
                        padding: '10px', 
                        backgroundColor: isDark ? '#1e1e1e' : '#f6f8fa',
                        borderRadius: '4px',
                        marginTop: '10px'
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: todo.description
                          // This is a simple placeholder - in a real app, you'd use a proper markdown renderer
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/\n/g, '<br />') 
                      }}
                    />
                  )}
                </List.Item>
              );
            }}
          />
        </Card>
      </Space>
      
      <TodoEditorModal
        visible={modalVisible}
        todo={currentTodo}
        onCancel={() => setModalVisible(false)}
        onSave={saveTodo}
      />
    </div>
  );
};

export default Todo; 