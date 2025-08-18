import React from 'react';
import { Filter, Search, RotateCcw } from 'lucide-react';
import { Input, Select, Button, ConfigProvider } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Option } = Select;

interface FilterBarProps {
  filterText: string;
  onFilterTextChange: (value: string) => void;
  callTypeFilter: string;
  onCallTypeFilterChange: (value: string) => void;
  threadFilter: string;
  onThreadFilterChange: (value: string) => void;
  allThreadIds: number[];
  onResetFilters: () => void;
  onViewAggregatedGraph: () => void;
  filteredData: any[];
  currentData: any;
}

const FilterBar: React.FC<FilterBarProps> = ({
  filterText,
  onFilterTextChange,
  callTypeFilter,
  onCallTypeFilterChange,
  threadFilter,
  onThreadFilterChange,
  allThreadIds,
  onResetFilters,
  onViewAggregatedGraph,
  filteredData,
  currentData
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className={classNames(
      "w-full border-b px-4 py-2",
      isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
    )}>
      <div className="flex items-center gap-3 flex-wrap scale-90 origin-left">
        <div className="flex items-center gap-1.5">
          <Filter className={classNames(
            "w-3.5 h-3.5",
            isDark ? "text-gray-400" : "text-slate-600"
          )} />
          <span className={classNames(
            "text-xs font-medium",
            isDark ? "text-gray-300" : "text-slate-700"
          )}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.filter' })}
          </span>
        </div>
        
        <ConfigProvider
          theme={{
            components: {
              Input: {
                colorBgContainer: isDark ? '#374151' : '#ffffff',
                colorBorder: isDark ? '#4b5563' : '#d1d5db',
                colorText: isDark ? '#e5e7eb' : '#374151',
                colorTextPlaceholder: isDark ? '#9ca3af' : '#6b7280',
                colorIcon: isDark ? '#9ca3af' : '#6b7280',
                activeBorderColor: isDark ? '#2563eb' : '#2563eb',
                hoverBorderColor: isDark ? '#6b7280' : '#9ca3af',
              },
            },
          }}
        >
          <Input 
            placeholder={intl.formatMessage({ id: 'FunctionCallChainViewer.searchPlaceholder' })} 
            value={filterText} 
            onChange={(e) => onFilterTextChange(e.target.value)} 
            prefix={<Search className={classNames(
              "w-3.5 h-3.5",
              isDark ? "text-gray-500" : "text-slate-400"
            )} />} 
            size="small" 
            style={{ width: 160, fontSize: '12px' }}
          />
        </ConfigProvider>
        
        <div className="flex items-center gap-1.5">
          <label className={classNames(
            "text-xs",
            isDark ? "text-gray-400" : "text-slate-600"
          )}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.type' })}
          </label>
          <ConfigProvider
            theme={{
              components: {
                Select: {
                  colorBgContainer: isDark ? '#374151' : '#ffffff',
                  colorBorder: isDark ? '#4b5563' : '#d1d5db',
                  colorText: isDark ? '#e5e7eb' : '#374151',
                  colorTextPlaceholder: isDark ? '#9ca3af' : '#6b7280',
                  optionSelectedBg: isDark ? '#2563eb' : '#e0f2fe',
                  optionActiveBg: isDark ? '#4b5563' : '#f3f4f6',
                  colorBgElevated: isDark ? '#374151' : '#ffffff',
                },
              },
            }}
          >
            <Select 
              value={callTypeFilter} 
              onChange={onCallTypeFilterChange} 
              size="small" 
              style={{ width: 90, fontSize: '12px' }}
            >
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              <Option value="call">{intl.formatMessage({ id: 'FunctionCallChainViewer.call' })}</Option>
              <Option value="return">{intl.formatMessage({ id: 'FunctionCallChainViewer.return' })}</Option>
            </Select>
          </ConfigProvider>
        </div>
        
        <div className="flex items-center gap-1.5">
          <label className={classNames(
            "text-xs",
            isDark ? "text-gray-400" : "text-slate-600"
          )}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.thread' })}
          </label>
          <ConfigProvider
            theme={{
              components: {
                Select: {
                  colorBgContainer: isDark ? '#374151' : '#ffffff',
                  colorBorder: isDark ? '#4b5563' : '#d1d5db',
                  colorText: isDark ? '#e5e7eb' : '#374151',
                  colorTextPlaceholder: isDark ? '#9ca3af' : '#6b7280',
                  optionSelectedBg: isDark ? '#2563eb' : '#e0f2fe',
                  optionActiveBg: isDark ? '#4b5563' : '#f3f4f6',
                  colorBgElevated: isDark ? '#374151' : '#ffffff',
                },
              },
            }}
          >
            <Select 
              value={threadFilter} 
              onChange={onThreadFilterChange} 
              size="small" 
              style={{ width: 80, fontSize: '12px' }}
            >
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              {allThreadIds.map((threadId) => (
                <Option key={threadId} value={threadId.toString()}>{threadId}</Option>
              ))}
            </Select>
          </ConfigProvider>
        </div>
        
        <ConfigProvider
          theme={{
            components: {
              Button: {
                colorText: isDark ? '#e5e7eb' : '#374151',
                colorBorder: isDark ? '#4b5563' : '#d1d5db',
                colorBgContainer: isDark ? '#374151' : '#ffffff',
                colorBgContainerHover: isDark ? '#4b5563' : '#f3f4f6',
              },
            },
          }}
        >
          <Button 
            onClick={onResetFilters} 
            size="small" 
            icon={<RotateCcw className="w-3 h-3" />} 
            className="flex items-center gap-1 text-xs"
          >
            {intl.formatMessage({ id: 'FunctionCallChainViewer.reset' })}
          </Button>
        </ConfigProvider>
        
        <ConfigProvider
          theme={{
            components: {
              Button: {
                colorText: isDark ? '#e5e7eb' : '#374151',
                colorBorder: isDark ? '#4b5563' : '#d1d5db',
                colorBgContainer: isDark ? '#374151' : '#ffffff',
                colorBgContainerHover: isDark ? '#4b5563' : '#f3f4f6',
              },
            },
          }}
        >
          <Button size="small" onClick={onViewAggregatedGraph}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAggregatedGraph' })}
          </Button>
        </ConfigProvider>
        
        {(filterText || callTypeFilter !== 'all' || threadFilter !== 'all') && (
          <div className={classNames(
            "text-xs px-1.5 py-0.5 rounded ml-auto",
            isDark ? "text-gray-400 bg-blue-900" : "text-slate-500 bg-blue-50"
          )}>
            {intl.formatMessage({ 
              id: 'FunctionCallChainViewer.filterResult' 
            }, { 
              filteredCount: filteredData.reduce((acc, chain) => acc + chain.calls.length, 0), 
              totalCount: currentData.reduce((acc, chain) => acc + chain.length, 0) 
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterBar;