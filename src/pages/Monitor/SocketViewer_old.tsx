import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { Card, Descriptions, Table, Input, Select, Button, Row, Col, ConfigProvider, Tabs, Empty } from 'antd';
import { SearchOutlined, ClearOutlined, FilterOutlined, Loading3QuartersOutlined } from '@ant-design/icons';
import { usePollingManager } from '@/stores/usePollingManager';
import { WifiOff, RefreshCw, Logs, Monitor, Activity } from 'lucide-react';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';

const { Option } = Select;

// Protocol color mapping for both light and dark modes
const PROTOCOL_COLORS = {
  light: {
    TCP: 'bg-green-100 text-green-800',
    UDP: 'bg-orange-100 text-orange-800',
    RAW: 'bg-red-100 text-red-800',
    ICMP: 'bg-cyan-100 text-cyan-800',
    default: 'bg-gray-100 text-gray-800',
  },
  dark: {
    TCP: 'bg-green-900/50 text-green-300 border border-green-800/50',
    UDP: 'bg-orange-900/50 text-orange-300 border border-orange-800/50',
    RAW: 'bg-red-900/50 text-red-300 border border-red-800/50',
    ICMP: 'bg-cyan-900/50 text-cyan-300 border border-cyan-800/50',
    default: 'bg-gray-800/50 text-gray-300 border border-gray-700/50',
  },
};

// State color mapping for both light and dark modes
const STATE_COLORS = {
  light: {
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
  },
  dark: {
    ESTABLISHED: 'bg-green-900/50 text-green-300 border border-green-800/50',
    LISTEN: 'bg-blue-900/50 text-blue-300 border border-blue-800/50',
    TIME_WAIT: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800/50',
    SYN_SENT: 'bg-purple-900/50 text-purple-300 border border-purple-800/50',
    SYN_RECV: 'bg-indigo-900/50 text-indigo-300 border border-indigo-800/50',
    FIN_WAIT1: 'bg-orange-900/50 text-orange-300 border border-orange-800/50',
    FIN_WAIT2: 'bg-orange-900/50 text-orange-300 border border-orange-800/50',
    CLOSE: 'bg-gray-800/50 text-gray-300 border border-gray-700/50',
    CLOSE_WAIT: 'bg-red-900/50 text-red-300 border border-red-800/50',
    LAST_ACK: 'bg-red-900/50 text-red-300 border border-red-800/50',
    CLOSING: 'bg-red-900/50 text-red-300 border border-red-800/50',
    UNDEFINED: 'bg-slate-800/50 text-slate-300 border border-slate-700/50',
    default: 'bg-gray-800/50 text-gray-300 border border-gray-700/50',
  },
};

// Utility function to get protocol color based on theme
const getProtocolColor = (protocol: string, isDark: boolean): string => {
  const colors = isDark ? PROTOCOL_COLORS.dark : PROTOCOL_COLORS.light;
  return colors[protocol] || colors.default;
};

// Utility function to get state color based on theme
const getStateColor = (state: string, isDark: boolean): string => {
  const colors = isDark ? STATE_COLORS.dark : STATE_COLORS.light;
  
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
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
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

  // Protocol statistics component with dark mode support
  const ProtocolStats = ({ label, count, colorClass }: { label: string; count: number; colorClass: string }) => (
    <div className={`${colorClass} rounded-lg px-2.5 py-1.5 border shadow-sm text-center min-w-0`}>
      <div className="text-sm font-bold leading-tight">{count}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );

  // Define theme-aware colors
  const getStatsColors = (type: string) => {
    const baseColors = {
      tcp: isDark 
        ? 'bg-gradient-to-br from-emerald-900/40 to-green-900/40 border-emerald-700/50 text-emerald-300'
        : 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100/60 text-emerald-600',
      udp: isDark
        ? 'bg-gradient-to-br from-orange-900/40 to-amber-900/40 border-orange-700/50 text-orange-300'
        : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100/60 text-orange-600',
      raw: isDark
        ? 'bg-gradient-to-br from-red-900/40 to-rose-900/40 border-red-700/50 text-red-300'
        : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100/60 text-red-600',
      icmp: isDark
        ? 'bg-gradient-to-br from-cyan-900/40 to-teal-900/40 border-cyan-700/50 text-cyan-300'
        : 'bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-100/60 text-cyan-600',
      count: isDark
        ? 'bg-gradient-to-br from-violet-900/40 via-purple-900/40 to-indigo-900/40 border-violet-700/50'
        : 'bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 border-violet-100/60',
      interface: isDark
        ? 'bg-gradient-to-br from-green-900/40 via-green-900/40 to-green-900/40 border-green-700/50'
        : 'bg-gradient-to-br from-green-50 via-green-50 to-green-50 border-green-100/60',
    };
    return baseColors[type];
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-grow overflow-hidden">
        {/* Header section with dual-row layout */}
        <div 
          className={classNames(
            "border-b backdrop-blur-sm", 
            isDark 
              ? "bg-[#141414] border-gray-600/50" 
              : "bg-white border-gray-200/80"
          )}  
          style={{ height: '90px' }}
        >
          <div className="px-6 py-3 h-full relative">
            {/* First row: Title and statistics */}
            <div className="flex items-center justify-between">
              {/* Left: Title area */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={classNames(
                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
                    isDark
                      ? "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700"
                      : "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600"
                  )}>
                    <div className="w-4 h-4 bg-white rounded-full opacity-90"></div>
                    {pollingManagerStore.tasks['socket']?.isPolling && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                    )}
                  </div>
                </div>
                <div>
                  <h1 className={classNames(
                    "text-lg font-bold bg-clip-text text-transparent leading-tight",
                    isDark
                      ? "bg-gradient-to-r from-gray-200 to-gray-400"
                      : "bg-gradient-to-r from-gray-800 to-gray-600"
                  )}>
                    {intl.formatMessage({ id: 'SocketViewer.title' })}
                  </h1>
                  <p className={classNames(
                    "text-xs font-medium tracking-wide",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}>
                    {intl.formatMessage({ id: 'SocketViewer.subtitle' })}
                  </p>
                </div>
              </div>

              {/* Right: Statistics and status */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Protocol statistics grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  <ProtocolStats
                    label="TCP"
                    count={(summaryInfo.TCPv4 || 0) + (summaryInfo.TCPv6 || 0)}
                    colorClass={getStatsColors('tcp')}
                  />
                  <ProtocolStats
                    label="UDP"
                    count={(summaryInfo.UDPv4 || 0) + (summaryInfo.UDPv6 || 0)}
                    colorClass={getStatsColors('udp')}
                  />
                  <ProtocolStats
                    label="RAW"
                    count={(summaryInfo.RAWv4 || 0) + (summaryInfo.RAWv6 || 0)}
                    colorClass={getStatsColors('raw')}
                  />
                  <ProtocolStats
                    label="ICMP"
                    count={(summaryInfo.ICMPv4 || 0) + (summaryInfo.ICMPv6 || 0)}
                    colorClass={getStatsColors('icmp')}
                  />
                </div>

                {/* Display statistics */}
                <div className={`${getStatsColors('count')} rounded-lg px-3 py-2 border shadow-sm`}>
                  <div className="text-center relative min-w-[80px]">
                    <div className="flex items-baseline justify-center gap-0.5 relative top-2 whitespace-nowrap">
                      <span className={classNames(
                        "text-lg font-bold bg-clip-text text-transparent",
                        isDark
                          ? "bg-gradient-to-r from-violet-300 to-purple-300"
                          : "bg-gradient-to-r from-violet-600 to-purple-600"
                      )}>
                        {filteredData.length}
                      </span>
                      <span className={classNames(
                        "text-xs font-medium",
                        isDark ? "text-violet-400" : "text-violet-500"
                      )}>
                        /{tableData.length}
                      </span>
                    </div>
                    <div className={classNames(
                      "absolute text-xs font-semibold left-[-5px] top-[-6px]",
                      isDark ? "text-violet-400/60" : "text-violet-700/40"
                    )}>
                      {intl.formatMessage({ id: 'SocketViewer.entryCount' })}
                    </div>
                  </div>
                </div>

                {/* Network interface */}
                <div className={`${getStatsColors('interface')} rounded-lg px-3 py-2 border shadow-sm`}>
                  <div className="text-center relative min-w-[80px]">
                    <div className="flex items-baseline justify-center gap-0.5 relative top-2">
                      <span className={classNames(
                        "text-lg font-bold bg-clip-text whitespace-nowrap text-transparent",
                        isDark
                          ? "bg-gradient-to-r from-green-300 to-green-500"
                          : "bg-gradient-to-r from-green-600 to-green-800"
                      )}>
                        {summaryInfo.interface ?? 'N/A'}
                      </span>
                    </div>
                    <div className={classNames(
                      "absolute text-xs font-semibold left-[-5px] top-[-6px]",
                      isDark ? "text-green-400/60" : "text-green-800/40"
                    )}>
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
                  <SearchOutlined className={classNames(
                    "text-sm",
                    isDark ? "text-blue-400" : "text-blue-500"
                  )} />
                  <Input
                    placeholder={intl.formatMessage({ id: 'SocketViewer.search.placeholder' })}
                    value={filters.searchText}
                    onChange={(e) => updateFilter('searchText', e.target.value)}
                    allowClear
                    size="small"
                    bordered={false}
                    style={{ width: 200 }}
                    className={classNames(
                      "border-0",
                      isDark 
                        ? "placeholder:text-gray-500 text-gray-300 bg-transparent"
                        : "placeholder:text-gray-400"
                    )}
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
                    className={classNames(
                      "rounded-lg transition-all duration-200",
                      hasActiveFilters
                        ? isDark
                          ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300'
                          : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                        : isDark
                          ? 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-400'
                          : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    )}
                  >
                    {intl.formatMessage({ id: 'SocketViewer.filter.reset' })}
                  </Button>
                  {hasActiveFilters && (
                    <div className={classNames(
                      "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                      isDark
                        ? "bg-blue-900/50 text-blue-300 border border-blue-800/50"
                        : "bg-blue-500 text-white"
                    )}>
                      <FilterOutlined className="text-xs" />
                      {intl.formatMessage({ id: 'SocketViewer.filter.active' })}
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time status indicator */}
              <div className={classNames(
                "text-xs w-[130px] ml-3 absolute right-2 scale-85 origin-right",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                {intl.formatMessage({ id: 'SocketViewer.updateTime' })}: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* Table section */}
        <div className="h-full overflow-auto">
          <ConfigProvider
            theme={{
              components: {
                Table: {
                  headerBorderRadius: 0,
                  // headerBg: isDark ? '#1a1a1a' : undefined,
                  // headerColor: isDark ? '#e8e8e8' : undefined,
                  // borderColor: isDark ? '#404040' : undefined,
                  // rowHoverBg: isDark ? '#262626' : undefined,
                },
              },
            }}
            renderEmpty={() =>
              pollingManagerStore.tasks['socket']?.data ? (
                <Empty className="py-16"></Empty>
              ) : (
                <div className="py-16 text-center flex items-center flex-col">
                  <Logs size={70} className={classNames(
                    "mb-6",
                    isDark ? "text-gray-600" : "text-gray-300"
                  )} />
                  <h4 className={classNames(
                    "text-lg font-semibold mb-2",
                    isDark ? "text-gray-400" : "text-slate-500"
                  )}>
                    {intl.formatMessage({ id: 'SocketViewer.empty.title' })}
                  </h4>
                  <p className={classNames(
                    "text-sm mb-2",
                    isDark ? "text-gray-500" : "text-gray-500"
                  )}>
                    {intl.formatMessage({ id: 'SocketViewer.empty.description' })}
                  </p>
                  <p className={classNames(
                    "text-xs mb-8",
                    isDark ? "text-gray-600" : "text-gray-400"
                  )}>
                    {intl.formatMessage({ id: 'SocketViewer.empty.subtitle' })}
                  </p>

                  <Button
                    type="primary"
                    loading={
                      pollingManagerStore.tasks['socket']?.isPolling ? { icon: <Loading3QuartersOutlined spin className="flex" /> } : false
                    }
                    onClick={() => {
                      pollingManagerStore.startPolling('socket');
                    }}
                    className={classNames(
                      "border-0 rounded-full px-8 py-2 h-auto",
                      isDark 
                        ? "bg-blue-700 hover:bg-blue-600" 
                        : "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    {pollingManagerStore.tasks['socket']?.isPolling 
                      ? intl.formatMessage({ id: 'SocketViewer.button.starting' })
                      : intl.formatMessage({ id: 'SocketViewer.button.start' })
                    }
                  </Button>

                  {pollingManagerStore.tasks['socket']?.isPolling && (
                    <div className="mt-6 text-sm animate-pulse">
                      <div className="flex items-center justify-center space-x-2">
                        <span className={isDark ? "text-gray-400" : "text-gray-500"}>
                          {intl.formatMessage({ id: 'SocketViewer.status.initializing' })}
                        </span>
                        <div className="flex space-x-1">
                          <div className={classNames(
                            "w-2 h-2 rounded-full animate-bounce",
                            isDark ? "bg-blue-400" : "bg-blue-500"
                          )}></div>
                          <div 
                            className={classNames(
                              "w-2 h-2 rounded-full animate-bounce",
                              isDark ? "bg-blue-400" : "bg-blue-500"
                            )} 
                            style={{ animationDelay: '0.1s' }}
                          ></div>
                          <div 
                            className={classNames(
                              "w-2 h-2 rounded-full animate-bounce",
                              isDark ? "bg-blue-400" : "bg-blue-500"
                            )} 
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }
          >
            <Table
              dataSource={filteredData}
              ref={tableRef}
              style={{ minHeight: contentHeight }}
              columns={columns}
              rowClassName={(record: any) => {
                const classNames = ['transition-all duration-100'];
                if (record.key === selectedRowKey) {
                  classNames.push(isDark ? 'bg-blue-900/40' : 'bg-blue-300/60');
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