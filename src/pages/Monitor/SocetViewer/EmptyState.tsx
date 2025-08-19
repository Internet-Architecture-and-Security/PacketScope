import React from 'react';
import { useIntl } from 'react-intl';
import { Button, Empty } from 'antd';
import { Loading3QuartersOutlined } from '@ant-design/icons';
import { Logs } from 'lucide-react';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import { usePollingManager } from '@/stores/usePollingManager';

interface EmptyStateProps {
  hasSocketData: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasSocketData }) => {
  const intl = useIntl();
  const pollingManagerStore = usePollingManager();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  if (hasSocketData) {
    return <Empty className={classNames("py-16", isDark && "text-gray-400")} />;
  }

  return (
    <div className="py-16 text-center flex items-center flex-col">
      <Logs size={70} className={classNames(
        isDark ? "text-gray-600" : "text-gray-300"
      )} />
      <h4 className={classNames(
        "text-lg font-semibold mb-2",
        isDark ? "text-gray-300" : "text-slate-500"
      )}>
        {intl.formatMessage({ id: 'SocketViewer.empty.title' })}
      </h4>
      <p className={classNames(
        "text-sm mb-2",
        isDark ? "text-gray-400" : "text-gray-500"
      )}>
        {intl.formatMessage({ id: 'SocketViewer.empty.description' })}
      </p>
      <p className={classNames(
        "text-xs mb-8",
        isDark ? "text-gray-500" : "text-gray-400"
      )}>
        {intl.formatMessage({ id: 'SocketViewer.empty.subtitle' })}
      </p>

      <Button
        type="primary"
        loading={
          pollingManagerStore.tasks['socket']?.isPolling ? { icon: <Loading3QuartersOutlined spin className="flex" /> } : false
        }
        onClick={() => {
          pollingManagerStore.startPolling('socket');
        }}
        className={classNames(
          "border-0 rounded-full px-8 py-2 h-auto",
          isDark 
            ? "bg-blue-600 hover:bg-blue-500" 
            : "bg-blue-600 hover:bg-blue-700"
        )}
      >
        {pollingManagerStore.tasks['socket']?.isPolling 
          ? intl.formatMessage({ id: 'SocketViewer.button.starting' })
          : intl.formatMessage({ id: 'SocketViewer.button.start' })
        }
      </Button>

      {pollingManagerStore.tasks['socket']?.isPolling && (
        <div className={classNames(
          "mt-6 text-sm animate-pulse",
          isDark ? "text-gray-400" : "text-gray-500"
        )}>
          <div className="flex items-center justify-center space-x-2">
            <span>{intl.formatMessage({ id: 'SocketViewer.status.initializing' })}</span>
            <div className="flex space-x-1">
              <div className={classNames(
                "w-2 h-2 rounded-full animate-bounce",
                isDark ? "bg-blue-400" : "bg-blue-500"
              )}></div>
              <div className={classNames(
                "w-2 h-2 rounded-full animate-bounce",
                isDark ? "bg-blue-400" : "bg-blue-500"
              )} style={{ animationDelay: '0.1s' }}></div>
              <div className={classNames(
                "w-2 h-2 rounded-full animate-bounce",
                isDark ? "bg-blue-400" : "bg-blue-500"
              )} style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmptyState;