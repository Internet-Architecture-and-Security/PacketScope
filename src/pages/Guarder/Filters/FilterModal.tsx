import React from 'react';
import { Modal, Form, ConfigProvider } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import FilterFormFields from './FilterFormFields';
import type { Filter } from '@/stores/useFiltersStore';

interface FilterModalProps {
  visible: boolean;
  editingFilter: Filter | null;
  form: any;
  currentRuleType: string;
  onOk: () => void;
  onCancel: () => void;
  onRuleTypeChange: (value: string) => void;
}

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  editingFilter,
  form,
  currentRuleType,
  onOk,
  onCancel,
  onRuleTypeChange,
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <ConfigProvider
      theme={{
        components: {
          // Modal: isDark ? {
          //   contentBg: '#1f2937',
          //   headerBg: '#1f2937',
          //   colorText: '#e5e7eb',
          //   colorTextHeading: '#f3f4f6',
          //   colorBorder: '#374151',
          // } : {},
          // Form: isDark ? {
          //   labelColor: '#e5e7eb',
          // } : {},
          // Input: isDark ? {
          //   colorBg: 'transparent',
          //   colorText: '#e5e7eb',
          //   colorBorder: '#374151',
          //   colorTextPlaceholder: '#9ca3af',
          // } : {},
          // Select: isDark ? {
          //   colorBg: 'transparent',
          //   colorText: '#e5e7eb',
          //   colorBorder: '#374151',
          //   colorTextPlaceholder: '#9ca3af',
          //   optionSelectedBg: '#374151',
          // } : {},
          // InputNumber: isDark ? {
          //   colorBg: 'transparent',
          //   colorText: '#e5e7eb',
          //   colorBorder: '#374151',
          // } : {},
          // Checkbox: isDark ? {
          //   colorText: '#e5e7eb',
          // } : {},
          // Alert: isDark ? {
          //   colorInfoBg: '#1e3a8a20',
          //   colorInfoBorder: '#3b82f6',
          //   colorWarningBg: '#92400e20',
          //   colorWarningBorder: '#f59e0b',
          // } : {},
        },
      }}
    >
      <Modal
        title={editingFilter 
          ? intl.formatMessage({ id: 'FiltersManager.editFilter' }) 
          : intl.formatMessage({ id: 'FiltersManager.addFilter' })
        }
        open={visible}
        onOk={onOk}
        onCancel={onCancel}
        width={900}
        forceRender
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <FilterFormFields 
            currentRuleType={currentRuleType}
            onRuleTypeChange={onRuleTypeChange}
          />
        </Form>
      </Modal>
    </ConfigProvider>
  );
};

export default FilterModal;