import React from 'react';
import { Button, Segmented, ConfigProvider } from 'antd';
import { Cpu } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface ChainHeaderProps {
  receiveChainName: string;
  sendChainName: string;
  currentChainType: string;
  onChainTypeChange: (value: string) => void;
  currentData: any;
  processedData: any;
  isClickedAllChains: boolean;
  queryParams: any;
  onViewAllChains: () => void;
}

const ChainHeader: React.FC<ChainHeaderProps> = ({
  receiveChainName,
  sendChainName,
  currentChainType,
  onChainTypeChange,
  currentData,
  processedData,
  isClickedAllChains,
  queryParams,
  onViewAllChains
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  // 夜间模式主题配置
  const customTheme = {
    components: {
      Segmented: {
        colorBgLayout: isDark ? '#374151' : undefined,
        colorText: isDark ? '#e5e7eb' : undefined,
        colorBgElevated: isDark ? '#4b5563' : undefined,
        itemSelectedBg: isDark ? '#1f2937' : undefined,
      },
      Button: {
        colorBgContainer: isDark ? '#374151' : undefined,
        colorText: isDark ? '#e5e7eb' : undefined,
        colorBorder: isDark ? '#6b7280' : undefined,
        colorTextDisabled: isDark ? '#6b7280' : undefined,
        colorBgContainerDisabled: isDark ? '#374151' : undefined,
      }
    }
  };

  return (
    <ConfigProvider theme={customTheme}>
      <div className={classNames(
        "border-b px-4 py-3 flex items-center gap-3",
        isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      )}>
        <Cpu className="text-blue-600" size={20} />
        <span className={classNames(
          "font-semibold text-base",
          isDark ? "text-gray-100" : "text-slate-900"
        )}>
          {intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}
        </span>
        
        <Segmented 
          size="small" 
          options={[receiveChainName, sendChainName]} 
          value={currentChainType} 
          onChange={onChainTypeChange} 
        />
        
        {currentData && processedData && (
          <div className={classNames(
            "text-xs ml-2 flex items-center",
            isDark ? "text-gray-400" : "text-slate-500"
          )}>
            {intl.formatMessage({ 
              id: 'FunctionCallChainViewer.chainStats' 
            }, { 
              chainCount: currentData.length, 
              callCount: currentData.reduce((acc, chain) => acc + chain.length, 0) 
            })}
            <Button 
              disabled={isClickedAllChains} 
              size="small" 
              className="ml-2" 
              onClick={onViewAllChains}
            >
              {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAllChains' })}
            </Button>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};

export default ChainHeader;