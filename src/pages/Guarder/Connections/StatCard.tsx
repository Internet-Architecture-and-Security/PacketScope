import React from 'react';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "rounded-xl p-6 border shadow-sm",
      isDark ? "bg-gray-800 border-gray-700" : "bg-white border-white"
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className={classNames(
            "text-sm font-medium",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>{label}</p>
          <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
        </div>
        <div className={`p-3 bg-${color}-100 rounded-lg`}>
          {React.cloneElement(icon, { className: `w-6 h-6 text-${color}-600` })}
        </div>
      </div>
    </div>
  );
};

export default StatCard;