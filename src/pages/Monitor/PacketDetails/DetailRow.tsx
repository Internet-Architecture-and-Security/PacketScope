import React from 'react';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ icon, label, children }) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "flex items-center px-4 py-1.5 transition-colors duration-100",
      isDark ? "hover:bg-gray-900/30" : "hover:bg-gray-300/30"
    )}>
      <div className={classNames(
        "flex items-center text-xs w-32 flex-shrink-0",
        isDark ? "text-gray-400" : "text-gray-500"
      )}>
        <span className={classNames(
          "w-4 text-center mr-2",
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className={classNames(
        "text-xs flex items-center",
        isDark ? "text-gray-300" : "text-gray-700"
      )}>
        {children}
      </div>
    </div>
  );
};

export default DetailRow;