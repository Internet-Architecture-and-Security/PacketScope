import React from 'react';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface ProtocolStatsProps {
  label: string;
  count: number;
  colorClass: string;
}

const ProtocolStats: React.FC<ProtocolStatsProps> = ({ label, count, colorClass }) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      `${colorClass} rounded-lg px-2.5 py-1.5 border shadow-sm text-center min-w-0`,
      isDark && "border-gray-600 shadow-gray-800/20"
    )}>
      <div className={classNames(
        "text-sm font-bold leading-tight",
        isDark && "text-gray-200"
      )}>
        {count}
      </div>
      <div className={classNames(
        "text-xs font-medium",
        isDark && "text-gray-300"
      )}>
        {label}
      </div>
    </div>
  );
};

export default ProtocolStats;