import React from 'react';
import { Card, Table, Button, Space, Tag, Switch, Tooltip, Popconfirm } from 'antd';
import type { TableProps } from 'antd';
import {
  RobotOutlined,
  EditOutlined,
  DeleteOutlined,
  FilterOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useIntl } from 'react-intl';
import classNames from 'classnames';
import { useTheme } from '@/stores/useStore';
import type { Filter } from '@/stores/useFiltersStore';

interface FilterTableProps {
  filters: Filter[];
  onEdit: (filter: Filter) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number) => void;
  onAdd: () => void;
}

const FilterTable: React.FC<FilterTableProps> = ({
  filters,
  onEdit,
  onDelete,
  onToggle,
  onAdd,
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const filterColumns: TableProps<Filter>['columns'] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      sorter: (a, b) => b.id - a.id,
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.ruleType' }),
      dataIndex: 'rule_type',
      key: 'rule_type',
      render: (type: string, record: Filter) => (
        <Space>
          <Tag color={type === 'basic' ? 'blue' : type === 'tcp' ? 'green' : type === 'udp' ? 'orange' : 'purple'}>
            {type.toUpperCase()}
          </Tag>
          {record.ai_generated && (
            <Tag color="gold" icon={<RobotOutlined />}>
              AI
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.sourceIp' }),
      dataIndex: 'src_ip',
      key: 'src_ip',
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.protocol' }),
      dataIndex: 'protocol',
      key: 'protocol',
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.action' }),
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => (
        <Tag color={action === 'drop' ? 'red' : 'green'}>
          {action === 'drop' 
            ? intl.formatMessage({ id: 'FiltersManager.actionDrop' })
            : intl.formatMessage({ id: 'FiltersManager.actionAllow' })
          }
        </Tag>
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.status' }),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: Filter) => (
        <Switch checked={enabled} onChange={() => onToggle(record.id)} size="small" />
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.comment' }),
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string, record: Filter) => (
        <div>
          <div className={classNames(
            isDark ? "text-gray-300" : ""
          )}>
            {comment}
          </div>
          {record.ai_generated && record.ai_confidence && (
            <div style={{ fontSize: '12px', marginTop: '4px' }} className={classNames(
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              {intl.formatMessage(
                { id: 'FiltersManager.aiConfidence' },
                { confidence: (record.ai_confidence * 100).toFixed(1) }
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: intl.formatMessage({ id: 'FiltersManager.operations' }),
      key: 'actions',
      render: (_, record: Filter) => (
        <Space>
          <Tooltip title={intl.formatMessage({ id: 'FiltersManager.edit' })}>
            <Button type="text" icon={<EditOutlined className="w-4 h-4" />} onClick={() => onEdit(record)} />
          </Tooltip>
          <Popconfirm 
            title={intl.formatMessage({ id: 'FiltersManager.confirmDelete' })} 
            onConfirm={() => onDelete(record.id)} 
            okText={intl.formatMessage({ id: 'FiltersManager.confirm' })} 
            cancelText={intl.formatMessage({ id: 'FiltersManager.cancel' })}
          >
            <Tooltip title={intl.formatMessage({ id: 'FiltersManager.delete' })}>
              <Button type="text" danger icon={<DeleteOutlined className="w-4 h-4" />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card className={classNames(
      "shadow-sm",
      isDark ? "bg-gray-800 border-gray-700" : "border-white"
    )}>
      <Table
        columns={filterColumns}
        dataSource={filters}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => intl.formatMessage({ id: 'FiltersManager.totalRulesCount' }, { total }),
        }}
        size="small"
        onChange={(pagination, filters, sorter) => {
          console.log('Table parameters:', { pagination, filters, sorter });
        }}
        locale={{
          emptyText: (
            <div className="text-center py-12">
              <FilterOutlined className={classNames(
                "text-5xl mx-auto mb-4",
                isDark ? "text-gray-500" : "text-gray-300"
              )} />
              <h3 className={classNames(
                "text-lg font-medium mb-2",
                isDark ? "text-gray-300" : "text-gray-900"
              )}>
                {intl.formatMessage({ id: 'FiltersManager.noFiltersFound' })}
              </h3>
              <p className={classNames(
                "mb-4",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                {intl.formatMessage({ id: 'FiltersManager.adjustSearchOrCreate' })}
              </p>
              <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                {intl.formatMessage({ id: 'FiltersManager.addFilter' })}
              </Button>
            </div>
          ),
        }}
      />
    </Card>
  );
};

export default FilterTable;