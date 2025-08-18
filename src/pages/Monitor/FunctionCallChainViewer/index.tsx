import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Cpu, AlertCircle, Search, Filter, RotateCcw } from 'lucide-react';
import { Input, Select, Button, Segmented, Spin, App } from 'antd';
import { useIntl } from 'react-intl';
import ChainTree from './ChainTree';
import FunctionDetails from './FunctionDetails';
import GraphModal from './GraphModal';

const { Option } = Select;

interface FunctionCallChainViewerProps {
  queryParams: {
    srcip: string;
    dstip: string;
    srcport: number;
    dstport: number;
  } | null;
}

interface ChainData {
  [key: string]: number[][][] | null;
}

interface FuncTable {
  [key: string]: {
    name: string;
    kind: string;
    type_id: string;
    linkage: string;
  };
}

interface ProcessedCall {
  timestamp: number;
  isReturn: boolean;
  funcId: number;
  threadId: number;
  funcName: string;
  callType: string;
  depth: number;
  callIndex: number;
  chainIndex: number;
}

interface FilteredChainData {
  chainIndex: number;
  calls: ProcessedCall[];
  originalLength: number;
}

interface SelectedCall {
  chainIndex: number;
  callIndex: number;
}

const FunctionCallChainViewer: React.FC<FunctionCallChainViewerProps> = ({ queryParams }) => {
  const intl = useIntl();
  const receiveChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.receiveFunctionChain' });
  const sendChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.sendFunctionChain' });

  // State management
  const [currentChainType, setCurrentChainType] = useState(receiveChainName);
  const [chainData, setChainData] = useState<ChainData>({
    [receiveChainName]: null,
    [sendChainName]: null,
  });
  const [funcTable, setFuncTable] = useState<FuncTable>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message } = App.useApp();
  const isCheckedRef = useRef<boolean>(false);
  const [isClickedAllChains, setIsClickedAllChains] = useState<boolean>(false);

  // UI state
  const [selectedCall, setSelectedCall] = useState<SelectedCall | null>(null);
  const [expandedKeys, setExpandedKeys] = useState(['chain-0']);
  const [filterText, setFilterText] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('all');
  const [threadFilter, setThreadFilter] = useState('all');

  // Graph modal state
  const [isGraphVisible, setIsGraphVisible] = useState(false);
  const [graphChainIndex, setGraphChainIndex] = useState<'all' | number>('all');

  // Duration filter state
  const [durationFilter, setDurationFilter] = useState<[number, number]>([0, 10000]);

  // Calculate duration range from chain data
  const durationRange = useMemo(() => {
    if (!chainData || (!chainData[receiveChainName] && !chainData[sendChainName])) {
      return [0, 10000] as [number, number];
    }
    
    const functionStats = new Map<string, { durations: number[]; totalDuration: number }>();
    
    const processChain = (chain: number[][][]) => {
      if (!Array.isArray(chain)) return;
      for (const singleChain of chain) {
        const callStack: Array<{ addr: number; startTime: number }> = [];
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
    
    const avgDurations = Array.from(functionStats.values())
      .map((stats) => (stats.durations.length > 0 ? stats.totalDuration / stats.durations.length : 0))
      .filter((duration) => duration > 0);
    
    if (avgDurations.length === 0) return [0, 10000] as [number, number];
    return [Math.floor(Math.min(...avgDurations)), Math.ceil(Math.max(...avgDurations))] as [number, number];
  }, [chainData, receiveChainName, sendChainName]);

  // Update duration filter when duration range changes
  useEffect(() => {
    if (durationRange[0] !== durationRange[1]) {
      setDurationFilter(durationRange);
    }
  }, [durationRange]);

  // Fetch function table data
  const fetchFuncTable = async () => {
    try {
      const res = await fetch('http://127.0.0.1:19999/GetFuncTable', { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setFuncTable(data);
    } catch (err: any) {
      console.error(intl.formatMessage({ id: 'FunctionCallChainViewer.fetchFuncTableFailed' }), err);
      message.error(intl.formatMessage({ id: 'FunctionCallChainViewer.fetchFuncTableFailed' }));
    }
  };

  // Fetch chain data from API
  const fetchChainData = async (params: any) => {
    if (!params.srcip) {
      message.warning(intl.formatMessage({ id: 'FunctionCallChainViewer.missingParams' }));
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = 'http://127.0.0.1:19999/GetRecentMap';
      const formData = new URLSearchParams();
      formData.append('srcip', params.srcip);
      formData.append('dstip', params.dstip);
      formData.append('srcport', params.srcport.toString());
      formData.append('dstport', params.dstport.toString());
      formData.append('count', params.count ?? '1');
      
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      
      const newData: ChainData = {
        [receiveChainName]: data[0],
        [sendChainName]: data[1],
      };
      
      setChainData(newData);
      if (params.count) isCheckedRef.current = true;
      setIsClickedAllChains(false);
      setSelectedCall(null);
      setExpandedKeys(['chain-0']);
      return newData;
    } catch (err: any) {
      const errorMsg = intl.formatMessage({ id: 'FunctionCallChainViewer.fetchChainDataFailed' });
      const errorDetails = intl.formatMessage(
        { id: 'FunctionCallChainViewer.fetchChainTypeDataFailed' },
        { chainType: currentChainType }
      );
      console.error(errorMsg, err);
      setError(`${errorDetails}: ${err.message}`);
      message.error(errorDetails);
    } finally {
      setLoading(false);
    }
  };

  // Handle chain type change
  const handleChainTypeChange = (value: string) => {
    setCurrentChainType(value);
  };

  // Initialize data when queryParams change
  useEffect(() => {
    if (queryParams) {
      isCheckedRef.current = false;
      setIsClickedAllChains(false);
      fetchFuncTable();
      fetchChainData(queryParams);
    }
  }, [queryParams]);

  // Reset all filters
  const resetFilters = () => {
    setFilterText('');
    setCallTypeFilter('all');
    setThreadFilter('all');
    setDurationFilter(durationRange);
  };

  // Open graph modal
  const openGraphModal = (index: 'all' | number) => {
    setGraphChainIndex(index);
    setIsGraphVisible(true);
  };

  // Utility functions
  const getFunctionName = (id: number) => funcTable[id]?.name || `Unknown_${id}`;
  const getCallType = (isReturn: boolean) => (isReturn ? 'RETURN' : 'CALL');

  // Get current chain data
  const currentData = chainData[currentChainType];

  // Process raw chain data into structured format
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
          timestamp,
          isReturn,
          funcId,
          threadId,
          funcName: getFunctionName(funcId),
          callType: getCallType(isReturn),
          depth: currentDepth,
          callIndex,
          chainIndex,
        };
      });
    });
  }, [currentData, funcTable]);

  // Apply filters to processed data
  const filteredData = useMemo(() => {
    return processedData
      .map((chain, chainIndex) => {
        const filteredCalls = chain.filter((call) => {
          // Text filter
          if (
            filterText &&
            !call.funcName.toLowerCase().includes(filterText.toLowerCase()) &&
            !call.funcId.toString().includes(filterText)
          ) {
            return false;
          }
          
          // Call type filter
          if (callTypeFilter !== 'all' && call.callType.toLowerCase() !== callTypeFilter) {
            return false;
          }
          
          // Thread filter
          if (threadFilter !== 'all' && call.threadId.toString() !== threadFilter) {
            return false;
          }
          
          return true;
        });
        
        return { chainIndex, calls: filteredCalls, originalLength: chain.length };
      })
      .filter((chain) => chain.calls.length > 0);
  }, [processedData, filterText, callTypeFilter, threadFilter]);

  // Get all unique thread IDs for filter dropdown
  const allThreadIds = useMemo(() => {
    const threads = new Set<number>();
    processedData.forEach((chain) => 
      chain.forEach((call) => threads.add(call.threadId))
    );
    return Array.from(threads).sort();
  }, [processedData]);

  // Error state
  if (error) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-700 mb-2">
            {intl.formatMessage({ id: 'FunctionCallChainViewer.loadFailed' })}
          </div>
          <div className="text-sm text-slate-500 mb-4">{error}</div>
          <Button onClick={() => fetchChainData(queryParams)}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.retry' })}
          </Button>
        </div>
      </div>
    );
  }

  // No query params state
  if (!queryParams) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Cpu className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-500 mb-2">
            {intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}
          </div>
          <div className="text-sm text-slate-400">
            {intl.formatMessage({ id: 'FunctionCallChainViewer.selectConnectionPrompt' })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 text-slate-800 flex flex-col font-mono text-sm min-w-[800px]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Cpu className="text-blue-600" size={20} />
        <span className="font-semibold text-base text-slate-900">
          {intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}
        </span>
        <Segmented
          size="small"
          options={[receiveChainName, sendChainName]}
          value={currentChainType}
          onChange={handleChainTypeChange}
        />
        {currentData && processedData && (
          <div className="text-xs text-slate-500 ml-2 flex items-center">
            {intl.formatMessage(
              { id: 'FunctionCallChainViewer.chainStats' },
              {
                chainCount: currentData.length,
                callCount: currentData.reduce((acc, chain) => acc + chain.length, 0),
              }
            )}
            <Button
              disabled={isClickedAllChains}
              size="small"
              className="ml-2"
              onClick={() => {
                setIsClickedAllChains(true);
                fetchChainData({ ...queryParams, count: 20000 });
              }}
            >
              {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAllChains' })}
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white w-full border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3 flex-wrap scale-90 origin-left">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-medium text-slate-700">
              {intl.formatMessage({ id: 'FunctionCallChainViewer.filter' })}
            </span>
          </div>
          <Input
            placeholder={intl.formatMessage({ id: 'FunctionCallChainViewer.searchPlaceholder' })}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            prefix={<Search className="w-3.5 h-3.5 text-slate-400" />}
            size="small"
            style={{ width: 160, fontSize: '12px' }}
          />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">
              {intl.formatMessage({ id: 'FunctionCallChainViewer.type' })}
            </label>
            <Select
              value={callTypeFilter}
              onChange={setCallTypeFilter}
              size="small"
              style={{ width: 90, fontSize: '12px' }}
            >
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              <Option value="call">{intl.formatMessage({ id: 'FunctionCallChainViewer.call' })}</Option>
              <Option value="return">{intl.formatMessage({ id: 'FunctionCallChainViewer.return' })}</Option>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">
              {intl.formatMessage({ id: 'FunctionCallChainViewer.thread' })}
            </label>
            <Select
              value={threadFilter}
              onChange={setThreadFilter}
              size="small"
              style={{ width: 80, fontSize: '12px' }}
            >
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              {allThreadIds.map((threadId) => (
                <Option key={threadId} value={threadId.toString()}>
                  {threadId}
                </Option>
              ))}
            </Select>
          </div>
          <Button
            onClick={resetFilters}
            size="small"
            icon={<RotateCcw className="w-3 h-3" />}
            className="flex items-center gap-1 text-xs"
          >
            {intl.formatMessage({ id: 'FunctionCallChainViewer.reset' })}
          </Button>
          <Button size="small" onClick={() => openGraphModal('all')}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAggregatedGraph' })}
          </Button>
          {(filterText || callTypeFilter !== 'all' || threadFilter !== 'all') && (
            <div className="text-xs text-slate-500 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">
              {intl.formatMessage(
                { id: 'FunctionCallChainViewer.filterResult' },
                {
                  filteredCount: filteredData.reduce((acc, chain) => acc + chain.calls.length, 0),
                  totalCount: currentData.reduce((acc, chain) => acc + chain.length, 0),
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-full overflow-hidden min-w-0">
        <div className={`flex-1 flex flex-col min-w-[500px] ${selectedCall ? 'w-3/4' : 'w-full'}`}>
          <div className="flex-1 overflow-auto px-4 py-4 min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Spin />
                <span className="ml-2 text-slate-500">
                  {intl.formatMessage(
                    { id: 'FunctionCallChainViewer.loadingData' },
                    { chainType: currentChainType }
                  )}
                </span>
              </div>
            ) : !currentData || currentData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                {intl.formatMessage(
                  { id: 'FunctionCallChainViewer.noData' },
                  { chainType: currentChainType }
                )}
              </div>
            ) : (
              <ChainTree
                filteredData={filteredData}
                selectedCall={selectedCall}
                expandedKeys={expandedKeys}
                onExpandedKeysChange={setExpandedKeys}
                onCallSelect={setSelectedCall}
                onOpenGraphModal={openGraphModal}
              />
            )}
          </div>
        </div>

        {/* Function Details Panel */}
        <FunctionDetails
          selectedCall={selectedCall}
          processedData={processedData}
          funcTable={funcTable}
          onClose={() => setSelectedCall(null)}
        />
      </div>

      {/* Graph Modal */}
      <GraphModal
        isVisible={isGraphVisible}
        onClose={() => setIsGraphVisible(false)}
        chainData={chainData}
        graphChainIndex={graphChainIndex}
        durationFilter={durationFilter}
        funcTable={funcTable}
        receiveChainName={receiveChainName}
        sendChainName={sendChainName}
        currentChainType={currentChainType}
        queryParams={queryParams}
      />
    </div>
  );
};

export default FunctionCallChainViewer;