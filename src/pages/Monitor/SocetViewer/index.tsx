import React, { useMemo, useState, useCallback } from 'react';
import { usePollingManager } from '@/stores/usePollingManager';
import { INITIAL_FILTERS, FilterState } from './constants';
import SocketViewerHeader from './SocketViewerHeader';
import SocketTable from './SocketTable';

interface SocketViewerProps {
  contentHeight: number;
  onRowClick: (record: any) => void;
}

const SocketViewer: React.FC<SocketViewerProps> = ({ contentHeight, onRowClick }) => {
  const pollingManagerStore = usePollingManager();
  const socketData = pollingManagerStore.tasks['socket']?.data;
  const [selectedRowKey, setSelectedRowKey] = useState<string | number | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Process socket data and apply filters
  const { summaryInfo, tableData, filteredData } = useMemo(() => {
    if (!socketData) {
      return { summaryInfo: {}, tableData: [], filteredData: [] };
    }

    // FIX: The complete data processing logic is now included here.
    // This part defines the `summary` variable, fixing the ReferenceError.
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

    addSocketData(socketData.tcpipv4, 'ipv4', 'TCP');
    addSocketData(socketData.tcpipv6, 'ipv6', 'TCP');
    addSocketData(socketData.udpipv4, 'ipv4', 'UDP');
    addSocketData(socketData.udpipv6, 'ipv6', 'UDP');
    addSocketData(socketData.rawipv4, 'ipv4', 'RAW');
    addSocketData(socketData.rawipv6, 'ipv6', 'RAW');
    addSocketData(socketData.icmpipv4, 'ipv4', 'ICMP');
    addSocketData(socketData.icmpipv6, 'ipv6', 'ICMP');

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
    
    // Now this return statement works because `summary` is defined above.
    return { summaryInfo: summary, tableData: list, filteredData: filtered };
  }, [socketData, filters]);

  // Get unique states for filter dropdown
  const uniqueStates = useMemo(() => {
    const states = new Set<string>();
    tableData.forEach((item) => {
      if (item.state) states.add(item.state);
    });
    return Array.from(states).sort();
  }, [tableData]);

  // Reset filters handler
  const handleResetFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);

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

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-grow overflow-hidden">
        <SocketViewerHeader
          summaryInfo={summaryInfo}
          filteredCount={filteredData.length}
          totalCount={tableData.length}
          filters={filters}
          onFilterChange={updateFilter}
          onResetFilters={handleResetFilters}
          uniqueStates={uniqueStates}
        />
        <SocketTable
          data={filteredData}
          onRowClick={handleRowClick}
          selectedRowKey={selectedRowKey}
          contentHeight={contentHeight}
        />
      </div>
    </div>
  );
};

export default SocketViewer;