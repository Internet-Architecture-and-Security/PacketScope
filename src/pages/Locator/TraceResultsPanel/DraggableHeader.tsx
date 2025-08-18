import React from 'react';
import { Tooltip } from 'antd';
import { useIntl } from 'react-intl';
import { DeploymentUnitOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface DraggableHeaderProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  listeners?: any;
  attributes?: any;
}

const DraggableHeader: React.FC<DraggableHeaderProps> = ({
  isCollapsed,
  onToggleCollapse,
  listeners,
  attributes
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div
      {...listeners}
      {...attributes}
      className={classNames(
        'px-3 py-2 border-b cursor-move select-none flex items-center justify-between transition-all duration-200',
        isDark
          ? 'bg-gradient-to-r from-gray-700/20 to-gray-600/20 border-gray-600/50 hover:from-gray-700/30 hover:to-gray-600/30'
          : 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-white/10 hover:from-blue-600/30 hover:to-purple-600/30'
      )}
    >
      <div className="flex items-center gap-2">
        <h2 className={classNames(
          'text-base font-medium flex items-center gap-2',
          isDark ? 'text-gray-200' : 'text-white'
        )}>
          <DeploymentUnitOutlined className={classNames(
            'text-sm',
            isDark ? 'text-gray-400' : 'text-blue-400'
          )} />
          {intl.formatMessage({ id: 'TraceResultsPanel.title' })}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <span className={classNames(
          'text-xs',
          isDark ? 'text-gray-400' : 'text-gray-300'
        )}>
          {intl.formatMessage({ id: 'TraceResultsPanel.draggable' })}
        </span>
        <Tooltip title={isCollapsed ? intl.formatMessage({ id: 'TraceResultsPanel.expand' }) : intl.formatMessage({ id: 'TraceResultsPanel.collapse' })}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.();
            }}
            className={classNames(
              'text-xs transition',
              isDark
                ? 'text-gray-200 hover:text-gray-400'
                : 'text-white hover:text-blue-400'
            )}
          >
            {isCollapsed ? <DownOutlined /> : <UpOutlined />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default DraggableHeader;