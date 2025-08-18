import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import usePolling from '@/hooks/usePolling';
import PageHeader from './PageHeader';
import StatsGrid from './StatsGrid';
import ControlPanel from './ControlPanel';
import ConnectionsTable from './ConnectionsTable';

// 类型定义
interface Connection {
  id: number;
  key: string;
  info: string;
}

interface Stats {
  TotalPackets: number;
  TotalBytes: number;
  DroppedPackets: number;
  MalformedPackets: number;
}

// API 配置
const API_BASE_URL = 'http://localhost:8080/api';
const POLLING_INTERVAL = 3000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const MIN_TABLE_HEIGHT = 300;

const Connections: React.FC = () => {
  const intl = useIntl();
  const { notification: notificationFn } = App.useApp();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  // 状态管理
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filteredConnections, setFilteredConnections] = useState<Connection[]>([]);
  const [stats, setStats] = useState<Stats>({
    TotalPackets: 0,
    TotalBytes: 0,
    DroppedPackets: 0,
    MalformedPackets: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [tableHeight, setTableHeight] = useState(400);

  // 引用
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<any>(null);

  // 工具函数
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // 计算表格高度
  const calculateTableHeight = useCallback(() => {
    if (tableContainerRef.current) {
      const rect = tableContainerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const availableHeight = windowHeight - rect.top;
      const calculatedHeight = Math.max(availableHeight - 156, MIN_TABLE_HEIGHT);
      setTableHeight(calculatedHeight);
    }
  }, []);

  // API 调用函数
  const fetchStats = useCallback(async (): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    setStats(data);
  }, []);

  const fetchConnections = useCallback(async (): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/connections`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const processedConnections = data.map((conn: any, index: number) => ({
      id: conn.id || index + 1,
      key: conn.key,
      info: conn.info,
    }));

    setConnections(processedConnections);
  }, []);

  const fetchAllData = useCallback(async (): Promise<void> => {
    await Promise.all([fetchStats(), fetchConnections()]);
  }, [fetchStats, fetchConnections]);

  // 轮询配置
  const {
    isPolling,
    isLoading,
    error,
    toggle: togglePolling,
    execute: manualRefresh,
    retryCount,
  } = usePolling(fetchAllData, {
    interval: POLLING_INTERVAL,
    immediate: true,
    autoStart: false,
    maxRetries: MAX_RETRIES,
    retryDelay: RETRY_DELAY,
    onError: (error) => {
      notificationFn.error({
        message: intl.formatMessage({ id: 'ConnectionsMonitor.dataFetchError' }),
        description: intl.formatMessage(
          { id: 'ConnectionsMonitor.dataFetchErrorDescription' },
          { 
            error: error.message, 
            retry: retryCount > 0 ? intl.formatMessage(
              { id: 'ConnectionsMonitor.retryInfo' },
              { current: retryCount, total: MAX_RETRIES }
            ) : ''
          }
        ),
        duration: 4,
      });
    },
    onStart: () => {
      notificationFn.success({
        message: intl.formatMessage({ id: 'ConnectionsMonitor.monitoringStarted' }),
        description: intl.formatMessage({ id: 'ConnectionsMonitor.monitoringStartedDescription' }),
        duration: 2,
      });
    },
    onStop: () => {
      notificationFn.info({
        message: intl.formatMessage({ id: 'ConnectionsMonitor.monitoringStopped' }),
        description: intl.formatMessage({ id: 'ConnectionsMonitor.monitoringStoppedDescription' }),
        duration: 2,
      });
    },
  });

  // 事件处理函数
  const handleRefresh = async (): Promise<void> => {
    try {
      await manualRefresh();
      notificationFn.success({
        message: intl.formatMessage({ id: 'ConnectionsMonitor.refreshSuccess' }),
        description: intl.formatMessage({ id: 'ConnectionsMonitor.refreshSuccessDescription' }),
        duration: 2,
      });
    } catch (error) {
      // 错误已经在轮询 Hook 中处理
    }
  };

  const handleExport = (): void => {
    const exportData = {
      stats,
      connections: filteredConnections,
      exportTime: new Date().toISOString(),
      isPolling,
      retryCount,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `network_connections_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    notificationFn.success({
      message: intl.formatMessage({ id: 'ConnectionsMonitor.exportSuccess' }),
      description: intl.formatMessage({ id: 'ConnectionsMonitor.exportSuccessDescription' }),
      duration: 2,
    });
  };

  // 副作用处理
  useEffect(() => {
    calculateTableHeight();
    const handleResize = () => calculateTableHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateTableHeight]);

  useEffect(() => {
    const timer = setTimeout(calculateTableHeight, 100);
    return () => clearTimeout(timer);
  }, [calculateTableHeight]);

  // 连接过滤
  useEffect(() => {
    let filtered = connections;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((conn) => conn.key.toLowerCase().includes(searchLower) || conn.info.toLowerCase().includes(searchLower));
    }

    setFilteredConnections(filtered);
  }, [connections, searchTerm]);

  // 自动滚动处理
  useEffect(() => {
    if (!tableRef.current || !filteredConnections.length || !isAutoScroll) return;

    const scrollToBottom = () => {
      const body = tableRef.current?.nativeElement?.querySelector('.ant-table-tbody-virtual-holder');
      if (body) {
        setTimeout(() => {
          body.scrollTop = body.scrollHeight;
        }, 0);
      }
    };

    const frameId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(frameId);
  }, [filteredConnections, isAutoScroll]);

  // 滚动事件监听
  useEffect(() => {
    if (!tableRef.current) return;

    const body = tableRef.current?.nativeElement?.querySelector('.ant-table-tbody-virtual-holder');
    if (!body) return;

    const handleScrollEvent = () => {
      const distanceToBottom = body.scrollHeight - body.scrollTop - body.clientHeight;
      const atBottom = distanceToBottom < 20;
      setIsAutoScroll(atBottom);
    };

    body.addEventListener('scroll', handleScrollEvent);
    return () => body.removeEventListener('scroll', handleScrollEvent);
  }, [tableRef.current]);

  return (
    <div className={classNames(
      "min-h-screen transition-colors duration-200"
    )}>
      <div className="mx-auto space-y-6">
        <PageHeader />
        <StatsGrid stats={stats} formatBytes={formatBytes} />
        <ControlPanel
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isPolling={isPolling}
          togglePolling={togglePolling}
          handleRefresh={handleRefresh}
          handleExport={handleExport}
        />
        <div ref={tableContainerRef}>
          <ConnectionsTable
            filteredConnections={filteredConnections}
            tableHeight={tableHeight}
            tableRef={tableRef}
          />
        </div>
      </div>
    </div>
  );
};

export default Connections;