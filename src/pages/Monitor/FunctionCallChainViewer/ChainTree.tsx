import React, { useMemo } from 'react';
import { Tree, Button, ConfigProvider } from 'antd';
import { ArrowLeft, Play, Clock, Hash, BarChart2 } from 'lucide-react';
import { useIntl } from 'react-intl';

interface ChainTreeProps {
  filteredData: Array<{
    chainIndex: number;
    calls: Array<{
      timestamp: number;
      isReturn: boolean;
      funcId: number;
      threadId: number;
      funcName: string;
      callType: string;
      depth: number;
      callIndex: number;
      chainIndex: number;
    }>;
    originalLength: number;
  }>;
  selectedCall: { chainIndex: number; callIndex: number } | null;
  expandedKeys: string[];
  onExpandedKeysChange: (keys: string[]) => void;
  onCallSelect: (call: { chainIndex: number; callIndex: number }) => void;
  onOpenGraphModal: (index: number) => void;
}

const ChainTree: React.FC<ChainTreeProps> = ({
  filteredData,
  selectedCall,
  expandedKeys,
  onExpandedKeysChange,
  onCallSelect,
  onOpenGraphModal,
}) => {
  const intl = useIntl();

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  };

  const treeData = useMemo(() => {
    return filteredData.map(({ chainIndex, calls, originalLength }) => {
      const stack: Array<{
        key: string;
        title: JSX.Element;
        children: any[];
        callData: any;
      }> = [];
      const treeNodes: any[] = [];
      let nodeId = 0;

      calls.forEach((call) => {
        const currentNodeId = `${chainIndex}-${nodeId++}`;
        const nodeData = {
          key: currentNodeId,
          title: (
            <div 
              onClick={() => onCallSelect({ chainIndex: call.chainIndex, callIndex: call.callIndex })} 
              className={`flex items-center gap-3 py-0 px-2 rounded cursor-pointer transition-colors w-full ${
                selectedCall?.chainIndex === call.chainIndex && selectedCall?.callIndex === call.callIndex 
                  ? 'bg-blue-100 border-l-2 border-blue-500' 
                  : 'hover:bg-gray-100 border-l-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                {call.isReturn ? (
                  <ArrowLeft size={16} className="text-red-500" />
                ) : (
                  <Play size={16} className="text-green-500" />
                )}
                <span className={`text-xs font-medium ${call.isReturn ? 'text-red-600' : 'text-green-600'}`}>
                  {call.callType}
                </span>
                <code className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm font-medium">
                  {call.funcName}
                </code>
              </div>
              <div className="ml-auto flex items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatTime(call.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <Hash size={12} />
                  {call.funcId}
                </span>
              </div>
            </div>
          ),
          children: [],
          callData: call,
        };

        if (!call.isReturn) {
          if (stack.length === 0) {
            treeNodes.push(nodeData);
          } else {
            stack[stack.length - 1].children.push(nodeData);
          }
          stack.push(nodeData);
        } else {
          if (stack.length > 0) {
            stack[stack.length - 1].children.push(nodeData);
            stack.pop();
          } else {
            treeNodes.push(nodeData);
          }
        }
      });

      return {
        key: `chain-${chainIndex}`,
        title: (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-blue-700 font-semibold mr-4">
              <span className="text-sm">
                {intl.formatMessage(
                  { id: 'FunctionCallChainViewer.chainTitle' },
                  { chainIndex: chainIndex + 1 }
                )}
              </span>
              <span className="text-amber-700 text-xs font-normal">
                {intl.formatMessage(
                  { id: 'FunctionCallChainViewer.threadId' },
                  { threadId: calls[0]?.threadId }
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 bg-blue-50 px-2 py-0.5 rounded">
                {intl.formatMessage(
                  { id: 'FunctionCallChainViewer.callCountInChain' },
                  { callCount: calls.length, originalLength: originalLength }
                )}
              </div>
              <Button
                className="text-xs"
                size="small"
                type="text"
                icon={<BarChart2 size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGraphModal(chainIndex);
                }}
                title={intl.formatMessage(
                  { id: 'FunctionCallChainViewer.viewChainGraphTooltip' },
                  { chainIndex: chainIndex + 1 }
                )}
              >
                {intl.formatMessage({ id: 'FunctionCallChainViewer.viewGraph' })}
              </Button>
            </div>
          </div>
        ),
        children: treeNodes,
        selectable: false,
      };
    });
  }, [filteredData, selectedCall, intl, onCallSelect, onOpenGraphModal]);

  return (
    <div className="min-w-[600px]">
      <ConfigProvider
        theme={{
          components: {
            Tree: {
              nodeHoverBg: 'transparent',
              nodeSelectedBg: 'transparent',
            },
          },
        }}
      >
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={onExpandedKeysChange}
          onSelect={(keys, info) => {
            if (info.node.callData) {
              onCallSelect({
                chainIndex: info.node.callData.chainIndex,
                callIndex: info.node.callData.callIndex,
              });
            }
          }}
          showLine={{ showLeafIcon: false }}
          className="bg-white border border-gray-200 rounded-md p-4"
        />
      </ConfigProvider>
    </div>
  );
};

export default ChainTree;