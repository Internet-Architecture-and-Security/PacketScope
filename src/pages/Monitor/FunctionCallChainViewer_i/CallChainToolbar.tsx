import React from 'react';
import { Input, Select, Button, Segmented } from 'antd';
import { Cpu, Search, Filter, RotateCcw } from 'lucide-react';
import { useIntl } from 'react-intl';

const { Option } = Select;

interface CallChainToolbarProps {
  receiveChainName: string;
  sendChainName: string;
  currentChainType: string;
  onChainTypeChange: (value: string) => void;
  currentData: any[] | null;
  isClickedAllChains: boolean;
  onViewAllChainsClick: () => void;
  filterText: string;
  onFilterTextChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  callTypeFilter: string;
  onCallTypeFilterChange: (value: string) => void;
  threadFilter: string;
  onThreadFilterChange: (value: string) => void;
  allThreadIds: (string | number)[];
  onResetFilters: () => void;
  onOpenGraphModal: () => void;
  filteredCount: number;
  totalCount: number;
}

const CallChainToolbar: React.FC<CallChainToolbarProps> = ({
  receiveChainName,
  sendChainName,
  currentChainType,
  onChainTypeChange,
  currentData,
  isClickedAllChains,
  onViewAllChainsClick,
  filterText,
  onFilterTextChange,
  callTypeFilter,
  onCallTypeFilterChange,
  threadFilter,
  onThreadFilterChange,
  allThreadIds,
  onResetFilters,
  onOpenGraphModal,
  filteredCount,
  totalCount
}) => {
  const intl = useIntl();
  const isFiltered = filterText || callTypeFilter !== 'all' || threadFilter !== 'all';
  const totalCalls = currentData ? currentData.reduce((acc, chain) => acc + chain.length, 0) : 0;

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Cpu className="text-blue-600" size={20} />
        <span className="font-semibold text-base text-slate-900">{intl.formatMessage({ id: 'FunctionCallChainViewer.analyzerTitle' })}</span>
        <Segmented size="small" options={[receiveChainName, sendChainName]} value={currentChainType} onChange={onChainTypeChange} />
        {currentData && (
          <div className="text-xs text-slate-500 ml-2 flex items-center">
            {intl.formatMessage({ id: 'FunctionCallChainViewer.chainStats' }, { chainCount: currentData.length, callCount: totalCalls })}
            <Button disabled={isClickedAllChains} size="small" className="ml-2" onClick={onViewAllChainsClick}>
              {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAllChains' })}
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white w-full border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3 flex-wrap scale-90 origin-left">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-medium text-slate-700">{intl.formatMessage({ id: 'FunctionCallChainViewer.filter' })}</span>
          </div>
          <Input placeholder={intl.formatMessage({ id: 'FunctionCallChainViewer.searchPlaceholder' })} value={filterText} onChange={onFilterTextChange} prefix={<Search className="w-3.5 h-3.5 text-slate-400" />} size="small" style={{ width: 160, fontSize: '12px' }} />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">{intl.formatMessage({ id: 'FunctionCallChainViewer.type' })}</label>
            <Select value={callTypeFilter} onChange={onCallTypeFilterChange} size="small" style={{ width: 90, fontSize: '12px' }}>
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              <Option value="call">{intl.formatMessage({ id: 'FunctionCallChainViewer.call' })}</Option>
              <Option value="return">{intl.formatMessage({ id: 'FunctionCallChainViewer.return' })}</Option>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-600">{intl.formatMessage({ id: 'FunctionCallChainViewer.thread' })}</label>
            <Select value={threadFilter} onChange={onThreadFilterChange} size="small" style={{ width: 80, fontSize: '12px' }}>
              <Option value="all">{intl.formatMessage({ id: 'FunctionCallChainViewer.all' })}</Option>
              {allThreadIds.map((threadId) => (<Option key={threadId} value={String(threadId)}>{threadId}</Option>))}
            </Select>
          </div>
          <Button onClick={onResetFilters} size="small" icon={<RotateCcw className="w-3 h-3" />} className="flex items-center gap-1 text-xs">
            {intl.formatMessage({ id: 'FunctionCallChainViewer.reset' })}
          </Button>
          <Button size="small" onClick={onOpenGraphModal}>
            {intl.formatMessage({ id: 'FunctionCallChainViewer.viewAggregatedGraph' })}
          </Button>
          {isFiltered && (
            <div className="text-xs text-slate-500 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">
              {intl.formatMessage({ id: 'FunctionCallChainViewer.filterResult' }, { filteredCount: filteredCount, totalCount: totalCount })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CallChainToolbar;