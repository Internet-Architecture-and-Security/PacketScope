import React from 'react';
import { Tree, ConfigProvider, Button, Empty } from 'antd';
import { Play, ArrowLeft, Clock, Hash, BarChart2 } from 'lucide-react';
import { useIntl } from 'react-intl';
import { ProcessedCall, SelectedCall } from './types';

interface CallChainTreeProps {
  filteredData: { chainIndex: number; calls: ProcessedCall[]; originalLength: number }[];
  selectedCall: SelectedCall | null;
  expandedKeys: string[];
  onExpand: (keys: any) => void;
  onSelect: (call: SelectedCall | null) => void;
  onOpenGraphModal: (index: number) => void;
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
};

const CallChainTree: React.FC<CallChainTreeProps> = ({
  filteredData,
  selectedCall,
  expandedKeys,
  onExpand,
  onSelect,
  onOpenGraphModal
}) => {
  const intl = useIntl();

  const treeData = React.useMemo(() => {
    if (filteredData.length === 0) {
      return [];
    }
    
    return filteredData.map(({ chainIndex, calls, originalLength }) => {
      const root = { children: [] };
      const stack: any[] = [root];
      let nodeId = 0;

      calls.forEach((call) => {
        const currentNodeId = `${chainIndex}-${nodeId++}`;
        const parent = stack[stack.length - 1];

        const nodeData = {
          key: currentNodeId,
          title: (
            <div 
              onClick={() => onSelect({ chainIndex: call.chainIndex, callIndex: call.callIndex })} 
              className={`flex items-center gap-3 py-0 px-2 rounded cursor-pointer transition-colors w-full ${selectedCall?.chainIndex === call.chainIndex && selectedCall?.callIndex === call.callIndex ? 'bg-blue-100 border-l-2 border-blue-500' : 'hover:bg-gray-100 border-l-2 border-transparent'}`}
            >
              <div className="flex items-center gap-3">
                {call.isReturn ? <ArrowLeft size={16} className="text-red-500" /> : <Play size={16} className="text-green-500" />}
                <span className={`text-xs font-medium ${call.isReturn ? 'text-red-600' : 'text-green-600'}`}>{call.callType}</span>
                <code className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-sm font-medium">{call.funcName}</code>
              </div>
              <div className="ml-auto flex items-center gap-6 text-xs text-slate-500 min-w-max">
                <span className="flex items-center gap-1"><Clock size={12} />{formatTime(call.timestamp)}</span>
                <span className="flex items-center gap-1"><Hash size={12} />{call.funcId}</span>
              </div>
            </div>
          ),
          children: [],
          callData: call,
        };
        
        // Add the node to its parent's children
        if (parent) {
            parent.children.push(nodeData);
        }

        // If it's a CALL, push it onto the stack to become the new parent
        if (!call.isReturn) {
          stack.push(nodeData);
        } else {
          // If it's a RETURN, and the stack has more than the root, pop the corresponding CALL
          if (stack.length > 1) {
            stack.pop();
          }
        }
      });
      
      return {
        key: `chain-${chainIndex}`,
        title: (
           <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-blue-700 font-semibold mr-4">
              <span className="text-sm">{intl.formatMessage({ id: 'FunctionCallChainViewer.chainTitle' }, { chainIndex: chainIndex + 1 })}</span>
              {calls.length > 0 && <span className="text-amber-700 text-xs font-normal">{intl.formatMessage({ id: 'FunctionCallChainViewer.threadId' }, { threadId: calls[0]?.threadId })}</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 bg-blue-50 px-2 py-0.5 rounded">
                {intl.formatMessage({ id: 'FunctionCallChainViewer.callCountInChain' }, { callCount: calls.length, originalLength: originalLength })}
              </div>
              <Button
                className="text-xs" size="small" type="text" icon={<BarChart2 size={14} />}
                onClick={(e) => { e.stopPropagation(); onOpenGraphModal(chainIndex); }}
                title={intl.formatMessage({ id: 'FunctionCallChainViewer.viewChainGraphTooltip' }, { chainIndex: chainIndex + 1 })}
              >
                {intl.formatMessage({ id: 'FunctionCallChainViewer.viewGraph' })}
              </Button>
            </div>
          </div>
        ),
        children: root.children,
        selectable: false,
      };
    });
  }, [filteredData, selectedCall, intl, onSelect, onOpenGraphModal]);

  if (filteredData.length === 0) {
      return (
          <div className="flex items-center justify-center h-full text-slate-500 bg-white border border-gray-200 rounded-md p-4">
              <Empty description={intl.formatMessage({ id: 'FunctionCallChainViewer.noFilteredData' })} />
          </div>
      );
  }

  return (
    <div className="min-w-[700px]">
      <ConfigProvider theme={{ components: { Tree: { nodeHoverBg: 'transparent', nodeSelectedBg: 'transparent' } } }}>
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={onExpand}
          showLine={{ showLeafIcon: false }}
          className="bg-white border border-gray-200 rounded-md p-4"
        />
      </ConfigProvider>
    </div>
  );
};

export default CallChainTree;