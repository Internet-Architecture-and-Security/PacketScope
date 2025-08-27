import React, { useState, useMemo, useEffect, useRef } from 'react';
import { App } from 'antd';
import { useIntl } from 'react-intl';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';
import { APIs } from '@/constants/APs';

// 导入拆分的组件
import ChainHeader from './ChainHeader';
import FilterBar from './FilterBar';
import ChainTree from './ChainTree';
import FunctionDetails from './FunctionDetails';
import GraphModal from './GraphModal';
import { LoadingState, ErrorState, EmptyState, NoQueryParamsState } from './LoadingErrorStates';

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

  // 格式化时间的函数
  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  };

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