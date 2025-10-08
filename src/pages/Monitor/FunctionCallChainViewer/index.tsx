import React, { useState, useMemo, useEffect, useRef } from 'react';
import { App } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme, useMonitorReadyStore } from '@/stores/useStore';
import classNames from 'classnames';
import { APIs } from '@/constants';

// 导入拆分的组件
import ChainHeader from './ChainHeader';
import FilterBar from './FilterBar';
import ChainTree from './ChainTree';
import FunctionDetails from './FunctionDetails';
import GraphModal from './GraphModal';
import { LoadingState, ErrorState, EmptyState, NoQueryParamsState } from './LoadingErrorStates';
import { formatTime } from '@/utils';

interface FunctionCallChainViewerProps {
  queryParams: {
    srcip: string;
    dstip: string;
    srcport: number;
    dstport: number;
  } | null;
}

const FunctionCallChainViewer: React.FC<FunctionCallChainViewerProps> = ({ queryParams }) => {
  const intl = useIntl();
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  
  // 获取 ready 状态
  const { isReady, error: readyError, maxAttemptsReached } = useMonitorReadyStore();

  const receiveChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.receiveFunctionChain' });
  const sendChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.sendFunctionChain' });

  const [currentChainType, setCurrentChainType] = useState(receiveChainName);
  const [chainData, setChainData] = useState({
    [receiveChainName]: null,
    [sendChainName]: null,
  });
  const [funcTable, setFuncTable] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { message } = App.useApp();
  const isCheckedRef = useRef<boolean>(false);
  const [isClickedAllChains, setIsClickedAllChains] = useState<boolean>(false);

  const [selectedCall, setSelectedCall] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(['chain-0']);
  const [filterText, setFilterText] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('all');
  const [threadFilter, setThreadFilter] = useState('all');

  const [isGraphVisible, setIsGraphVisible] = useState(false);
  const [graphChainIndex, setGraphChainIndex] = useState<'all' | number>('all');

  const [durationFilter, setDurationFilter] = useState([0, 10000]);
  const [showDurationFilter, setShowDurationFilter] = useState(false);

  const getFunctionName = (id) => funcTable[id]?.name || `Unknown_${id}`;
  const getCallType = (isReturn) => (isReturn ? 'RETURN' : 'CALL');

  const currentData = chainData[currentChainType];

  // 处理数据的逻辑
  const processedData = useMemo(() => {
    if (!currentData || !currentData.length) return [];
    return currentData.map((chain, chainIndex) => {
      let depth = 0;
      return chain.map((call, callIndex) => {
        const [timestamp, isReturn, funcId, threadId] = call;
        if (isReturn) depth = Math.max(0, depth - 1);
        const currentDepth = depth;
        if (!isReturn) depth++;
        return {
          timestamp, isReturn, funcId, threadId,
          funcName: getFunctionName(funcId),
          callType: getCallType(isReturn),
          depth: currentDepth, callIndex, chainIndex,
        };
      });
    });
  }, [currentData, funcTable]);

  // 过滤数据的逻辑
  const filteredData = useMemo(() => {
    return processedData
      .map((chain, chainIndex) => {
        const filteredCalls = chain.filter((call) => {
          if (filterText && !call.funcName.toLowerCase().includes(filterText.toLowerCase()) && !call.funcId.toString().includes(filterText)) return false;
          if (callTypeFilter !== 'all' && call.callType.toLowerCase() !== callTypeFilter) return false;
          if (threadFilter !== 'all' && call.threadId.toString() !== threadFilter) return false;
          return true;
        });
        return { chainIndex, calls: filteredCalls, originalLength: chain.length };
      })
      .filter((chain) => chain.calls.length > 0);
  }, [processedData, filterText, callTypeFilter, threadFilter]);

  // 获取所有线程ID
  const allThreadIds = useMemo(() => {
    const threads = new Set();
    processedData.forEach((chain) => chain.forEach((call) => threads.add(call.threadId)));
    return Array.from(threads).sort();
  }, [processedData]);

  // 计算持续时间范围
  const durationRange = useMemo(() => {
    if (!chainData || (!chainData[receiveChainName] && !chainData[sendChainName])) return [0, 10000];
    const functionStats = new Map();
    const processChain = (chain: number[][][]) => {
      if (!Array.isArray(chain)) return;
      for (const singleChain of chain) {
        const callStack = [];
        for (let i = 0; i < singleChain.length; i++) {
          const item = singleChain[i] as [number, number, number, number];
          const [timestamp, isReturn, addr] = item;
          const functionKey = `${addr}`;
          if (!isReturn) {
            callStack.push({ addr, startTime: timestamp });
            if (!functionStats.has(functionKey)) {
              functionStats.set(functionKey, { durations: [], totalDuration: 0 });
            }
          } else {
            if (callStack.length > 0) {
              const callInfo = callStack.pop();
              if (callInfo && callInfo.addr === addr) {
                const duration = (timestamp - callInfo.startTime) * 1000000;
                const stats = functionStats.get(functionKey);
                if (stats) {
                  stats.durations.push(duration);
                  stats.totalDuration += duration;
                }
              }
            }
          }
        }
      }
    };
    processChain(chainData[receiveChainName]);
    processChain(chainData[sendChainName]);
    const avgDurations = Array.from(functionStats.values()).map((stats) => (stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0)).filter((duration) => duration > 0);
    if (avgDurations.length === 0) return [0, 10000];
    return [Math.floor(Math.min(...avgDurations)), Math.ceil(Math.max(...avgDurations))];
  }, [chainData, receiveChainName, sendChainName]);

  useEffect(() => {
    if (durationRange[0] !== durationRange[1]) {
      setDurationFilter(durationRange);
    }
  }, [durationRange]);

  // API调用函数
  const fetchFuncTable = async () => {
    try {
      const res = await fetch(APIs['Tracer.getFuncTable'], { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setFuncTable(data);
    } catch (err) {
      console.error('Failed to fetch function table:', err);
      message.error('Failed to fetch function table');
    }
  };

  const fetchChainData = async (params) => {
    if (!params.srcip) {
      message.warning('Missing required parameters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('srcip', params.srcip);
      formData.append('dstip', params.dstip);
      formData.append('srcport', params.srcport);
      formData.append('dstport', params.dstport);
      formData.append('count', params.count ?? 1);
      const res = await fetch(APIs['Tracer.getRecentMap'], { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const newData = {
        [receiveChainName]: data[0],
        [sendChainName]: data[1],
      };
      setChainData(newData);
      if (params.count) isCheckedRef.current = true;
      setIsClickedAllChains(false);
      setSelectedCall(null);
      setExpandedKeys(['chain-0']);
      return newData;
    } catch (err) {
      const errorMsg = 'Failed to fetch chain data';
      const errorDetails = `Failed to fetch ${currentChainType} data`;
      console.error(errorMsg, err);
      setError(`${errorDetails}: ${err.message}`);
      message.error(errorDetails);
    } finally {
      setLoading(false);
    }
  };

  // 事件处理函数
  const handleChainTypeChange = (value) => {
    setCurrentChainType(value);
  };

  const resetFilters = () => {
    setFilterText('');
    setCallTypeFilter('all');
    setThreadFilter('all');
    setDurationFilter([0, 10000]);
    setShowDurationFilter(false);
  };

  const openGraphModal = (index: 'all' | number) => {
    setGraphChainIndex(index);
    setIsGraphVisible(true);
  };

  const handleViewAllChains = () => {
    setIsClickedAllChains(true);
    fetchChainData({ ...queryParams, count: 20000 });
  };

  // 生命周期
  useEffect(() => {
    if (queryParams) {
      isCheckedRef.current = false;
      setIsClickedAllChains(false);
      fetchFuncTable();
      fetchChainData(queryParams);
    }
  }, [queryParams]);

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

  // 渲染错误状态
  if (error) {
    return <ErrorState error={error} onRetry={() => fetchChainData(queryParams)} />;
  }

  // 渲染无查询参数状态
  if (!queryParams) {
    return <NoQueryParamsState />;
  }

  return (
    <div className={classNames(
      "h-full w-full flex flex-col font-mono text-sm min-w-[800px]",
      isDark ? "bg-gray-900 text-gray-200" : "bg-gray-50 text-slate-800"
    )}>
      <ChainHeader
        receiveChainName={receiveChainName}
        sendChainName={sendChainName}
        currentChainType={currentChainType}
        onChainTypeChange={handleChainTypeChange}
        currentData={currentData}
        processedData={processedData}
        isClickedAllChains={isClickedAllChains}
        queryParams={queryParams}
        onViewAllChains={handleViewAllChains}
      />

      <FilterBar
        filterText={filterText}
        onFilterTextChange={setFilterText}
        callTypeFilter={callTypeFilter}
        onCallTypeFilterChange={setCallTypeFilter}
        threadFilter={threadFilter}
        onThreadFilterChange={setThreadFilter}
        allThreadIds={allThreadIds}
        onResetFilters={resetFilters}
        onViewAggregatedGraph={() => openGraphModal('all')}
        filteredData={filteredData}
        currentData={currentData}
      />

      <div className="flex h-full overflow-hidden min-w-0">
        <div className={classNames(
          "flex-1 flex flex-col min-w-[500px]",
          selectedCall ? "w-3/4" : "w-full"
        )}>
          <div className="flex-1 overflow-auto px-4 py-4 min-w-0">
            {loading ? (
              <LoadingState currentChainType={currentChainType} />
            ) : !currentData || currentData.length === 0 ? (
              <EmptyState currentChainType={currentChainType} />
            ) : (
              <ChainTree
                filteredData={filteredData}
                selectedCall={selectedCall}
                onSelectCall={setSelectedCall}
                expandedKeys={expandedKeys}
                onExpandedKeysChange={setExpandedKeys}
                onOpenGraphModal={openGraphModal}
                formatTime={formatTime}
              />
            )}
          </div>
        </div>

        {selectedCall && (
          <FunctionDetails
            selectedCall={selectedCall}
            processedData={processedData}
            funcTable={funcTable}
            formatTime={formatTime}
            onClose={() => setSelectedCall(null)}
          />
        )}
      </div>

      <GraphModal
        isVisible={isGraphVisible}
        onClose={() => setIsGraphVisible(false)}
        graphChainIndex={graphChainIndex}
        chainData={chainData}
        funcTable={funcTable}
        durationFilter={durationFilter}
        queryParams={queryParams}
        receiveChainName={receiveChainName}
        sendChainName={sendChainName}
      />
    </div>
  );
};

export default FunctionCallChainViewer;