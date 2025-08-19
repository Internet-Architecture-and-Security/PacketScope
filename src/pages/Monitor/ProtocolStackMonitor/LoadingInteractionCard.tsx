import React from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

// Loading 组件 - 交互卡片版本
export const LoadingInteractionCard = ({ title, fromIcon: FromIcon, toIcon: ToIcon, fromColor, toColor, gradientClass, borderClass }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  return (
    <div className={classNames(
      "rounded border",
      isDark ? "bg-gray-800 border-gray-700" : gradientClass + " " + borderClass
    )}>
      <div className={classNames(
        "flex items-center gap-2 p-3 border-b",
        isDark ? "border-gray-600" : "border-gray-100"
      )}>
        <FromIcon className={fromColor} size={12} />
        <ArrowRight className={classNames(
          isDark ? "text-gray-500" : "text-gray-400"
        )} size={10} />
        <ToIcon className={toColor} size={12} />
        <span className={classNames(
          "text-xs font-medium ml-2",
          isDark ? "text-gray-200" : "text-gray-700"
        )}>{title}</span>
      </div>
      <div className="flex items-center justify-center h-32">
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

export default LoadingInteractionCard;