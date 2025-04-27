import React from 'react';
import { Button, Tooltip } from 'antd';
import { 
  MinusOutlined, 
  CloseOutlined, 
  BorderOutlined, 
  PushpinOutlined, 
  PushpinFilled,
  DownOutlined
} from '@ant-design/icons';
import { GreetService } from '../../../../../bindings/changeme';

interface WindowControlsProps {
  isAlwaysOnTop: boolean;
  onAlwaysOnTopChange: (isAlwaysOnTop: boolean) => void;
}

const WindowControls: React.FC<WindowControlsProps> = ({
  isAlwaysOnTop,
  onAlwaysOnTopChange,
}) => {
  const handleAlwaysOnTop = () => {
    const newState = !isAlwaysOnTop;
    onAlwaysOnTopChange(newState);
    GreetService.SetAlwaysOnTop(newState);
  };

  const handleHideToTray = () => {
    GreetService.HideToSystemTray();
  };

  return (
    <>
      <Tooltip title="Always on Top">
        <Button 
          type="text" 
          icon={isAlwaysOnTop ? <PushpinFilled /> : <PushpinOutlined />} 
          onClick={handleAlwaysOnTop}
          size="small"
          className="header-button"
        />
      </Tooltip>
      <Tooltip title="Hide to Tray">
        <Button 
          type="text" 
          icon={<DownOutlined />} 
          onClick={handleHideToTray}
          size="small"
          className="header-button"
        />
      </Tooltip>
      <Tooltip title="Minimize">
        <Button 
          type="text" 
          icon={<MinusOutlined />} 
          onClick={() => GreetService.Minimize()}
          size="small"
          className="header-button"
        />
      </Tooltip>
      <Tooltip title="Maximize">
        <Button 
          type="text" 
          icon={<BorderOutlined />} 
          onClick={() => GreetService.Maximize()}
          size="small"
          className="header-button"
        />
      </Tooltip>
      <Tooltip title="Close">
        <Button 
          type="text" 
          icon={<CloseOutlined />} 
          onClick={() => GreetService.Close()}
          size="small"
          className="header-button header-button-danger"
          danger
        />
      </Tooltip>
    </>
  );
};

export default WindowControls;
