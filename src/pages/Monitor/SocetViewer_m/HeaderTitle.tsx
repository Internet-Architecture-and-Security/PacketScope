import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import { usePollingManager } from '@/stores/usePollingManager';

const HeaderTitle: React.FC = () => {
  const intl = useIntl();
  const pollingManagerStore = usePollingManager();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className={classNames(
          "w-10 h-10 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg",
          isDark && "shadow-gray-800/30"
        )}>
          <div className="w-4 h-4 bg-white rounded-full opacity-90"></div>
          {pollingManagerStore.tasks['socket']?.isPolling && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
          )}
        </div>
      </div>
      <div>
        <h1 className={classNames(
          "text-lg font-bold leading-tight",
          isDark 
            ? "bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent" 
            : "bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
        )}>
          {intl.formatMessage({ id: 'SocketViewer.title' })}
        </h1>
        <p className={classNames(
          "text-xs font-medium tracking-wide",
          isDark ? "text-gray-400" : "text-gray-500"
        )}>
          {intl.formatMessage({ id: 'SocketViewer.subtitle' })}
        </p>
      </div>
    </div>
  );
};

export default HeaderTitle;