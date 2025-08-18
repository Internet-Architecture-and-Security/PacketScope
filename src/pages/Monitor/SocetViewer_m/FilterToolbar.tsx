import React, { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Input, Select, Button } from 'antd';
import { SearchOutlined, ClearOutlined, FilterOutlined } from '@ant-design/icons';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Option } = Select;

interface FilterState {
  searchText: string;
  protocol: string;
  type: string;
  state: string;
}

interface FilterToolbarProps {
  filters: FilterState;
  uniqueStates: string[];
  hasActiveFilters: boolean;
  updateFilter: (key: keyof FilterState, value: string) => void;
  handleResetFilters: () => void;
}

const FilterToolbar: React.FC<FilterToolbarProps> = ({
  filters,
  uniqueStates,
  hasActiveFilters,
  updateFilter,
  handleResetFilters
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <div className="flex items-center absolute left-0 w-full">
      <div
        className={`flex items-center gap-2 scale-85 origin-left transition-all duration-300 ease-in-out ${
          hasActiveFilters ? 'opacity-100 translate-y-0' : 'opacity-30 hover:opacity-100 translate-y-0'
        }`}
      >
        {/* Search area */}
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
          <SearchOutlined className={classNames(
            "text-sm",
            isDark ? "text-blue-400" : "text-blue-500"
          )} />
          <Input
            placeholder={intl.formatMessage({ id: 'SocketViewer.search.placeholder' })}
            value={filters.searchText}
            onChange={(e) => updateFilter('searchText', e.target.value)}
            allowClear
            size="small"
            bordered={false}
            style={{ width: 200 }}
            className={classNames(
              "border-0",
              isDark 
                ? "placeholder:text-gray-500 text-gray-300 bg-transparent" 
                : "placeholder:text-gray-400"
            )}
          />
        </div>

        {/* Filter group */}
        <div className="flex items-center gap-3">
          <Select
            value={filters.protocol}
            onChange={(value) => updateFilter('protocol', value)}
            size="small"
            bordered={false}
            style={{ width: 120 }}
            className={classNames(
              "filter-select",
              isDark && "[&_.ant-select-selector]:bg-transparent [&_.ant-select-selector]:text-gray-300 [&_.ant-select-arrow]:text-gray-400"
            )}
            dropdownClassName={isDark ? "bg-gray-800 [&_.ant-select-item]:text-gray-300 [&_.ant-select-item-option-selected]:bg-blue-600" : ""}
          >
            <Option value="all">{intl.formatMessage({ id: 'SocketViewer.filter.protocol.all' })}</Option>
            <Option value="TCP">TCP</Option>
            <Option value="UDP">UDP</Option>
            <Option value="RAW">RAW</Option>
            <Option value="ICMP">ICMP</Option>
          </Select>

          <Select
            value={filters.type}
            onChange={(value) => updateFilter('type', value)}
            size="small"
            bordered={false}
            style={{ width: 110 }}
            className={classNames(
              "filter-select",
              isDark && "[&_.ant-select-selector]:bg-transparent [&_.ant-select-selector]:text-gray-300 [&_.ant-select-arrow]:text-gray-400"
            )}
            dropdownClassName={isDark ? "bg-gray-800 [&_.ant-select-item]:text-gray-300 [&_.ant-select-item-option-selected]:bg-blue-600" : ""}
          >
            <Option value="all">{intl.formatMessage({ id: 'SocketViewer.filter.type.all' })}</Option>
            <Option value="ipv4">IPv4</Option>
            <Option value="ipv6">IPv6</Option>
          </Select>

          <Select
            value={filters.state}
            onChange={(value) => updateFilter('state', value)}
            size="small"
            bordered={false}
            style={{ width: 180 }}
            showSearch
            optionFilterProp="children"
            className={classNames(
              "filter-select",
              isDark && "[&_.ant-select-selector]:bg-transparent [&_.ant-select-selector]:text-gray-300 [&_.ant-select-arrow]:text-gray-400"
            )}
            dropdownClassName={isDark ? "bg-gray-800 [&_.ant-select-item]:text-gray-300 [&_.ant-select-item-option-selected]:bg-blue-600" : ""}
          >
            <Option value="all">{intl.formatMessage({ id: 'SocketViewer.filter.state.all' })}</Option>
            {uniqueStates.map((state) => (
              <Option key={state} value={state}>
                {state}
              </Option>
            ))}
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            icon={<ClearOutlined />}
            onClick={handleResetFilters}
            size="small"
            type="text"
            disabled={!hasActiveFilters}
            className={classNames(
              "rounded-lg transition-all duration-200",
              hasActiveFilters
                ? isDark 
                  ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                  : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                : isDark
                  ? 'text-gray-600 hover:bg-gray-800 hover:text-gray-500'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            )}
          >
            {intl.formatMessage({ id: 'SocketViewer.filter.reset' })}
          </Button>
          {hasActiveFilters && (
            <div className={classNames(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
              isDark 
                ? "bg-blue-600 text-blue-100" 
                : "bg-blue-500 text-white"
            )}>
              <FilterOutlined className="text-xs" />
              {intl.formatMessage({ id: 'SocketViewer.filter.active' })}
            </div>
          )}
        </div>
      </div>

      {/* Real-time status indicator */}
      <div className={classNames(
        "text-xs w-[130px] ml-3 absolute right-2 scale-85 origin-right",
        isDark ? "text-gray-400" : "text-gray-500"
      )}>
        {intl.formatMessage({ id: 'SocketViewer.updateTime' })}: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default FilterToolbar;