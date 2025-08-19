import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Table, ConfigProvider } from 'antd';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import EmptyState from './EmptyState';
import { usePollingManager } from '@/stores/usePollingManager';

// Protocol color mapping for better maintainability
const PROTOCOL_COLORS = {
  TCP: 'bg-green-100 text-green-800',
  UDP: 'bg-orange-100 text-orange-800',
  RAW: 'bg-red-100 text-red-800',
  ICMP: 'bg-cyan-100 text-cyan-800',
  default: 'bg-gray-100 text-gray-800',
};

// State color mapping for better maintainability
const STATE_COLORS = {
  ESTABLISHED: 'bg-green-100 text-green-800',
  LISTEN: 'bg-blue-100 text-blue-800',
  TIME_WAIT: 'bg-yellow-100 text-yellow-800',
  SYN_SENT: 'bg-purple-100 text-purple-800',
  SYN_RECV: 'bg-indigo-100 text-indigo-800',
  FIN_WAIT1: 'bg-orange-100 text-orange-800',
  FIN_WAIT2: 'bg-orange-100 text-orange-800',
  CLOSE: 'bg-gray-100 text-gray-800',
  CLOSE_WAIT: 'bg-red-100 text-red-800',
  LAST_ACK: 'bg-red-100 text-red-800',
  CLOSING: 'bg-red-100 text-red-800',
  UNDEFINED: 'bg-slate-100 text-slate-800',
  default: 'bg-gray-100 text-gray-800',
};

// Dark mode protocol colors
const DARK_PROTOCOL_COLORS = {
  TCP: 'bg-green-900/40 text-green-400 border-green-600/30',
  UDP: 'bg-orange-900/40 text-orange-400 border-orange-600/30',
  RAW: 'bg-red-900/40 text-red-400 border-red-600/30',
  ICMP: 'bg-cyan-900/40 text-cyan-400 border-cyan-600/30',
  default: 'bg-gray-800/40 text-gray-300 border-gray-600/30',
};

// Dark mode state colors
const DARK_STATE_COLORS = {
  ESTABLISHED: 'bg-green-900/40 text-green-400 border-green-600/30',
  LISTEN: 'bg-blue-900/40 text-blue-400 border-blue-600/30',
  TIME_WAIT: 'bg-yellow-900/40 text-yellow-400 border-yellow-600/30',
  SYN_SENT: 'bg-purple-900/40 text-purple-400 border-purple-600/30',
  SYN_RECV: 'bg-indigo-900/40 text-indigo-400 border-indigo-600/30',
  FIN_WAIT1: 'bg-orange-900/40 text-orange-400 border-orange-600/30',
  FIN_WAIT2: 'bg-orange-900/40 text-orange-400 border-orange-600/30',
  CLOSE: 'bg-gray-800/40 text-gray-300 border-gray-600/30',
  CLOSE_WAIT: 'bg-red-900/40 text-red-400 border-red-600/30',
  LAST_ACK: 'bg-red-900/40 text-red-400 border-red-600/30',
  CLOSING: 'bg-red-900/40 text-red-400 border-red-600/30',
  UNDEFINED: 'bg-slate-800/40 text-slate-400 border-slate-600/30',
  default: 'bg-gray-800/40 text-gray-300 border-gray-600/30',
};

// Utility function to get protocol color
const getProtocolColor = (protocol: string, isDark: boolean): string => {
  if (isDark) {
    return DARK_PROTOCOL_COLORS[protocol] || DARK_PROTOCOL_COLORS.default;
  }
  return PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS.default;
};

// Utility function to get state color
const getStateColor = (state: string, isDark: boolean): string => {
  const darkColors = DARK_STATE_COLORS;
  const lightColors = STATE_COLORS;
  const colors = isDark ? darkColors : lightColors;
  
  // Check for hex state codes and named states
  if (state.includes('01') || state.includes('ESTABLISHED')) return colors.ESTABLISHED;
  if (state.includes('0A') || state.includes('LISTEN')) return colors.LISTEN;
  if (state.includes('06') || state.includes('TIME_WAIT')) return colors.TIME_WAIT;
  if (state.includes('02') || state.includes('SYN_SENT')) return colors.SYN_SENT;
  if (state.includes('03') || state.includes('SYN_RECV')) return colors.SYN_RECV;
  if (state.includes('04') || state.includes('FIN_WAIT1')) return colors.FIN_WAIT1;
  if (state.includes('05') || state.includes('FIN_WAIT2')) return colors.FIN_WAIT2;
  if (state.includes('07') || state.includes('CLOSE')) return colors.CLOSE;
  if (state.includes('08') || state.includes('CLOSE_WAIT')) return colors.CLOSE_WAIT;
  if (state.includes('09') || state.includes('LAST_ACK')) return colors.LAST_ACK;
  if (state.includes('0B') || state.includes('CLOSING')) return colors.CLOSING;
  if (state.includes('UNDEFINED')) return colors.UNDEFINED;
  return colors.default;
};

interface SocketTableProps {
  contentHeight: number;
  filteredData: any[];
  selectedRowKey: string | number | null;
  onRowClick: (record: any) => void;
}

const SocketTable: React.FC<SocketTableProps> = ({
  contentHeight,
  filteredData,
  selectedRowKey,
  onRowClick
}) => {
  const intl = useIntl();
  const pollingManagerStore = usePollingManager();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const tableRef = useRef<any>(null);
  const [tableHeadHeight, setTableHeadHeight] = useState<number>(0);

  // Get table header height
  useEffect(() => {
    if (!tableRef.current) return;
    const headerHeight = tableRef.current.nativeElement?.querySelector('th')?.offsetHeight ?? 0;
    setTableHeadHeight(headerHeight);
  }, []);

  // Handle row click
  const handleRowClick = useCallback(
    (record: any) => {
      onRowClick(record);
    },
    [onRowClick],
  );

  // Table column definitions - optimized titles and alignment
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
          className={classNames(
            "px-2 py-1 rounded text-xs font-medium",
            {
              'bg-blue-100 text-blue-800': type === 'ipv4' && !isDark,
              'bg-blue-900/40 text-blue-400 border border-blue-600/30': type === 'ipv4' && isDark,
              'bg-purple-100 text-purple-800': type === 'ipv6' && !isDark,
              'bg-purple-900/40 text-purple-400 border border-purple-600/30': type === 'ipv6' && isDark,
            }
          )}
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
        <span className={classNames(
          "px-2 py-1 rounded text-xs font-medium",
          getProtocolColor(protocol, isDark),
          {
            "border": isDark,
          }
        )}>
          {protocol}
        </span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.timestamp' }),
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: number) => (
        <span className={classNames(
          "text-sm",
          {
            "text-gray-600": !isDark,
            "text-gray-300": isDark,
          }
        )}>
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
        <span className={classNames(
          "font-mono text-sm",
          {
            "text-blue-600": !isDark,
            "text-blue-400": isDark,
          }
        )}>
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
        <span className={classNames(
          "font-mono text-sm",
          {
            "text-green-600": !isDark,
            "text-green-400": isDark,
          }
        )}>
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
        <span className={classNames(
          "px-2 py-1 rounded text-xs font-medium",
          getStateColor(state, isDark),
          {
            "border": isDark,
          }
        )}>
          {state}
        </span>
      ),
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <ConfigProvider
        renderEmpty={() => (
          <EmptyState hasSocketData={!!pollingManagerStore.tasks['socket']?.data} />
        )}
        theme={{
          components: {
            Table: {
              headerBg: isDark ? '#1f2937' : '#fafafa',
              headerColor: isDark ? '#e5e7eb' : '#262626',
              colorBgContainer: isDark ? '#111827' : '#ffffff',
              colorText: isDark ? '#e5e7eb' : '#262626',
              colorBorder: isDark ? '#374151' : '#d9d9d9',
              colorBorderSecondary: isDark ? '#374151' : '#f0f0f0',
              headerFilterHoverBg: isDark ? '#374151' : '#f0f0f0',
              rowHoverBg: isDark ? '#374151' : '#f5f5f5',
              headerSortHoverBg: isDark ? '#374151' : '#f0f0f0',
            },
          },
        }}
      >
        <Table
          dataSource={filteredData}
          ref={tableRef}
          style={{ minHeight: contentHeight }}
          columns={columns}
          rowClassName={(record: any) => {
            const classNames = ['transition-all duration-100'];
            if (record.key === selectedRowKey) {
              classNames.push(isDark ? 'bg-blue-600/40' : 'bg-blue-300/60');
            }
            return classNames.join(' ');
          }}
          pagination={false}
          scroll={{ y: contentHeight - tableHeadHeight - 89 }}
          size="small"
          onRow={(record: any) => ({
            onClick: () => handleRowClick(record),
          })}
          sticky
        />
      </ConfigProvider>
    </div>
  );
};

export default SocketTable;