import React, { useEffect } from 'react';
import { Form, ConfigProvider, App } from 'antd';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useFilters } from '@/hooks/useFilters';
import { useModals } from '@/stores/useStore';
import { useEdit } from '@/stores/useStore';
import { useTheme } from '@/stores/useStore';
import { Funnel } from 'lucide-react';

import FilterStatistics from './FilterStatistics';
import FilterToolbar from './FilterToolbar';
import FilterTable from './FilterTable';
import FilterModal from './FilterModal';

const Filters: React.FC = () => {
  const intl = useIntl();
  const { message } = App.useApp();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const { filters, fetchFilters, addFilter, updateFilter, deleteFilter, toggleFilter } = useFilters();
  const { filterModalVisible, setFilterModalVisible, setAiGenerateModalVisible } = useModals();
  const { editingFilter, setEditingFilter } = useEdit();
  const [formRef] = Form.useForm();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterAction, setFilterAction] = React.useState('all');
  const [currentRuleType, setCurrentRuleType] = React.useState('basic');

  // 过滤和搜索逻辑
  const filteredFilters = React.useMemo(() => {
    return filters.filter((filter) => {
      // 搜索条件匹配
      const matchesSearch =
        searchTerm === '' ||
        (filter.src_ip && filter.src_ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (filter.dst_ip && filter.dst_ip.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (filter.comment && filter.comment.toLowerCase().includes(searchTerm.toLowerCase()));

      // 类型过滤
      const matchesType = filterType === 'all' || (filterType === 'ai' ? filter.ai_generated : filter.rule_type === filterType);

      // 状态过滤
      const matchesStatus =
        filterStatus === 'all' || (filterStatus === 'enabled' && filter.enabled) || (filterStatus === 'disabled' && !filter.enabled);

      // 动作过滤
      const matchesAction = filterAction === 'all' || filter.action === filterAction;

      return matchesSearch && matchesType && matchesStatus && matchesAction;
    });
  }, [filters, searchTerm, filterType, filterStatus, filterAction]);

  useEffect(() => {
    fetchFilters();
  }, []);

  const editFilter = (filter: any) => {
    setEditingFilter(filter);
    setCurrentRuleType(filter.rule_type);
    formRef.setFieldsValue(filter);
    setFilterModalVisible(true);
  };

  const addNewFilter = () => {
    setEditingFilter(null);
    setCurrentRuleType('basic');
    formRef.resetFields();
    formRef.setFieldsValue({
      rule_type: 'basic',
      action: 'allow',
      enabled: true,
      protocol: 'tcp',
    });
    setFilterModalVisible(true);
  };

  const handleModalOk = () => {
    formRef.validateFields().then((values) => {
      // 处理特殊字段
      const processedValues = {
        ...values,
        src_ip: values.src_ip || '0.0.0.0',
        dst_ip: values.dst_ip || '0.0.0.0',
        src_port: values.src_port || 0,
        dst_port: values.dst_port || 0,
        icmp_type: values.icmp_type || 255,
        icmp_code: values.icmp_code || 255,
        tcp_flags: values.tcp_flags || 0,
        tcp_flags_mask: values.tcp_flags_mask || 0,
        inner_src_ip: values.inner_src_ip || '0.0.0.0',
        inner_dst_ip: values.inner_dst_ip || '0.0.0.0',
        inner_protocol: values.inner_protocol || 0,
      };
      if (editingFilter) {
        updateFilter(editingFilter.id, values);
      } else {
        const newFilter = {
          id: Math.max(...filters.map((f) => f.id), 0) + 1,
          ...values,
          ai_generated: false,
        };
        addFilter(newFilter);
      }
      setFilterModalVisible(false);
    });
  };

  const handleRuleTypeChange = (value: string) => {
    setCurrentRuleType(value);
    if (value === 'basic') {
      formRef.setFieldsValue({
        tcp_flags: undefined,
        tcp_flags_mask: undefined,
        icmp_type: undefined,
        icmp_code: undefined,
        inner_src_ip: undefined,
        inner_dst_ip: undefined,
        inner_protocol: undefined,
      });
    }
  };

  return (
    <ConfigProvider
      theme={{
        components: {
        },
      }}
    >
      <div className={classNames(
        isDark ? "bg-gray-900 text-gray-100" : ""
      )}>
        <div className="mx-auto">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Funnel className="text-white text-3xl" color="#fff" size={30} />
              </div>
              <div>
                <h1 className={classNames(
                  "text-2xl font-bold",
                  isDark ? "text-gray-100" : "text-gray-900"
                )}>
                  {intl.formatMessage({ id: 'FiltersManager.title' })}
                </h1>
                <p className={classNames(
                  isDark ? "text-gray-300" : "text-gray-600"
                )}>
                  {intl.formatMessage({ id: 'FiltersManager.subtitle' })}
                </p>
              </div>
            </div>
          </header>

          {/* 统计卡片 */}
          <FilterStatistics filters={filters} />

          {/* 工具栏 */}
          <FilterToolbar
            searchTerm={searchTerm}
            filterType={filterType}
            filterStatus={filterStatus}
            filterAction={filterAction}
            onSearchChange={setSearchTerm}
            onFilterTypeChange={setFilterType}
            onFilterStatusChange={setFilterStatus}
            onFilterActionChange={setFilterAction}
            onAddFilter={addNewFilter}
            onAiGenerate={() => setAiGenerateModalVisible(true)}
          />

          {/* 过滤器列表 */}
          <FilterTable
            filters={filteredFilters}
            onEdit={editFilter}
            onDelete={deleteFilter}
            onToggle={toggleFilter}
            onAdd={addNewFilter}
          />

          {/* 添加/编辑模态框 */}
          <FilterModal
            visible={filterModalVisible}
            editingFilter={editingFilter}
            form={formRef}
            currentRuleType={currentRuleType}
            onOk={handleModalOk}
            onCancel={() => setFilterModalVisible(false)}
            onRuleTypeChange={handleRuleTypeChange}
          />
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Filters;