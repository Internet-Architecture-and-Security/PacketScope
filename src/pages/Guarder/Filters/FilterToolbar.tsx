import React from 'react';
import { Card, Input, Select, Space, Button,ConfigProvider } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useTheme } from '@/stores/useStore';

const { Option } = Select;

interface FilterToolbarProps {
  searchTerm: string;
  filterType: string;
  filterStatus: string;
  filterAction: string;
  onSearchChange: (value: string) => void;
  onFilterTypeChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onFilterActionChange: (value: string) => void;
  onAddFilter: () => void;
  onAiGenerate: () => void;
}

const FilterToolbar: React.FC<FilterToolbarProps> = ({
  searchTerm,
  filterType,
  filterStatus,
  filterAction,
  onSearchChange,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterActionChange,
  onAddFilter,
  onAiGenerate,
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <ConfigProvider theme={{
        token: {
                  colorBorderSecondary: isDark ? '#374151' : undefined,
                  colorBorder: isDark ? '#374151' : "#d9d9d9",
        },
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
      }}>
    <Card className={classNames(
      "mb-6 shadow-sm z-10 relative",
      isDark ? "bg-gray-800 border-gray-700" : "border-white"
    )}>
      <div className="flex flex-col lg:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <Input
            prefix={<SearchOutlined className={classNames(
              isDark ? "text-gray-400" : "text-gray-400"
            )} />}
            placeholder={intl.formatMessage({ id: 'FiltersManager.searchPlaceholder' })}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={classNames(
              "max-w-md border-1",
              isDark 
                ? "placeholder:text-gray-500 text-gray-300 bg-transparent" 
                : "placeholder:text-gray-400"
            )}
            allowClear
          />
          <Space>
            <Select 
              value={filterType} 
              onChange={onFilterTypeChange} 
              style={{ width: 120 }} 
              placeholder={intl.formatMessage({ id: 'FiltersManager.ruleType' })}
              className={isDark ? "dark-select" : ""}
            >
              <Option value="all">{intl.formatMessage({ id: 'FiltersManager.allTypes' })}</Option>
              <Option value="ai">{intl.formatMessage({ id: 'FiltersManager.aiGeneratedRules' })}</Option>
              <Option value="basic">{intl.formatMessage({ id: 'FiltersManager.basicRule' })}</Option>
              <Option value="tcp">{intl.formatMessage({ id: 'FiltersManager.tcpRule' })}</Option>
              <Option value="udp">{intl.formatMessage({ id: 'FiltersManager.udpRule' })}</Option>
              <Option value="icmp">{intl.formatMessage({ id: 'FiltersManager.icmpRule' })}</Option>
            </Select>
            <Select 
              value={filterStatus} 
              onChange={onFilterStatusChange} 
              style={{ width: 120 }} 
              placeholder={intl.formatMessage({ id: 'FiltersManager.ruleStatus' })}
              className={isDark ? "dark-select" : ""}
            >
              <Option value="all">{intl.formatMessage({ id: 'FiltersManager.allStatus' })}</Option>
              <Option value="enabled">{intl.formatMessage({ id: 'FiltersManager.enabled' })}</Option>
              <Option value="disabled">{intl.formatMessage({ id: 'FiltersManager.disabled' })}</Option>
            </Select>
            <Select 
              value={filterAction} 
              onChange={onFilterActionChange} 
              style={{ width: 120 }} 
              placeholder={intl.formatMessage({ id: 'FiltersManager.action' })}
              className={isDark ? "dark-select" : ""}
            >
              <Option value="all">{intl.formatMessage({ id: 'FiltersManager.allActions' })}</Option>
              <Option value="drop">{intl.formatMessage({ id: 'FiltersManager.actionDrop' })}</Option>
              <Option value="allow">{intl.formatMessage({ id: 'FiltersManager.actionAllow' })}</Option>
            </Select>
          </Space>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddFilter}>
            {intl.formatMessage({ id: 'FiltersManager.addFilter' })}
          </Button>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={onAiGenerate}
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
          >
            {intl.formatMessage({ id: 'FiltersManager.aiGenerate' })}
          </Button>
        </Space>
      </div>
    </Card>
    </ConfigProvider>
  );
};

export default FilterToolbar;