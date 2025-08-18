import React from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const LoadingState: React.FC = () => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className="flex items-center justify-center h-64">
      <Spin size="default" className="mr-2" />
      <p className={classNames(
        isDark ? "text-gray-300" : "text-gray-600"
      )}>
        {intl.formatMessage({ id: 'PacketDetails.loading' })}
      </p>
    </div>
  );
};

export default LoadingState;