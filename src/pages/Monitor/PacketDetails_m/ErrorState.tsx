import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface ErrorStateProps {
  error: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "border rounded-lg p-4 mb-4",
      isDark
        ? "bg-red-900/20 border-red-800"
        : "bg-red-50 border-red-200"
    )}>
      <div className="flex items-center">
        <div className={classNames(
          "mr-3",
          isDark ? "text-red-400" : "text-red-600"
        )}>
          ⚠️
        </div>
        <div>
          <h4 className={classNames(
            "font-medium",
            isDark ? "text-red-300" : "text-red-800"
          )}>
            {intl.formatMessage({ id: 'PacketDetails.loadFailed' })}
          </h4>
          <p className={classNames(
            "text-sm mt-1",
            isDark ? "text-red-400" : "text-red-600"
          )}>
            {error}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;