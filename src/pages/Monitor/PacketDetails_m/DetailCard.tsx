import React, { useState } from 'react';
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface DetailCardProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

const DetailCard: React.FC<DetailCardProps> = ({
  title,
  children,
  defaultCollapsed = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div
        className={classNames(
          "flex items-center px-4 py-2 text-xs font-medium cursor-pointer transition-colors duration-100 select-none",
          isDark 
            ? "text-gray-300 hover:bg-gray-800/50" 
            : "text-gray-600 hover:bg-gray-200/50"
        )}
        onClick={toggleExpand}
      >
        {isExpanded ? 
          <CaretDownOutlined className={classNames(
            "mr-2",
            isDark ? "text-gray-500" : "text-gray-400"
          )} /> : 
          <CaretRightOutlined className={classNames(
            "mr-2",
            isDark ? "text-gray-500" : "text-gray-400"
          )} />
        }
        <span className="uppercase tracking-wide">{title}</span>
      </div>
      {isExpanded && <div>{children}</div>}
    </div>
  );
};

export default DetailCard;