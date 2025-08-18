import React from 'react';
import { Boxes } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface EmptyStateProps {
  type: 'no-selection' | 'no-packets';
}

const EmptyState: React.FC<EmptyStateProps> = ({ type }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  if (type === 'no-selection') {
    return (
      <div className={classNames(
        "h-full w-full flex items-center justify-center",
        isDark ? "bg-gray-900" : "bg-gray-50"
      )}>
        <div className="text-center">
          <Boxes className={classNames(
            "w-12 h-12 mx-auto mb-4",
            isDark ? "text-gray-600" : "text-gray-300"
          )} />
          <div className={classNames(
            "text-lg font-semibold mb-2",
            isDark ? "text-gray-300" : "text-slate-500"
          )}>
            {intl.formatMessage({ id: 'PacketDetails.analyzer' })}
          </div>
          <div className={classNames(
            "text-sm",
            isDark ? "text-gray-500" : "text-slate-400"
          )}>
            {intl.formatMessage({ id: 'PacketDetails.selectConnection' })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <div className="text-gray-400 text-6xl mb-4">📭</div>
      <h4 className={classNames(
        "text-lg font-medium mb-2",
        isDark ? "text-gray-300" : "text-gray-600"
      )}>
        {intl.formatMessage({ id: 'PacketDetails.noPacketsFound' })}
      </h4>
      <p className={classNames(
        isDark ? "text-gray-500" : "text-gray-500"
      )}>
        {intl.formatMessage({ id: 'PacketDetails.noPacketsDescription' })}
      </p>
    </div>
  );
};

export default EmptyState;