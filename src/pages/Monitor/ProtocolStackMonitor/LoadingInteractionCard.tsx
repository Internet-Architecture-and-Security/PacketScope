import React from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';

// Loading 组件 - 交互卡片版本
const LoadingInteractionCard = ({ title, fromIcon: FromIcon, toIcon: ToIcon, fromColor, toColor, gradientClass, borderClass }) => {
  const intl = useIntl();
  
  return (
    <div className={`${gradientClass} rounded border ${borderClass}`}>
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <FromIcon className={fromColor} size={12} />
        <ArrowRight className="text-gray-400" size={10} />
        <ToIcon className={toColor} size={12} />
        <span className="text-xs font-medium text-gray-700 ml-2">{title}</span>
      </div>
      <div className="flex items-center justify-center h-32">
        <div className="flex items-center justify-center h-full">
          <Spin />
          <span className="ml-2 text-slate-500">{intl.formatMessage({ id: 'ProtocolStackMonitor.loading' })}</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingInteractionCard;