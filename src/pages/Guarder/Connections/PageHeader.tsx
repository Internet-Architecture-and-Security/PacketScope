import React from 'react';
import { Activity } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const PageHeader: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Activity className="text-white" size={30} />
        </div>
        <div>
          <h1 className={classNames(
            "text-2xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {intl.formatMessage({ id: 'ConnectionsMonitor.title' })}
          </h1>
          <p className={classNames(
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            {intl.formatMessage({ id: 'ConnectionsMonitor.subtitle' })}
          </p>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;