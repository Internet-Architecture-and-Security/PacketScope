import React from 'react';
import { Card, Button, Space, Input } from 'antd';
import { Search, Eye, RefreshCw, RotateCcw, Download } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface ControlPanelProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  isPolling: boolean;
  togglePolling: () => void;
  handleRefresh: () => void;
  handleExport: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  searchTerm,
  setSearchTerm,
  isPolling,
  togglePolling,
  handleRefresh,
  handleExport,
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <Card className={classNames(
      "shadow-sm",
      isDark ? "bg-gray-800 border-gray-600" : "border-white"
    )}>
      <div className="flex flex-col lg:flex-row gap-4 justify-between">
        <div className="flex-1">
          <Input
            prefix={<Search className={classNames(
              "w-4 h-4",
              isDark ? "text-gray-500" : "text-gray-400"
            )} />}
            placeholder={intl.formatMessage({ id: 'ConnectionsMonitor.searchPlaceholder' })}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={classNames(
              "max-w-md border-1",
              isDark ? "placeholder:text-gray-500 text-gray-300 bg-transparent" : "placeholder:text-gray-400"
            )}
            allowClear
          />
        </div>
        <Space>
          <Button
            type={isPolling ? 'primary' : 'default'}
            danger={isPolling}
            icon={isPolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            onClick={togglePolling}
          >
            {isPolling
              ? intl.formatMessage({ id: 'ConnectionsMonitor.stopMonitoring' })
              : intl.formatMessage({ id: 'ConnectionsMonitor.startMonitoring' })
            }
          </Button>
          <Button
            onClick={handleRefresh}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            {intl.formatMessage({ id: 'ConnectionsMonitor.refreshNow' })}
          </Button>
          <Button onClick={handleExport} icon={<Download className="w-4 h-4" />}>
            {intl.formatMessage({ id: 'ConnectionsMonitor.exportData' })}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default ControlPanel;