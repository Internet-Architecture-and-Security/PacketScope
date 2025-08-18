import React from 'react';
import { Form, Switch } from 'antd';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

export const DataSwitch = ({ name, label }: { name: string; label: string }) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  return (
    <Form.Item name={name} valuePropName="checked" noStyle>
      <label className="inline-flex items-center cursor-pointer gap-3 py-1">
        <Switch size="small" />
        <span className={classNames(isDark ? "text-gray-300" : "text-gray-900")}>{label}</span>
      </label>
    </Form.Item>
  );
};

export default DataSwitch;