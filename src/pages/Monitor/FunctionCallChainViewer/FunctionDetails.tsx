import React from 'react';
import { Button } from 'antd';
import { X } from 'lucide-react';
import { useIntl } from 'react-intl';

interface FunctionDetailsProps {
  selectedCall: {
    chainIndex: number;
    callIndex: number;
  } | null;
  processedData: Array<Array<{
    timestamp: number;
    isReturn: boolean;
    funcId: number;
    threadId: number;
    funcName: string;
    callType: string;
    depth: number;
    callIndex: number;
    chainIndex: number;
  }>>;
  funcTable: Record<string, {
    name: string;
    kind: string;
    type_id: string;
    linkage: string;
  }>;
  onClose: () => void;
}

const FunctionDetails: React.FC<FunctionDetailsProps> = ({
  selectedCall,
  processedData,
  funcTable,
  onClose,
}) => {
  const intl = useIntl();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  };

  if (!selectedCall || processedData.length === 0) {
    return null;
  }

  const call = processedData[selectedCall.chainIndex][selectedCall.callIndex];
  const funcInfo = funcTable[call.funcId];

  return (
    <div className="w-1/4 min-w-[280px] bg-white border-l border-gray-200 flex flex-col">
      <div className="px-2 py-1 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">
          {intl.formatMessage({ id: 'FunctionCallChainViewer.functionDetails' })}
        </div>
        <Button
          type="text"
          size="small"
          icon={<X className="w-4 h-4 text-slate-500" />}
          onClick={onClose}
        />
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
              <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <div className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                {intl.formatMessage({ id: 'FunctionCallChainViewer.basicInfo' })}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.functionName' })}
                </div>
                <code className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm font-medium block break-all">
                  {call.funcName}
                </code>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.callType' })}
                </div>
                <span
                  className={`text-sm font-medium px-2 py-1 rounded ${
                    call.isReturn
                      ? 'text-red-600 bg-red-50'
                      : 'text-green-600 bg-green-50'
                  }`}
                >
                  {call.callType}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
              <div className="w-1 h-4 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
              <div className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                {intl.formatMessage({ id: 'FunctionCallChainViewer.executionInfo' })}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.timestamp' })}
                </div>
                <div className="text-sm text-slate-700 font-mono break-all">
                  {formatTime(call.timestamp)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.functionId' })}
                </div>
                <div className="text-sm text-slate-700 font-mono">{call.funcId}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.threadIdLabel' })}
                </div>
                <div className="text-sm text-slate-700 font-mono">{call.threadId}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.callDepth' })}
                </div>
                <div className="text-sm text-slate-700">{call.depth}</div>
              </div>
            </div>
          </div>
          
          {funcInfo && (
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
                <div className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  {intl.formatMessage({ id: 'FunctionCallChainViewer.metadata' })}
                </div>
              </div>
              <div className="bg-gray-50 rounded p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Kind:</span>
                  <span className="text-xs text-slate-700 font-mono">{funcInfo.kind}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Type ID:</span>
                  <span className="text-xs text-slate-700 font-mono">{funcInfo.type_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Linkage:</span>
                  <span className="text-xs text-slate-700 font-mono">{funcInfo.linkage}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FunctionDetails;