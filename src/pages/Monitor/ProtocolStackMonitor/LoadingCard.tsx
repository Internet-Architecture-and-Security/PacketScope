import React from 'react';
import { Spin } from 'antd';
import { useIntl } from 'react-intl';

// Loading 组件
const LoadingCard = ({ title, icon: Icon, color }) => {
  const intl = useIntl();
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-gray-50 border-b border-gray-100">
        <Icon className={color} size={16} />
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </div>
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center justify-center h-full">
          <Spin />
          <span className="ml-2 text-slate-500">{intl.formatMessage({ id: 'ProtocolStackMonitor.loading' })}</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingCard;