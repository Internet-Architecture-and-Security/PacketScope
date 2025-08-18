import React, { useEffect, useRef } from 'react';
import { Table, Tooltip, Spin } from 'antd';
import { useIntl } from 'react-intl';
import {
  CloseCircleOutlined,
  LoadingOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

interface TraceResult {
  ip: string;
  latency: string;
  packet_loss?: string;
  asn?: string;
  location?: string;
}

interface TraceTableProps {
  traceResults: TraceResult[];
  loading: boolean;
}

const TraceTable: React.FC<TraceTableProps> = ({ traceResults, loading }) => {
  const intl = useIntl();
  const tableRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  useEffect(() => {
    if (containerRef.current) {
      const tableBody = containerRef.current.querySelector('.ant-table-body');
      if (tableBody) {
        tableBody.scrollTop = tableBody.scrollHeight;
      }
    }
  }, [traceResults]);

  const columns = [
    {
      title: <div className={classNames(
        'font-medium text-xs',
        isDark ? 'text-gray-300' : 'text-gray-200'
      )}>{intl.formatMessage({ id: 'TraceResultsPanel.ttl' })}</div>,
      dataIndex: 'ttl',
      key: 'ttl',
      width: 65,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => <span className={classNames(
        'font-mono text-xs',
        isDark ? 'text-gray-400' : 'text-gray-300'
      )}>{index + 1}</span>,
    },
    {
      title: <div className={classNames(
        'font-medium text-xs',
        isDark ? 'text-gray-300' : 'text-gray-200'
      )}>{intl.formatMessage({ id: 'TraceResultsPanel.ipAddress' })}</div>,
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      ellipsis: true,
      render: (ip: string) => (
        <Tooltip title={ip === '*' ? intl.formatMessage({ id: 'TraceResultsPanel.timeout' }) : ip}>
          <div className="flex items-center gap-1.5">
            {ip === '*' ?
              <CloseCircleOutlined className="text-red-400 text-xs" /> :
              <GlobalOutlined className={classNames(
                'text-xs',
                isDark ? 'text-gray-400' : 'text-blue-400'
              )} />
            }
            <span
              className={classNames(
                'font-mono block w-full overflow-hidden whitespace-nowrap text-ellipsis text-xs',
                ip === '*'
                  ? 'text-red-400'
                  : isDark ? 'text-gray-300' : 'text-gray-200'
              )}
            >
              {ip === '*' ? `* (${intl.formatMessage({ id: 'TraceResultsPanel.timeoutShort' })})` : ip}
            </span>
          </div>
        </Tooltip>
      ),
    },
    {
      title: <div className={classNames(
        'font-medium text-xs',
        isDark ? 'text-gray-300' : 'text-gray-200'
      )}>{intl.formatMessage({ id: 'TraceResultsPanel.latency' })}</div>,
      dataIndex: 'latency',
      key: 'latency',
      width: 100,
      align: 'right' as const,
      ellipsis: true,
      render: (latency: string, record: TraceResult) => {
        if (record.packet_loss === '100%') {
          return (
            <Tooltip title={intl.formatMessage({ id: 'TraceResultsPanel.allPacketsLost' })}>
              <span className="text-red-400 font-medium text-xs">-</span>
            </Tooltip>
          );
        }
        const value = parseFloat(latency);
        let colorClass = 'text-green-400';
        let bgClass = 'bg-green-500/20';
        if (value > 200) {
          colorClass = 'text-red-400';
          bgClass = 'bg-red-500/20';
        } else if (value > 100) {
          colorClass = 'text-yellow-400';
          bgClass = 'bg-yellow-500/20';
        }
        return (
          <Tooltip title={`${latency} ms`}>
            <span className={`font-mono text-xs font-medium px-1 py-0.5 rounded ${colorClass} ${bgClass}`}>{latency} ms</span>
          </Tooltip>
        );
      },
    },
    {
      title: <div className={classNames(
        'font-medium text-xs',
        isDark ? 'text-gray-300' : 'text-gray-200'
      )}>{intl.formatMessage({ id: 'TraceResultsPanel.asn' })}</div>,
      dataIndex: 'asn',
      key: 'asn',
      width: 100,
      align: 'center' as const,
      ellipsis: true,
      render: (asn: string) => (
        <Tooltip title={asn || '-'}>
          <span className={classNames(
            'font-mono text-xs px-1.5 py-0.5 rounded',
            isDark ? 'text-gray-400 bg-gray-600/30' : 'text-gray-300 bg-gray-500/30'
          )}>{asn || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: <div className={classNames(
        'font-medium text-xs',
        isDark ? 'text-gray-300' : 'text-gray-200'
      )}>{intl.formatMessage({ id: 'TraceResultsPanel.location' })}</div>,
      dataIndex: 'location',
      key: 'location',
      ellipsis: true,
      render: (location: string) => (
        <Tooltip title={location && location !== 'Unknown' ? location : intl.formatMessage({ id: 'TraceResultsPanel.unknown' })}>
          <div className="text-xs">
            {location && location !== 'Unknown' ? (
              <span className={classNames(
                'px-1.5 py-0.5 block w-full overflow-hidden whitespace-nowrap text-ellipsis',
                isDark ? 'text-gray-300' : 'text-gray-200'
              )}>{location}</span>
            ) : (
              <span className={classNames(
                'italic',
                isDark ? 'text-gray-400' : 'text-gray-300'
              )}>{intl.formatMessage({ id: 'TraceResultsPanel.unknown' })}</span>
            )}
          </div>
        </Tooltip>
      ),
    },
  ];

  const dataSource = traceResults.map((hop, index) => ({ ...hop, key: index }));
  if (loading) {
    dataSource.push({ key: 'loading', ip: 'loading' } as any);
  }

  return (
    <div className="flex-grow overflow-hidden" ref={containerRef}>
      <Table
        ref={tableRef}
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        scroll={{ y: 320 }}
        className="trace-results-table"
        rowClassName={(record: any, index: number) => {
          if (record.ip === 'loading') return 'loading-row';
          if (record.packet_loss === '100%') return 'error-row';
          return index % 2 === 0 ? 'even-row' : 'odd-row';
        }}
        components={{
          body: {
            row: (props: any) => {
              const { children } = props;
              if (children[0]?.props.record.ip === 'loading') {
                return (
                  <tr>
                    <td colSpan={columns.length} className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Spin indicator={<LoadingOutlined style={{
                          fontSize: 20,
                          color: isDark ? '#9ca3af' : '#60a5fa'
                        }} spin />} />
                        <p className={classNames(
                          'text-xs',
                          isDark ? 'text-gray-400' : 'text-gray-300'
                        )}>{intl.formatMessage({ id: 'TraceResultsPanel.tracing' })}</p>
                      </div>
                    </td>
                  </tr>
                );
              }
              return <tr {...props}>{children}</tr>;
            },
          },
        }}
      />
      <style jsx>{`
        .trace-results-table .ant-table {
          background: transparent;
          font-size: 12px;
        }
        .trace-results-table .ant-table-thead > tr > th {
          background: rgba(31, 41, 55, 0);
          border-bottom: 1px solid ${isDark ? 'rgba(156, 163, 175, 0.2)' : 'rgba(255, 255, 255, 0.2)'};
          color: ${isDark ? '#d1d5db' : '#d1d5db'};
          font-weight: 500;
          padding: 6px 8px;
          font-size: 11px;
        }
        .trace-results-table .ant-table-thead > tr > th::before {
          background-color: #b2b4b58a;
        }
        .trace-results-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid ${isDark ? 'rgba(156, 163, 175, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
          padding: 6px 8px;
          background: transparent;
          font-size: 12px;
        }
        .trace-results-table .even-row,
        .trace-results-table .odd-row {
          background: transparent;
        }
        .trace-results-table .error-row {
          background: rgba(220, 38, 38, 0.15);
        }
        .trace-results-table .ant-table-tbody > tr:hover > td {
          background: ${isDark ? 'rgba(75, 85, 99, 0.2)' : 'rgba(59, 130, 246, 0.2)'} !important;
        }
        .trace-results-table .ant-table-body {
          scroll-behavior: smooth;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar {
          width: 4px;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(156, 163, 175, 0.1)' : 'rgba(255, 255, 255, 0.1)'};
          border-radius: 2px;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(59, 130, 246, 0.5)'};
          border-radius: 2px;
        }
        .trace-results-table .ant-table-body::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(75, 85, 99, 0.7)' : 'rgba(59, 130, 246, 0.7)'};
        }
      `}</style>
    </div>
  );
};

export default TraceTable;