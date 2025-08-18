import React from 'react';
import { Table, ConfigProvider } from 'antd';
import { Search } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface Connection {
  id: number;
  key: string;
  info: string;
}

interface ConnectionsTableProps {
  filteredConnections: Connection[];
  tableHeight: number;
  tableRef: React.RefObject<any>;
}

const ConnectionsTable: React.FC<ConnectionsTableProps> = ({
  filteredConnections,
  tableHeight,
  tableRef,
}) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  const columns = [
    {
      title: intl.formatMessage({ id: 'ConnectionsMonitor.connectionInfo' }),
      key: 'key',
      width: 200,
      dataIndex: 'key',
      render: (key: string) => (
        <div className={classNames(
          "text-sm font-medium",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>{key}</div>
      ),
    },
    {
      title: intl.formatMessage({ id: 'ConnectionsMonitor.detailInfo' }),
      key: 'info',
      dataIndex: 'info',
      render: (info: string) => (
        <div className={classNames(
          "text-sm font-medium",
          isDark ? "text-gray-300" : "text-gray-600"
        )}>{info}</div>
      ),
    },
  ];

  return (
    <section className={classNames(
      "rounded-xl border shadow-sm overflow-hidden",
      isDark ? "bg-gray-800 border-gray-700" : "bg-white border-white"
    )}>
      <header className={classNames(
        "px-6 py-4 border-b flex items-center justify-between",
        isDark ? "border-gray-700" : "border-gray-200"
      )}>
        <h3 className={classNames(
          "text-lg font-semibold",
          isDark ? "text-white" : "text-gray-900"
        )}>
          {intl.formatMessage({ id: 'ConnectionsMonitor.connectionDetails' })}
        </h3>
        <p className={classNames(
          "text-sm",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          {intl.formatMessage(
            { id: 'ConnectionsMonitor.totalConnections' },
            { count: filteredConnections.length }
          )}
        </p>
      </header>
      <ConfigProvider
        theme={{
          components: {
            Table: {
              headerBorderRadius:0,
              colorBgContainer: isDark ? '#1f2937' : '#ffffff',
              colorText: isDark ? '#d1d5db' : '#000000',
              headerBg: isDark ? '#374151' : '#fafafa',
              headerColor: isDark ? '#d1d5db' : '#000000',
              rowHoverBg: isDark ? '#374151' : '#f5f5f5',
            },
          },
        }}
      >
        <Table
          className="pb-[2px]"
          columns={columns}
          dataSource={filteredConnections}
          pagination={false}
          rowKey="id"
          ref={tableRef}
          scroll={{ y: tableHeight }}
          virtual
          locale={{
            emptyText: (
              <div className={classNames(
                "text-center py-12",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                <Search className={classNames(
                  "w-12 h-12 mx-auto mb-2",
                  isDark ? "text-gray-500" : "text-gray-400"
                )} />
                <p className="text-lg font-medium">
                  {intl.formatMessage({ id: 'ConnectionsMonitor.noMatchingConnections' })}
                </p>
                <p>
                  {intl.formatMessage({ id: 'ConnectionsMonitor.adjustSearchCriteria' })}
                </p>
              </div>
            ),
          }}
        />
      </ConfigProvider>
    </section>
  );
};

export default ConnectionsTable;