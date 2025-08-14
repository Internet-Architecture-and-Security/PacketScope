import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Card, Descriptions, Table, Input, Select, Button, Row, Col, ConfigProvider, Tabs, Empty } from 'antd';
import { SearchOutlined, ClearOutlined, FilterOutlined, Loading3QuartersOutlined } from '@ant-design/icons';
import { usePollingManager } from '@/stores/usePollingManager';
import { WifiOff, RefreshCw, Logs, Monitor, Activity } from 'lucide-react';

const { Option } = Select;

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

// Utility function to get protocol color
const getProtocolColor = (protocol: string): string => {
  return PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS.default;
};

// Utility function to get state color
const getStateColor = (state: string): string => {
  // Check for hex state codes and named states
  if (state.includes('01') || state.includes('ESTABLISHED')) return STATE_COLORS.ESTABLISHED;
  if (state.includes('0A') || state.includes('LISTEN')) return STATE_COLORS.LISTEN;
  if (state.includes('06') || state.includes('TIME_WAIT')) return STATE_COLORS.TIME_WAIT;
  if (state.includes('02') || state.includes('SYN_SENT')) return STATE_COLORS.SYN_SENT;
  if (state.includes('03') || state.includes('SYN_RECV')) return STATE_COLORS.SYN_RECV;
  if (state.includes('04') || state.includes('FIN_WAIT1')) return STATE_COLORS.FIN_WAIT1;
  if (state.includes('05') || state.includes('FIN_WAIT2')) return STATE_COLORS.FIN_WAIT2;
  if (state.includes('07') || state.includes('CLOSE')) return STATE_COLORS.CLOSE;
  if (state.includes('08') || state.includes('CLOSE_WAIT')) return STATE_COLORS.CLOSE_WAIT;
  if (state.includes('09') || state.includes('LAST_ACK')) return STATE_COLORS.LAST_ACK;
  if (state.includes('0B') || state.includes('CLOSING')) return STATE_COLORS.CLOSING;
  if (state.includes('UNDEFINED')) return STATE_COLORS.UNDEFINED;
  return STATE_COLORS.default;
};

// Define component props interface
interface SocketViewerProps {
  contentHeight: number;
  onRowClick: (key: string | number) => void;
}

// Filter state interface
interface FilterState {
  searchText: string;
  protocol: string;
  type: string;
  state: string;
}

// Initial filter state
const INITIAL_FILTERS: FilterState = {
  searchText: '',
  protocol: 'all',
  type: 'all',
  state: 'all',
};

const SocketViewer: React.FC<SocketViewerProps> = ({ contentHeight, onRowClick }) => {
  const pollingManagerStore = usePollingManager();
  const socketData = pollingManagerStore.tasks['socket']?.data;
  const [selectedRowKey, setSelectedRowKey] = useState<string | number | null>(null);
  const tableRef = useRef<any>(null);
  const [tableHeadHeight, setTableHeadHeight] = useState<number>(0);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const intl = useIntl();

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
          className={`px-2 py-1 rounded text-xs font-medium ${
            type === 'ipv4' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
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
        <span className={`px-2 py-1 rounded text-xs font-medium ${getProtocolColor(protocol)}`}>{protocol}</span>
      ),
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.timestamp' }),
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (ts: number) => <span className="text-gray-600 text-sm">{new Date(ts * 1000).toLocaleString()}</span>,
      width: 180,
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.src' }),
      dataIndex: 'src',
      key: 'src',
      width: 220,
      sorter: (a: any, b: any) => a.src.localeCompare(b.src),
      render: (src: string) => <span className="font-mono text-sm text-blue-600">{src}</span>,
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.dist' }),
      dataIndex: 'dist',
      key: 'dist',
      width: 220,
      sorter: (a: any, b: any) => a.dist.localeCompare(b.dist),
      render: (dist: string) => <span className="font-mono text-sm text-green-600">{dist}</span>,
    },
    {
      title: intl.formatMessage({ id: 'SocketViewer.column.state' }),
      dataIndex: 'state',
      key: 'state',
      width: 120,
      sorter: (a: any, b: any) => a.state.localeCompare(b.state),
      render: (state: string) => <span className={`px-2 py-1 rounded text-xs font-medium ${getStateColor(state)}`}>{state}</span>,
    },
  ];

  // Get table header height
  useEffect(() => {
    if (!tableRef.current) return;
    const headerHeight = tableRef.current.nativeElement?.querySelector('th')?.offsetHeight ?? 0;
    setTableHeadHeight(headerHeight);
  }, []);

  // Process socket data and apply filters - optimized with useMemo
  const { summaryInfo, tableData, filteredData } = useMemo(() => {
    if (!socketData) {
      return { summaryInfo: {}, tableData: [], filteredData: [] };
    }

    // Calculate summary information
    const summary = {
      interface: socketData.dev?.map((item: any) => item[1]).join(', ') || 'N/A',
      TCPv4: socketData.tcpipv4?.length || 0,
      TCPv6: socketData.tcpipv6?.length || 0,
      UDPv4: socketData.udpipv4?.length || 0,
      UDPv6: socketData.udpipv6?.length || 0,
      RAWv4: socketData.rawipv4?.length || 0,
      RAWv6: socketData.rawipv6?.length || 0,
      ICMPv4: socketData.icmpipv4?.length || 0,
      ICMPv6: socketData.icmpipv6?.length || 0,
    };

    // Process all socket data into unified format
    const list: any[] = [];
    const addSocketData = (arr: any[], type: string, protocol: string) => {
      arr?.forEach((item: any) => {
        list.push({
          key: `${type}-${protocol}-${item[2]}-${item[3]}`,
          type,
          protocol,
          timestamp: item[0],
          id: item[1],
          src: item[2],
          dist: item[3],
          state: item[4],
        });
      });
    };

    // Add all socket types
    addSocketData(socketData.tcpipv4, 'ipv4', 'TCP');
    addSocketData(socketData.tcpipv6, 'ipv6', 'TCP');
    addSocketData(socketData.udpipv4, 'ipv4', 'UDP');
    addSocketData(socketData.udpipv6, 'ipv6', 'UDP');
    addSocketData(socketData.rawipv4, 'ipv4', 'RAW');
    addSocketData(socketData.rawipv6, 'ipv6', 'RAW');
    addSocketData(socketData.icmpipv4, 'ipv4', 'ICMP');
    addSocketData(socketData.icmpipv6, 'ipv6', 'ICMP');

    // Apply filters
    const filtered = list.filter((item) => {
      const matchesSearch =
        !filters.searchText ||
        item.src.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        item.dist.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        item.state.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        item.id.toString().includes(filters.searchText);

      const matchesProtocol = filters.protocol === 'all' || item.protocol === filters.protocol;
      const matchesType = filters.type === 'all' || item.type === filters.type;
      const matchesState = filters.state === 'all' || item.state.includes(filters.state);

      return matchesSearch && matchesProtocol && matchesType && matchesState;
    });

    return { summaryInfo: summary, tableData: list, filteredData: filtered };
  }, [socketData, filters]);

  // Get unique states for filter dropdown
  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    tableData.forEach((item) => {
      if (item.state) {
        states.add(item.state);
      }
    });
    return Array.from(states).sort();
  }, [tableData]);

  // Reset filters handler
  const handleResetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  // Update filter handler
  const updateFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Handle row click
  const handleRowClick = useCallback(
    (record: any) => {
      setSelectedRowKey(record.key);
      onRowClick(record);
    },
    [onRowClick],
  );

  // Check if there are active filters
  const hasActiveFilters = filters.searchText || filters.protocol !== 'all' || filters.type !== 'all' || filters.state !== 'all';

  // Protocol statistics component
  const ProtocolStats = ({ label, count, colorClass }: { label: string; count: number; colorClass: string }) => (
    <div className={`${colorClass} rounded-lg px-2.5 py-1.5 border shadow-sm text-center min-w-0`}>
      <div className="text-sm font-bold leading-tight">{count}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-grow overflow-hidden">
        {/* Header section with dual-row layout */}
        <div className="bg-white border-b border-gray-200/80 backdrop-blur-sm" style={{ height: '90px' }}>
          <div className="px-6 py-3 h-full relative">
            {/* First row: Title and statistics */}
            <div className="flex items-center justify-between">
              {/* Left: Title area */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <div className="w-4 h-4 bg-white rounded-full opacity-90"></div>
                    {pollingManagerStore.tasks['socket']?.isPolling && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                    )}
                  </div>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent leading-tight">
                    {intl.formatMessage({ id: 'SocketViewer.title' })}
                  </h1>
                  <p className="text-xs text-gray-500 font-medium tracking-wide">{intl.formatMessage({ id: 'SocketViewer.subtitle' })}</p>
                </div>
              </div>

              {/* Right: Statistics and status */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Protocol statistics grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  <ProtocolStats
                    label="TCP"
                    count={(summaryInfo.TCPv4 || 0) + (summaryInfo.TCPv6 || 0)}
                    colorClass="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100/60 text-emerald-600"
                  />
                  <ProtocolStats
                    label="UDP"
                    count={(summaryInfo.UDPv4 || 0) + (summaryInfo.UDPv6 || 0)}
                    colorClass="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100/60 text-orange-600"
                  />
                  <ProtocolStats
                    label="RAW"
                    count={(summaryInfo.RAWv4 || 0) + (summaryInfo.RAWv6 || 0)}
                    colorClass="bg-gradient-to-br from-red-50 to-rose-50 border-red-100/60 text-red-600"
                  />
                  <ProtocolStats
                    label="ICMP"
                    count={(summaryInfo.ICMPv4 || 0) + (summaryInfo.ICMPv6 || 0)}
                    colorClass="bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-100/60 text-cyan-600"
                  />
                </div>

                {/* Display statistics */}
                <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 rounded-lg px-3 py-2 border border-violet-100/60 shadow-sm">
                  <div className="text-center relative min-w-[80px]">
                    <div className="flex items-baseline justify-center gap-0.5 relative top-2 whitespace-nowrap">
                      <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        {filteredData.length}
                      </span>
                      <span className="text-xs text-violet-500 font-medium">/{tableData.length}</span>
                    </div>
                    <div className="absolute text-xs font-semibold text-violet-700/40 left-[-5px] top-[-6px]">
                      {intl.formatMessage({ id: 'SocketViewer.entryCount' })}
                    </div>
                  </div>
                </div>

                {/* Network interface */}
                <div className="bg-gradient-to-br from-green-50 via-green-50 to-green-50 rounded-lg px-3 py-2 border border-green-100/60 shadow-sm">
                  <div className="text-center relative min-w-[80px]">
                    <div className="flex items-baseline justify-center gap-0.5 relative top-2">
                      <span className="text-lg font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text whitespace-nowrap text-transparent">
                        {summaryInfo.interface ?? 'N/A'}
                      </span>
                    </div>
                    <div className="absolute text-xs font-semibold text-green-800/40 left-[-5px] top-[-6px]">
                      {intl.formatMessage({ id: 'SocketViewer.interface' })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Second row: Search and filter toolbar */}
            <div className="flex items-center absolute left-0 w-full">
              <div
                className={`flex items-center gap-2 scale-85 origin-left transition-all duration-300 ease-in-out ${
                  hasActiveFilters ? 'opacity-100 translate-y-0' : 'opacity-30 hover:opacity-100 translate-y-0'
                }`}
              >
                {/* Search area */}
                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
                  <SearchOutlined className="text-blue-500 text-sm" />
                  <Input
                    placeholder={intl.formatMessage({ id: 'SocketViewer.search.placeholder' })}
                    value={filters.searchText}
                    onChange={(e) => updateFilter('searchText', e.target.value)}
                    allowClear
                    size="small"
                    bordered={false}
                    style={{ width: 200 }}
                    className="placeholder:text-gray-400 border-0"
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
                    className="filter-select"
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
                    className="filter-select"
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
                    className="filter-select"
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
                    className={`rounded-lg transition-all duration-200 ${
                      hasActiveFilters
                        ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                  >
                    {intl.formatMessage({ id: 'SocketViewer.filter.reset' })}
                  </Button>
                  {hasActiveFilters && (
                    <div className="flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded-md text-xs font-medium">
                      <FilterOutlined className="text-xs" />
                      {intl.formatMessage({ id: 'SocketViewer.filter.active' })}
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time status indicator */}
              <div className="text-xs text-gray-500 w-[130px] ml-3 absolute right-2 scale-85 origin-right">
                {intl.formatMessage({ id: 'SocketViewer.updateTime' })}: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* Table section */}
        <div className="h-full overflow-auto">
          <ConfigProvider
            renderEmpty={() =>
              pollingManagerStore.tasks['socket']?.data ? (
                <Empty className="py-16"></Empty>
              ) : (
                <div className="py-16 text-center flex items-center flex-col">
                  <Logs size={70} className="text-gray-300 mb-6" />
                  <h4 className="text-lg font-semibold text-slate-500 mb-2">{intl.formatMessage({ id: 'SocketViewer.empty.title' })}</h4>
                  <p className="text-gray-500 text-sm mb-2">{intl.formatMessage({ id: 'SocketViewer.empty.description' })}</p>
                  <p className="text-gray-400 text-xs mb-8">{intl.formatMessage({ id: 'SocketViewer.empty.subtitle' })}</p>

                  <Button
                    type="primary"
                    loading={
                      pollingManagerStore.tasks['socket']?.isPolling ? { icon: <Loading3QuartersOutlined spin className="flex" /> } : false
                    }
                    onClick={() => {
                      pollingManagerStore.startPolling('socket');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 border-0 rounded-full px-8 py-2 h-auto"
                  >
                    {pollingManagerStore.tasks['socket']?.isPolling 
                      ? intl.formatMessage({ id: 'SocketViewer.button.starting' })
                      : intl.formatMessage({ id: 'SocketViewer.button.start' })
                    }
                  </Button>

                  {pollingManagerStore.tasks['socket']?.isPolling && (
                    <div className="mt-6 text-sm text-gray-500 animate-pulse">
                      <div className="flex items-center justify-center space-x-2">
                        <span>{intl.formatMessage({ id: 'SocketViewer.status.initializing' })}</span>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            theme={{
              components: {
                Table: {
                  headerBorderRadius: 0,
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
                  classNames.push('bg-blue-300/60');
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
      </div>
    </div>
  );
};

export default SocketViewer;