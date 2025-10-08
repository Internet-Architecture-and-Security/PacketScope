import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useTheme, useMonitorReadyStore } from '@/stores/useStore';
import classNames from 'classnames';
import PacketHeader from './PacketHeader';
import PacketItem from './PacketItem';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import { APIs } from '@/constants';

interface IPv4PacketData {
  timestamp: string;
  interface: number;
  direction: number;
  length: number;
  content: string;
  srcAddress: string;
  dstAddress: string;
  srcPort: number;
  dstPort: number;
  protocol: string;
  ipId: number;
  ttl: number;
  fragInfo: string;
  options: string;
}

interface IPv6PacketData {
  timestamp: string;
  interface: number;
  direction: number;
  length: number;
  content: string;
  srcAddress: string;
  dstAddress: string;
  headerType: string;
  srcPort: number;
  dstPort: number;
}

interface PacketDetailsProps {
  queryParams: {
    srcip: string;
    dstip: string;
    srcport: number;
    dstport: number;
    ipver?: number;
  } | null;
}

const PacketDetails: React.FC<PacketDetailsProps> = ({ queryParams }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';

  // 获取 ready 状态
  const { isReady, error: readyError, maxAttemptsReached } = useMonitorReadyStore();

  console.log('[PacketDetails] queryParams:', JSON.stringify(queryParams));
  const [loading, setLoading] = useState(false);
  const [packetData, setPacketData] = useState<(IPv4PacketData | IPv6PacketData)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedPackets, setExpandedPackets] = useState<Set<number>>(new Set([0])); // 默认展开第一个

  const fetchData = async (params) => {
    try {
      // 构造表单数据
      const formData = new URLSearchParams();
      formData.append('srcip', params.srcip);
      formData.append('dstip', params.dstip);
      formData.append('srcport', params.srcport);
      formData.append('dstport', params.dstport);
      formData.append('ipver', params.ipver);
      formData.append('count', params.count ?? 40);

      // 发起POST请求
      const res = await fetch(APIs['Tracer.getRecentPacket'], {
        method: 'POST',
        body: formData,
      });
      // 判断请求是否成功
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      // 解析返回的JSON数据
      return res.json();
    } catch (err) {
      console.error('[PacketDetails] 请求失败：', err);
    }
  };

  const togglePacketExpansion = (index: number) => {
    const newExpanded = new Set(expandedPackets);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedPackets(newExpanded);
  };

  // 合并展开/收起功能
  const toggleAllPackets = () => {
    const allExpanded = expandedPackets.size === packetData.length;
    if (allExpanded) {
      setExpandedPackets(new Set());
    } else {
      setExpandedPackets(new Set(Array.from({ length: packetData.length }, (_, i) => i)));
    }
  };

  // 刷新数据
  const handleRefresh = async (params) => {
    if (!queryParams) return;
    console.log('[PacketDetails] handleRefresh params:', params);
    setLoading(true);
    setError(null);

    try {
      const packetDataArray = (await fetchData(params || queryParams)) || [];
      console.log('[PacketDetails] refreshed packetDataArray:', packetDataArray);

      const parsedPackets = packetDataArray.map((packetData) => {
        if (queryParams.ipver === 4) {
          return {
            timestamp: packetData[0],
            interface: packetData[1],
            direction: packetData[2],
            length: packetData[3],
            content: packetData[4],
            srcAddress: packetData[5],
            dstAddress: packetData[6],
            srcPort: packetData[7],
            dstPort: packetData[8],
            protocol: packetData[9],
            ipId: packetData[10],
            ttl: packetData[11],
            fragInfo: packetData[12],
            options: packetData[13],
          } as IPv4PacketData;
        } else {
          return {
            timestamp: packetData[0],
            interface: packetData[1],
            direction: packetData[2],
            length: packetData[3],
            content: packetData[4],
            srcAddress: packetData[5],
            dstAddress: packetData[6],
            headerType: packetData[7],
            srcPort: packetData[8],
            dstPort: packetData[9],
          } as IPv6PacketData;
        }
      });

      setPacketData(parsedPackets);
      setExpandedPackets(new Set([0])); // 默认展开第一个
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('[PacketDetails] Error refreshing packet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAllPackets = () => {
    console.log('[PacketDetails] handleViewAllPackets triggered');
    handleRefresh({ ...queryParams, count: 20000 });
  };

  useEffect(() => {
    // 只有当 isReady 为 true 时才获取数据
    if (!queryParams || !isReady) {
      console.log('[PacketDetails] 跳过数据获取', { hasQueryParams: !!queryParams, isReady });
      return;
    }

    const fetchPacketData = async () => {
      console.log('[PacketDetails] 开始获取packet数据');
      setLoading(true);
      setError(null);
      setPacketData([]);

      try {
        const packetDataArray = (await fetchData(queryParams)) || [];
        console.log('[PacketDetails] packetDataArray:', packetDataArray);

        const parsedPackets = packetDataArray.map((packetData) => {
          if (queryParams.ipver === 4) {
            return {
              timestamp: packetData[0],
              interface: packetData[1],
              direction: packetData[2],
              length: packetData[3],
              content: packetData[4],
              srcAddress: packetData[5],
              dstAddress: packetData[6],
              srcPort: packetData[7],
              dstPort: packetData[8],
              protocol: packetData[9],
              ipId: packetData[10],
              ttl: packetData[11],
              fragInfo: packetData[12],
              options: packetData[13],
            } as IPv4PacketData;
          } else {
            return {
              timestamp: packetData[0],
              interface: packetData[1],
              direction: packetData[2],
              length: packetData[3],
              content: packetData[4],
              srcAddress: packetData[5],
              dstAddress: packetData[6],
              headerType: packetData[7],
              srcPort: packetData[8],
              dstPort: packetData[9],
            } as IPv6PacketData;
          }
        });

        setPacketData(parsedPackets);
        setExpandedPackets(new Set([0])); // 默认展开第一个
        console.log('[PacketDetails] 数据获取完成，共', parsedPackets.length, '条');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('[PacketDetails] Error fetching packet data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPacketData();
  }, [queryParams, isReady]); // 添加 isReady 依赖

  // 如果还在检查 ready 状态或未准备好，显示 loading 或错误状态
  if (!isReady) {
    console.log('[PacketDetails] 显示初始化界面');
    return (
      <div className={classNames(
        "h-full w-full flex items-center justify-center min-w-[500px] border-l",
        isDark
          ? "bg-gray-900 border-gray-700"
          : "bg-gray-50 border-gray-200"
      )}>
        {readyError || maxAttemptsReached ? (
          <div className="flex flex-col items-center gap-5 max-w-sm px-6">
            {/* 错误图标 */}
            <div className={classNames(
              "w-14 h-14 rounded-full flex items-center justify-center",
              isDark ? "bg-red-500/10" : "bg-red-50"
            )}>
              <svg
                className={classNames(
                  "w-7 h-7",
                  isDark ? "text-red-400" : "text-red-500"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* 错误信息 */}
            <div className="text-center space-y-1">
              <h3 className={classNames(
                "text-base font-semibold",
                isDark ? "text-gray-100" : "text-gray-900"
              )}>
                服务初始化失败
              </h3>
              <p className={classNames(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-500"
              )}>
                {readyError || '服务没有开启或网络故障'}
              </p>
            </div>

            {/* 重试按钮 */}
            <button
              onClick={() => {
                console.log('[PacketDetails] 用户点击重试');
                useMonitorReadyStore.getState().resetPolling();
              }}
              className={classNames(
                "px-5 py-2 rounded-md font-medium text-sm transition-all duration-200",
                "flex items-center gap-2",
                isDark
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新尝试
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* 加载动画圆点 */}
            <div className="flex gap-1.5">
              <span
                className={classNames(
                  "w-2 h-2 rounded-full animate-pulse",
                  isDark ? "bg-blue-500" : "bg-blue-500"
                )}
                style={{ animationDelay: '0ms' }}
              />
              <span
                className={classNames(
                  "w-2 h-2 rounded-full animate-pulse",
                  isDark ? "bg-blue-500" : "bg-blue-500"
                )}
                style={{ animationDelay: '150ms' }}
              />
              <span
                className={classNames(
                  "w-2 h-2 rounded-full animate-pulse",
                  isDark ? "bg-blue-500" : "bg-blue-500"
                )}
                style={{ animationDelay: '300ms' }}
              />
            </div>

            {/* 加载文本 */}
            <span className={classNames(
              "text-sm font-medium",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              正在连接服务
            </span>
          </div>
        )}
      </div>
    );
  }
  if (!queryParams) {
    console.log('[PacketDetails] 无 queryParams，显示空状态');
    return <EmptyState type="no-selection" />;
  }
  console.log('[PacketDetails] 显示正常内容，packet数量:', packetData.length);

  // 判断是否全部展开
  const allExpanded = packetData.length > 0 && expandedPackets.size === packetData.length;

  return (
    <div className={classNames(
      "h-full w-full flex flex-col min-w-[500px] border-l",
      isDark
        ? "bg-gray-900 border-gray-700"
        : "bg-gray-50 border-gray-200"
    )}>
      {/* 头部摘要 */}
      <PacketHeader
        queryParams={queryParams}
        packetData={packetData}
        loading={loading}
        allExpanded={allExpanded}
        onToggleAll={toggleAllPackets}
        onRefresh={() => handleRefresh()}
        onViewAllPackets={handleViewAllPackets}
      />

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto p-4">
        {loading && <LoadingState />}

        {error && <ErrorState error={error} />}

        {!loading && !error && packetData.length === 0 && (
          <EmptyState type="no-packets" />
        )}

        {!loading && !error && packetData.length > 0 && (
          <div className="space-y-4">
            {packetData.sort((a, b) => b.timestamp - a.timestamp).map((packet, index) => (
              <PacketItem
                key={index}
                packet={packet}
                index={index}
                isExpanded={expandedPackets.has(index)}
                onToggle={() => togglePacketExpansion(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PacketDetails;