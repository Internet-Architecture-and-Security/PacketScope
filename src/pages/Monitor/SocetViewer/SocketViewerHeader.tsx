import React from 'react';
import { useIntl } from 'react-intl';
import { Input, Select, Button } from 'antd';
import { SearchOutlined, ClearOutlined, FilterOutlined } from '@ant-design/icons';
import { usePollingManager } from '@/stores/usePollingManager';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import { FilterState } from './constants'; // 假设 constants.ts 在同一目录下

const { Option } = Select;

// 内部展示组件：用于显示单个协议的统计信息
interface ProtocolStatsProps {
  label: string;
  count: number;
  colorClass: string;
}

const ProtocolStats: React.FC<ProtocolStatsProps> = ({ label, count, colorClass }) => (
  <div className={`${colorClass} rounded-lg px-2.5 py-1.5 border shadow-sm text-center min-w-0`}>
    <div className="text-sm font-bold leading-tight">{count}</div>
    <div className="text-xs font-medium">{label}</div>
  </div>
);

// 定义 Header 组件需要的 props
interface SocketViewerHeaderProps {
  summaryInfo: any;
  filteredCount: number;
  totalCount: number;
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onResetFilters: () => void;
  uniqueStates: string[];
}

const SocketViewerHeader: React.FC<SocketViewerHeaderProps> = ({
  summaryInfo,
  filteredCount,
  totalCount,
  filters,
  onFilterChange,
  onResetFilters,
  uniqueStates,
}) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const pollingManagerStore = usePollingManager();
  const intl = useIntl();

  // 检查是否有任何过滤器处于激活状态
  const hasActiveFilters =
    filters.searchText ||
    filters.protocol !== 'all' ||
    filters.type !== 'all' ||
    filters.state !== 'all';

  // 根据主题获取统计信息的颜色样式
  const getStatsColors = (type: string) => {
    const baseColors = {
      tcp: isDark
        ? 'bg-gradient-to-br from-emerald-900/40 to-green-900/40 border-emerald-700/50 text-emerald-300'
        : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100/60 text-emerald-600',
      udp: isDark
        ? 'bg-gradient-to-br from-orange-900/40 to-amber-900/40 border-orange-700/50 text-orange-300'
        : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100/60 text-orange-600',
      raw: isDark
        ? 'bg-gradient-to-br from-red-900/40 to-rose-900/40 border-red-700/50 text-red-300'
        : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100/60 text-red-600',
      icmp: isDark
        ? 'bg-gradient-to-br from-cyan-900/40 to-teal-900/40 border-cyan-700/50 text-cyan-300'
        : 'bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-100/60 text-cyan-600',
      count: isDark
        ? 'bg-gradient-to-br from-violet-900/40 via-purple-900/40 to-indigo-900/40 border-violet-700/50'
        : 'bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 border-violet-100/60',
      interface: isDark
        ? 'bg-gradient-to-br from-green-900/40 via-green-900/40 to-green-900/40 border-green-700/50'
        : 'bg-gradient-to-br from-green-50 via-green-50 to-green-50 border-green-100/60',
    };
    return baseColors[type];
  };

  return (
    <div
      className={classNames(
        'border-b backdrop-blur-sm',
        isDark ? 'bg-[#141414] border-gray-600/50' : 'bg-white border-gray-200/80',
      )}
      style={{ height: '90px' }}
    >
      <div className="px-6 py-3 h-full relative">
        {/* 第一行: 标题和统计信息 */}
        <div className="flex items-center justify-between">
          {/* 左侧: 标题区域 */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={classNames(
                  'w-10 h-10 rounded-xl flex items-center justify-center shadow-lg',
                  isDark
                    ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700'
                    : 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
                )}
              >
                <div className="w-4 h-4 bg-white rounded-full opacity-90"></div>
                {pollingManagerStore.tasks['socket']?.isPolling && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
              </div>
            </div>
            <div>
              <h1
                className={classNames(
                  'text-lg font-bold bg-clip-text text-transparent leading-tight',
                  isDark
                    ? 'bg-gradient-to-r from-gray-200 to-gray-400'
                    : 'bg-gradient-to-r from-gray-800 to-gray-600',
                )}
              >
                {intl.formatMessage({ id: 'SocketViewer.title' })}
              </h1>
              <p className={classNames('text-xs font-medium tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {intl.formatMessage({ id: 'SocketViewer.subtitle' })}
              </p>
            </div>
          </div>

          {/* 右侧: 统计和状态 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* 协议统计网格 */}
            <div className="grid grid-cols-4 gap-1.5">
              <ProtocolStats
                label="TCP"
                count={(summaryInfo.TCPv4 || 0) + (summaryInfo.TCPv6 || 0)}
                colorClass={getStatsColors('tcp')}
              />
              <ProtocolStats
                label="UDP"
                count={(summaryInfo.UDPv4 || 0) + (summaryInfo.UDPv6 || 0)}
                colorClass={getStatsColors('udp')}
              />
              <ProtocolStats
                label="RAW"
                count={(summaryInfo.RAWv4 || 0) + (summaryInfo.RAWv6 || 0)}
                colorClass={getStatsColors('raw')}
              />
              <ProtocolStats
                label="ICMP"
                count={(summaryInfo.ICMPv4 || 0) + (summaryInfo.ICMPv6 || 0)}
                colorClass={getStatsColors('icmp')}
              />
            </div>

            {/* 条目数量统计 */}
            <div className={`${getStatsColors('count')} rounded-lg px-3 py-2 border shadow-sm`}>
              <div className="text-center relative min-w-[80px]">
                <div className="flex items-baseline justify-center gap-0.5 relative top-2 whitespace-nowrap">
                  <span
                    className={classNames(
                      'text-lg font-bold bg-clip-text text-transparent',
                      isDark
                        ? 'bg-gradient-to-r from-violet-300 to-purple-300'
                        : 'bg-gradient-to-r from-violet-600 to-purple-600',
                    )}
                  >
                    {filteredCount}
                  </span>
                  <span className={classNames('text-xs font-medium', isDark ? 'text-violet-400' : 'text-violet-500')}>
                    /{totalCount}
                  </span>
                </div>
                <div
                  className={classNames(
                    'absolute text-xs font-semibold left-[-5px] top-[-6px]',
                    isDark ? 'text-violet-400/60' : 'text-violet-700/40',
                  )}
                >
                  {intl.formatMessage({ id: 'SocketViewer.entryCount' })}
                </div>
              </div>
            </div>

            {/* 网络接口 */}
            <div className={`${getStatsColors('interface')} rounded-lg px-3 py-2 border shadow-sm`}>
              <div className="text-center relative min-w-[80px]">
                <div className="flex items-baseline justify-center gap-0.5 relative top-2">
                  <span
                    className={classNames(
                      'text-lg font-bold bg-clip-text whitespace-nowrap text-transparent',
                      isDark
                        ? 'bg-gradient-to-r from-green-300 to-green-500'
                        : 'bg-gradient-to-r from-green-600 to-green-800',
                    )}
                  >
                    {summaryInfo.interface ?? 'N/A'}
                  </span>
                </div>
                <div
                  className={classNames(
                    'absolute text-xs font-semibold left-[-5px] top-[-6px]',
                    isDark ? 'text-green-400/60' : 'text-green-800/40',
                  )}
                >
                  {intl.formatMessage({ id: 'SocketViewer.interface' })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 第二行: 搜索和过滤工具栏 */}
        <div className="flex items-center absolute left-0 w-full">
          <div
            className={`flex items-center gap-2 scale-85 origin-left transition-all duration-300 ease-in-out ${
              hasActiveFilters ? 'opacity-100 translate-y-0' : 'opacity-30 hover:opacity-100 translate-y-0'
            }`}
          >
            {/* 搜索区域 */}
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
              <SearchOutlined className={classNames('text-sm', isDark ? 'text-blue-400' : 'text-blue-500')} />
              <Input
                placeholder={intl.formatMessage({ id: 'SocketViewer.search.placeholder' })}
                value={filters.searchText}
                onChange={(e) => onFilterChange('searchText', e.target.value)}
                allowClear
                size="small"
                bordered={false}
                style={{ width: 200 }}
                className={classNames(
                  'border-0',
                  isDark
                    ? 'placeholder:text-gray-500 text-gray-300 bg-transparent'
                    : 'placeholder:text-gray-400',
                )}
              />
            </div>

            {/* 过滤器组 */}
            <div className="flex items-center gap-3">
              <Select
                value={filters.protocol}
                onChange={(value) => onFilterChange('protocol', value)}
                size="small"
                bordered={false}
                style={{ width: 120 }}
                className="filter-select"
              >
                <Option value="all">{intl.formatMessage({ id: 'SocketViewer.filter.protocol.all' })}</Option>
                <Option value="TCP">TCP</Option>
                <Option value="UDP">UDP</Option>
                <Option value="RAW">RAW</Option>
                <Option value="ICMP">ICMP</Option>
              </Select>

              <Select
                value={filters.type}
                onChange={(value) => onFilterChange('type', value)}
                size="small"
                bordered={false}
                style={{ width: 110 }}
                className="filter-select"
              >
                <Option value="all">{intl.formatMessage({ id: 'SocketViewer.filter.type.all' })}</Option>
                <Option value="ipv4">IPv4</Option>
                <Option value="ipv6">IPv6</Option>
              </Select>

              <Select
                value={filters.state}
                onChange={(value) => onFilterChange('state', value)}
                size="small"
                bordered={false}
                style={{ width: 180 }}
                showSearch
                optionFilterProp="children"
                className="filter-select"
              >
                <Option value="all">{intl.formatMessage({ id: 'SocketViewer.filter.state.all' })}</Option>
                {uniqueStates.map((state) => (
                  <Option key={state} value={state}>
                    {state}
                  </Option>
                ))}
              </Select>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1.5">
              <Button
                icon={<ClearOutlined />}
                onClick={onResetFilters}
                size="small"
                type="text"
                disabled={!hasActiveFilters}
                className={classNames(
                  'rounded-lg transition-all duration-200',
                  hasActiveFilters
                    ? isDark
                      ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                      : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                    : isDark
                      ? 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-400'
                      : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600',
                )}
              >
                {intl.formatMessage({ id: 'SocketViewer.filter.reset' })}
              </Button>
              {hasActiveFilters && (
                <div
                  className={classNames(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
                    isDark
                      ? 'bg-blue-900/50 text-blue-300 border border-blue-800/50'
                      : 'bg-blue-500 text-white',
                  )}
                >
                  <FilterOutlined className="text-xs" />
                  {intl.formatMessage({ id: 'SocketViewer.filter.active' })}
                </div>
              )}
            </div>
          </div>

          {/* 实时状态指示器 */}
          <div
            className={classNames(
              'text-xs w-[130px] ml-3 absolute right-2 scale-85 origin-right',
              isDark ? 'text-gray-400' : 'text-gray-500',
            )}
          >
            {intl.formatMessage({ id: 'SocketViewer.updateTime' })}: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocketViewerHeader;