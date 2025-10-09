import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { usePollingManager } from '@/stores/usePollingManager';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import HeaderTitle from './HeaderTitle';
import HeaderStats from './HeaderStats';
import FilterToolbar from './FilterToolbar';
import SocketTable from './SocketTable';

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
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

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

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-grow overflow-hidden">
        {/* Header section with dual-row layout */}
        <div className={classNames(
          "border-b backdrop-blur-sm",
          isDark 
            ? "bg-gray-800 border-gray-700" 
            : "bg-white border-gray-200/80"
        )} style={{ height: '90px' }}>
          <div className="px-6 py-3 h-full relative">
            {/* First row: Title and statistics */}
            <div className="flex items-center justify-between">
              {/* Left: Title area */}
              <HeaderTitle />

              {/* Right: Statistics and status */}
              <HeaderStats 
                summaryInfo={summaryInfo}
                filteredDataLength={filteredData.length}
                tableDataLength={tableData.length}
              />
            </div>

            {/* Second row: Search and filter toolbar */}
            <FilterToolbar
              filters={filters}
              uniqueStates={uniqueStates}
              hasActiveFilters={hasActiveFilters}
              updateFilter={updateFilter}
              handleResetFilters={handleResetFilters}
            />
          </div>
        </div>

        {/* Table section */}
        <SocketTable
          contentHeight={contentHeight}
          filteredData={filteredData}
          selectedRowKey={selectedRowKey}
          onRowClick={handleRowClick}
        />
      </div>
    </div>
  );
};

export default SocketViewer;