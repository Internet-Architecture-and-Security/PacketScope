// /FunctionCallChainViewer/types.ts

export interface QueryParams {
  srcip: string;
  dstip: string;
  srcport: number;
  dstport: number;
  count?: number;
}

export interface FuncInfo {
  name: string;
  kind: string;
  type_id: number;
  linkage: string;
}

export interface FuncTable {
  [id: number]: FuncInfo;
}

export type Call = [number, number, number, number]; // [timestamp, isReturn, funcId, threadId]

export interface ProcessedCall {
  timestamp: number;
  isReturn: boolean;
  funcId: number;
  threadId: number;
  funcName: string;
  callType: 'CALL' | 'RETURN';
  depth: number;
  callIndex: number;
  chainIndex: number;
}

export interface SelectedCall {
  chainIndex: number;
  callIndex: number;
}