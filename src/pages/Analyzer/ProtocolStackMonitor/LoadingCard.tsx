import React from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

// Loading 组件
export const LoadingCard = ({ title, icon: Icon, color }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  return (
    <div className={classNames(
      "rounded-lg border overflow-hidden",
      isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
    )}>
      <div className={classNames(
        "flex items-center gap-2 p-3 border-b",
        isDark ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-100"
      )}>
        <Icon className={color} size={16} />
        <span className={classNames(
          "text-sm font-medium",
          isDark ? "text-gray-100" : "text-gray-900"
        )}>{title}</span>
      </div>
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center justify-center h-full">
          <Spin />
          <span className={classNames(
            "ml-2",
            isDark ? "text-gray-400" : "text-slate-500"
          )}>{intl.formatMessage({ id: 'ProtocolStackMonitor.loading' })}</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingCard;