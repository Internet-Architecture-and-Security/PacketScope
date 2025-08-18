// /components/SocketViewer/SocketTable.tsx

import React, { useRef, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Table, ConfigProvider, Empty } from 'antd';
import { useTheme } from '@/stores/useStore';
import { usePollingManager } from '@/stores/usePollingManager';
import { getStateColor, getProtocolColor } from './constants';
import SocketDataEmptyState from './SocketDataEmptyState';

interface SocketTableProps {
  data: any[];
  onRowClick: (record: any) => void;
  selectedRowKey: string | number | null;
  contentHeight: number;
}

const SocketTable: React.FC<SocketTableProps> = ({ data, onRowClick, selectedRowKey, contentHeight }) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const pollingManagerStore = usePollingManager();
  const intl = useIntl();
  const tableRef = useRef<any>(null);
  const [tableHeadHeight, setTableHeadHeight] = useState<number>(0);

  // Table column definitions
  const columns = [
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.id' }),
      dataIndex: 'id',
      key: 'id',
      width: 30,
      align: 'center' as const,
      sorter: (a: any, b: any) => a.id - b.id,
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.type' }),
      dataIndex: 'type',
      key: 'type',
      width: 60,
      align: 'center' as const,
      render: (type: string) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            type === 'ipv4' 
              ? isDark 
                ? 'bg-blue-900/50 text-blue-300 border border-blue-800/50' 
                : 'bg-blue-100 text-blue-800'
              : isDark 
                ? 'bg-purple-900/50 text-purple-300 border border-purple-800/50' 
                : 'bg-purple-100 text-purple-800'
          }`}
        >
          {type.toUpperCase()}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.protocol' }),
      dataIndex: 'protocol',
      key: 'protocol',
      width: 60,
      align: 'center' as const,
      render: (protocol: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getProtocolColor(protocol, isDark)}`}>
          {protocol}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.timestamp' }),
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: number) => (
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {new Date(ts * 1000).toLocaleString()}
        </span>
      ),
      width: 180,
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.src' }),
      dataIndex: 'src',
      key: 'src',
      width: 220,
      sorter: (a: any, b: any) => a.src.localeCompare(b.src),
      render: (src: string) => (
        <span className={`font-mono text-sm ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
          {src}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.dist' }),
      dataIndex: 'dist',
      key: 'dist',
      width: 220,
      sorter: (a: any, b: any) => a.dist.localeCompare(b.dist),
      render: (dist: string) => (
        <span className={`font-mono text-sm ${isDark ? 'text-green-400' : 'text-green-600'}`}>
          {dist}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.state' }),
      dataIndex: 'state',
      key: 'state',
      width: 120,
      sorter: (a: any, b: any) => a.state.localeCompare(b.state),
      render: (state: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStateColor(state, isDark)}`}>
          {state}
        </span>
      ),
    },
  ];
  // Get table header height
  useEffect(() => {
    if (!tableRef.current) return;
    const headerHeight = tableRef.current.nativeElement?.querySelector('th')?.offsetHeight ?? 0;
    setTableHeadHeight(headerHeight);
  }, []);

  return (
    <div className="h-full overflow-auto">
      <ConfigProvider
        theme={{ components: { Table: { headerBorderRadius: 0 } } }}
        renderEmpty={() =>
          pollingManagerStore.tasks['socket']?.data ? (
            <Empty className="py-16"></Empty>
          ) : (
            <SocketDataEmptyState />
          )
        }
      >
        <Table
          dataSource={data}
          ref={tableRef}
          style={{ minHeight: contentHeight }}
          columns={columns}
          rowClassName={(record: any) => {
            const classes = ['transition-all duration-100'];
            if (record.key === selectedRowKey) {
              classes.push(isDark ? 'bg-blue-900/40' : 'bg-blue-300/60');
            }
            return classes.join(' ');
          }}
          pagination={false}
          scroll={{ y: contentHeight - tableHeadHeight - 89 }}
          size="small"
          onRow={(record: any) => ({
            onClick: () => onRowClick(record),
          })}
          sticky
        />
      </ConfigProvider>
    </div>
  );
};

export default SocketTable;