import React, { useState, useMemo, useEffect } from 'react';
import { Spin, Button } from 'antd';
import { Cpu, AlertCircle } from 'lucide-react';
import { useIntl } from 'react-intl';
import { useFunctionCallData } from './useFunctionCallData';
import CallChainToolbar from './CallChainToolbar';
import CallChainTree from './CallChainTree';
import CallDetailsPanel from './CallDetailsPanel';
import FunctionCallGraph from './FunctionCallGraph';
import { QueryParams, SelectedCall, ProcessedCall, Call } from './types';

interface FunctionCallChainViewerProps {
  queryParams: QueryParams | null;
}

const FunctionCallChainViewer: React.FC<FunctionCallChainViewerProps> = ({ queryParams }) => {
  const intl = useIntl();
  const {
    chainData,
    funcTable,
    loading,
    error,
    fetchChainData,
    receiveChainName,
    sendChainName,
    isClickedAllChains,
  } = useFunctionCallData(queryParams);

  const [currentChainType, setCurrentChainType] = useState(receiveChainName);
  
  // UI State
  const [selectedCall, setSelectedCall] = useState<SelectedCall | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['chain-0']);
  const [filterText, setFilterText] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('all');
  const [threadFilter, setThreadFilter] = useState('all');
  
  // Graph Modal State
  const [isGraphVisible, setIsGraphVisible] = useState(false);
  const [graphChainIndex, setGraphChainIndex] = useState<'all' | number>('all');
  const [durationFilter, setDurationFilter] = useState([0, 10000]);
  
  // Reset state when data or chain type changes
  useEffect(() => {
    setSelectedCall(null);
    setExpandedKeys(['chain-0']);
    resetFilters();
  }, [chainData, currentChainType]);

  const currentData = chainData[currentChainType] as Call[][] | null;

  const getFunctionName = (id: number) => funcTable[id]?.name || `Unknown_${id}`;
  const getCallType = (isReturn: number) => (isReturn ? 'RETURN' : 'CALL');

  const processedData = useMemo((): ProcessedCall[][] => {
    if (!currentData || !Array.isArray(currentData)) return [];
    return currentData.map((chain, chainIndex) => {
      let depth = 0;
      return chain.map((call, callIndex) => {
        const [timestamp, isReturn, funcId, threadId] = call;
        // Correct depth calculation
        const currentDepth = depth;
        if (!isReturn) {
          depth++;
        } else {
          depth = Math.max(0, depth - 1);
        }
        return {
          timestamp, isReturn: !!isReturn, funcId, threadId,
          funcName: getFunctionName(funcId),
          callType: getCallType(isReturn),
          depth: currentDepth, callIndex, chainIndex,
        };
      });
    });
  }, [currentData, funcTable]);
  
  const filteredData = useMemo(() => {
    return processedData
      .map((chain, chainIndex) => {
        const filteredCalls = chain.filter((call) => {
          if (filterText && !call.funcName.toLowerCase().includes(filterText.toLowerCase()) && !String(call.funcId).includes(filterText)) return false;
          if (callTypeFilter !== 'all' && call.callType.toLowerCase() !== callTypeFilter) return false;
          if (threadFilter !== 'all' && String(call.threadId) !== threadFilter) return false;
          return true;
        });
        return { chainIndex, calls: filteredCalls, originalLength: chain.length };
      })
      .filter((chain) => chain.calls.length > 0);
  }, [processedData, filterText, callTypeFilter, threadFilter]);

  const allThreadIds = useMemo(() => {
    const threads = new Set<number>();
    processedData.forEach((chain) => chain.forEach((call) => threads.add(call.threadId)));
    return Array.from(threads).sort((a, b) => a - b);
  }, [processedData]);

  const resetFilters = () => {
    setFilterText('');
    setCallTypeFilter('all');
    setThreadFilter('all');
  };

  const openGraphModal = (index: 'all' | number) => {
    setGraphChainIndex(index);
    setIsGraphVisible(true);
  };
  
  if (error) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center text-center p-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-700 mb-2">{intl.formatMessage({ id: 'FunctionCallChainViewer.loadFailed' })}</div>
          <div className="text-sm text-slate-500 break-all mb-4">{error}</div>
          {queryParams && <Button onClick={() => fetchChainData(queryParams)}>{intl.formatMessage({ id: 'FunctionCallChainViewer.retry' })}</Button>}
      </div>
    );
  }

  if (!queryParams) {
    return (
      <div className="h-full w-full bg-gray-50 flex items-center justify-center text-center">
        <div>
          <Cpu className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-500 mb-2">{intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}</div>
          <div className="text-sm text-slate-400">{intl.formatMessage({ id: 'FunctionCallChainViewer.selectConnectionPrompt' })}</div>
        </div>
      </div>
    );
  }

  return (
      <div className="h-full w-full bg-gray-50 text-slate-800 flex flex-col font-mono text-sm min-w-[800px]">
        <CallChainToolbar
          receiveChainName={receiveChainName}
          sendChainName={sendChainName}
          currentChainType={currentChainType}
          onChainTypeChange={setCurrentChainType}
          currentData={currentData}
          isClickedAllChains={isClickedAllChains}
          onViewAllChainsClick={() => queryParams && fetchChainData({ ...queryParams, count: 20000 })}
          filterText={filterText}
          onFilterTextChange={(e) => setFilterText(e.target.value)}
          callTypeFilter={callTypeFilter}
          onCallTypeFilterChange={setCallTypeFilter}
          threadFilter={threadFilter}
          onThreadFilterChange={setThreadFilter}
          allThreadIds={allThreadIds}
          onResetFilters={resetFilters}
          onOpenGraphModal={() => openGraphModal('all')}
          filteredCount={filteredData.reduce((acc, chain) => acc + chain.calls.length, 0)}
          totalCount={currentData ? currentData.reduce((acc, chain) => acc + chain.length, 0) : 0}
        />

        <div className="flex-1 flex overflow-hidden min-w-0">
          <div className={`flex-1 flex flex-col min-w-[500px] transition-all duration-300 ${selectedCall ? 'w-3/4' : 'w-full'}`}>
            <div className="flex-1 overflow-auto px-4 py-4 min-w-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Spin />
                  <span className="ml-2 text-slate-500">{intl.formatMessage({ id: 'FunctionCallChainViewer.loadingData' }, { chainType: currentChainType })}</span>
                </div>
              ) : !currentData || currentData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500">{intl.formatMessage({ id: 'FunctionCallChainViewer.noData' }, { chainType: currentChainType })}</div>
              ) : (
                <CallChainTree
                  filteredData={filteredData}
                  selectedCall={selectedCall}
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  onSelect={setSelectedCall}
                  onOpenGraphModal={openGraphModal}
                />
              )}
            </div>
          </div>

          {selectedCall && processedData.length > 0 && (
            <CallDetailsPanel
              selectedCall={selectedCall}
              processedData={processedData}
              funcTable={funcTable}
              onClose={() => setSelectedCall(null)}
            />
          )}
        </div>
        
        {isGraphVisible && <FunctionCallGraph
            isGraphVisible={isGraphVisible}
            onCancel={() => setIsGraphVisible(false)}
            chainData={chainData}
            funcTable={funcTable}
            graphChainIndex={graphChainIndex}
            durationFilter={durationFilter}
            currentChainType={currentChainType}
            queryParams={queryParams}
            fetchChainData={fetchChainData}
        />}
      </div>
  );
};

export default FunctionCallChainViewer;